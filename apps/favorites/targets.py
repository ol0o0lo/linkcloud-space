"""
收藏目标适配器的兼容辅助模块。

具体业务适配器应由各业务应用自行实现并在对应 ``AppConfig.ready`` 中注册。
"""


class IntegerFavoriteTargetAdapter:
    def normalize_target_id(self, target_id: str | int) -> str | None:
        try:
            value = int(target_id)
        except (TypeError, ValueError):
            return None
        return str(value) if value > 0 else None
