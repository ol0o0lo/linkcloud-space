from collections import defaultdict
from collections.abc import Iterable
from typing import Any

from django.db.models import Count

from apps.favorites.models import Favorite
from apps.favorites.registry import get_target_adapter, get_target_adapters, get_target_types


class FavoriteTargetTypeUnsupported(ValueError):
    pass


class FavoriteTargetNotFound(ValueError):
    pass


def ensure_target_type_supported(target_type: str):
    adapter = get_target_adapter(target_type)
    if adapter is None:
        raise FavoriteTargetTypeUnsupported(target_type)
    return adapter


def get_favorites(user, *, target_type: str | None = None, target_id: str | int | None = None):
    queryset = Favorite.objects.filter(user=user)
    if target_type is not None:
        adapter = ensure_target_type_supported(target_type)
        queryset = queryset.filter(target_type=target_type)
        if target_id is not None:
            normalized_id = adapter.normalize_target_id(target_id)
            queryset = queryset.filter(target_id=normalized_id) if normalized_id is not None else queryset.none()
    else:
        queryset = queryset.filter(target_type__in=get_target_types())
    return queryset.order_by("-created_at", "-pk")


def get_favorite_target_types(user) -> list[dict[str, Any]]:
    adapters = get_target_adapters()
    counts = {
        row["target_type"]: row["favorite_count"]
        for row in Favorite.objects.filter(
            user=user,
            target_type__in=[adapter.target_type for adapter in adapters],
        )
        .values("target_type")
        .annotate(favorite_count=Count("id"))
    }
    return [
        {
            "target_type": adapter.target_type,
            "display_name": adapter.display_name,
            "order": adapter.order,
            "favorite_count": counts.get(adapter.target_type, 0),
        }
        for adapter in adapters
    ]


def _serialize_target(adapter, target: Any) -> tuple[dict[str, Any], dict[str, Any]]:
    serialized_target = adapter.serialize_target(target)
    return serialized_target, adapter.serialize_display(target, serialized_target)


def resolve_favorites(favorites: Iterable[Favorite]) -> list[dict[str, Any]]:
    favorite_list = list(favorites)
    ids_by_type: dict[str, list[str]] = defaultdict(list)
    for favorite in favorite_list:
        ids_by_type[favorite.target_type].append(favorite.target_id)

    targets_by_type: dict[str, dict[str, Any]] = {}
    for target_type, target_ids in ids_by_type.items():
        adapter = get_target_adapter(target_type)
        targets_by_type[target_type] = adapter.get_visible_targets(target_ids) if adapter else {}

    resolved: list[dict[str, Any]] = []
    for favorite in favorite_list:
        adapter = get_target_adapter(favorite.target_type)
        target = targets_by_type[favorite.target_type].get(favorite.target_id)
        serialized_target, display = _serialize_target(adapter, target) if adapter and target is not None else (None, None)
        resolved.append(
            {
                "id": favorite.pk,
                "target_type": favorite.target_type,
                "target_id": favorite.target_id,
                "created_at": favorite.created_at,
                "available": target is not None,
                "display": display,
                "target": serialized_target,
            }
        )
    return resolved


def serialize_favorite(favorite: Favorite, target: Any) -> dict[str, Any]:
    adapter = ensure_target_type_supported(favorite.target_type)
    serialized_target, display = _serialize_target(adapter, target)
    return {
        "id": favorite.pk,
        "target_type": favorite.target_type,
        "target_id": favorite.target_id,
        "created_at": favorite.created_at,
        "available": True,
        "display": display,
        "target": serialized_target,
    }


def put_favorite(user, *, target_type: str, target_id: str | int) -> tuple[Favorite, Any, bool]:
    adapter = ensure_target_type_supported(target_type)
    normalized_id = adapter.normalize_target_id(target_id)
    target = adapter.get_collectible_target(normalized_id) if normalized_id is not None else None
    if target is None or normalized_id is None:
        raise FavoriteTargetNotFound(f"{target_type}/{target_id}")

    favorite, created = Favorite.objects.get_or_create(user=user, target_type=target_type, target_id=normalized_id)
    return favorite, target, created


def remove_favorite(user, *, target_type: str, target_id: str | int) -> None:
    adapter = ensure_target_type_supported(target_type)
    normalized_id = adapter.normalize_target_id(target_id)
    if normalized_id is None:
        return
    Favorite.objects.filter(user=user, target_type=target_type, target_id=normalized_id).delete()
