import hashlib
from collections import Counter
from datetime import UTC
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from django.conf import settings
from django.core.exceptions import PermissionDenied, ValidationError
from django.db import transaction
from django.db.models import Count
from django.utils import timezone
from django.utils.dateparse import parse_datetime

from ninja.errors import HttpError

from apps.accounts.models import normalize_phone
from apps.data_migration.conversion import BUSINESS_MODELS, normalized_fields, source_id, target_fingerprint, target_queryset, validate_fields
from apps.data_migration.models import MigrationAsset, MigrationAssetBinding, MigrationBatch, MigrationObjectMapping, MigrationRecord
from apps.data_migration.protocol import PackageError, PackageReader, content_hash
from apps.media.constants import ResourceType
from apps.organizations.models import Organization, OrganizationMember

FINAL_STATES = {"created", "updated", "reused", "skipped", "archived"}


def source_timestamp(value, manifest):
    if value in (None, ""):
        return ""
    try:
        parsed = parse_datetime(str(value))
        if parsed is None:
            raise ValueError
        if timezone.is_naive(parsed):
            parsed = timezone.make_aware(parsed, ZoneInfo(manifest.get("source_timezone", "Asia/Shanghai")))
        return parsed.astimezone(UTC).isoformat(timespec="microseconds")
    except (ValueError, ZoneInfoNotFoundError) as exc:
        raise PackageError("来源业务时间或时区不合法。") from exc


def require_owner(organization, actor):
    if not actor.is_authenticated or not actor.is_active or not organization.is_active or not organization.is_owner(actor):
        raise PermissionDenied("仅当前组织的有效所有者可以执行数据迁移。")


def mapping_identity(batch, record):
    return {
        "organization_id": batch.organization_id,
        "source_instance_id": batch.source_instance_id,
        "source_team_id": batch.source_team_id,
        "entity_type": record.entity_type,
        "source_id": record.source_id,
    }


def create_batch(*, organization, actor, file):
    require_owner(organization, actor)
    digest = hashlib.sha256()
    size = 0
    for chunk in file.chunks():
        size += len(chunk)
        if size > getattr(settings, "DATA_MIGRATION_MAX_PACKAGE_BYTES", 100 * 1024 * 1024):
            raise HttpError(422, "迁移包超过大小限制。")
        digest.update(chunk)
    if not size:
        raise HttpError(422, "迁移文件不能为空。")
    package_hash = digest.hexdigest()
    from apps.data_migration.tasks import enqueue_validation

    with transaction.atomic():
        Organization.objects.select_for_update().get(pk=organization.pk)
        existing = MigrationBatch.objects.filter(organization=organization, package_hash=package_hash).first()
        if existing:
            return existing
        batch = MigrationBatch(organization=organization, created_by=actor, package_hash=package_hash)
        file.seek(0)
        batch.package.save("migration.zip", file, save=False)
        batch.save()
        transaction.on_commit(lambda: enqueue_validation(str(batch.pk)), robust=True)
    return batch


def _resource_type(row):
    if row["field"] == "logo" and row["entity_type"] == "team":
        return ResourceType.ORG_LOGO
    if row["entity_type"] == "houses" and row["field"] in {"images", "videos"}:
        return ResourceType.HOUSE_IMAGE if row["media_type"] == "image" else ResourceType.HOUSE_VIDEO
    if row["entity_type"] == "buildings" and row["field"] == "images":
        return ResourceType.BUILDING_IMAGE
    return ResourceType.LEGACY_ARCHIVE_ASSET


def validate_batch(batch_id):
    """读取和持久化包；任何校验失败回滚该次记录写入。"""
    batch = MigrationBatch.objects.get(pk=batch_id)
    if batch.records.exists():
        return preview_batch(batch, batch.decisions)
    try:
        with transaction.atomic():
            batch = MigrationBatch.objects.select_for_update().get(pk=batch_id)
            if batch.records.exists():
                return batch
            batch.status = MigrationBatch.Status.VALIDATING
            batch.heartbeat_at = timezone.now()
            batch.save(update_fields=["status", "heartbeat_at", "updated_at"])
            with batch.package.open("rb") as file, PackageReader(file) as package:
                manifest = package.manifest
                batch.source_instance_id = manifest["source_instance_id"]
                batch.source_team_id = manifest["source_team_id"]
                batch.source_team_name = manifest["source_team_name"]
                batch.source_export_id = manifest["export_id"]
                batch.manifest = manifest
                batch.save()
                for row in package.records():
                    MigrationRecord.objects.create(
                        batch=batch,
                        entity_type=row["entity_type"],
                        source_id=row["source_id"],
                        data=row["data"],
                        content_hash=content_hash({"data": row["data"], "deleted": row.get("source_deleted", False)}),
                        source_deleted=row.get("source_deleted", False),
                        source_created_at=source_timestamp(row.get("source_created_at"), manifest),
                        source_updated_at=source_timestamp(row.get("source_updated_at"), manifest),
                    )
                for row in package.media():
                    record = batch.records.get(entity_type=row["entity_type"], source_id=row["source_id"])
                    resource_type = _resource_type(row)
                    identity = content_hash({"url": row["source_url"]})
                    asset, _ = MigrationAsset.objects.get_or_create(
                        organization=batch.organization,
                        source_identity=identity,
                        resource_type=resource_type,
                        defaults={"source_url": row["source_url"], "object_key": str(row.get("object_key") or "")[:1024], "media_type": row["media_type"]},
                    )
                    MigrationAssetBinding.objects.create(
                        record=record,
                        asset=asset,
                        field=row["field"],
                        position=row["position"],
                        source_meta={key: row[key] for key in ("field_path", "original_position", "related_field", "original_filename") if key in row},
                    )
        return preview_batch(batch, {})
    except (PackageError, ValidationError, OSError, ValueError) as exc:
        MigrationBatch.objects.filter(pk=batch_id).update(status=MigrationBatch.Status.FAILED, error_message=str(exc)[:2000], heartbeat_at=timezone.now())
        return MigrationBatch.objects.get(pk=batch_id)


def _decisions(payload):
    result = {"overrides": [], "mappings": [], "member_mappings": {}}
    if not isinstance(payload, dict):
        raise HttpError(422, "预检决定必须是对象。")
    for key in ("overrides", "mappings"):
        items = payload.get(key, [])
        if not isinstance(items, list) or len(items) > 100_000:
            raise HttpError(422, "补全或映射格式不合法。")
        for item in items:
            if not isinstance(item, dict) or not isinstance(item.get("entity_type"), str) or not isinstance(item.get("source_id"), str):
                raise HttpError(422, "补全或映射缺少来源标识。")
            if key == "overrides" and not isinstance(item.get("fields"), dict):
                raise HttpError(422, "补全字段必须是对象。")
            if key == "mappings" and type(item.get("target_id")) is not int:
                raise HttpError(422, "目标映射必须为有效编号。")
        result[key] = items
    members = payload.get("member_mappings", {})
    if not isinstance(members, dict) or any(type(value) is not int for value in members.values()):
        raise HttpError(422, "员工映射格式不合法。")
    result["member_mappings"] = {str(key): value for key, value in members.items()}
    try:
        content_hash(result)
    except (ValueError, TypeError) as exc:
        raise HttpError(422, "补全资料包含不合法的数字或数据类型。") from exc
    return result


@transaction.atomic
def preview_batch(batch, payload):
    batch = MigrationBatch.objects.select_for_update().select_related("organization").get(pk=batch.pk)
    if batch.status == MigrationBatch.Status.IMPORTING:
        raise HttpError(409, "导入正在执行，请等待任务完成。")
    decisions = _decisions(payload)
    records = list(batch.records.all())
    if not records and not batch.manifest:
        raise HttpError(409, "文件尚未完成校验。")
    overrides = {(row["entity_type"], row["source_id"]): row["fields"] for row in decisions["overrides"]}
    mappings = {(row["entity_type"], row["source_id"]): row["target_id"] for row in decisions["mappings"]}
    members = {str(member.user_id): member for member in OrganizationMember.objects.filter(organization=batch.organization, user__is_active=True).select_related("user")}
    by_identity = {(record.entity_type, record.source_id): record for record in records}
    known_targets = {}
    issues = []
    plans = []
    unique_keys = {}
    resolved_members = {}

    def issue(record, field, message, code="invalid_field", candidates=None):
        item = {"entity_type": record.entity_type, "source_id": record.source_id, "field": field, "code": code, "message": message}
        if candidates:
            item["candidates"] = candidates
        issues.append(item)

    ordered = sorted(records, key=lambda row: ({"landlords": 0, "buildings": 1, "houses": 2, "staff": 3, "staff_landlord_relations": 4}.get(row.entity_type, 5), row.pk))
    for record in ordered:
        identity = (record.entity_type, record.source_id)
        extra = overrides.get(identity, {})
        plan = {"action": "archive", "fields": {}, "target_id": None}
        if record.source_deleted:
            pass
        elif record.entity_type == "team":
            plan["fields"] = {"apply_name": extra.get("apply_name") is True, "apply_logo": extra.get("apply_logo") is True}
            if plan["fields"]["apply_name"] or plan["fields"]["apply_logo"]:
                plan["organization_version"] = target_fingerprint(batch.organization)
            if plan["fields"]["apply_name"]:
                name = str(record.data.get("team_name") or "").strip()
                if not name or len(name) > 75:
                    issue(record, "team_name", "旧团队名称为空或超过新版组织名称限制。")
                plan["fields"]["name"] = name
        elif record.entity_type == "staff":
            previous_member = MigrationObjectMapping.objects.filter(**mapping_identity(batch, record), target_type="staff").first()
            user_id = decisions["member_mappings"].get(record.source_id, previous_member.target_id if previous_member else None)
            if record.state == "reused" and record.target_type == "staff" and user_id != record.target_id:
                issue(record, "user_id", "该员工已完成绑定，请在现有成员和职责管理中调整。", "already_bound")
            if user_id:
                if str(user_id) not in members:
                    issue(record, "user_id", "员工只能映射到本组织有效成员。", "invalid_mapping")
                else:
                    plan.update(action="reuse", target_id=user_id)
                    resolved_members[record.source_id] = user_id
                    decisions["member_mappings"].setdefault(record.source_id, user_id)
        elif record.entity_type in BUSINESS_MODELS:
            kind = record.entity_type
            qs = target_queryset(kind, batch.organization)
            previous = MigrationObjectMapping.objects.filter(**mapping_identity(batch, record)).first()
            plan["mapping_version"] = content_hash({"target_id": previous.target_id, "source_hash": previous.source_hash}) if previous else None
            target_id = mappings.get(identity, previous.target_id if previous else None)
            target = qs.filter(pk=target_id).first() if target_id else None
            if target_id and target is None:
                issue(
                    record,
                    "target_id",
                    "原目标已不可用，请选择本组织对象或重新创建。",
                    "invalid_mapping",
                    [{"id": 0, "label": "重新创建并补全资料"}] + [{"id": item.pk, "label": str(item)} for item in qs[:20]],
                )
            if previous and target and previous.source_hash == record.content_hash and not extra:
                plan.update(action="skip", target_id=target.pk, target_hash=target_fingerprint(target))
                known_targets[identity] = target.pk
            else:
                fields = normalized_fields(record, extra, records)
                if kind == "houses":
                    dependencies = {"building": source_id(record.data, "building_id", "building"), "landlord": source_id(record.data, "landlordNew_id", "landlordNew")}
                    if not dependencies["landlord"] and "landlord_id" not in extra:
                        old_name, old_phone = str(record.data.get("landlord") or "").strip(), str(record.data.get("phone") or "").strip()
                        if old_name or old_phone:
                            inline = {"name": old_name, "phone": old_phone, "roles": ["landlord"]}
                            inline_errors = validate_fields("landlords", inline)
                            matching_source = next(
                                (
                                    item
                                    for item in records
                                    if item.entity_type == "landlords"
                                    and not item.source_deleted
                                    and item.data.get("name") == old_name
                                    and normalize_phone(item.data.get("phone")) == normalize_phone(old_phone)
                                ),
                                None,
                            )
                            existing_contact = target_queryset("landlords", batch.organization).filter(name=old_name, normalized_phone=normalize_phone(old_phone) or "").first()
                            if matching_source:
                                dependencies["landlord"] = matching_source.source_id
                            elif existing_contact and existing_contact.has_role("landlord"):
                                fields["landlord_id"] = existing_contact.pk
                            elif inline_errors:
                                issue(record, "landlord_id", "旧内嵌房东资料不完整，请选择有效房东或清空关联。", "invalid_inline_contact")
                            else:
                                plan["inline_landlord"] = inline
                    plan["dependencies"] = dependencies
                    for field, dependency_kind in (("building_id", "buildings"), ("landlord_id", "landlords")):
                        old_id = dependencies["building" if field == "building_id" else "landlord"]
                        if field == "landlord_id" and field in extra and extra[field] is None:
                            fields[field] = None
                            dependencies["landlord"] = ""
                        elif fields.get(field):
                            candidate = target_queryset(dependency_kind, batch.organization).filter(pk=fields[field]).first()
                            if candidate is None or (field == "landlord_id" and not candidate.has_role("landlord")):
                                issue(record, field, "关联对象必须属于当前组织。", "invalid_mapping")
                        elif old_id and (dependency_kind, old_id) in known_targets:
                            fields[field] = known_targets[(dependency_kind, old_id)]
                        elif old_id and (dependency_kind, old_id) in by_identity and not by_identity[(dependency_kind, old_id)].source_deleted:
                            pass
                        elif field == "building_id":
                            issue(record, field, "缺少有效楼栋，请补全或选择本组织楼栋。", "missing_reference")
                        elif old_id:
                            issue(record, field, "房东关联无效，请选择本组织房东或清空旧关联。", "missing_reference")
                if target:
                    action = extra.get("migration_action", "keep")
                    if previous and previous.source_hash != record.content_hash and "migration_action" not in extra and identity not in mappings:
                        issue(record, "migration_action", "来源数据有变化，请填写 keep 保留现状或 update 确认更新。", "source_changed")
                    if action not in {"keep", "update"}:
                        issue(record, "migration_action", "请选择 keep 或 update。")
                    plan.update(action="update" if action == "update" else "reuse", target_id=target.pk, target_hash=target_fingerprint(target))
                else:
                    plan["action"] = "create"
                if plan["action"] in {"create", "update"}:
                    for field, message in validate_fields(kind, fields):
                        issue(record, field, message)
                    if kind == "landlords":
                        candidates = qs.filter(name=fields.get("name"), normalized_phone=normalize_phone(fields.get("phone")) or "")
                        unique = (kind, fields.get("name"), normalize_phone(fields.get("phone")))
                    elif kind == "buildings":
                        candidates = qs.filter(name=fields.get("name"), address=fields.get("address"), estate__isnull=True)
                        unique = (kind, fields.get("name"), fields.get("address"))
                    else:
                        building_id = fields.get("building_id")
                        candidates = qs.filter(building_id=building_id, room_number=fields.get("room_number")) if building_id else qs.none()
                        unique = (kind, building_id or plan.get("dependencies", {}).get("building"), fields.get("room_number"))
                    if plan["action"] == "create" and candidates.exists():
                        issue(
                            record,
                            "target_id",
                            "目标组织存在相同资料，请确认复用或修改后新增。",
                            "duplicate_target",
                            [{"id": item.pk, "label": str(item)} for item in candidates[:20]],
                        )
                    if unique in unique_keys and plan["action"] == "create":
                        issue(record, "room_number" if kind == "houses" else "name", f"包内与记录 {unique_keys[unique]} 的业务标识重复，请修正。", "duplicate_source")
                    unique_keys[unique] = record.source_id
                plan["fields"] = fields
                known_targets[identity] = target.pk if target else None
        elif record.entity_type == "staff_landlord_relations":
            staff_id = source_id(record.data, "staff_id", "staff")
            landlord_id = source_id(record.data, "landlord_id", "landlord")
            user_id = resolved_members.get(staff_id)
            if user_id and str(user_id) in members and ("landlords", landlord_id) in by_identity:
                plan.update(action="responsibility", fields={"user_id": user_id}, dependencies={"landlord": landlord_id})
        for key in ("media_originals", "media_expected"):
            if key in record.prepared:
                plan[key] = record.prepared[key]
        if record.state == "archived" and plan["action"] in {"reuse", "responsibility"} and record.entity_type in {"staff", "staff_landlord_relations"}:
            record.state = "pending"
        record.prepared = plan
        record.save(update_fields=["prepared", "state", "updated_at"])
        plans.append({"identity": identity, "plan": plan, "source_hash": record.content_hash})
    if batch.manifest.get("complete") is not True:
        issues.append(
            {"entity_type": "package", "source_id": "", "field": "complete", "code": "incomplete_export", "message": "来源导出存在未解决的归属异常，请在旧版修正后重新导出。"}
        )
    summary = Counter(plan["plan"]["action"] for plan in plans)
    preview = {
        "version": content_hash({"plans": plans, "decisions": decisions, "members": sorted(members)}),
        "summary": {
            "total": len(records),
            "created": summary["create"] + summary["responsibility"],
            "updated": summary["update"],
            "reused": summary["reuse"],
            "skipped": summary["skip"],
            "archived": summary["archive"],
            "failed": len({(item["entity_type"], item["source_id"]) for item in issues}),
            "pending": 0,
        },
        "issues": issues,
        "decisions": decisions,
    }
    batch.preview = preview
    batch.decisions = decisions
    batch.status = MigrationBatch.Status.BLOCKED if issues else MigrationBatch.Status.AWAITING
    batch.error_message = ""
    batch.save()
    return batch


@transaction.atomic
def confirm_batch(batch, *, version):
    Organization.objects.select_for_update().get(pk=batch.organization_id)
    if MigrationBatch.objects.filter(organization_id=batch.organization_id, status=MigrationBatch.Status.IMPORTING).exclude(pk=batch.pk).exists():
        raise HttpError(409, "当前组织有其他导入任务正在执行，请等待完成后重新预检。")
    batch = MigrationBatch.objects.select_for_update().get(pk=batch.pk)
    if batch.status in {MigrationBatch.Status.IMPORTING, MigrationBatch.Status.COMPLETED}:
        return batch
    if batch.status not in {MigrationBatch.Status.AWAITING, MigrationBatch.Status.PARTIAL_FAILED}:
        raise HttpError(409, "请先完成预检并解决阻断项。")
    checked = preview_batch(batch, batch.decisions)
    if checked.preview["version"] != version or checked.preview["issues"]:
        raise HttpError(409, "预检结果或目标数据已变化，请重新预检。")
    checked.status = MigrationBatch.Status.IMPORTING
    checked.heartbeat_at = timezone.now()
    checked.run_token = None
    checked.save(update_fields=["status", "heartbeat_at", "run_token", "updated_at"])
    from apps.data_migration.tasks import enqueue_import

    transaction.on_commit(lambda: enqueue_import(str(checked.pk)), robust=True)
    return checked


def refresh_summary(batch, *, token=None):
    counts = Counter({row["state"]: row["total"] for row in batch.records.values("state").annotate(total=Count("id"))})
    summary = {state: counts[state] for state in ("created", "updated", "reused", "skipped", "archived", "failed", "pending")}
    summary["total"] = sum(counts.values())
    qs = MigrationBatch.objects.filter(pk=batch.pk)
    if token is not None:
        qs = qs.filter(run_token=token)
    qs.update(summary=summary)
    return summary


def batch_assets(batch):
    return MigrationAsset.objects.filter(bindings__record__batch=batch).distinct()


def media_summary(batch):
    assets = batch_assets(batch)
    counts = {row["status"]: row["total"] for row in assets.order_by().values("status").annotate(total=Count("id", distinct=True))}
    detached = batch.records.filter(media_bindings__state="detached", media_bindings__asset__status="succeeded").values("media_bindings__asset_id").distinct().count()
    return {"total": sum(counts.values()), "detached": detached, **{state: counts.get(state, 0) for state in ("pending", "processing", "succeeded", "failed", "missing")}}
