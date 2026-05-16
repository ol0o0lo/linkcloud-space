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
| value | JSONField | 设置值，支持任意 JSON 类型 |
| description | TextField, blank | 说明，方便超管理解用途 |
| updated_at | DateTimeField | 最后更新时间 |
| updated_by | FK → User, null | 最后修改人 |

### `settings_organization`（租户设置，稀疏存储）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | AutoField | PK |
| organization | FK → Organization, CASCADE | 所属租户 |
| key | CharField(100) | 设置项 key |
| value | JSONField | 覆盖值 |
| updated_at | DateTimeField | |

unique_together: `(organization, key)`

### `settings_team`（Team 设置，稀疏存储）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | AutoField | PK |
| team | FK → Team, CASCADE | 所属 Team |
| key | CharField(100) | 设置项 key |
| value | JSONField | 覆盖值 |
| updated_at | DateTimeField | |

unique_together: `(team, key)`

### `settings_user`（用户偏好）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | AutoField | PK |
| user | FK → User, CASCADE | 所属用户 |
| key | CharField(100) | 偏好项 key |
| value | JSONField | 偏好值 |
| updated_at | DateTimeField | |

unique_together: `(user, key)`

---

## App 结构

```
apps/settings/
  __init__.py
  apps.py
  models.py        # 4 张表的 Model 定义
  service.py       # 业务逻辑：get_setting / set_setting
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

```python
def get_org_setting(org, key) -> dict:
    """获取 org 某个 key 的值，fallback 到 default。"""

def get_all_org_settings(org) -> list[dict]:
    """获取 org 所有设置项（全量 default key 列表，标注是否已覆盖）。"""

def set_org_setting(org, key, value) -> OrgSetting:
    """覆盖 org 的某个 key（upsert）。"""

def delete_org_setting(org, key) -> None:
    """删除 org 的覆盖，恢复使用默认值。"""

# Team 同理
def get_team_setting(team, key) -> dict: ...
def get_all_team_settings(team) -> list[dict]: ...
def set_team_setting(team, key, value) -> TeamSetting: ...
def delete_team_setting(team, key) -> None: ...

# 用户偏好（无 fallback）
def get_user_setting(user, key, default=None): ...
def get_all_user_settings(user) -> list[dict]: ...
def set_user_setting(user, key, value) -> UserSetting: ...
def delete_user_setting(user, key) -> None: ...
```

---

## API 接口（DRF）

挂载在 `config/urls.py` 的 `/api/settings/` 下。

### 返回格式统一

```json
{
  "key": "sms_provider",
  "value": "aliyun",
  "is_customized": false
}
```

`is_customized: false` 表示当前值来自平台默认，`true` 表示该 scope 已自行覆盖。

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
| value 格式非法（非 JSON） | 400 |
| 删除不存在的覆盖 | 404 |

---

## 测试策略

- `test_service.py`：单元测试 service 层，覆盖 fallback 逻辑、upsert、delete
- `test_api.py`：API 集成测试，覆盖权限校验、正常 CRUD 流程
- 使用 Model Bakery 生成测试数据

---

## 不在本期范围内

- 设置变更历史/审计日志
- 设置项分组/分类展示
- 批量更新多个 key
