# 签约业绩、佣金审核与员工收益设计

日期：2026-07-19
状态：设计评审中（未实施）

本文是实施前设计稿，不描述当前系统已经具备的能力。当前事实仍以业务代码、迁移和事实型文档为准。

## 1. 结论

新增独立的 `performance` 业务域，负责签约业绩认定、多人业绩分配、佣金审核、员工排行和人工收益调整。实施前必须先补齐租户内稳定员工身份、稳定团队键和组织时区，否则历史排行、审核快照和期间统计都没有可靠基础。

四个业务域分别保存不同事实：

| 业务域 | 唯一事实 |
|---|---|
| `house.Lease` | 合同事实：房源、租客、租期、合同租金、签约时间、合同状态 |
| `performance` | 认定事实：谁贡献了多少业绩、应计多少佣金、是否审核生效 |
| `finance`（后续） | 经营事实：公司收入、成本、收款、付款和净收益 |
| `wallet` | 资金事实：个人可用余额、冻结余额、提现和实际出款 |

业绩审核通过只形成“已认定应计收益”，不自动写入钱包，也不代表已经发工资或完成付款。

不使用 `Bill`、`BillEntry` 或钱包流水作为业绩排行的权威来源。未来财务模块可以读取已认定佣金作为公司成本，但不能反向决定业绩审核和员工排行。

一期所有金额固定使用 `CNY`。排行榜和台账始终按租户内稳定的 `subject_key`、`team_key` 聚合，`user_id`、员工姓名、团队名称和可空外键只用于当前展示或跳转。

## 2. 要解决的问题

一期必须覆盖：

- 从租约登记签约业绩。
- 一笔签约支持一个或多个协作员工。
- 明确每名员工的业绩权重、折算业绩额和佣金。
- 员工提交，财务或有权限人员审核通过或驳回。
- 驳回、修改、重新提交和已生效后的变更均保留历史。
- 员工排行只统计当前已生效口径。
- 支持人工增加或扣减佣金、奖金、罚款等员工收益。
- 员工离职、改名或转组后历史仍可解释。
- 用户或组织成员记录被删除后，不会把多名历史员工合并到同一个空身份。
- 团队归档、改名后仍能按原团队稳定统计历史业绩。
- 业绩额明确记录来源口径、计算输入、公式版本、组织时区和币种快照。
- 并发提交、重复点击和重复审核不能产生重复业绩或佣金。

## 3. 非目标

一期不包含：

- 基本工资、考勤、社保、公积金、个税和工资单。
- 发薪周期、工资结算批次和银行代发。
- 佣金自动进入钱包或自动提现。
- 通用公式 DSL 或可视化规则引擎。
- 分员工逐条审核；一份业绩单必须整体通过或整体驳回。
- 月度封账。审核通过的历史业绩可以回算原业绩归属期间。
- 通用业务来源。第一期签约业绩只直接关联 `Lease`。

“加/扣薪”在一期统一称为“收益调整”，只表示奖金、罚款、佣金补发或扣回，不表示完整工资核算。

## 4. 领域语言

### 4.1 租户员工身份

`OrganizationStaff`，租户内不会因离职而删除的稳定员工身份。每名员工拥有不可变的 `subject_key`；当前用户账号和当前组织成员关系只是这个身份的登录与在职映射。

### 4.2 稳定团队身份

`Team.team_key`，租户内不可变的团队业务键。团队删除改为归档；历史记录始终保存 `team_key` 和名称快照。

### 4.3 签约业绩单

`PerformanceCase`，表示一份租约如何被认定为团队和员工的签约业绩。一个租约只有一个稳定的业绩单身份，后续修改通过版本完成。

### 4.4 业绩版本

`PerformanceRevision`，一次完整、不可变的提交快照，包含业绩归属日期、业绩额、成交团队、租约快照和全部协作人分配。

草稿可以编辑；提交后版本冻结。驳回重提或已生效后变更必须产生新版本。

### 4.5 业绩协作人

`PerformanceContributor`，某个业绩版本中参与签约的租户员工，保存其业绩权重、折算业绩额、佣金计算快照和最终佣金。

### 4.6 有效版本

业绩单当前唯一参与排行和员工收益计算的已审核版本。新版本待审或被驳回时，旧有效版本继续生效。

### 4.7 认定流水

`RecognitionEntry`，审核通过后生成的不可变指标流水。员工排行和收益台账只聚合认定流水，不直接扫描草稿、待审版本或钱包流水。

### 4.8 收益调整

`CompensationAdjustment`，对员工已认定佣金或其他应计收益进行人工增加或扣减的审核记录。收益调整不伪装成签约业绩。

### 4.9 幂等命令

`PerformanceCommand`，模块内部的写命令幂等记录。它保存请求指纹和第一次可重放结果，包括成功结果或确定性业务错误；`PerformanceAction` 只记录审计时间线，不兼任幂等存储。

### 4.10 员工收益台账

指定期间内员工已生效佣金、佣金调整和其他收益调整的汇总。它不是钱包余额，也不是已发工资。

## 5. 模块形态

`performance` 是一个深模块。Ninja 路由、管理端页面、Celery 任务和测试均通过模块接口表达业务意图，不直接修改模型状态。

建议目录：

```text
apps/performance/
├── api.py
├── apps.py
├── constants.py
├── models.py
├── schemas.py
├── services.py       # 命令接口及状态流转
├── queries.py        # 统一排行、台账和审核队列口径
├── notifications.py  # 事务提交后的通知适配
└── admin.py
```

外部模块只需理解命令和查询两组接口。接口只接受基础类型 ID 与 DTO；路由不得把已经查询出的 `Lease`、`PerformanceCase`、`OrganizationStaff` 等 ORM 对象传给服务层。

命令接口：

```python
prepare_case_from_lease(*, organization_id, lease_id, actor_id, command: PrepareCaseCommand) -> PerformanceCaseView
save_case_draft(*, organization_id, case_id, actor_id, command: SaveCaseDraftCommand) -> PerformanceCaseView
submit_case(*, organization_id, case_id, actor_id, command: SubmitCaseCommand) -> PerformanceCaseView
review_case(*, organization_id, case_id, actor_id, command: ReviewCaseCommand) -> PerformanceCaseView
open_case_amendment(*, organization_id, case_id, actor_id, command: OpenCaseAmendmentCommand) -> PerformanceCaseView
retry_rejected_case(*, organization_id, case_id, actor_id, command: RetryRejectedCaseCommand) -> PerformanceCaseView
void_case(*, organization_id, case_id, actor_id, command: VoidCaseCommand) -> PerformanceCaseView

submit_adjustment(*, organization_id, actor_id, command: SubmitAdjustmentCommand) -> CompensationAdjustmentView
review_adjustment(*, organization_id, adjustment_id, actor_id, command: ReviewAdjustmentCommand) -> CompensationAdjustmentView
void_adjustment(*, organization_id, adjustment_id, actor_id, command: VoidAdjustmentCommand) -> CompensationAdjustmentView
```

每个命令 DTO 都包含 `command_id`。修改既有资源的命令还必须包含 `expected_version`；审核命令只提交 `revision_id + expected_version`，不由客户端提交 `content_hash`。

正式查询接口：

```python
get_case(*, organization_id, case_id, actor_id) -> PerformanceCaseView
get_case_by_lease(*, organization_id, lease_id, actor_id) -> PerformanceCaseView | None
list_case_summaries_by_lease_ids(*, organization_id, lease_ids, actor_id) -> list[LeasePerformanceSummary]
list_cases(*, organization_id, actor_id, query: CaseListQuery) -> Page[PerformanceCaseRow]
list_review_queue(*, organization_id, actor_id, query: ReviewQueueQuery) -> Page[ReviewQueueRow]

get_adjustment(*, organization_id, adjustment_id, actor_id) -> CompensationAdjustmentView
list_adjustments(*, organization_id, actor_id, query: AdjustmentListQuery) -> Page[CompensationAdjustmentRow]
get_ranking(*, organization_id, actor_id, query: RankingQuery) -> Page[RankingRow]
get_statement(*, organization_id, actor_id, query: StatementQuery) -> Page[StatementRow]
```

HTTP 适配器从认证会话取得 `organization_id` 和 `actor_id`，不能相信请求体自报租户。模块内部重新查询对象、校验租户作用域和权限，并在写命令中加锁。`api.py` 不得直接拼 ORM 查询或修改模型状态。

复杂的金额计算、舍入、快照、状态机、并发锁、幂等、权限范围、认定流水和冲销都隐藏在模块实现内。

## 6. 数据模型与前置身份基础

### 6.1 OrganizationStaff

在 `apps/organizations/` 增加不会因离职而删除的租户员工身份。当前 `OrganizationMember` 仍表示“现在是否有权进入租户”，`OrganizationStaff` 表示“历史上是谁”。

建议字段：

| 字段 | 说明 |
|---|---|
| `organization` | 所属租户 |
| `subject_key` | 租户内不可变 UUID，业务聚合键 |
| `user` | 当前登录账号，可空，账号删除时 `SET_NULL` |
| `display_name` | 当前展示名；历史行另存快照 |
| `status` | `active`、`left` |
| `joined_at/left_at` | 任职时间 |
| `created_at/updated_at` | 时间戳 |

规则：

- `(organization, subject_key)` 唯一；`subject_key` 创建后不可修改或复用。
- 同一租户内非空 `user` 只能关联一个 `OrganizationStaff`。同一账号离职后再加入时恢复原身份和原 `subject_key`。
- 移除组织成员时，在同一事务中把员工标记为 `left`，再删除 `OrganizationMember`、当前团队成员关系和权限绑定；普通业务接口不物理删除 `OrganizationStaff`。
- 用户账号被删除后仅把 `user` 置空。历史排行仍按 `subject_key` 分组，不按空 `user_id` 分组。
- 旧数据只有姓名、没有可关联账号时，迁移可创建 `user=NULL` 的历史员工身份，但每个人必须生成独立 `subject_key`，禁止把所有未知员工合并成一个占位身份。

### 6.2 Team 稳定键与归档

在 `Team` 增加：

| 字段 | 说明 |
|---|---|
| `team_key` | 租户内不可变 UUID |
| `is_active` | 是否可用于新业务 |
| `archived_at` | 归档时间 |

团队“删除”接口改为归档。当前 `(organization, name)` 唯一约束改成“同租户有效团队名称唯一”的条件约束，使归档后可以创建同名新团队；新团队必须生成新 `team_key`。恢复原团队沿用原 `team_key`，若同名有效团队已存在则先解决名称冲突。所有业绩版本、协作人和认定流水都保存 `team_key` 与团队名称快照，团队外键仅用于当前展示或跳转。

### 6.3 Organization 时区与一期币种

`Organization` 增加非空 `timezone` 字段，使用 IANA 时区名称并校验 `zoneinfo.ZoneInfo`。一期默认和现有租户迁移值均为 `Asia/Shanghai`，后续允许租户设置中修改。

一期金额币种固定为 `CNY`，但版本、收益调整和货币类认定流水仍显式保存币种快照。组织时区或系统默认时区以后变化，不得重算既有 `performance_date`、`effective_on` 或币种事实。

本设计中的当前用户外键和当前团队外键统一使用 `SET_NULL`，只负责页面跳转，不得级联删除业绩事实。员工权威引用使用 `OrganizationStaff` 的 `PROTECT` 外键和 `subject_key`；审计状态约束依赖稳定身份快照与时间戳，不能依赖以后可能置空的用户外键。

### 6.4 PerformanceCase

稳定的业绩单身份。

建议字段：

| 字段 | 说明 |
|---|---|
| `organization` | 所属租户，必填 |
| `lease` | 来源租约，`PROTECT`，同一租约唯一 |
| `case_no` | 租户内可读编号 |
| `lifecycle` | `open`、`voided` |
| `effective_revision` | 当前唯一参与统计的版本，可空 |
| `version` | 乐观锁版本号，每个成功写命令递增 |
| `voided_by/voided_at/void_reason` | 当前账号引用、作废时间和原因 |
| `voided_subject_key/voided_name_snapshot` | 稳定作废人身份和姓名快照 |
| `created_by/updated_by` | 当前账号引用，仅用于审计跳转 |
| `created_at/updated_at` | 时间戳 |

约束：

- `lease.organization` 必须等于 `organization`。
- 一个租约只有一个 `PerformanceCase`。
- `voided` 后不能再创建草稿、提交或审核，且 `effective_revision` 必须为空。
- 作废不删除历史版本和认定流水，而是在同一事务中生成反向冲销流水并清空有效版本指针。

### 6.5 PerformanceRevision

一次完整提交版本。

建议字段：

| 字段 | 说明 |
|---|---|
| `case` | 所属业绩单 |
| `revision_no` | 从 1 递增，`case + revision_no` 唯一 |
| `state` | `draft`、`pending_review`、`approved`、`rejected`、`cancelled` |
| `primary_team_key` | 主成交团队稳定键，可空；跨团队协作时可为空 |
| `primary_team` | 当前团队外键，可空，只用于展示或跳转 |
| `primary_team_name_snapshot` | 团队名称快照 |
| `performance_date` | 业绩归属日期 |
| `timezone_snapshot` | 首次确定归属日期时使用的组织时区 |
| `currency` | 一期固定 `CNY` |
| `performance_basis` | `monthly_rent`、`contract_total`、`manual` |
| `performance_amount` | 本单总业绩额，非负 |
| `performance_calculation_snapshot` | 口径、输入、公式版本、计算结果和来源指纹 |
| `performance_manual_reason` | `manual` 时必填 |
| `terminated_registration_reason` | 提交时租约已终止则必填 |
| `source_snapshot` | 房源、租客、签约时间、合同状态、租期、月租等提交快照 |
| `content_hash` | 服务端基于规范化不可变内容生成的内部指纹 |
| `amendment_reason` | 已生效后发起修改时必填 |
| `submitted_by/submitted_at` | 当前账号引用和提交时间 |
| `submitted_subject_key/submitted_name_snapshot` | 稳定提交人身份和姓名快照 |
| `reviewed_by/reviewed_at` | 当前账号引用和审核时间 |
| `reviewed_subject_key/reviewed_name_snapshot` | 稳定审核人身份和姓名快照 |
| `review_decision` | `approved` 或 `rejected` |
| `review_note` | 驳回时必填，通过时可空 |
| `cancelled_from_state/cancelled_by/cancelled_at/cancel_reason` | 业绩单作废时关闭草稿或待审版本的留痕 |
| `created_at/updated_at` | 时间戳 |

规则：

- `draft` 可编辑，其余状态内容不可修改。
- 被驳回版本不回退成草稿；“修改重提”创建新版本并复制上一版内容。
- `cancelled` 只用于业绩单作废时关闭当时的 `draft` 或 `pending_review` 工作版本，不表示审核驳回。
- 一个业绩单最多同时存在一个 `draft` 或 `pending_review` 工作版本。
- 新版本通过前，原 `effective_revision` 和原认定流水继续参与统计。
- 新版本通过时，在同一事务中冲销旧有效版本、生成新认定流水并切换 `effective_revision`。
- `content_hash` 只用于内部审计、幂等结果和服务端一致性校验，不由客户端回传。
- 首次版本按当时组织时区确定 `performance_date`；变更版本默认复制原归属日期和时区快照，只有明确修正归属日期并填写变更原因时才改变。

### 6.6 PerformanceContributor

业绩版本中的员工分配。

建议字段：

| 字段 | 说明 |
|---|---|
| `revision` | 所属版本 |
| `staff` | `OrganizationStaff`，必填，`PROTECT` |
| `subject_key` | 员工稳定键，必填且不可变 |
| `user` | 当前账号，可空，只用于展示或跳转 |
| `subject_name_snapshot` | 员工姓名快照 |
| `team_key` | 业绩归属团队稳定键，可空 |
| `credited_team` | 当前团队外键，可空，只用于展示或跳转 |
| `team_name_snapshot` | 团队名称快照 |
| `role` | `closer`、`assistant`、`channel`、`maintainer`、`other` |
| `performance_share_bp` | 业绩权重，万分比，范围 `1..10000` |
| `credited_performance_amount` | 按权重折算的业绩额 |
| `commission_method` | `percent` 或 `fixed` |
| `commission_base_amount` | 提成基数快照 |
| `commission_rate_bp` | 比例提成万分比，`10000` 表示 100% |
| `commission_calculation_snapshot` | 基数来源、公式版本、计算输入和结果 |
| `calculated_commission_amount` | 系统计算金额 |
| `commission_adjustment_amount` | 对计算金额的人工加减，可正可负 |
| `commission_adjustment_reason` | 人工加减非零时必填 |
| `final_commission_amount` | 最终已申报佣金，不能为负 |
| `remark` | 备注 |

约束：

- 同一版本同一 `subject_key` 只能出现一次。
- 首次申报、新增协作人或把分配改给另一员工时，目标员工必须有 `active` 的 `OrganizationStaff` 和当前 `OrganizationMember`。变更版本可以原样继承当前有效版本中已经离职的 `subject_key` 以修正历史金额，不要求为了修正而把员工重新加入组织。
- `team_key` 必须属于当前租户的有效或归档团队。首次申报或新增/改换团队时目标团队必须有效，员工也必须是该团队当前成员；变更版本可以原样保留当前有效版本中的归档 `team_key` 及原员工归属，但不能向归档团队新增协作人。
- 修改既有历史 `subject_key` 或 `team_key` 归属必须使用组织级 `case_submit` 作用域、填写变更原因，并在审核页显示“历史身份/团队重分配”风险提示；团队级提交人只能原样保留历史归属。
- 所有协作人的 `performance_share_bp` 总和必须等于 `10000`。
- `credited_performance_amount` 由模块计算，调用者不能直接指定。
- 百分比佣金按 `commission_base_amount × commission_rate_bp / 10000` 计算并保留到分；`commission_rate_bp` 范围为 `0..10000`。
- 固定佣金不允许填写 `commission_rate_bp`；比例佣金必须填写。
- 最终佣金可高于本单业绩额，但必须返回风险提示，不阻断提交。

金额舍入使用 `Decimal` 和 `ROUND_HALF_UP`。业绩额分配产生的尾差确定性归入权重最大的协作人；权重相同时归入 `subject_key` 字典序最小者，保证账号删除后重复计算结果仍一致。

### 6.7 PerformanceAction

追加式操作时间线，不允许更新或删除。

建议字段：

- `case`，可空
- `adjustment`，可空
- `revision`，可空，仅业绩单动作使用
- `action`：`case_created`、`case_draft_saved`、`case_submitted`、`case_approved`、`case_rejected`、`case_amendment_opened`、`case_retry_opened`、`case_working_revision_cancelled`、`case_voided`、`adjustment_submitted`、`adjustment_approved`、`adjustment_rejected`、`adjustment_voided`
- `actor`，当前账号可空
- `actor_subject_key` 与 `actor_name_snapshot`
- `note`
- `command`，可空外键，仅用于串联审计，不承担唯一性
- `occurred_at`

`case` 与 `adjustment` 必须恰好一个非空；调整动作的 `revision` 必须为空。`PerformanceAction` 只回答“发生了什么”，不保存或判断幂等状态。

### 6.8 PerformanceCommand

模块内部写命令幂等记录。

建议字段：

| 字段 | 说明 |
|---|---|
| `organization` | 所属租户 |
| `command_id` | 客户端命令键，租户内唯一 |
| `operation` | `prepare_case`、`save_draft`、`review_case` 等固定操作名 |
| `actor_id` | 第一次执行命令的认证账号 ID |
| `request_hash` | 对租户、操作者、操作名、资源 ID 和规范化 DTO 计算的请求指纹 |
| `resource_type/resource_id` | 第一次成功结果关联的聚合 |
| `result_version` | 第一次成功后的资源版本 |
| `result_status` | 第一次确定性返回的 HTTP/应用结果状态 |
| `result_snapshot` | 第一次确定性返回的规范化结果，保证重试不会读到后来状态 |
| `completed_at` | 结果已可重放的完成时间；未完成时为空 |
| `created_at` | 首次接收时间 |

数据库唯一约束为 `(organization, command_id)`。处理规则：

1. 每次请求，包括重放请求，都先校验当前认证、当前 `OrganizationMember`、操作权限和目标资源作用域。校验失败返回当前 401/403，不读取 `result_snapshot`，也不改变已有命令记录。认证授权是安全门，不受业务幂等结果覆盖。
2. 安全门和 HTTP DTO 解析通过后，在外层事务中建立命令记录。使用嵌套 `atomic()` 保存点尝试插入；遇到唯一冲突时回滚保存点，再 `select_for_update` 读取竞争请求提交的记录，不能假定 `get_or_create` 自动解决并发插入。
3. 已存在且 `request_hash` 不同，返回 `409 performance.idempotency_conflict`。
4. 已存在、指纹相同且已完成，在当前权限校验通过后原样返回第一次 `result_status + result_snapshot`；不重新校验资源版本或业务状态。
5. 首次执行的领域变更放在内层保存点中。2xx 成功结果和授权通过后的确定性 4xx 业务结果都写入命令记录并提交；同一请求以后必须重放第一次业务结果。
6. 未预期异常、数据库不可用和其他瞬态 5xx 使外层事务回滚，不固化命令结果，允许安全重试。

### 6.9 CompensationAdjustment

人工收益调整聚合。

建议字段：

| 字段 | 说明 |
|---|---|
| `organization` | 所属租户 |
| `staff/subject_key` | 稳定员工身份，必填；`staff` 使用 `PROTECT` |
| `user` | 当前账号，可空，只用于展示或跳转 |
| `team_key/team` | 稳定团队键和可空当前外键 |
| `subject_name_snapshot/team_name_snapshot` | 历史快照 |
| `bucket` | `commission` 或 `compensation` |
| `direction` | `increase` 或 `decrease` |
| `amount` | 正数金额 |
| `currency` | 一期固定 `CNY` |
| `effective_on/timezone_snapshot` | 台账归属日期及确定日期时使用的组织时区 |
| `reason_code` | `commission_supplement`、`commission_clawback`、`bonus`、`penalty`、`other` |
| `reason` | 业务原因，必填 |
| `related_recognition_entry` | 可选，仅说明补发或扣回针对哪条原认定流水 |
| `status` | `pending_review`、`approved`、`rejected`、`voided` |
| `version` | 乐观锁版本号 |
| `submitted_by/submitted_at` | 提交账号和时间 |
| `submitted_subject_key/submitted_name_snapshot` | 稳定提交人身份和快照 |
| `reviewed_by/reviewed_at/review_note` | 审核账号、时间和意见 |
| `reviewed_subject_key/reviewed_name_snapshot` | 稳定审核人身份和快照 |
| `voided_by/voided_at/void_reason` | 当前账号引用、作废时间和原因 |
| `voided_subject_key/voided_name_snapshot` | 稳定作废人身份和姓名快照 |

`bucket=commission` 影响佣金排行和员工收益台账；`bucket=compensation` 只影响员工收益台账，不影响签约数和业绩额排行。收益调整必须独立提交、审核和作废，不能通过修改字段绕过审核。

`related_recognition_entry` 非空时必须与调整同组织、同 `subject_key`、同 `currency`。`commission_supplement` 和 `commission_clawback` 只能关联 `metric=commission_amount` 的货币流水；关联仅提供业务解释，不修改或标记原流水。

### 6.10 RecognitionEntry

模块内部生成的不可变认定流水，没有直接创建、修改或删除接口。

建议字段：

| 字段 | 说明 |
|---|---|
| `organization` | 所属租户 |
| `staff` | 稳定员工身份，必填，`PROTECT` |
| `subject_key` | 员工稳定聚合键，必填 |
| `user` | 当前账号，可空，只用于展示或跳转 |
| `subject_name_snapshot` | 入账时姓名快照 |
| `team_key` | 团队稳定聚合键，可空 |
| `credited_team` | 当前团队外键，可空，只用于展示或跳转 |
| `team_name_snapshot` | 入账时团队名称快照 |
| `metric` | `deal_credit`、`performance_amount`、`commission_amount`、`compensation_amount` |
| `delta` | 有符号数值，不得为零 |
| `unit` | `count` 或 `currency` |
| `currency` | `unit=currency` 时固定 `CNY`，计数时为空 |
| `effective_on/timezone_snapshot` | 统计归属日期及其时区快照 |
| `contributor` | 来源协作人，可空 |
| `adjustment` | 来源收益调整，可空 |
| `reversal_of` | 被冲销的原流水，可空 |
| `idempotency_key` | 确定性唯一键 |
| `posted_at` | UTC 入账时间 |

查询与约束方向：

```text
(organization, metric, effective_on, subject_key)
(organization, team_key, metric, effective_on, subject_key)
(contributor, metric) UNIQUE WHERE contributor IS NOT NULL AND reversal_of IS NULL
(adjustment, metric) UNIQUE WHERE adjustment IS NOT NULL AND reversal_of IS NULL
(reversal_of) UNIQUE WHERE reversal_of IS NOT NULL
```

每条流水必须且只能有一个来源字段非空：原业绩流水使用 `contributor`，原收益调整流水使用 `adjustment`，冲销流水只使用 `reversal_of`。冲销通过原流水继续追溯业务来源；一个原流水最多只能被冲销一次。排行和台账只按 `subject_key`、`team_key` 聚合，绝不按 `user_id` 或可空外键聚合。

零值指标不生成认定流水，查询时缺失指标按零解释。例如业绩额允许为零、佣金比例允许为零、最终佣金允许为零，但只生成非零的 `RecognitionEntry`；因此 `delta != 0` 与上游允许零金额不冲突。

## 7. 状态与审核流程

### 7.1 首次申报

```text
Lease
  → 创建 PerformanceCase
  → 编辑 revision 1 草稿
  → 提交 revision 1
  → 待审核
      ├─ 通过：revision 1 成为有效版本并生成认定流水
      └─ 驳回：revision 1 冻结，复制为 revision 2 后修改重提
```

驳回后的复制不是 `save_case_draft` 的隐式副作用。调用 `retry_rejected_case`，要求当前没有工作版本、最新版本为 `rejected`，再原子复制最新驳回版本为新的 `draft`；后续保存和提交都针对这个新版本。

### 7.2 已生效后修改

```text
revision 1 已生效
  → 发起变更并填写原因
  → 复制为 revision 2 草稿
  → revision 2 待审核期间 revision 1 继续生效
      ├─ revision 2 通过：冲销 revision 1，revision 2 原子生效
      └─ revision 2 驳回：revision 1 保持生效
```

变更版本被驳回后也使用 `retry_rejected_case` 复制最新驳回内容；`open_case_amendment` 只用于“当前没有驳回重试目标，且需要从有效版本发起全新变更”的场景。因 `source_stale` 被驳回后的刷新复用同一重试命令。

### 7.3 作废

只有具备 `performance.case_void` 权限的用户可以作废业绩单。作废必须填写原因，并在同一事务中完成：

- 若存在 `draft` 或 `pending_review` 工作版本，把它冻结为 `cancelled` 并记录原状态和作废人。
- 若存在有效版本，为其全部原认定流水生成反向流水。
- 清空 `effective_revision`，把业绩单标记为 `voided`。

因此草稿、待审、已生效或“旧版生效且新版待审”的业绩单都能被明确关闭，不会留下永远待审的工作版本。

### 7.4 审核规则

- 一份版本整体通过或整体驳回，不支持部分员工通过。
- 职责分离以稳定身份判断：`submitted_subject_key` 与 `reviewed_subject_key` 默认不得相同，账号 ID 只作为补充审计和当前跳转字段。
- 小型租户确有单人运营需要时，通过明确的 `performance.review_self` 权限例外；该权限必须与 `case_review` 或 `adjustment_review` 同时具备，不允许页面绕过。
- 团队审核人只能审核全部协作人都归属该团队的业绩版本。
- 跨团队或租户级业绩必须由组织级审核人处理。
- 审核命令传入 `revision_id + expected_version`。模块锁定业绩单和指定版本后，校验该版本属于当前业绩单、仍是唯一待审工作版本且聚合版本一致。
- `content_hash` 由服务端在提交时生成，只用于内部审计和一致性校验；客户端不回传。
- 收益调整同样按稳定 `subject_key` 禁止本人审核，不能通过换绑账号或同时拥有多项权限绕过职责分离。

### 7.5 租约登记资格

- 租约必须存在 `sign_at`，否则不能登记业绩。
- `pending` 可以登记，因为它表示合同尚未开始履约，不表示尚未签署；`active`、`expired` 也可以登记和历史补录。
- `terminated` 不自动否定已经发生的签约事实。存在 `sign_at` 时允许登记，但必须填写 `terminated_registration_reason`，审核页显著展示可验证的终止状态和风险提示；当前 `Lease` 没有终止时间字段，不得用 `updated_at` 冒充终止时间。没有 `sign_at` 的终止租约不得登记。
- 租约在提交后发生影响口径的变更时，审核命令不得执行“通过”，并返回 `performance.source_stale`；审核人仍可对该待审版本执行“驳回”。驳回后再复制为新草稿并刷新来源快照，避免待审版本占用唯一工作版本而形成死锁。
- 租约后来到期或终止不会自动冲销已生效业绩。若业务认定需要变化，必须显式发起业绩版本变更、作废或一次性收益扣回。

### 7.6 业绩额口径

默认 `performance_basis=monthly_rent`，即业绩额等于提交时服务端读取的 `Lease.monthly_rent`，不是合同总额、服务费、佣金基数或人工填写值。

支持口径：

| 口径 | 规则 |
|---|---|
| `monthly_rent` | 服务端读取租约月租；客户端不能覆盖金额 |
| `contract_total` | 只能由有明确版本号的服务端计算器生成；在合同总额公式正式评审并实现前返回 `performance.performance_basis_unsupported`，禁止客户端自行填写“合同总额” |
| `manual` | 客户端填写金额，`performance_manual_reason` 必填，并在提交和审核页面显示风险提示 |

`performance_calculation_snapshot` 至少保存：

- `basis`
- `formula_version`
- 租约 ID、签约时间、状态、起止日期、月租等输入快照
- 来源字段指纹
- 舍入规则
- 计算结果和 `currency=CNY`
- 手工口径的填写人、金额和原因

若以后启用 `contract_total`，必须先单独确定完整月、非完整月、免租期、优惠和提前终止的算法；不能让实现者自行猜测。

一期页面只展示 `monthly_rent` 和 `manual`；`contract_total` 在服务端计算器和验收用例完成前不作为可选项暴露。

### 7.7 佣金口径与两类修改

- 比例佣金只接受整数 `commission_rate_bp`。例如 `6000` 表示 60%，计算公式为 `commission_base_amount × 6000 / 10000`；接口不接受 `0.6` 等小数比例。
- 已生效版本的员工分配、团队、业绩权重、业绩额口径、佣金基数、比例或计算结果错误，必须发起 `PerformanceRevision` 变更。新版本通过后冲销旧流水并生成新流水。
- 原认定事实正确，后续因独立业务决定产生的一次性佣金补发、扣回、奖金或罚款，使用 `CompensationAdjustment`。
- `CompensationAdjustment` 不得用于静默修正原始分配或计算错误；`commission_adjustment_amount` 只允许在版本提交前表达该版本内有理由的人工覆盖。

### 7.8 收益调整流程

```text
提交调整 → pending_review
  ├─ 审核通过：approved，并生成对应 RecognitionEntry
  └─ 审核驳回：rejected，记录意见且内容冻结

approved → 作废：voided，并为原调整流水生成唯一反向流水
```

- 提交后不能直接编辑；被驳回后如需重提，创建新的调整并可关联原调整。
- 审核通过、流水生成和版本递增必须在同一事务完成。
- 作废只适用于 `approved` 调整，必须具备 `adjustment_void` 权限并填写原因。
- `commission_supplement` 只能与 `bucket=commission + direction=increase` 组合；`commission_clawback` 只能与 `bucket=commission + direction=decrease` 组合；`bonus`、`penalty` 分别对应收益增加和扣减。

## 8. 排行与员工台账口径

所有排行只聚合 `RecognitionEntry`，不读取行为分析事件、钱包流水或当前可编辑模型。员工维度固定按 `(organization, subject_key)` 聚合；团队筛选和团队小计按 `team_key` 聚合。

### 8.1 排行指标

- `deal_credit`：折算成交数。例如 60% 权重计 `0.6` 单。
- `performance_amount`：折算业绩额。
- `commission_amount`：已生效佣金，包含已批准的佣金补发和扣回。

默认按 `performance_amount` 降序。同值使用 `dense_rank`，展示同一名次；分页稳定排序追加 `subject_key`，绝不使用可空 `user_id`。

期间内有认定流水的离职员工默认仍参与历史排行，并标记“已离职”。展示名称优先读取对应 `OrganizationStaff.display_name`，员工身份不可用时回退到该期间最近一条流水的 `subject_name_snapshot`。团队展示遵循相同规则，归档团队不会与同名新团队合并。

### 8.2 日期口径

- 签约业绩按 `performance_date` 统计。
- 收益调整按 `effective_on` 统计。
- 日期只使用 `Organization.timezone` 解释，不回退到操作者时区或 Django 全局 `TIME_ZONE`。
- 审核时间只表示何时生效，不改变业绩归属日期。
- `Lease.sign_at` 在首次提交时按 `PerformanceRevision.timezone_snapshot` 转为 `performance_date`；组织后来修改时区不会回算旧版本。
- 数据库时间戳仍以 UTC 保存，日期型业务事实保存已经确定的本地日期和时区快照。

### 8.3 员工收益台账

分别展示：

- 签约佣金
- 佣金补发
- 佣金扣回
- 其他收益增加
- 其他收益扣减
- 应计合计

“应计合计”不等于钱包可用余额，也不等于已支付金额。

普通员工通过当前账号关联的 `OrganizationStaff.subject_key` 查询本人台账；离开组织后不再具备查询权限，但历史数据仍可由有报表权限的租户人员按 `subject_key` 查询。

## 9. 权限

建议新增：

| 权限 | 用途 |
|---|---|
| `performance.case_view` | 查看作用域内业绩单 |
| `performance.case_submit` | 创建、保存、提交、驳回重试和发起版本变更 |
| `performance.case_review` | 审核通过或驳回业绩版本 |
| `performance.case_void` | 关闭草稿/待审业绩单或作废已生效业绩单 |
| `performance.adjustment_submit` | 提交人工收益调整 |
| `performance.adjustment_review` | 审核通过或驳回收益调整 |
| `performance.adjustment_void` | 作废已生效收益调整 |
| `performance.report_view` | 查看团队/租户排行和他人收益台账 |
| `performance.review_self` | 例外允许审核本人提交的业绩或收益调整 |

角色建议：

- `org_admin`：除 `review_self` 外的全部权限。
- `org_finance`：组织范围 `case_view/review/void`、`adjustment_submit/review/void`、`report_view`。
- `team_manager`：团队范围 `case_view/submit`、`adjustment_submit`、`report_view`。
- `team_finance`：团队范围 `case_view/review`、`adjustment_review`、`report_view`；默认没有作废权限。
- `team_staff`：团队范围 `case_view/submit`，只能查看本人台账。

最小权限规则：

- `case_review` 不隐含 `case_void`，`adjustment_review` 不隐含 `adjustment_void`。
- `review_self` 只豁免职责分离，不单独授予审核能力；必须同时具有对应审核权限。
- 业绩版本和收益调整都执行 `submitted_subject_key != reviewed_subject_key`。包括 `org_admin` 在内的默认系统角色均不自动获得 `review_self`；当前“管理员获取全部权限”的种子逻辑需要对该权限显式排除。
- 普通员工查询接口只能返回自己的数据；团队权限只能收窄到授权团队；组织权限可覆盖当前租户。
- 跨团队业绩只能由组织级 `case_review` 审核；团队级审核权限不能因接口参数扩大范围。

## 10. HTTP 接口

所有分页接口使用 `page`、`page_size` 和项目统一最小分页响应。请求体不接收 `organization_id`；HTTP 适配器从当前租户上下文取得它，并把基础类型 ID 和 DTO 传给模块接口。

### 10.1 业绩单

```text
GET  /api/performance/cases/
POST /api/performance/cases/from-lease/{lease_id}/
GET  /api/performance/cases/{case_id}/
PUT  /api/performance/cases/{case_id}/draft/
POST /api/performance/cases/{case_id}/submit/
POST /api/performance/cases/{case_id}/review/
POST /api/performance/cases/{case_id}/amendments/
POST /api/performance/cases/{case_id}/retries/
POST /api/performance/cases/{case_id}/void/
```

草稿接口一次提交完整业绩额和协作人列表，不提供逐条协作人 CRUD，避免页面绕过整体校验。

所有写接口都要求 `command_id`。保存草稿、提交、发起变更、驳回重试、审核和作废还要求 `expected_version`；创建业绩单和首次提交收益调整因为尚无既有聚合版本，不要求 `expected_version`。

审核请求：

```json
{
  "revision_id": 42,
  "decision": "approve",
  "note": "",
  "expected_version": 7,
  "command_id": "review-case-18-r2"
}
```

### 10.2 收益调整

```text
GET  /api/performance/adjustments/
POST /api/performance/adjustments/
GET  /api/performance/adjustments/{adjustment_id}/
POST /api/performance/adjustments/{adjustment_id}/review/
POST /api/performance/adjustments/{adjustment_id}/void/
```

### 10.3 排行与台账

```text
GET /api/performance/lease-summaries/?lease_ids=1,2,3
GET /api/performance/rankings/?metric=performance_amount&date_from=...&date_to=...&team_key=...
GET /api/performance/statements/me/?date_from=...&date_to=...
GET /api/performance/statements/?subject_key=...&team_key=...&date_from=...&date_to=...
GET /api/performance/review-queue/?team_key=...&date_from=...&date_to=...
```

查询响应可以附带当前 `user_id`、`team_id` 供页面跳转，但筛选、聚合和稳定分页使用 `subject_key`、`team_key`。

## 11. 管理端设计

### 11.1 租约入口

租约列表和详情显示业绩状态：

- 未登记
- 草稿
- 待审核
- 已驳回
- 已生效
- 变更中
- 变更待审
- 已作废

操作包括“登记业绩”“修改重提”“查看业绩”和“发起变更”。

租约列表先取得租约数据，再批量调用 performance 的租约摘要接口并按 `lease_id` 合并状态；不要求 `house` 返回 performance 字段。

### 11.2 业绩管理

路由：`/performance/cases`

- 支持状态、团队、提交人、审核人、业绩日期和关键字筛选。
- 列表展示来源租约、业绩额、协作人数、佣金合计、当前有效版本和工作版本状态。
- 详情展示租约快照、协作人分配、计算过程、审核意见和完整时间线。
- 员工与团队筛选使用稳定键；已离职员工和归档团队保留历史标签，不与空账号或同名新团队合并。

### 11.3 审核队列

可作为业绩列表的“待我审核”视图，不单独复制一套页面。

审核人必须看到：

- 租约与房源快照
- 总业绩额、`performance_basis`、公式版本、时区和 `CNY` 币种快照
- 各员工权重与折算业绩
- 佣金基数、`commission_rate_bp`/固定金额、系统计算值、人工调整和最终值
- 与当前有效版本的差异
- 风险提示，例如手工业绩额、终止租约补录、佣金合计高于业绩额

### 11.4 员工排行

路由：`/performance/rankings`

- 日期范围、团队和指标切换。
- 展示名次、员工、折算成交数、业绩额、已生效佣金。
- 默认按业绩额排序。
- 普通员工可以查看自己的名次和指标；是否开放完整榜单由权限决定。
- 离职员工仍出现在所选历史期间，页面标记“已离职”；归档团队仍可作为历史筛选项。

### 11.5 收益调整与个人台账

路由：`/performance/compensation`

- 提交、审核、作废按钮分别按独立权限显示；页面不能因为同一用户拥有多项权限而绕过自审限制。
- 普通员工只能查看自己的应计收益台账。
- 页面明确标注“应计金额，不代表已发放”。

## 12. 与其他模块的集成

### 12.1 Organizations 与 Teams

`performance` 依赖 `OrganizationStaff.subject_key`、`Team.team_key` 和 `Organization.timezone`。组织成员移除和团队归档必须通过各自领域服务维护这些稳定身份，performance 不自行复制一套成员生命周期。

当前用户账号、`OrganizationMember` 和 `Team.members` 只用于提交时资格与权限校验；历史事实以稳定键和快照为准。

### 12.2 Lease

`performance` 单向读取租约并生成快照；`house` 不反向导入 `performance`。

租约后续修改、到期或终止不会静默改写已生效业绩。需要修正时必须发起业绩变更或作废。

租约列表和详情通过 performance 批量摘要接口取得业绩状态，并在前端按 `lease_id` 组合展示。若未来需要服务端按业绩状态联合筛选租约，应放在同时依赖 `house` 与 `performance` 的组合查询层，不能放进 `house` 模型或领域服务。

### 12.3 Finance

现有财务草案中的 `BillEntry.commission` 不再作为员工提成事实来源。

未来 `finance.Bill/BillEntry` 只负责收入、成本、收款和付款。若财务报表需要把员工佣金计为公司成本，可以：

1. 查询 `performance` 的已认定佣金合计；或
2. 幂等投影为只读的 `commission_cost` 财务条目。

数据方向只能是：

```text
Performance RecognitionEntry 净认定流水 → Finance 佣金成本投影
```

财务投影必须同时消费原流水与冲销流水并以认定流水 ID 幂等；财务条目不能反向改变业绩、审核状态或排行榜。

### 12.4 Wallet 与未来结算

一期没有 wallet 依赖。`RecognitionEntry` 永远只表示业绩或应计收益认定，不保存“待发放”“已发放”状态，钱包也不能扫描它寻找所谓“未发放流水”。

未来出现真实发放需求时，先独立设计 `SettlementBatch + SettlementItem`（名称可在该阶段再定）结算聚合：

```text
RecognitionEntry
  → 租户级结算项按 organization + subject_key 幂等引用
  → 结算聚合记录结算金额、币种、状态和付款目标快照
  → 明确的入账/付款命令交给钱包或外部支付适配器
```

当前 `WalletAccount` 是用户全局账户，不是租户账户，而且历史员工可能已经没有 `user`。在租户级钱包子账户或外部收款人模型被正式设计前，performance 不直接写钱包。

### 12.5 Notifications

一期最佳努力通知使用 `transaction.on_commit(callback, robust=True)`，不得在领域事务内直接调用通知服务。事务提交后发送：

- 业绩待审核通知
- 审核通过通知
- 审核驳回通知
- 已生效业绩被作废通知
- 收益调整审核结果通知

通知收件资格在回调执行时按当前 `OrganizationMember` 重新校验。员工已经离开组织时跳过投递，但保留 `OrganizationStaff`、姓名快照和历史认定流水；跳过收件人或通知失败都不得回滚已经提交的业绩事务。

若后续要求保证最终送达，应在领域事务中写入 outbox，由 Celery 使用事件幂等键重试投递，而不是依赖同步通知调用。

### 12.6 Analytics

可记录 `performance.submitted`、`performance.approved`、`performance.rejected`、`performance.voided` 等事件用于流程分析，但行为事件不是业务权威数据。

## 13. 并发、幂等、数据库约束和错误

### 13.1 事务与锁

所有写命令遵循统一顺序：

1. 校验当前认证、组织成员资格、操作权限和目标资源作用域；重放请求也不能跳过。
2. 规范化 DTO 并计算 `request_hash`。
3. 按 6.8 节的“保存点插入、唯一冲突后锁定”算法创建或锁定 `(organization, command_id)` 对应的 `PerformanceCommand`；若已有同请求结果，在安全门通过后直接重放。
4. 首次执行时，在领域保存点中通过基础类型 ID 重新查询并 `select_for_update` 锁定 `PerformanceCase` 或 `CompensationAdjustment`；审核时同时锁定指定版本。
5. 锁内重新校验租户作用域、稳定员工身份、团队资格、权限、来源快照和 `expected_version`。
6. 成功时执行状态迁移、认定流水生成/冲销、有效版本切换和审计动作；授权通过后的确定性业务错误则回滚领域保存点但保留可重放错误结果。
7. 保存第一次 `result_status + result_snapshot` 后提交外层事务，再安排通知或分析事件。

除创建新聚合外，所有写命令使用 `expected_version` 防止覆盖他人修改。认定流水同时使用确定性 `idempotency_key` 和数据库唯一约束；幂等命令在当前授权仍成立时返回第一次成功或确定性业务错误，不返回“重复命令”错误。HTTP/DTO 解析错误、当前 401/403 安全门失败不进入或覆盖命令结果，未预期 5xx 不固化。

### 13.2 数据库可执行约束

至少建立以下约束：

- `OrganizationStaff(organization, subject_key)` 唯一；非空 `(organization, user)` 唯一。
- `Team(organization, team_key)` 唯一，`team_key` 不可修改；同租户只有 `is_active=True` 的团队名称需要条件唯一。
- `PerformanceCase(organization, lease)` 唯一。
- `PerformanceRevision(case, revision_no)` 唯一。
- 条件唯一：同一 `case` 在 `state IN (draft, pending_review)` 时最多一条工作版本。
- 版本状态与审核字段一致：
  - `draft` 没有提交和审核快照；
  - `pending_review` 有 `submitted_at + submitted_subject_key + submitted_name_snapshot`，没有审核快照；
  - `approved/rejected` 同时有稳定提交/审核身份快照和时间，且 `review_decision` 与 `state` 一致；
  - `rejected` 的 `review_note` 非空；
  - `cancelled` 有稳定取消人身份、时间和原因，没有审核决定，且 `cancelled_from_state` 只能是 `draft` 或 `pending_review`。
- `PerformanceRevision.currency = CNY`，`performance_amount >= 0`；`manual` 口径必须有 `performance_manual_reason`。
- `PerformanceContributor(revision, subject_key)` 唯一；`performance_share_bp` 在 `1..10000`。
- `commission_method=percent` 时 `commission_rate_bp` 非空且在 `0..10000`；`commission_method=fixed` 时必须为空。
- `PerformanceAction.case` 与 `adjustment` 恰好一个非空；调整动作不能关联 `revision`。
- `PerformanceCommand(organization, command_id)` 唯一。
- `CompensationAdjustment.amount > 0`、`currency=CNY`，状态与稳定提交/审核/作废身份快照及时间一致；佣金补发/扣回、奖金/罚款的 `bucket + direction + reason_code` 组合必须匹配。
- `RecognitionEntry.delta != 0`，且 `contributor`、`adjustment`、`reversal_of` 三个来源字段必须恰好一个非空。
- `RecognitionEntry(organization, idempotency_key)` 唯一。
- 原协作人流水 `(contributor, metric)` 条件唯一；原收益调整流水 `(adjustment, metric)` 条件唯一。
- 非空 `reversal_of` 条件唯一，保证一个原流水最多被冲销一次。
- 指标与单位、币种严格匹配：

```text
deal_credit                                      → unit=count, currency=NULL
performance_amount/commission_amount/
compensation_amount                              → unit=currency, currency=CNY
```

以下跨行或跨表关系由锁内领域服务校验，不能误称普通 `CheckConstraint` 可以完成：`effective_revision` 必须属于当前 case 且为已批准版本；Contributor、Adjustment、Entry 的 `staff/subject_key`、团队外键/`team_key`、来源记录及组织必须互相匹配；收益调整关联的原认定流水必须同组织、同员工和同币种；冲销流水必须与原流水同组织、同 `subject_key`、同 `team_key`、同指标和单位，且 `delta` 正好相反；全部协作人权重总和必须等于 `10000`。

### 13.3 建议错误

| 错误 | HTTP | 含义 |
|---|---:|---|
| `performance.lease_not_eligible` | 422 | 租约没有签约时间或状态不满足登记条件 |
| `performance.terminated_reason_required` | 422 | 终止租约补录未填写专项原因 |
| `performance.source_stale` | 409 | 租约事实在提交后变化，当前版本只能驳回、不能通过 |
| `performance.performance_basis_unsupported` | 422 | 所选业绩额口径尚无已批准的服务端计算器 |
| `performance.scope_mismatch` | 422 | 租约、团队或员工跨租户 |
| `performance.subject_not_eligible` | 422 | 员工稳定身份不存在、已离职或没有当前成员资格 |
| `performance.team_not_eligible` | 422 | 团队不存在、已归档或员工不属于该团队 |
| `performance.invalid_share_total` | 422 | 业绩权重总和不是 100% |
| `performance.invalid_commission` | 422 | 提成基数、方法或万分比字段不合法 |
| `performance.invalid_transition` | 409 | 当前状态不允许该操作 |
| `performance.stale_version` | 409 | 乐观锁版本冲突 |
| `performance.idempotency_conflict` | 409 | 同一命令键被不同请求使用 |
| `performance.self_review_forbidden` | 403 | 提交人无权审核本人记录 |
| `performance.review_scope_forbidden` | 403 | 审核人权限范围不足 |
| `performance.approved_immutable` | 409 | 已生效版本不能直接修改 |

## 14. 旧项目迁移映射

| 旧数据 | 新数据 |
|---|---|
| `Bill.bill_type=1` | `PerformanceCase + PerformanceRevision + PerformanceContributor` |
| `Bill.staff` | 先映射或创建独立 `OrganizationStaff.subject_key`，再创建单个 `PerformanceContributor`，权重 100% |
| `Bill.profit` | 初始 `performance_amount` 或最终佣金，迁移前需按旧业务口径确认 |
| `Bill.checked=False` | 待审核版本 |
| `Bill.checked=True, approved=True` | 已生效版本并生成认定流水 |
| `Bill.checked=True, approved=False` | 已驳回版本，不生成认定流水 |
| `Bill.bill_type=2` 勘察奖励 | `CompensationAdjustment(bucket=compensation, reason_code=bonus)` |
| `Salary.salary > 0` | 收益增加调整 |
| `Salary.salary < 0` | 收益扣减调整 |

迁移必须先生成预览报告，列出无法判断 `profit` 是“业绩额”还是“佣金”的记录，禁止静默猜测。

迁移还必须：

- 为每个现有组织显式回填 `timezone=Asia/Shanghai`，所有迁移金额标记 `currency=CNY`。
- 按“租户 + 可确认员工”生成稳定 `subject_key`；无法确认账号的同名员工不得仅凭姓名自动合并，需生成独立历史身份并列入人工核对报告。
- 为现有团队生成 `team_key`；旧记录无法映射团队时保留空团队键和原名称快照，不映射到当前同名团队。
- 对已审核通过记录同步生成 `RecognitionEntry`，不能先迁移为“已批准”再等待后续批次补流水。
- 对旧数据中的比例字段明确转换为 `commission_rate_bp`，任何无法判断“0.6 是 60% 还是 0.6%”的记录必须人工确认。

旧项目排行榜曾存在未严格过滤审核通过状态的风险；新排行只聚合认定流水，从结构上排除草稿、待审和驳回记录。

## 15. 测试重点

后端：

- 单人及多人业绩分配计算正确，权重总和严格等于 100%。
- 金额舍入和尾差按 `subject_key` 确定归属且可重复。
- 跨租户、跨团队员工不能被错误分配。
- 两个不同历史员工的账号和成员记录均被删除后，排行仍按两个不同 `subject_key` 分开。
- 团队改名、归档后历史仍按原 `team_key` 聚合；同名新团队不会合并旧团队数据。
- 驳回重提生成新版本，不覆盖旧审核记录。
- `retry_rejected_case` 只复制最新驳回版本；普通保存草稿不会隐式创建新版本，`source_stale` 驳回后可以正常刷新重提。
- 变更待审期间旧版本继续参与排行。
- 作废带草稿或待审变更的业绩单时，工作版本转为 `cancelled`，有效流水只冲销一次。
- 新版本通过时旧流水被冲销且新流水只生成一次。
- 零业绩额或零佣金不生成零值流水，查询聚合仍正确显示为零。
- 第一版审核通过立即生成认定流水，不存在“已批准但无权威流水”的状态。
- 相同命令键和相同请求在当前授权仍成立时返回第一次 2xx 或确定性业务 4xx 结果；相同键不同请求返回 409，后续业务状态变化不改变快照；撤销成员资格或权限后重放返回当前 403，瞬态 5xx 可以重试。
- 业绩和收益调整都按稳定 `subject_key` 执行提交人与审核人分离；换绑账号不能绕过，`review_self` 只与对应审核权限组合生效。
- 收益调整只影响指定指标。
- 普通员工只能查看自己的收益台账。
- 组织时区边界附近的 `sign_at` 得到正确 `performance_date`；修改组织时区不回算旧版本。
- `monthly_rent`、`manual` 和暂不支持的 `contract_total` 口径及计算快照符合规则。
- `commission_rate_bp=6000` 明确计算为 60%，接口拒绝含义不清的小数比例。
- `pending`、`active`、`expired`、`terminated` 的登记资格和专项原因规则正确。
- 数据库拒绝第二个工作版本、重复冲销、混合流水来源、状态字段矛盾以及指标/单位/币种不匹配。
- 查询接口按 `subject_key/team_key` 稳定分页；`api.py` 不直接查询或修改 performance ORM。
- 租约摘要没有引入 `house -> performance` 领域依赖；钱包没有扫描 `RecognitionEntry`。

前端：

- 租约页能正确展示业绩状态和入口。
- 草稿一次保存完整协作人分配。
- 审核页完整展示计算快照和版本差异。
- 已生效版本没有直接编辑入口。
- 终止租约补录、手工业绩额和佣金超额都有显著风险提示。
- 离职员工、归档团队和同名新团队在排行中展示正确。
- 各高风险按钮按独立权限控制，前端不能绕过后端自审校验。
- 排行和个人台账明确区分业绩、佣金、收益调整和钱包余额。

## 16. 分阶段实施建议

### 第一阶段：完整业绩事实闭环

- 前置身份与组织事实：`OrganizationStaff.subject_key`、`Team.team_key` 与团队归档、`Organization.timezone`、一期 `CNY`。
- 独立权限键及默认角色映射。
- `PerformanceCase`
- `PerformanceRevision`
- `PerformanceContributor`
- `PerformanceAction`（第一阶段只包含业绩单目标和业绩动作）
- `PerformanceCommand`
- `RecognitionEntry`
- 第一阶段的 `RecognitionEntry` 迁移只包含 `contributor` 与 `reversal_of` 两类互斥来源；不提前创建未开放的收益调整外键。
- 草稿、提交、审核、驳回重试、变更和作废命令。
- 首次审核生效、有效版本切换、原流水冲销和新流水生成。
- 数据库约束、幂等返回、写命令接口及命令返回视图。
- 完成登记与审核闭环必需的 `get_case`、`get_case_by_lease`、`list_cases` 和最小审核队列查询；第一阶段可不提供管理端页面。

第一阶段必须形成“审核通过即存在权威认定流水”的完整闭环。禁止上线或保留“版本已批准，但等待第二阶段再生成流水”的中间状态；作废也必须从第一天起真实冲销流水。

### 第二阶段：查询投影与页面

- 租约业绩批量摘要查询。
- 员工排行查询。
- 个人佣金台账和有权限的员工台账查询。
- 基于第一阶段命令与查询接口实现租约入口、业绩登记/审核、排行和台账页面。
- 报表筛选；导出只在确认有真实需求时增加。

第二阶段只增加查询投影和交互页面，不增加新的权威业务事实、审核状态或流水切换规则。

### 第三阶段：收益调整

- `CompensationAdjustment`
- 通过第三阶段迁移为 `RecognitionEntry` 增加 `adjustment` 外键，并把来源约束从两类互斥替换为 `contributor/adjustment/reversal_of` 三类互斥。
- 通过同阶段迁移为 `PerformanceAction` 增加调整目标和调整动作类型，并建立 `case/adjustment` 目标互斥约束。
- 独立的调整提交、审核、作废权限与状态机。
- 调整审核通过后的认定流水和作废冲销。
- 收益调整页面与员工完整应计收益台账。

三个阶段均不接钱包。未来财务模块和结算/发放模块分别独立设计；结算模块只能显式引用认定流水，钱包不能自行寻找“未发放业绩”。

## 17. 验收口径

设计实施完成后应满足：

- 一份租约只能对应一个稳定业绩单，但可以保留多个审核版本。
- 员工和团队分别以租户内稳定 `subject_key`、`team_key` 保存历史；账号删除、离职、团队归档和同名重建不会合并历史主体。
- 一笔签约可以按权重分配给多个员工，整单业绩不会重复膨胀。
- 业绩额明确记录 `performance_basis`、计算快照、组织时区和 `CNY` 币种；比例佣金只使用 `commission_rate_bp`。
- 审核通过与认定流水生成在同一事务完成；没有认定流水就不能形成已批准结果。
- 审核驳回、变更、作废和冲销均可追溯。
- 同一命令键的相同请求在当前授权仍成立时返回第一次业务结果，不同请求返回幂等冲突；权限撤销后不泄露历史响应快照，审计动作不兼任幂等存储。
- 业绩审核、业绩作废、调整提交、调整审核和调整作废分别授权，两类审核都默认禁止自审。
- 员工排行、佣金和收益调整有明确且互不混淆的统计口径。
- `house` 不反向依赖 performance；租约状态通过 performance 摘要接口或组合查询层展示。
- 钱包、经营账单、业绩认定和未来结算/发放互不替代。
