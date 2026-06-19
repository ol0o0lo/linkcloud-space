# 通知分发系统设计

## 背景

当前系统已经有 `Notification` 和 `NotificationPreference`：

- `Notification` 表示某个用户收到的一条站内通知，适合个人通知中心。
- `NotificationPreference` 表示用户对通知类别的接收偏好。
- `/api/notifications/` 已经按当前登录用户和当前租户隔离，适合作为个人通知中心接口。

新的目标是补齐“通知发送管理”能力，让平台管理员和租户管理员可以发起站内通知，并查看发送记录与实际投递结果。第一版只做站内通知，创建后立即进入发送流程，不做草稿、审核、模板、定时发送、多渠道编排。

## 目标

- 所有登录用户都可以使用个人通知中心，查看和处理自己的通知。
- 平台管理员可以向全平台用户、指定租户成员、指定用户发送站内通知。
- 租户管理员可以向当前租户全体成员或当前租户内指定用户发送站内通知。
- 普通用户不能发起通知分发任务。
- 发送由 Celery worker 执行，管理端记录发送任务状态，个人通知中心读取实际投递记录。
- 发送记录、投递明细、权限范围需要可审计、可追溯。

## 非目标

- 第一版不支持草稿。
- 第一版不支持审批。
- 第一版不支持定时发送。
- 第一版不支持通知模板。
- 第一版不支持邮件、短信、企微等多渠道发送管理。
- 第一版不支持按角色、团队、复杂条件圈选用户。

## 核心设计

采用两层模型：

- `NotificationDispatch`：一次通知分发任务，给管理端使用。
- `Notification`：某个用户实际收到的一条站内通知，给个人通知中心使用。

管理端创建 `NotificationDispatch` 后，Celery worker 根据 `scope` 和 `scope_ids` 解析接收人，并批量创建 `Notification`。`Notification` 通过可空外键关联回 `NotificationDispatch`，从而支持发送记录追溯。

设计上需要区分两个概念：

- 管理归属：这条分发任务归平台管理，还是归某个租户管理。
- 接收范围：这条分发任务最终发给哪些用户。

`scope/scope_ids` 只表达接收范围；管理归属单独用可空 `owner_organization` 表达。

## 数据模型

### NotificationDispatch

`NotificationDispatch` 使用 `BaseModelMixin`，复用 `created_by`、`updated_by`、`created_at`、`updated_at`。当前 `created_by` 是字符串字段，第一版记录发起人的用户名或稳定展示名，不设计成用户外键。

建议字段：

```text
scope: platform / organization / users
scope_ids: JSON list[int]
owner_organization: nullable FK -> Organization

category: string
title: string
body: text
url: nullable string
data: JSON object

status: pending / sending / sent / failed
target_count: int
delivered_count: int
error_message: text
sent_at: nullable datetime
```

字段语义：

- `scope` 表示接收人解析规则。
- `scope_ids` 表示接收人解析需要的 ID 列表。
- `owner_organization` 表示管理归属，空值代表平台归属，非空代表租户归属。
- `target_count` 表示 worker 解析出的目标用户数。
- `delivered_count` 表示实际创建成功的 `Notification` 数量。
- `error_message` 记录整体失败原因摘要。
- `sent_at` 表示 worker 完成发送的时间。

`owner_organization` 不是接收范围字段。例如平台管理员可以创建一条平台归属的分发任务，并设置 `scope=organization, scope_ids=[1]`，表示平台发起、接收人为租户 1 的全部成员。租户管理员创建的分发任务必须归属于当前租户，即 `owner_organization=request.org`。

### Notification

在现有 `Notification` 上新增字段：

```text
dispatch: nullable FK -> NotificationDispatch
```

语义：

- 管理台发出的通知会关联 `dispatch`。
- 现有系统内部通过 `notify()` 产生的通知可以不关联 `dispatch`。
- 个人通知中心仍然只关心当前用户自己的 `Notification`。

## Scope 规则

`scope` 和 `scope_ids` 是第一版唯一的接收范围表达。

```text
scope=platform
scope_ids=[]
```

含义：发送给全平台所有用户。

权限：仅平台管理员可用。

```text
scope=organization
scope_ids=[1]
```

含义：发送给租户 1 的全部成员。

权限：平台管理员可以指定任意租户；租户管理员只能指定当前租户。

```text
scope=users
scope_ids=[10, 11]
```

含义：发送给指定用户。

权限：平台管理员可以指定任意用户；租户管理员只能指定当前租户内用户；普通用户不可使用。

约束：

- `scope=platform` 时，`scope_ids` 必须为空。
- `scope=organization` 时，`scope_ids` 必须非空，且每个 ID 都必须是存在的租户。
- `scope=users` 时，`scope_ids` 必须非空，且每个 ID 都必须是存在的用户。
- 第一版模型允许 `scope=organization` 多租户 ID；前端可以先只在平台管理员视角开放多选，租户管理员固定当前租户。
- `owner_organization` 为空时表示平台归属；非空时表示租户归属。

## 权限规则

### 平台管理员

- 可以创建 `scope=platform` 的分发任务。
- 可以创建 `scope=organization` 的分发任务，范围可以是任意租户。
- 可以创建 `scope=users` 的分发任务，范围可以是任意用户。
- 可以查看全部 `NotificationDispatch`。
- 可以查看全部分发任务对应的 `Notification` 投递明细。
- 平台管理员创建的任务默认 `owner_organization=null`，归平台管理。

### 租户管理员

- 可以创建 `scope=organization` 的分发任务，但 `scope_ids` 只能是当前租户。
- 可以创建 `scope=users` 的分发任务，但所有用户必须属于当前租户。
- 不能创建 `scope=platform` 的分发任务。
- 创建的任务必须 `owner_organization=当前租户`。
- 只能查看 `owner_organization=当前租户` 的 `NotificationDispatch`。
- 只能查看当前租户归属分发任务对应的投递明细。

### 普通用户

- 不能访问通知分发管理接口。
- 只能通过个人通知中心接口访问自己的 `Notification`。
- 可以标记自己的通知已读、未读、删除、批量处理和维护通知偏好。

## 执行流程

### 创建分发任务

```text
POST /api/notification-dispatches/
-> 校验当前用户是否可创建该 scope/scope_ids
-> 创建 NotificationDispatch(status=pending)
-> 提交 Celery task dispatch_notification(dispatch_id)
-> 返回 dispatch 记录
```

### Worker 发送

```text
读取 NotificationDispatch
-> 将 status 更新为 sending
-> 根据 scope/scope_ids 解析目标用户
-> 根据 owner_organization 重新执行范围保护
-> 应用 NotificationPreference 的站内通知偏好
-> bulk_create Notification(dispatch=dispatch, recipient=user, ...)
-> 更新 target_count、delivered_count、status=sent、sent_at
```

### Worker 失败

```text
捕获异常
-> status=failed
-> error_message=错误摘要
```

worker 需要重新校验范围，因为异步执行时租户成员、用户状态、权限范围可能已经发生变化。对租户归属任务，worker 必须保证最终接收人仍然属于 `owner_organization`；对平台归属任务，worker 按平台范围解析接收人。

## API 设计

个人通知中心继续使用现有接口：

```text
GET    /api/notifications/
GET    /api/notifications/unread-count/
GET    /api/notifications/{id}/
PATCH  /api/notifications/{id}/
DELETE /api/notifications/{id}/
POST   /api/notifications/bulk/
GET    /api/notifications/preferences/
PATCH  /api/notifications/preferences/{category}/
```

新增统一通知分发管理接口：

```text
GET  /api/notification-dispatches/
POST /api/notification-dispatches/
GET  /api/notification-dispatches/{id}/
GET  /api/notification-dispatches/{id}/notifications/
```

接口语义：

- `GET /api/notification-dispatches/`：按当前用户权限返回可管理的分发任务。
- `POST /api/notification-dispatches/`：创建后立即进入异步发送。
- `GET /api/notification-dispatches/{id}/`：查看分发任务详情和发送状态。
- `GET /api/notification-dispatches/{id}/notifications/`：查看该任务生成的个人通知记录。

第一版不提供 `PATCH`、`cancel`、`send` 独立接口，因为不支持草稿和取消，创建后立即发送。

## 前端页面

### 个人通知中心

所有登录用户可见。

能力：

- 未读数量。
- 通知列表。
- 通知详情。
- 标记已读、未读。
- 删除。
- 批量标记已读。
- 通知偏好设置。

### 通知分发管理

平台管理员和租户管理员可见，普通用户不可见。

平台管理员能力：

- 查看全部分发任务。
- 创建全平台通知。
- 创建指定租户通知。
- 创建指定用户通知。
- 查看投递明细。

租户管理员能力：

- 查看当前租户分发任务。
- 创建当前租户全员通知。
- 创建当前租户指定用户通知。
- 查看当前租户投递明细。

## 查询与筛选

`NotificationDispatch` 列表第一版建议支持：

- `scope`
- `owner_organization`
- `status`
- `category`
- `created_by`
- `created_at` 起止时间
- `sent_at` 起止时间

`dispatch notifications` 明细第一版建议支持：

- `is_read`
- `recipient`
- `created_at` 起止时间

## 测试策略

后端测试：

- 平台管理员可以创建 `platform`、`organization`、`users` 范围任务。
- 租户管理员不能创建 `platform` 范围任务。
- 租户管理员创建 `organization` 时只能指定当前租户。
- 租户管理员创建 `users` 时只能指定当前租户成员。
- 租户管理员创建的任务必须归属当前租户。
- 普通用户不能访问分发管理接口。
- worker 能根据三种 scope 正确生成 `Notification`。
- worker 会按 `owner_organization` 重新保护租户范围。
- `NotificationPreference` 会过滤关闭站内通知的用户。
- 分发任务只能查看权限范围内的投递明细。

前端测试：

- 平台管理员能看到分发管理入口和平台发送选项。
- 租户管理员能看到分发管理入口，但不能看到全平台发送选项。
- 普通用户看不到分发管理入口。
- 创建分发任务后列表显示 `pending/sending/sent/failed` 状态。
- 个人通知中心继续使用现有通知接口。

## 实施顺序

1. 新增 `NotificationDispatch` 模型和迁移。
2. 给 `Notification` 增加可空 `dispatch` 外键。
3. 新增 scope 解析与权限校验服务。
4. 新增 Celery 任务 `dispatch_notification`。
5. 新增 `/api/notification-dispatches/` 管理接口。
6. 补后端单元测试。
7. 将现有 `frontend_admin` 通知页明确为个人通知中心。
8. 新增通知分发管理页面。
9. 补前端单元测试。

## 后续扩展

后续如果需要运营级增强，可以在不推翻第一版模型的基础上扩展：

- 定时发送：增加 `scheduled_at` 和调度任务。
- 草稿和取消：扩展 `status` 并增加 `PATCH/cancel/send` 接口。
- 模板：增加通知模板表。
- 角色和团队发送：增加新的 `scope` 值，例如 `roles`、`teams`。
- 多渠道发送：新增投递明细表，将站内、邮件、短信拆成 channel-level delivery。
