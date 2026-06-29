from collections.abc import Iterable
from typing import Any

from apps.accounts.constants import RealNameLogAction, RealNameProvider, RealNameSource, RealNameStatus


def enum_mapping(enum_cls: Any, value: Any) -> str:
    if value in (None, ""):
        return ""
    return str(enum_cls.get_choice_label(value))


def enum_list_mapping(enum_cls: Any, values: Iterable[Any] | None) -> list[str]:
    return [enum_mapping(enum_cls, value) for value in values or []]


def choice_enum_options(enum_cls: Any) -> list[dict[str, str]]:
    return [{"value": str(value), "mapping": str(label)} for value, label in enum_cls.choices]


ENUM_REGISTRY: dict[str, list[dict[str, str]]] = {
    "accounts.real_name_status": choice_enum_options(RealNameStatus),
    "accounts.real_name_source": choice_enum_options(RealNameSource),
    "accounts.real_name_provider": choice_enum_options(RealNameProvider),
    "accounts.real_name_log_action": choice_enum_options(RealNameLogAction),
    "accounts.admin_user_role": [
        {"value": "superuser", "mapping": "超级管理员"},
        {"value": "staff", "mapping": "后台账号"},
        {"value": "user", "mapping": "普通账号"},
    ],
}


def get_registered_enums() -> dict[str, list[dict[str, str]]]:
    return {key: [*items] for key, items in ENUM_REGISTRY.items()}
