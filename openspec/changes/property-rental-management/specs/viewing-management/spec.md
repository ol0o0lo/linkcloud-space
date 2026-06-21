## ADDED Requirements

### Requirement: 轻量带看记录管理
系统 SHALL 提供 ViewingRecord 模型，用于后台中介录入房源带看过程，字段包含：organization(FK→Organization)、house(FK→House, PROTECT)、contact(FK→Contact, null=True, blank=True, PROTECT)、customer_name、customer_phone、scheduled_at、viewed_at、status(choices, default=scheduled)、assigned_to(FK→User, null=True, blank=True, SET_NULL)、notes、extra(JSONField)、is_active。ViewingRecord SHALL 只表达带看记录，不承担完整 CRM 线索池、跟进任务、佣金结算或渠道归因能力。

#### Scenario: 创建预约带看记录
- **WHEN** 管理员或中介为某套 House 创建 ViewingRecord，并提供 customer_name、customer_phone、scheduled_at
- **THEN** 记录保存成功，status 默认 scheduled，is_active 默认 True

#### Scenario: 关联已有租客联系人
- **WHEN** 创建 ViewingRecord 时提供 contact
- **THEN** contact 必须属于同一 organization，且 SHOULD 具备 tenant 角色

#### Scenario: 临时客户信息允许不建 Contact
- **WHEN** 客户只是预约或带看阶段，尚未确认承租
- **THEN** 系统允许仅保存 customer_name 和 customer_phone，不强制创建 Contact

#### Scenario: 带看记录组织归属必须与房源一致
- **WHEN** 创建或更新 ViewingRecord，且 ViewingRecord.organization 与 House.building.estate.organization 不一致
- **THEN** 系统阻止保存并返回校验错误

#### Scenario: 带看状态约束
- **WHEN** 设置 ViewingRecord.status
- **THEN** 只允许：scheduled（已预约）、viewed（已带看）、canceled（已取消）、no_show（爽约）、converted（已成交）

#### Scenario: 实际带看时间可选
- **WHEN** ViewingRecord.status 为 scheduled
- **THEN** viewed_at 允许为空

#### Scenario: 标记为已带看
- **WHEN** ViewingRecord.status 更新为 viewed
- **THEN** viewed_at SHOULD 被填写；若未填写，系统 MAY 使用当前时间补齐

#### Scenario: 带看成交后创建租约
- **WHEN** 管理员将 ViewingRecord 标记为 converted
- **THEN** 系统不自动创建 Lease；管理员应显式创建或选择 tenant Contact 后再创建 Lease，并可通过 Lease.source_viewing_record 将该 ViewingRecord 作为成交来源记录

#### Scenario: V1 不提供完整 CRM 能力
- **WHEN** 用户需要线索池、渠道归因、多次跟进任务、佣金结算或转介绍统计
- **THEN** 当前版本不在 ViewingRecord 中实现，应由后续独立 CRM/销售流程模块承接
