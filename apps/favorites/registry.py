from typing import Any, Protocol


class FavoriteTargetAdapter(Protocol):
    target_type: str

    def normalize_target_id(self, target_id: str | int) -> str | None: ...

    def get_collectible_target(self, target_id: str) -> Any | None: ...

    def get_visible_targets(self, target_ids: list[str]) -> dict[str, Any]: ...

    def serialize_target(self, target: Any) -> dict[str, Any]: ...

    def on_favorited(self, target: Any, user: Any) -> None: ...


_adapters: dict[str, FavoriteTargetAdapter] = {}


def register_target_adapter(adapter: FavoriteTargetAdapter) -> None:
    if adapter.target_type in _adapters:
        raise ValueError(f"收藏目标类型重复注册：{adapter.target_type}")
    _adapters[adapter.target_type] = adapter


def get_target_adapter(target_type: str) -> FavoriteTargetAdapter | None:
    return _adapters.get(target_type)


def get_target_types() -> tuple[str, ...]:
    return tuple(_adapters)
