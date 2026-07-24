from typing import Any, Protocol, TypedDict


class FavoriteDisplayFact(TypedDict):
    label: str
    value: str


class FavoriteTargetDisplay(TypedDict):
    title: str
    subtitle: str
    cover_url: str | None
    description: str
    tags: list[str]
    facts: list[FavoriteDisplayFact]


class FavoriteTargetAdapter(Protocol):
    target_type: str
    display_name: str
    order: int

    def normalize_target_id(self, target_id: str | int) -> str | None: ...

    def get_collectible_target(self, target_id: str) -> Any | None: ...

    def get_visible_targets(self, target_ids: list[str]) -> dict[str, Any]: ...

    def serialize_target(self, target: Any) -> dict[str, Any]: ...

    def serialize_display(self, target: Any, serialized_target: dict[str, Any]) -> FavoriteTargetDisplay: ...


_adapters: dict[str, FavoriteTargetAdapter] = {}


def register_target_adapter(adapter: FavoriteTargetAdapter) -> None:
    if not adapter.target_type or len(adapter.target_type) > 64:
        raise ValueError("收藏目标类型不能为空且长度不能超过 64 个字符")
    if not adapter.display_name:
        raise ValueError(f"收藏目标类型缺少显示名称：{adapter.target_type}")
    if adapter.target_type in _adapters:
        raise ValueError(f"收藏目标类型重复注册：{adapter.target_type}")
    _adapters[adapter.target_type] = adapter


def get_target_adapter(target_type: str) -> FavoriteTargetAdapter | None:
    return _adapters.get(target_type)


def get_target_adapters() -> tuple[FavoriteTargetAdapter, ...]:
    return tuple(sorted(_adapters.values(), key=lambda adapter: (adapter.order, adapter.target_type)))


def get_target_types() -> tuple[str, ...]:
    return tuple(adapter.target_type for adapter in get_target_adapters())


def unregister_target_adapter(target_type: str) -> None:
    """移除目标适配器，主要供测试和可热插拔的业务模块使用。"""
    _adapters.pop(target_type, None)
