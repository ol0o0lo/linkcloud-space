from decimal import Decimal, InvalidOperation
from typing import Any

from apps.favorites.registry import FavoriteTargetDisplay, get_target_adapter, register_target_adapter
from apps.favorites.targets import IntegerFavoriteTargetAdapter
from apps.house.schemas import FavoriteBuildingTargetOut, FavoriteEstateTargetOut, PublicHouseListOut
from apps.house.services import get_public_buildings_queryset, get_public_estates_queryset, get_public_houses_queryset


def _cover_url(serialized_target: dict[str, Any]) -> str | None:
    images = serialized_target.get("images") or []
    if not images or not isinstance(images[0], dict):
        return None
    return images[0].get("thumbnail") or images[0].get("url")


def _format_number(value: Any) -> str:
    try:
        number = Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        return str(value)
    return format(number.normalize(), "f")


def _house_layout(serialized_target: dict[str, Any]) -> str:
    bedrooms = serialized_target.get("bedrooms")
    living_rooms = serialized_target.get("living_rooms")
    if bedrooms == 1 and living_rooms == 0:
        return "单间"
    if bedrooms is None and living_rooms is None:
        return ""
    return f"{bedrooms or 0}室{living_rooms or 0}厅"


class HouseFavoriteTargetAdapter(IntegerFavoriteTargetAdapter):
    target_type = "house"
    display_name = "房源"
    order = 10

    def get_collectible_target(self, target_id: str):
        normalized_id = self.normalize_target_id(target_id)
        if normalized_id is None:
            return None
        return get_public_houses_queryset().filter(pk=int(normalized_id)).first()

    def get_visible_targets(self, target_ids: list[str]) -> dict[str, Any]:
        normalized_ids = {normalized for target_id in target_ids if (normalized := self.normalize_target_id(target_id)) is not None}
        houses = get_public_houses_queryset().filter(pk__in=[int(target_id) for target_id in normalized_ids])
        return {str(house.pk): house for house in houses}

    def serialize_target(self, target) -> dict[str, Any]:
        return PublicHouseListOut.model_validate(target).model_dump(mode="json")

    def serialize_display(self, target, serialized_target: dict[str, Any]) -> FavoriteTargetDisplay:
        building = serialized_target["building"]
        estate = building.get("estate") or {}
        facts = []
        if asking_rent := serialized_target.get("asking_rent"):
            facts.append({"label": "月租", "value": f"¥{_format_number(asking_rent)}"})
        if area := serialized_target.get("area"):
            facts.append({"label": "面积", "value": f"{_format_number(area)}㎡"})
        if layout := _house_layout(serialized_target):
            facts.append({"label": "户型", "value": layout})
        return {
            "title": f"{building['name']} · {serialized_target['room_number']}",
            "subtitle": estate.get("display_name") or estate.get("name") or building.get("address", ""),
            "cover_url": _cover_url(serialized_target),
            "description": serialized_target.get("public_description", ""),
            "tags": serialized_target.get("effective_tags") or serialized_target.get("tags") or [],
            "facts": facts,
        }


class BuildingFavoriteTargetAdapter(IntegerFavoriteTargetAdapter):
    target_type = "building"
    display_name = "楼栋"
    order = 20

    def get_collectible_target(self, target_id: str):
        normalized_id = self.normalize_target_id(target_id)
        if normalized_id is None:
            return None
        return get_public_buildings_queryset().filter(pk=int(normalized_id)).first()

    def get_visible_targets(self, target_ids: list[str]) -> dict[str, Any]:
        normalized_ids = {normalized for target_id in target_ids if (normalized := self.normalize_target_id(target_id)) is not None}
        buildings = get_public_buildings_queryset().filter(pk__in=[int(target_id) for target_id in normalized_ids])
        return {str(building.pk): building for building in buildings}

    def serialize_target(self, target) -> dict[str, Any]:
        return FavoriteBuildingTargetOut.model_validate(target).model_dump(mode="json")

    def serialize_display(self, target, serialized_target: dict[str, Any]) -> FavoriteTargetDisplay:
        estate = serialized_target.get("estate") or {}
        facts = [{"label": "楼层", "value": f"{serialized_target['floors']}层"}]
        facts.append({"label": "电梯", "value": "有" if serialized_target.get("elevator") else "无"})
        return {
            "title": f"{estate.get('display_name') or estate.get('name') or ''} · {serialized_target['name']}".lstrip(" ·"),
            "subtitle": serialized_target.get("address", ""),
            "cover_url": _cover_url(serialized_target),
            "description": "",
            "tags": serialized_target.get("tags") or [],
            "facts": facts,
        }


class EstateFavoriteTargetAdapter(IntegerFavoriteTargetAdapter):
    target_type = "estate"
    display_name = "小区"
    order = 30

    def get_collectible_target(self, target_id: str):
        normalized_id = self.normalize_target_id(target_id)
        if normalized_id is None:
            return None
        return get_public_estates_queryset().filter(pk=int(normalized_id)).first()

    def get_visible_targets(self, target_ids: list[str]) -> dict[str, Any]:
        normalized_ids = {normalized for target_id in target_ids if (normalized := self.normalize_target_id(target_id)) is not None}
        estates = get_public_estates_queryset().filter(pk__in=[int(target_id) for target_id in normalized_ids])
        return {str(estate.pk): estate for estate in estates}

    def serialize_target(self, target) -> dict[str, Any]:
        return FavoriteEstateTargetOut.model_validate(target).model_dump(mode="json")

    def serialize_display(self, target, serialized_target: dict[str, Any]) -> FavoriteTargetDisplay:
        location = "".join(str(serialized_target.get(field) or "") for field in ("province", "city", "district"))
        return {
            "title": serialized_target.get("display_name") or serialized_target["name"],
            "subtitle": f"{location} {serialized_target.get('address', '')}".strip(),
            "cover_url": _cover_url(serialized_target),
            "description": serialized_target.get("description", ""),
            "tags": [],
            "facts": [],
        }


FAVORITE_TARGET_ADAPTERS = (
    HouseFavoriteTargetAdapter(),
    BuildingFavoriteTargetAdapter(),
    EstateFavoriteTargetAdapter(),
)


def register_favorite_target_adapters() -> None:
    for adapter in FAVORITE_TARGET_ADAPTERS:
        existing = get_target_adapter(adapter.target_type)
        if existing is None:
            register_target_adapter(adapter)
        elif existing is not adapter:
            raise ValueError(f"收藏目标类型已由其他适配器注册：{adapter.target_type}")
