## ADDED Requirements

### Requirement: 租约管理
系统 SHALL 提供 Lease 模型，字段包含：organization(FK→Organization)、house(FK→House, PROTECT)、tenant(FK→Contact, PROTECT)、source_viewing_record(FK→ViewingRecord, null=True, blank=True, PROTECT)、sign_at、start_date、end_date、monthly_rent、deposit、payment_day(default=1)、status(choices, default=pending)、contract_files(MediaRefsField)、notes、extra(JSONField)。Lease.contract_files SHALL 保存有序合同媒体引用对象列表，每项至少包含 `media_id`。

#### Scenario: 创建租约
- **WHEN** 创建 Lease，提供 house、tenant、start_date、end_date、monthly_rent
- **THEN** 记录保存成功，status 默认 pending，payment_day 默认 1

#### Scenario: 租约状态约束
- **WHEN** 设置 Lease.status
- **THEN** 只允许：pending（待生效）、active（生效中）、expired（已到期）、terminated（已终止）

#### Scenario: 租客角色约束
- **WHEN** 创建 Lease，但 tenant 不具备 tenant 角色
- **THEN** 系统阻止保存并返回校验错误

#### Scenario: 日期范围校验
- **WHEN** 创建或更新 Lease，且 end_date 早于 start_date
- **THEN** 系统阻止保存并返回校验错误

#### Scenario: 收费字段校验
- **WHEN** 创建或更新 Lease，monthly_rent 或 deposit 小于 0，或 payment_day 不在 1 到 31 之间
- **THEN** 系统阻止保存并返回校验错误

#### Scenario: 租约组织归属必须与房源和租客一致
- **WHEN** 创建或更新 Lease，且 Lease.organization、House.building.estate.organization、tenant.organization 三者任一不一致
- **THEN** 系统阻止保存并返回校验错误

#### Scenario: 创建租约前必须已登记出租方
- **WHEN** 管理员尝试为 `landlord is null` 的 House 创建 Lease
- **THEN** 系统阻止保存并返回“需先补齐登记出租方”的校验错误

#### Scenario: 租约可追溯成交来源带看
- **WHEN** 管理员从已成交 ViewingRecord 显式创建 Lease
- **THEN** 系统 SHALL 允许通过 `source_viewing_record` 保存该租约的成交来源带看记录

#### Scenario: 成交来源带看必须匹配租约上下文
- **WHEN** 创建或更新 Lease 并提供 `source_viewing_record`
- **THEN** 该 ViewingRecord 必须属于同一 organization、同一 House、状态为 converted；若 ViewingRecord.contact 非空，还必须与 Lease.tenant 一致

### Requirement: 租约合同文件存储
系统 SHALL 复用现有 `apps.media.MediaFile` 与 `S3MediaStorage` 存储租约合同文件，Lease.contract_files SHALL 通过 `MediaRefsField` 保存引用已登记 MediaFile 的 `media_id`，默认上限为 1 个。

#### Scenario: 创建带合同文件的租约
- **WHEN** 创建 Lease 并提供 `contract_files`
- **THEN** 每个 item SHALL 通过 `media_id` 指向 MediaFile 记录，而不是保存裸文件路径或裸 URL

#### Scenario: 合同文件可选
- **WHEN** 创建 Lease 未提供 `contract_files` 或提供空列表
- **THEN** 租约仍可保存成功

#### Scenario: 合同文件数量上限
- **WHEN** 为 Lease 保存超过 1 个合同媒体引用对象
- **THEN** 系统阻止保存并返回校验错误

#### Scenario: 合同文件字段声明
- **WHEN** 定义 Lease.contract_files 字段
- **THEN** 系统 SHALL 声明 `max_items=1`、`allowed_media_types=[MediaType.FILE]` 和 `allowed_resource_types=[ResourceType.LEASE_CONTRACT]`

#### Scenario: 合同文件详情通过 media app 解析
- **WHEN** 查询某份租约的合同文件展示信息
- **THEN** 系统 SHALL 优先使用 `contract_files_resolved`，或复用 `apps.media.services.resolve_media_refs()`，根据 `contract_files[].media_id` 按原顺序返回平铺增强后的 `contract_files=[{"media_id": ..., "url": ..., ...}]`

#### Scenario: 合同文件资源类型
- **WHEN** 登记租约合同 MediaFile
- **THEN** resource_type SHALL 为 `lease_contract`

#### Scenario: 合同文件格式限制
- **WHEN** 上传租约合同
- **THEN** 系统 SHALL 至少允许 pdf 格式；如需编辑文档，可扩展 doc、docx 格式

### Requirement: 租约与房态保持弱关系
系统 SHALL 将 Lease 作为关联房源的业务记录，不根据 Lease 的生命周期自动修改 House.status。

#### Scenario: 租约生效
- **WHEN** Lease.status 更新为 active
- **THEN** 对应 House.status 保持不变

#### Scenario: 租约终止或到期
- **WHEN** Lease.status 更新为 expired 或 terminated
- **THEN** 对应 House.status 保持不变

#### Scenario: 租约迁移房源
- **WHEN** Lease.house 从一套房源修改为另一套房源
- **THEN** 原房源与新房源的 House.status 均保持不变

#### Scenario: 删除租约
- **WHEN** 删除一条 Lease
- **THEN** 对应 House.status 保持不变

### Requirement: 一套房同一时间只有一条 active 租约
系统 SHALL 在创建或激活租约时检查同一 House 是否已有 active 状态租约，并用数据库约束保证并发场景下的最终一致性。

#### Scenario: 重复激活校验
- **WHEN** 尝试将 Lease.status 设为 active，但该 House 已有另一条 active Lease
- **THEN** 系统阻止操作并返回错误

#### Scenario: 当前版本不校验非 active 租约的时间重叠
- **WHEN** 两条 `pending`、历史或未来租约在日期区间上存在重叠，但同一时间没有两条 `active` 租约
- **THEN** 当前版本允许保存，不额外做时间重叠校验
