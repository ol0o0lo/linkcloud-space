# 枚举现代化改造设计

**日期：** 2026-05-24  
**范围：** `apps/base`、`apps/settings`、`apps/media`

## 目标

统一全项目枚举风格，以 Django `TextChoices` 为基础，补齐原 `StructuredEnum` API 习惯，并将两个 app 中的裸字符串常量枚举化。

## 方案选择

采用**方案 A**：`apps/base` 新增 `ChoicesMixin` 增强基类，`apps/settings` 和 `apps/media` 全部枚举化。

## 架构设计

### 1. `apps/base/enums.py`（新建）

提供 `ChoicesMixin`，继承 `models.TextChoices`，补齐以下类方法：

| 方法 | 说明 |
|------|------|
| `get_choices()` | 返回 `cls.choices`（等同 `get_django_choices()`） |
| `get_django_choices()` | 同上，兼容旧 API |
| `get_values()` | 返回 `cls.values` |
| `get_labels()` | 返回 `cls.labels` |
| `get_choice_label(value)` | 按 value 查 label，找不到原样返回 |

- label 写在枚举定义处，自然支持 `gettext_lazy`
- `get_choice_label` 找不到时原样返回 value，与原 `StructuredEnum` 行为一致

### 2. `apps/settings/models.py`

`ValueType` 基类从 `models.TextChoices` 改为 `ChoicesMixin`，无 DB migration。

```
ValueType(ChoicesMixin):
  TEXT / PASSWORD / JSON / BOOLEAN / INTEGER
```

### 3. `apps/settings/service.py`

`_serialize_value` 中的字符串字面量 `"password"` / `"boolean"` / `"integer"` 改为 `ValueType.PASSWORD` 等枚举成员引用。

### 4. `apps/media/enums.py`（新建）

```
MediaScope(ChoicesMixin):  USER="user" / ORG="org"
MediaExtension(ChoicesMixin): JPG / JPEG / PNG / WEBP
```

删除 `services.py` 中的 `ALLOWED_SCOPES` 和 `ALLOWED_EXTENSIONS` 裸集合。

### 5. `apps/media/schemas.py`

`OssTokenIn.scope` 从 `Literal["user", "org"]` 改为 `MediaScope`，Ninja 自动生成 OpenAPI enum 校验。

### 6. `apps/media/services.py`

- `generate_upload_path` scope/ext 校验改为 `MediaScope.get_values()` / `MediaExtension.get_values()`
- scope 分支比较改为 `MediaScope.USER`

### 7. `apps/media/api.py`

scope 比较改为 `MediaScope.USER`。

## 变更文件清单

| 文件 | 操作 |
|------|------|
| `apps/base/enums.py` | 新建 |
| `apps/media/enums.py` | 新建 |
| `apps/settings/models.py` | 修改基类 |
| `apps/settings/service.py` | 替换字符串字面量 |
| `apps/media/schemas.py` | 替换 Literal |
| `apps/media/services.py` | 替换裸集合 |
| `apps/media/api.py` | 替换 scope 比较 |

## 不在范围内

- 其他 app 的枚举（accounts、organizations、teams、notifications）
- 前端代码
- DB migration（`TextChoices` 基类变更不影响 schema）
