# Settings 模块设计文档

日期：2026-05-16

## 概述

为 SaaS 平台设计一套多层级设置管理系统，支持平台默认设置、租户（Org）设置、Team 设置和用户偏好设置，采用稀疏存储 + fallback 查找策略。

---

## 需求

- 超级管理员维护平台默认设置（全局），对普通用户透明
- 租户可以覆盖部分设置项，未覆盖的取平台默认值
- Team 可以覆盖部分设置项，未覆盖的取平台默认值（不经过 Org）
- 用户有独立的偏好设置，无 fallback 链
- 新增设置项不需要数据库迁移，只需在默认设置表插入新记录
- 接口使用 DRF 实现，独立为 `apps/settings` app

---

## Fallback 链

```
Org 取值：  org_setting → default_setting
Team 取值： team_setting → default_setting
User 取值： user_setting（无 fallback）
```

---

## 数据模型

### `settings_default`（平台默认，超管维护）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | AutoField | PK |
| key | CharField(100), unique | 设置项 key，如 `sms_provider` |
| value | JSONField | 默认值，支持任意 JSON 类型 |
| value_type | CharField(20) | 值类型：`text` / `password` / `json` / `boolean` / `integer` |
| description | TextField, blank | 说明，方便超管理解用途 |
| updated_at | DateTimeField | 最后更新时间 |
| updated_by | FK → User, null | 最后修改人 |

**`value_type` 处理规则：**

| 类型 | 存储 | API 返回 | 写入校验 |
|------|------|---------|---------|
| `text` | 原始字符串 | 原样返回 | 无 |
| `password` | Fernet 加密存储 | 返回 `"********"` | 非空字符串 |
| `json` | JSON 对象/数组 | 反序列化后返回 | 合法 JSON |
| `boolean` | `true` / `false` | bool 类型 | 只接受 true/false |
| `integer` | 数字 | int 类型 | 合法整数 |

### `settings_organization`（租户设置，稀疏存储）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | AutoField | PK |
| organization | FK → Organization, CASCADE | 所属租户 |
| setting | FK → DefaultSetting, PROTECT | 关联默认设置项，类型由此继承 |
| value | JSONField | 覆盖值 |
| updated_at | DateTimeField | |

unique_together: `(organization, setting)`

### `settings_team`（Team 设置，稀疏存储）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | AutoField | PK |
| team | FK → Team, CASCADE | 所属 Team |
| setting | FK → DefaultSetting, PROTECT | 关联默认设置项，类型由此继承 |
| value | JSONField | 覆盖值 |
| updated_at | DateTimeField | |

unique_together: `(team, setting)`

### `settings_user`（用户偏好）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | AutoField | PK |
| user | FK → User, CASCADE | 所属用户 |
| key | CharField(100) | 偏好项 key（不关联 DefaultSetting，用户偏好独立） |
| value | JSONField | 偏好值 |
| updated_at | DateTimeField | |

unique_together: `(user, key)`

> 用户偏好（如新手引导已读状态、UI 折叠状态等）与系统设置项无关，key 不需要预先在 `settings_default` 中定义，直接存取即可。

---

## App 结构

```
apps/settings/
  __init__.py
  apps.py
  models.py        # 4 张表的 Model 定义
  service.py       # 业务逻辑：get_setting / set_setting / serialize_value
  serializers.py   # DRF Serializer
  views.py         # DRF ViewSet
  urls.py          # URL 路由
  admin.py         # 超管操作 DefaultSetting
  tests/
    test_service.py
    test_api.py
```

---

## Service 层

`apps/settings/service.py` 是唯一操作设置的入口，views 不直接查 model。

### 类型序列化

```python
def serialize_value(value, value_type: str):
    """根据 value_type 处理返回值。"""
    if value_type == "password":
        return "********"
    if value_type == "boolean":
        return bool(value)
    if value_type == "integer":
        return int(value)
    # text / json 原样返回
    return value
```

### Org 设置

```python
def get_org_setting(org, key: str) -> dict:
    """获取 org 某个 key 的值，fallback 到 default。
    返回 {"key": ..., "value": ..., "is_customized": bool}
    """

def get_all_org_settings(org) -> list[dict]:
    """获取 org 所有设置项（全量 default 列表，标注是否已覆盖）。"""

def set_org_setting(org, key: str, value) -> OrgSetting:
    """覆盖 org 的某个 key（upsert）。写入前按 value_type 校验。"""

def delete_org_setting(org, key: str) -> None:
    """删除 org 的覆盖，恢复使用默认值。"""
```

### Team 设置（同 Org）

```python
def get_team_setting(team, key: str) -> dict: ...
def get_all_team_settings(team) -> list[dict]: ...
def set_team_setting(team, key: str, value) -> TeamSetting: ...
def delete_team_setting(team, key: str) -> None: ...
```

### 用户偏好（无 fallback，无类型约束）

```python
def get_user_setting(user, key: str, default=None): ...
def get_all_user_settings(user) -> list[dict]: ...
def set_user_setting(user, key: str, value) -> UserSetting: ...
def delete_user_setting(user, key: str) -> None: ...
```

---

## API 接口（DRF）

挂载在 `config/urls.py` 的 `/api/settings/` 下。

### 返回格式统一

```json
{
  "key": "sms_provider",
  "value": "aliyun",
  "value_type": "text",
  "is_customized": false
}
```

- `is_customized: false`：当前值来自平台默认
- `is_customized: true`：该 scope 已自行覆盖
- `password` 类型的 `value` 固定返回 `"********"`
- `description` 和 `value_type` 始终来自 `DefaultSetting`，列表接口一并返回，前端可直接渲染设置页面

---

### 租户设置

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET | `/api/settings/org/` | Org 成员 | 获取当前 org 所有设置项 |
| PUT | `/api/settings/org/{key}/` | Org Owner | 覆盖某个 key |
| DELETE | `/api/settings/org/{key}/` | Org Owner | 删除覆盖，恢复默认 |

### Team 设置

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET | `/api/settings/teams/{team_id}/` | Team 成员 | 获取该 team 所有设置项 |
| PUT | `/api/settings/teams/{team_id}/{key}/` | Team 管理员 | 覆盖某个 key |
| DELETE | `/api/settings/teams/{team_id}/{key}/` | Team 管理员 | 删除覆盖，恢复默认 |

### 用户偏好

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET | `/api/settings/user/` | 本人 | 获取当前用户所有偏好 |
| PUT | `/api/settings/user/{key}/` | 本人 | 设置某个偏好 |
| DELETE | `/api/settings/user/{key}/` | 本人 | 删除某个偏好 |

---

## 权限设计

- `IsOrgOwner`：自定义 DRF Permission，校验 `request.user` 是当前 org 的 owner
- `IsTeamAdmin`：校验 user 是指定 team 的管理员（或 org owner）
- `IsAuthenticated`：用户偏好接口，登录即可

---

## 错误处理

| 场景 | HTTP 状态码 |
|------|-------------|
| key 不存在于 default 设置表 | 404 |
| 无权限操作 | 403 |
| value 与 value_type 不匹配 | 400 |
| 删除不存在的覆盖 | 404 |

---

## 测试策略

- `test_service.py`：单元测试 service 层，覆盖 fallback 逻辑、upsert、delete、各类型序列化
- `test_api.py`：API 集成测试，覆盖权限校验、正常 CRUD 流程、password 脱敏
- 使用 Model Bakery 生成测试数据

---

## 不在本期范围内

- 设置变更历史/审计日志
- 设置项分组/分类展示
- 批量更新多个 key
