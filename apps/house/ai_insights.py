from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from datetime import timedelta
from decimal import Decimal
from typing import Any, Literal

from django.conf import settings
from django.core.cache import cache
from django.db import transaction
from django.utils import timezone

from pydantic import BaseModel, Field, field_validator
from pydantic import ValidationError as PydanticValidationError

from apps.ai.services import AICapability, AIErrorCode, AIExecutionError, AIRetentionPolicy, ensure_capability_access, generate
from apps.analytics.constants import AnalyticsSource
from apps.analytics.services import record_event_safely
from apps.house.constants import HouseDecoration, HouseOrientation
from apps.house.formatters import format_house_layout
from apps.house.models import House, HouseAIInsight

HOUSE_AI_INSIGHT_PROMPT_KEY = "house.public_insight"
HOUSE_AI_INSIGHT_SCHEMA_VERSION = 3
HOUSE_AI_INSIGHT_MINIMUM_INFORMATION_COUNT = 3
HOUSE_AI_INSIGHT_LOCK_SECONDS = 120


class HouseAIInsightBusyError(Exception):
    pass


class HouseAIInsightInsufficientDataError(Exception):
    pass


class GeneratedInsightText(BaseModel):
    text: str = Field(min_length=1, max_length=320)
    fact_ids: list[str] = Field(min_length=1, max_length=8)

    @field_validator("text")
    @classmethod
    def normalize_text(cls, value: str) -> str:
        return " ".join(value.split())


class GeneratedInsightSignal(BaseModel):
    label: str = Field(min_length=1, max_length=12)
    value: str = Field(min_length=1, max_length=80)
    tone: Literal["positive", "neutral", "caution"]
    fact_ids: list[str] = Field(min_length=1, max_length=5)

    @field_validator("label", "value")
    @classmethod
    def normalize_text(cls, value: str) -> str:
        return " ".join(value.split())


class GeneratedAppealPoint(BaseModel):
    text: str = Field(min_length=1, max_length=180)
    fact_ids: list[str] = Field(min_length=1, max_length=5)

    @field_validator("text")
    @classmethod
    def normalize_text(cls, value: str) -> str:
        return " ".join(value.split())


class GeneratedViewingQuestion(BaseModel):
    text: str = Field(min_length=1, max_length=180)
    fact_ids: list[str] = Field(default_factory=list, max_length=5)
    missing_field_keys: list[str] = Field(default_factory=list, max_length=5)

    @field_validator("text")
    @classmethod
    def normalize_text(cls, value: str) -> str:
        return " ".join(value.split())


class GeneratedHouseAIInsight(BaseModel):
    conclusion: GeneratedInsightText
    signals: list[GeneratedInsightSignal] = Field(min_length=2, max_length=3)
    appeal_points: list[GeneratedAppealPoint] = Field(max_length=2)
    viewing_questions: list[GeneratedViewingQuestion] = Field(min_length=1, max_length=3)


@dataclass(frozen=True, slots=True)
class HousePublicSnapshot:
    facts: list[dict[str, str]]
    missing_fields: list[dict[str, str]]
    snapshot_hash: str
    information_count: int


def _format_decimal(value: Decimal) -> str:
    normalized = format(value.normalize(), "f")
    return normalized.rstrip("0").rstrip(".") if "." in normalized else normalized


def _format_money(value: Decimal) -> str:
    number = f"{value:,.2f}"
    return number.rstrip("0").rstrip(".")


def _compact_text(value: str, *, max_length: int = 2000) -> str:
    normalized = " ".join((value or "").split())
    return normalized if len(normalized) <= max_length else f"{normalized[: max_length - 1]}…"


def _add_fact(facts: list[dict[str, str]], fact_id: str, label: str, value: str | None) -> None:
    if value:
        facts.append({"id": fact_id, "label": label, "value": value})


def build_house_public_snapshot(house: House) -> HousePublicSnapshot:
    facts: list[dict[str, str]] = []
    missing_fields: list[dict[str, str]] = []
    estate = house.building.estate
    location_parts = [estate.display_name or estate.name if estate else "", house.building.name]

    _add_fact(facts, "location", "位置", " · ".join(part for part in location_parts if part))
    _add_fact(facts, "address", "公开地址", house.building.address)
    _add_fact(facts, "room_number", "房号", house.room_number)
    _add_fact(facts, "rent", "挂牌租金", f"¥{_format_money(house.asking_rent)}/月" if house.asking_rent is not None else None)
    _add_fact(facts, "deposit", "押金", f"¥{_format_money(house.deposit_amount)}" if house.deposit_amount is not None else None)
    _add_fact(facts, "layout", "户型", format_house_layout(house.bedrooms, house.living_rooms))
    _add_fact(facts, "area", "建筑面积", f"{_format_decimal(house.area)}㎡" if house.area is not None else None)
    _add_fact(facts, "interior_area", "套内面积", f"{_format_decimal(house.interior_area)}㎡" if house.interior_area is not None else None)
    _add_fact(facts, "floor", "楼层", f"{house.floor}层" if house.floor is not None else None)
    _add_fact(facts, "bathrooms", "卫生间", f"{house.bathrooms}卫" if house.bathrooms is not None else None)
    _add_fact(facts, "kitchens", "厨房", f"{house.kitchens}厨" if house.kitchens is not None else None)
    _add_fact(facts, "balconies", "阳台", f"{house.balconies}个" if house.balconies is not None else None)
    _add_fact(facts, "elevator", "电梯", "可使用电梯" if house.has_elevator_access else "不可使用电梯")
    _add_fact(facts, "orientation", "朝向", HouseOrientation.get_choice_label(house.orientation) if house.orientation else None)
    _add_fact(facts, "decoration", "装修", HouseDecoration.get_choice_label(house.decoration) if house.decoration else None)
    _add_fact(facts, "tags", "公开标签", "、".join(house.effective_tags))
    _add_fact(facts, "public_description", "对外描述", _compact_text(house.public_description))
    _add_fact(facts, "images", "房源图片", f"{len(house.images or [])}张" if house.images else None)
    _add_fact(facts, "videos", "房源视频", f"{len(house.videos or [])}个" if house.videos else None)

    missing_definitions = (
        ("rent", "挂牌租金", house.asking_rent is None),
        ("deposit", "押金", house.deposit_amount is None),
        ("layout", "户型", not format_house_layout(house.bedrooms, house.living_rooms)),
        ("area", "建筑面积", house.area is None),
        ("floor", "楼层", house.floor is None),
        ("orientation", "朝向", not house.orientation),
        ("decoration", "装修", not house.decoration),
        ("public_description", "对外描述", not house.public_description.strip()),
        ("images", "房源图片", not house.images),
        ("videos", "房源视频", not house.videos),
    )
    missing_fields.extend({"key": key, "label": label} for key, label, missing in missing_definitions if missing)

    information_count = sum(
        (
            house.asking_rent is not None,
            bool(format_house_layout(house.bedrooms, house.living_rooms)),
            house.area is not None,
            bool(house.decoration),
            bool(house.orientation),
            bool(house.effective_tags),
            bool(house.public_description.strip()),
        )
    )
    encoded = json.dumps({"facts": facts, "missing_fields": missing_fields}, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()
    return HousePublicSnapshot(facts=facts, missing_fields=missing_fields, snapshot_hash=hashlib.sha256(encoded).hexdigest(), information_count=information_count)


def _normalize_stored_content(insight: HouseAIInsight) -> dict[str, Any]:
    content = dict(insight.content)
    if "conclusion" in content:
        content["signals"] = [{**item, "tone": item.get("tone", "neutral"), "fact_ids": item.get("fact_ids", [])} for item in content.get("signals", []) if isinstance(item, dict)]
        content["appeal_points"] = [{**item, "fact_ids": item.get("fact_ids", [])} for item in content.get("appeal_points", []) if isinstance(item, dict)]
        content["viewing_questions"] = [
            {
                **item,
                "fact_ids": item.get("fact_ids", []),
                "missing_field_keys": item.get("missing_field_keys", []),
            }
            for item in content.get("viewing_questions", [])
            if isinstance(item, dict)
        ]
        return content

    signals: list[dict[str, Any]] = []
    appeal_points: list[dict[str, Any]] = []
    for item in content.get("highlights", []):
        if not isinstance(item, dict):
            continue
        kind = item.get("kind", "insight")
        if kind == "highlight" and len(appeal_points) < 2:
            appeal_points.append({"text": item.get("text", ""), "fact_ids": item.get("fact_ids", [])})
        elif len(signals) < 3:
            signals.append(
                {
                    "label": "注意事项" if kind == "risk" else "重点信息",
                    "value": item.get("text", ""),
                    "tone": "caution" if kind == "risk" else "neutral",
                    "fact_ids": item.get("fact_ids", []),
                }
            )
    viewing_questions = []
    for item in content.get("verification_items", []):
        text = item.get("text", "") if isinstance(item, dict) else str(item)
        viewing_questions.append({"text": text, "fact_ids": [], "missing_field_keys": []})
    return {
        "conclusion": content.get("summary", {"text": "", "fact_ids": []}),
        "signals": signals,
        "appeal_points": appeal_points,
        "viewing_questions": viewing_questions[:3],
    }


def _serialize_insight(insight: HouseAIInsight | None, snapshot: HousePublicSnapshot) -> dict[str, Any]:
    if insight is None:
        return {
            "state": "not_generated",
            "insight": None,
            "generated_at": None,
            "expires_at": None,
            "source_changed": False,
        }
    state = "fresh" if insight.schema_version == HOUSE_AI_INSIGHT_SCHEMA_VERSION and insight.expires_at > timezone.now() else "expired"
    return {
        "state": state,
        "insight": {
            "schema_version": insight.schema_version,
            **_normalize_stored_content(insight),
            "missing_fields": insight.missing_fields,
            "facts": insight.source_facts,
        },
        "generated_at": insight.generated_at,
        "expires_at": insight.expires_at,
        "source_changed": insight.source_snapshot_hash != snapshot.snapshot_hash,
    }


def _track(event_name: str, *, actor, house: House, properties: dict[str, Any] | None = None) -> None:
    record_event_safely(
        event_name,
        target_type="house",
        target_id=house.pk,
        organization=house.organization,
        actor=actor,
        source=AnalyticsSource.ADMIN,
        properties={"page": "admin_house_detail", **(properties or {})},
    )


def _validate_generated_content(data: dict[str, Any] | None, valid_fact_ids: set[str], valid_missing_field_keys: set[str]) -> dict[str, Any]:
    try:
        generated = GeneratedHouseAIInsight.model_validate(data)
    except PydanticValidationError as exc:
        raise AIExecutionError(AIErrorCode.STRUCTURED_OUTPUT_INVALID, "AI 返回的房源洞察结构无效。") from exc
    referenced_ids = set(generated.conclusion.fact_ids)
    for signal in generated.signals:
        referenced_ids.update(signal.fact_ids)
    for appeal_point in generated.appeal_points:
        referenced_ids.update(appeal_point.fact_ids)
    referenced_missing_field_keys: set[str] = set()
    for question in generated.viewing_questions:
        if not question.fact_ids and not question.missing_field_keys:
            raise AIExecutionError(AIErrorCode.STRUCTURED_OUTPUT_INVALID, "AI 返回了没有事实或缺失字段依据的看房问题。")
        referenced_ids.update(question.fact_ids)
        referenced_missing_field_keys.update(question.missing_field_keys)
    if unknown_ids := sorted(referenced_ids - valid_fact_ids):
        raise AIExecutionError(AIErrorCode.STRUCTURED_OUTPUT_INVALID, f"AI 返回了未知的事实引用：{', '.join(unknown_ids)}。")
    if unknown_keys := sorted(referenced_missing_field_keys - valid_missing_field_keys):
        raise AIExecutionError(AIErrorCode.STRUCTURED_OUTPUT_INVALID, f"AI 返回了未知的缺失字段引用：{', '.join(unknown_keys)}。")
    return generated.model_dump(mode="json")


def get_house_ai_insight(*, actor, organization, house: House) -> dict[str, Any]:
    ensure_capability_access(actor=actor, organization=organization, capability=AICapability.STRUCTURED_EXTRACT)
    snapshot = build_house_public_snapshot(house)
    insight = HouseAIInsight.objects.filter(house=house).first()
    payload = _serialize_insight(insight, snapshot)
    _track(
        "house.ai_insight.loaded",
        actor=actor,
        house=house,
        properties={"state": payload["state"], "source_changed": payload["source_changed"]},
    )
    return payload


def generate_house_ai_insight(*, actor, organization, house: House) -> dict[str, Any]:
    ensure_capability_access(actor=actor, organization=organization, capability=AICapability.STRUCTURED_EXTRACT)
    _track("house.ai_insight.generate_requested", actor=actor, house=house)
    snapshot = build_house_public_snapshot(house)
    existing = HouseAIInsight.objects.filter(house=house).first()
    if existing is not None and existing.schema_version == HOUSE_AI_INSIGHT_SCHEMA_VERSION and existing.expires_at > timezone.now():
        _track("house.ai_insight.cache_hit", actor=actor, house=house)
        return _serialize_insight(existing, snapshot)

    lock_key = f"house-ai-insight:{house.pk}:generating"
    if not cache.add(lock_key, str(getattr(actor, "pk", "system")), timeout=HOUSE_AI_INSIGHT_LOCK_SECONDS):
        raise HouseAIInsightBusyError("该房源的租房速览正在生成，请稍后重试。")

    try:
        existing = HouseAIInsight.objects.filter(house=house).first()
        if existing is not None and existing.schema_version == HOUSE_AI_INSIGHT_SCHEMA_VERSION and existing.expires_at > timezone.now():
            _track("house.ai_insight.cache_hit", actor=actor, house=house)
            return _serialize_insight(existing, snapshot)
        if snapshot.information_count < HOUSE_AI_INSIGHT_MINIMUM_INFORMATION_COUNT:
            missing_labels = "、".join(item["label"] for item in snapshot.missing_fields[:5])
            raise HouseAIInsightInsufficientDataError(f"公开资料不足，请先补充租金、户型、面积、装修、朝向、标签或对外描述中的至少三类信息。当前可优先补充：{missing_labels}。")

        try:
            result = generate(
                actor=actor,
                organization=organization,
                capability=AICapability.STRUCTURED_EXTRACT,
                prompt_key=HOUSE_AI_INSIGHT_PROMPT_KEY,
                variables={
                    "facts_json": json.dumps(snapshot.facts, ensure_ascii=False),
                    "missing_fields_json": json.dumps(snapshot.missing_fields, ensure_ascii=False),
                },
                response_model=GeneratedHouseAIInsight,
                source_app="house.ai_insight",
                target_type="house",
                target_id=str(house.pk),
                retention_policy=AIRetentionPolicy.METADATA_ONLY,
                safe_summary={"house_id": house.pk, "fact_count": len(snapshot.facts)},
            )
            content = _validate_generated_content(
                result.data,
                {item["id"] for item in snapshot.facts},
                {item["key"] for item in snapshot.missing_fields},
            )
        except AIExecutionError as exc:
            _track("house.ai_insight.failed", actor=actor, house=house, properties={"error_code": exc.code.value})
            raise

        generated_at = timezone.now()
        expires_at = generated_at + timedelta(hours=settings.HOUSE_AI_INSIGHT_CACHE_HOURS)
        with transaction.atomic():
            insight, _created = HouseAIInsight.objects.update_or_create(
                house=house,
                defaults={
                    "invocation_id": result.invocation_id,
                    "schema_version": HOUSE_AI_INSIGHT_SCHEMA_VERSION,
                    "content": content,
                    "source_facts": snapshot.facts,
                    "missing_fields": snapshot.missing_fields,
                    "source_snapshot_hash": snapshot.snapshot_hash,
                    "generated_at": generated_at,
                    "expires_at": expires_at,
                },
            )
        _track("house.ai_insight.generated", actor=actor, house=house)
        return _serialize_insight(insight, snapshot)
    finally:
        cache.delete(lock_key)
