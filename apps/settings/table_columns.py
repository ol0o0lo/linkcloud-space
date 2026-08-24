import json
import math
import re
from collections.abc import Mapping

from django.db import transaction

from apps.settings.models import UserSetting

USER_TABLE_COLUMNS_SETTING_KEY = "internal.ui.table_columns"

MAX_KEY_LENGTH = 100
MAX_COLUMNS_PER_TABLE = 200
MAX_SETTING_BYTES = 256 * 1024
KEY_PATTERN = re.compile(r"^[a-z0-9][a-z0-9._-]{0,99}$")
ALLOWED_COLUMN_STATE_FIELDS = {"show", "fixed", "order"}


class TableColumnsValidationError(ValueError):
    pass


def _validate_key(value: str, label: str) -> None:
    if not isinstance(value, str) or len(value) > MAX_KEY_LENGTH or not KEY_PATTERN.fullmatch(value):
        raise TableColumnsValidationError(f"{label} 格式不合法")


def normalize_table_columns_state(value: Mapping) -> dict[str, dict]:
    if not isinstance(value, Mapping):
        raise TableColumnsValidationError("表头设置必须是对象")
    if len(value) > MAX_COLUMNS_PER_TABLE:
        raise TableColumnsValidationError("单个列表最多保存 200 列")

    normalized: dict[str, dict] = {}
    for column_key, raw_state in value.items():
        _validate_key(column_key, "列 key")
        if not isinstance(raw_state, Mapping):
            raise TableColumnsValidationError("列状态必须是对象")

        unknown_fields = set(raw_state) - ALLOWED_COLUMN_STATE_FIELDS
        if unknown_fields:
            raise TableColumnsValidationError("列状态包含不支持的字段")

        state: dict = {}
        if "show" in raw_state:
            show = raw_state["show"]
            if not isinstance(show, bool):
                raise TableColumnsValidationError("show 必须是布尔值")
            state["show"] = show

        if "fixed" in raw_state:
            fixed = raw_state["fixed"]
            if fixed is not None and fixed not in {"left", "right"}:
                raise TableColumnsValidationError("fixed 只能是 left、right 或 null")
            state["fixed"] = fixed

        if "order" in raw_state:
            order = raw_state["order"]
            if isinstance(order, bool) or not isinstance(order, int | float) or not math.isfinite(order):
                raise TableColumnsValidationError("order 必须是有限数字")
            state["order"] = order

        normalized[column_key] = state

    return normalized


def _validate_setting_size(value: dict) -> None:
    size = len(json.dumps(value, ensure_ascii=False, separators=(",", ":")).encode("utf-8"))
    if size > MAX_SETTING_BYTES:
        raise TableColumnsValidationError("表头个人设置不能超过 256 KiB")


def _lock_user(user) -> None:
    user.__class__._default_manager.select_for_update().get(pk=user.pk)


def set_user_table_columns(user, table_key: str, value: Mapping) -> dict[str, dict]:
    _validate_key(table_key, "table_key")
    normalized = normalize_table_columns_state(value)

    with transaction.atomic():
        _lock_user(user)
        setting, _ = UserSetting.objects.get_or_create(
            user=user,
            key=USER_TABLE_COLUMNS_SETTING_KEY,
            defaults={"value": {}},
        )
        setting = UserSetting.objects.select_for_update().get(pk=setting.pk)
        all_tables = dict(setting.value) if isinstance(setting.value, dict) else {}
        all_tables[table_key] = normalized
        _validate_setting_size(all_tables)
        setting.value = all_tables
        setting.save(update_fields=["value", "updated_at"])

    return normalized


def delete_user_table_columns(user, table_key: str) -> None:
    _validate_key(table_key, "table_key")

    with transaction.atomic():
        _lock_user(user)
        setting = UserSetting.objects.select_for_update().filter(user=user, key=USER_TABLE_COLUMNS_SETTING_KEY).first()
        if setting is None:
            return

        all_tables = dict(setting.value) if isinstance(setting.value, dict) else {}
        all_tables.pop(table_key, None)
        if not all_tables:
            setting.delete()
            return

        setting.value = all_tables
        setting.save(update_fields=["value", "updated_at"])
