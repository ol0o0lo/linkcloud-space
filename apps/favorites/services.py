from collections import defaultdict
from collections.abc import Iterable
from typing import Any

from django.db import transaction

from apps.favorites.models import Favorite
from apps.favorites.registry import get_target_adapter, get_target_types


class FavoriteTargetTypeUnsupported(ValueError):
    pass


class FavoriteTargetNotFound(ValueError):
    pass


def ensure_target_type_supported(target_type: str):
    adapter = get_target_adapter(target_type)
    if adapter is None:
        raise FavoriteTargetTypeUnsupported(target_type)
    return adapter


def get_active_favorites(user, *, target_type: str | None = None, target_id: str | int | None = None):
    queryset = Favorite.objects.filter(user=user, is_active=True)
    if target_type is not None:
        adapter = ensure_target_type_supported(target_type)
        queryset = queryset.filter(target_type=target_type)
        if target_id is not None:
            normalized_id = adapter.normalize_target_id(target_id)
            queryset = queryset.filter(target_id=normalized_id) if normalized_id is not None else queryset.none()
    else:
        queryset = queryset.filter(target_type__in=get_target_types())
    return queryset.order_by("-updated_at", "-pk")


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
        resolved.append(
            {
                "id": favorite.pk,
                "target_type": favorite.target_type,
                "target_id": favorite.target_id,
                "created_at": favorite.created_at,
                "available": target is not None,
                "target": adapter.serialize_target(target) if adapter and target is not None else None,
            }
        )
    return resolved


def serialize_favorite(favorite: Favorite, target: Any) -> dict[str, Any]:
    adapter = ensure_target_type_supported(favorite.target_type)
    return {
        "id": favorite.pk,
        "target_type": favorite.target_type,
        "target_id": favorite.target_id,
        "created_at": favorite.created_at,
        "available": True,
        "target": adapter.serialize_target(target),
    }


@transaction.atomic
def put_favorite(user, *, target_type: str, target_id: str | int) -> tuple[Favorite, Any, bool]:
    adapter = ensure_target_type_supported(target_type)
    normalized_id = adapter.normalize_target_id(target_id)
    target = adapter.get_collectible_target(normalized_id) if normalized_id is not None else None
    if target is None or normalized_id is None:
        raise FavoriteTargetNotFound(f"{target_type}/{target_id}")

    favorite, created = Favorite.objects.get_or_create(
        user=user,
        target_type=target_type,
        target_id=normalized_id,
        defaults={"is_active": True},
    )
    reactivated = not created and not favorite.is_active
    if reactivated:
        favorite.is_active = True
        favorite.save(update_fields=["is_active", "updated_at"])
    activated = created or reactivated
    if activated:
        adapter.on_favorited(target, user)
    return favorite, target, activated


def remove_favorite(user, *, target_type: str, target_id: str | int) -> None:
    adapter = ensure_target_type_supported(target_type)
    normalized_id = adapter.normalize_target_id(target_id)
    if normalized_id is None:
        return
    Favorite.objects.filter(user=user, target_type=target_type, target_id=normalized_id, is_active=True).update(is_active=False)
