from typing import Any

from apps.favorites.registry import register_target_adapter
from apps.house.schemas import FavoriteBuildingTargetOut, FavoriteEstateTargetOut, PublicHouseListOut
from apps.house.services import get_public_buildings_queryset, get_public_estates_queryset, get_public_houses_queryset


class IntegerFavoriteTargetAdapter:
    def normalize_target_id(self, target_id: str | int) -> str | None:
        try:
            value = int(target_id)
        except (TypeError, ValueError):
            return None
        return str(value) if value > 0 else None

    def on_favorited(self, target, user) -> None:
        return None


class HouseFavoriteTargetAdapter(IntegerFavoriteTargetAdapter):
    target_type = "house"

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


class BuildingFavoriteTargetAdapter(IntegerFavoriteTargetAdapter):
    target_type = "building"

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


class EstateFavoriteTargetAdapter(IntegerFavoriteTargetAdapter):
    target_type = "estate"

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


register_target_adapter(HouseFavoriteTargetAdapter())
register_target_adapter(BuildingFavoriteTargetAdapter())
register_target_adapter(EstateFavoriteTargetAdapter())
