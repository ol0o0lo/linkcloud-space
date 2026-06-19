---
name: media-business-closure-design
description: Media 模块面向后续业务 app 的通用闭环设计
metadata:
  type: project
---

# Media 模块业务闭环设计

## 背景

当前 `apps/media` 已经具备这些基础能力：

1. 直传凭证接口：`GET /api/media/oss-token/`
2. 直传登记接口：`POST /api/media/confirm/`
3. 服务端上传接口：`POST /api/media/upload/`
4. 统一媒体记录模型：`MediaFile`
5. 基于 `list[int]` 的回显能力：`validate_media_ids()` / `get_media_list_info()`
6. 基于 `MEDIA_REFERENCE_PROVIDERS` 的延迟清理框架

这些能力已经足够证明 `media` 不是空壳，但仍缺少“平台侧自证闭环”的最后一段：`confirm` 仍然轻信前端参数、引用协议还没有业务样板、清理链路虽然存在但尚未通过真实接入模型验证。

本次目标不是把头像、组织 Logo 等既有链路统一迁移到 `media`，而是先把 `media` 提升成一个后续业务 app 可以直接依赖的通用平台能力。

---

## 已确认的设计决策

### 1. 平台层以 `list[int]` 作为唯一标准引用形态

所有接入 `media` 的业务模型，平台协议统一围绕 `JSON list[int]` 展开。

约束如下：

- 列表中的整数是 `MediaFile.id`
- 列表顺序即业务展示顺序
- 不允许重复 ID
- 空列表表示无媒体

单图场景不在平台层引入额外协议，业务 app 如需单图字段，可在自身 schema/service 中把单个 `media_id` 适配成长度为 1 的列表。

### 2. 权限仍由业务模块负责

`media` 只负责：

- 上传上下文签发
- 媒体记录登记
- `media_ids` 校验与回显
- 引用收集与延迟回收

谁能查看、编辑、替换某个业务记录上的媒体，仍由业务模块自己判断。

### 3. `confirm` 必须升级为强绑定校验

本次不再接受“前端传什么路径，后端就登记什么路径”的模式。

平台需要新增一个上传意图（upload intent）上下文，把以下信息在服务端绑定起来：

- 当前用户
- 上传作用域（`user` / `org`）
- 目标对象 ID
- `resource_type`
- `original_filename`
- 生成出的对象存储路径
- 过期时间

只有和该上传意图匹配的确认请求，才能成功创建 `MediaFile`。

### 4. 平台层先闭环，不顺手做全量迁移

本轮不做：

- `accounts` 头像迁移
- 组织 Logo 迁移
- 新增统一引用中间表
- 对象存储文件内容级校验（例如 HEAD/ETag/图片探测）

目标是先把平台接口、协议和业务样板收紧成可靠的基础层。

---

## 闭环目标

本轮完成后，`media` 需要满足下面 5 个条件：

1. **上传闭环**：客户端只能确认自己刚刚申请过的那次上传
2. **落库闭环**：平台落库的数据来自服务端已签发的上传意图，而不是前端自由输入
3. **引用闭环**：业务 app 按统一协议保存与校验 `media_ids`
4. **回收闭环**：清理任务可以基于真实业务引用结果安全工作
5. **接入闭环**：仓库内至少有一个示例业务模型完整接入，作为后续业务模板

---

## 方案对比

### 方案 A：保持现状，只补文档

做法：

- 保留当前 `oss-token -> confirm` 轻校验链路
- 只写接入约定，不调整后端校验

优点：

- 改动最小

缺点：

- 不能真正解决 `confirm` 可伪造的问题
- 业务 app 仍然无法把平台层当作可信闭环能力

### 方案 B：引入上传意图上下文，平台围绕 `list[int]` 建立闭环（推荐）

做法：

- 新增服务端上传意图模型或等价持久化结构
- `oss-token` 返回凭证时顺带返回 `intent_id`
- `confirm` 必须提交 `intent_id`，由后端取回已签发上下文做比对
- 为业务 app 提供统一的 `media_ids` 校验、回显、引用收集样板
- 接入一个真实示例业务

优点：

- 改动集中在平台边界
- 足够安全且不过度设计
- 后续业务 app 可以直接照协议接入

缺点：

- 需要增加一份持久化上下文和少量清理逻辑

### 方案 C：直接做统一媒体引用表

做法：

- 为每次业务引用都建立结构化引用记录
- 平台统一管理媒体与业务对象的关系

优点：

- 长期表达力最强

缺点：

- 本轮明显过重
- 会把当前仓库多数业务模型的改造面一起拉大

本轮采用 **方案 B**。

---

## 架构设计

### 1. 上传意图模型

平台新增一个短生命周期的上传意图模型，例如 `MediaUploadIntent`，只负责承接一次“申请上传”到“确认落库”之间的服务端上下文。

建议字段：

- `id`
- `created_by`
- `scope`
- `scope_object_id`
- `resource_type`
- `original_filename`
- `oss_path`
- `expires_at`
- `confirmed_at`
- `created_at`

语义：

- 创建意图时，由服务端统一生成 `oss_path`
- 意图在过期前只能被确认一次
- 已确认的意图不可重复使用

本模型不承担长期媒体引用语义，也不替代 `MediaFile`。

### 2. `oss-token` 接口行为

`GET /api/media/oss-token/` 从“返回临时上传凭证”升级为“创建上传意图并返回临时上传凭证”。

行为要求：

- 校验 `scope`
- 校验 `resource_type`
- 依据当前用户和当前组织生成合法的 `scope_object_id`
- 生成 `oss_path`
- 创建上传意图
- 返回：
  - STS 临时凭证
  - bucket / endpoint / path
  - `intent_id`
  - 过期时间

这样客户端后续只能围绕这次服务端签发的路径完成上传与确认。

### 3. `confirm` 接口行为

`POST /api/media/confirm/` 改为只接受：

- `intent_id`
- `file_size`

可选地继续带 `original_filename` 仅用于前端兼容，但后端不信任它作为真实来源。

确认逻辑：

1. 根据 `intent_id` 取回上传意图
2. 校验意图属于当前用户
3. 校验意图未过期
4. 校验意图尚未确认
5. 使用意图中的 `oss_path`、`resource_type`、`original_filename` 创建 `MediaFile`
6. 回写 `confirmed_at`

这里不要求额外访问对象存储验证文件是否存在；本轮的“强绑定”含义是 **后端只信自己签发过的上传上下文**，而不是做内容探测。

### 4. 服务端上传接口行为

`POST /api/media/upload/` 继续保留，作为不走直传的备用能力。

它仍然直接上传并落库，但要和平台主协议保持一致：

- `resource_type` 继续受白名单约束
- 支持 `user` / `org`
- 返回可直接保存的 `MediaFile` 列表

服务端上传不需要 upload intent，因为文件内容已经经过当前请求提交到服务端，平台并没有“后续再确认一次”的需求。

### 5. `media_ids` 标准能力

平台继续提供并强化以下服务：

- `validate_media_ids(media_ids)`
- `get_media_list_info(media_ids)`

并补一层面向业务接入的帮助函数，目标不是增加复杂抽象，而是让业务侧更容易遵守同一套协议。

建议新增的帮助能力：

- 从模型集合中提取 `media_ids`
- 收集多个记录上的全部引用 ID
- 将原始 `media_ids` 列表规范化为无重复、有序、可校验的值

这些函数都围绕 `list[int]` 工作，不引入 `int | list[int]` 双协议。

### 6. 引用收集与清理

`MEDIA_REFERENCE_PROVIDERS` 继续作为平台与业务的边界。

统一要求：

- 每个接入业务 app 都提供一个 provider 函数
- provider 扫描其业务模型中的 `media_ids`
- provider 返回当前仍被引用的全部 `MediaFile.id`

清理任务行为不变：

- 仅清理超过保留窗口的媒体
- 仅清理未被任何 provider 返回的媒体

本轮额外增加上传意图的过期清理，防止短生命周期上下文无限堆积。

---

## 数据模型设计

### `MediaFile`

保留现有字段：

- `uploader`
- `resource_type`
- `original_filename`
- `file`
- `file_size`
- `created_at`
- `updated_at`

不在 `MediaFile` 上添加业务记录归属字段，也不添加排序字段。

### `MediaUploadIntent`

新增短生命周期模型，生命周期规则如下：

- 创建后等待客户端上传并确认
- 成功确认后保留记录，作为审计与防重依据
- 超过过期时间且未确认的记录可以清理

是否立即物理删除已确认 intent 不是本轮重点；为了可审计和实现简单，可以先保留。

---

## 示例业务接入设计

本轮需要新增一个最小但真实的样板业务接入，用来验证平台协议真的能走通。

推荐方式：在一个低风险、平台性较强的业务模块里增加“图片列表”字段和对应 provider，而不是改造现有头像链路。

样板应覆盖：

1. 模型保存 `media_ids: JSON list[int]`
2. 写接口在保存前调用 `validate_media_ids()`
3. 读接口在回显时调用 `get_media_list_info()`
4. provider 将该模型上的 `media_ids` 汇总到 `MEDIA_REFERENCE_PROVIDERS`
5. 清理任务能够正确识别“已引用 / 未引用”两类媒体

样板业务不追求业务复杂度，只追求把平台协议完整走一遍。

---

## 错误处理

新增或调整的错误场景：

1. `resource_type` 非法
2. `scope` 非法
3. `intent_id` 不存在
4. 上传意图不属于当前用户
5. 上传意图已过期
6. 上传意图已被确认
7. `media_ids` 包含重复值
8. `media_ids` 包含不存在的 ID

这些错误继续沿用现有 Ninja + `apps.base.errors` 风格，不额外引入新的响应协议。

---

## 测试策略

### 1. 上传意图与 `oss-token`

覆盖：

- 用户作用域创建 intent 成功
- 组织作用域创建 intent 成功
- 非法 `resource_type` 被拒绝
- 非法 `scope` 被拒绝
- 返回结果包含 `intent_id`

### 2. `confirm` 强绑定校验

覆盖：

- 使用有效 `intent_id` 能创建 `MediaFile`
- 重复确认同一个 intent 失败
- 非创建人确认失败
- 过期 intent 确认失败
- `confirm` 不再接受前端伪造 `oss_path` 改写落库路径

### 3. `media_ids` 标准能力

覆盖：

- 保持顺序
- 拒绝重复
- 拒绝不存在 ID
- 空列表正常返回

### 4. 示例业务接入

覆盖：

- 写入时校验 `media_ids`
- 读取时返回按顺序展开的媒体详情
- provider 能正确收集引用 ID

### 5. 清理任务

覆盖：

- 已被样板业务引用的媒体不会被删
- 未被引用且超过保留期的媒体会被删
- 过期未确认 intent 能被清理

---

## 迁移与兼容性

本轮 API 存在一个明确的兼容性变化：

- `confirm` 从“前端提交路径元数据”改为“前端提交 `intent_id`”

因为当前仓库里还没有发现其他真实业务 app 消费该接口，本次可以直接升级协议，不额外保留双写兼容层。

如果前端已有试验性调用，需要同步调整为：

1. 调 `oss-token`
2. 拿到 `intent_id` 和 `path`
3. 完成上传
4. 用 `intent_id` 调 `confirm`

---

## 实施边界

本轮必须完成：

1. 上传意图持久化结构
2. `oss-token` 创建意图并返回 `intent_id`
3. `confirm` 切换到强绑定校验
4. `list[int]` 标准工具补齐
5. 一个真实样板业务接入
6. 样板 provider 注册到 `MEDIA_REFERENCE_PROVIDERS`
7. intent 清理能力和测试

本轮不做：

1. 头像迁移
2. 组织 Logo 迁移
3. 统一媒体引用关系表
4. 缩略图生成系统
5. 对象存储内容级探测

---

## 成功标准

完成后，判断 `media` 是否真正业务闭环，以以下标准为准：

1. 业务 app 无法伪造未签发路径完成 `confirm`
2. 新业务只要保存 `list[int]`，就能直接复用平台校验与回显能力
3. 至少一个示例业务已经按协议接入
4. 清理任务能根据该业务的真实引用结果工作
5. `tests/media` 与样板业务相关测试全部通过
