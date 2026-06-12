# Spec: 枚举/常量统一迁移到 per-app `constants.py`

**日期**: 2026-05-24  
**状态**: 已归档

## 背景

项目中枚举定义分散：有的在 `enums.py`，有的直接写在 `models.py` 内部。这会引发循环引用风险，也不利于统一查找常量。

## 目标

每个 app 下只保留一个 `constants.py`，作为该 app 所有枚举和常量的唯一出处。`models.py`、`services.py`、`api.py`、`schemas.py` 均从 `constants.py` 导入，不再各自定义。

## 基础类

`apps/base/constants.py`（由 `apps/base/enums.py` 重命名而来）：

```python
from django.db import models

class StrChoices(models.TextChoices):
    @classmethod
    def get_choice_label(cls, value):
        return cls(value).label if value in cls.values else value

class IntChoices(models.IntegerChoices):
    @classmethod
    def get_choice_label(cls, value):
        return cls(value).label if value in cls.values else value
```

## 迁移映射

| 当前位置 | 迁移后位置 | 操作 |
|---|---|---|
| `apps/base/enums.py` | `apps/base/constants.py` | 重命名 |
| `apps/media/enums.py` | `apps/media/constants.py` | 重命名 |
| `apps/settings/models.py` → `ValueType` | `apps/settings/constants.py` | 提取 |
| `apps/notifications/constants.py` | 无变化（已正确命名） | 更新导入源 |

## 受影响的导入

- `apps/base/tests/test_enums.py` → `from apps.base.constants import StrChoices, IntChoices`
- `apps/media/services.py` → `from apps.media.constants import MediaScope, MediaExtension`
- `apps/media/schemas.py` → `from apps.media.constants import MediaScope`
- `apps/media/api.py` → `from apps.media.constants import MediaScope`
- `apps/media/tests/test_enums.py` → `from apps.media.constants import MediaScope, MediaExtension`
- `apps/settings/models.py` → `from apps.settings.constants import ValueType`
- `apps/settings/service.py` → `from apps.settings.constants import ValueType`（若已改）
- `apps/notifications/constants.py` → `from apps.base.constants import StrChoices`

## 约定

- 所有新枚举优先继承 `StrChoices` 或 `IntChoices`
- `constants.py` 只放枚举和纯常量（无模型、无业务逻辑）
- 跨 app 依赖仅允许从 `apps.base.constants` 导入基础类，不允许从其他 app 的 `constants.py` 导入
