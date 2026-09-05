# 应计收益分配模块设计

日期：2026-08-29
状态：已确认，待实施

本文替代 `2026-07-19-signing-performance-compensation-design.md` 作为当前实施依据。旧设计稿保留用于追溯，不再代表当前方案。

## 1. 结论

新增一个业务无关的应计收益分配核心模块，并由具体业务模块通过明确的关联表接入。

第一期只接入租约，新增五张表：

```text
house.Lease
  │
  ▼
house.LeaseAllocation
  │
  ▼
allocation.AllocationRequest
  ├── allocation.AllocationItem
  └── allocation.AllocationShare
          │ 审核通过
          ▼
      allocation.AccrualEntry
```

五张表分别保存五种不同事实：

| 模型 | 唯一职责 |
|---|---|
| `LeaseAllocation` | 明确连接租约与通用分配申请，并保护两端不被物理删除 |
| `AllocationRequest` | 保存一次不可修改的分配申请、审核状态和可分配金额 |
| `AllocationItem` | 保存计算依据金额的增加、扣减明细 |
| `AllocationShare` | 保存审核中的受益人、权重和计划分配结果 |
| `AccrualEntry` | 保存审核通过后生效的不可变正负应计流水 |

本模块不是财务总账，不处理实际收付款、钱包余额、工资发放、应收应付、银行流水、对账或月度冻结。

## 2. 设计原则

- 核心 `allocation` 模块不得依赖 `house.Lease` 或其他具体业务模型。
- 具体业务模块主动关联和编排通用分配申请，依赖方向固定为 `house → allocation`。
- 第一期不引入 `source_kind`、GenericForeignKey、来源注册表、适配器注册机制或通用来源解析接口。
- 每种真实业务来源使用自己的显式关联表；出现三种以上来源且重复代码已经明显时，再评估统一来源适配机制。
- 分配申请提交后不可修改。审核不通过或过期后不能重提；再次申请必须创建新的业务单据。
- 审核中的分配方案与已经生效的应计流水必须分开保存。
- 应计流水只能追加和冲销，不得修改或删除。
- 金额统一使用精确 `Decimal`，一期币种固定为 `CNY`，禁止使用浮点数。
- 一期所有业务月份统一按 `Asia/Shanghai` 计算，不提前增加组织时区字段；出现真实的跨时区租户需求后再扩展。
- 所有权限、租户范围和金额关系都在服务端重新校验，不能信任请求体自报的组织或计算结果。

## 3. 领域边界

### 3.1 分配申请

`AllocationRequest` 表示一份业务单据形成的应计收益分配申请，回答：

- 为什么进行分配；
- 计算依据金额是多少；
- 可分配金额是多少；
- 申请何时提交、何时过期；
- 审核结果是什么。

它不是员工已经获得的收益。只有审核通过后生成的 `AccrualEntry` 才是生效事实。

### 3.2 计算依据项

`AllocationItem` 回答可分配金额的业务计算依据由哪些增加项和扣减项组成。它不表示真实资金收入或支出。

### 3.3 分配明细

`AllocationShare` 表示申请计划分给哪个受益人、其权重和金额。申请仍在待审核时，分配明细不进入员工收益统计。

### 3.4 应计流水

`AccrualEntry` 表示已经生效的员工应计收益变化，包括：

- 审核通过的业务分配；
- 管理员人工增加；
- 管理员人工扣减；
- 已生效流水的冲销。

应计流水不表示已经付款、已经发薪或已经进入钱包。

## 4. 模块关系

### 4.1 业务模块主动关联

第一期由 `house` 模块定义：

```text
LeaseAllocation
- lease                   OneToOne → house.Lease, PROTECT
- allocation_request  OneToOne → AllocationRequest, PROTECT
- created_at
```

关联表不提供修改和删除接口。租约、申请、计算项、分配明细和关联记录必须在同一事务中创建。

未来出现其他业务来源时，优先由其业务模块增加自己的明确关联表，例如：

```text
MotorcycleTradeAllocation
ServiceOrderAllocation
```

核心 `allocation` 模块不导入、解析或反向调用这些业务模型。

### 4.2 业务快照

`AllocationRequest.source_snapshot` 由来源业务模块在创建申请时提供。核心模块只保存快照，不根据其中字段执行业务判断。

租约快照可以包含当时用于审核展示的房源、租客、签约时间、租期、月租和租约状态。快照只用于追溯，不取代租约关系型事实。

## 5. 数据模型

### 5.1 AllocationRequest

| 字段 | 说明 |
|---|---|
| `organization` | 所属组织，必填，`PROTECT` |
| `status` | `pending`、`approved`、`rejected`、`expired`、`voided` |
| `basis_amount` | 计算依据金额，非负 |
| `distribution_method` | `percentage` 或 `fixed` |
| `distribution_rate_bp` | 比例万分比；比例模式必填 |
| `distributable_amount` | 最终可分配金额，非负 |
| `currency` | 一期固定 `CNY` |
| `source_snapshot` | 来源业务提交时快照，JSON 对象 |
| `submitted_by` | 申请人，`PROTECT` |
| `submitted_by_name_snapshot` | 申请人姓名快照 |
| `submitted_at` | 提交时间 |
| `expires_at` | 审核截止时间，固定为提交后 168 小时 |
| `reviewed_by` | 审核人，可空，`PROTECT` |
| `reviewed_by_name_snapshot` | 审核人姓名快照 |
| `reviewed_at` | 审核时间 |
| `rejection_reason` | 审核不通过时必填 |
| `voided_by` | 作废人，可空，`PROTECT` |
| `voided_by_name_snapshot` | 作废人姓名快照 |
| `voided_at` | 作废时间 |
| `void_reason` | 作废时必填 |
| `created_at/updated_at` | 创建和更新时间 |

申请创建后，金额、业务快照、计算项和分配明细不可修改。后续只允许状态及其对应审核、过期或作废字段发生合法迁移。

比例模式的可分配金额由服务端计算：

```text
distributable_amount = basis_amount × distribution_rate_bp / 10000
```

所有货币计算统一量化到 `0.01` 元并使用 `ROUND_HALF_UP`。固定模式直接使用请求中的 `distributable_amount`，比例模式则由服务端计算并冻结该字段。

### 5.2 AllocationItem

| 字段 | 说明 |
|---|---|
| `allocation_request` | 所属申请 |
| `name` | 明细名称 |
| `effect` | `increase` 或 `decrease` |
| `amount` | 正数金额 |
| `sort_order` | 展示顺序 |
| `remark` | 备注 |

计算公式：

```text
basis_amount = increase 金额合计 - decrease 金额合计
```

计算结果必须非负。计算项只是分配依据，不得命名或解释为真实公司收入、支出或资金流水。

### 5.3 AllocationShare

| 字段 | 说明 |
|---|---|
| `allocation_request` | 所属申请 |
| `beneficiary_user` | 当前受益人账号，`PROTECT` |
| `beneficiary_name_snapshot` | 受益人姓名快照 |
| `weight_bp` | 权重万分比，范围 `1..10000` |
| `attributed_basis_amount` | 按权重折算的计算依据金额 |
| `allocated_amount` | 最终计划分配金额，非负 |
| `sort_order` | 展示顺序 |
| `remark` | 备注 |

同一申请中同一受益人只能出现一次。全部权重合计必须等于 `10000`，全部分配金额合计不得超过申请的 `distributable_amount`。

系统按权重计算分配金额或折算依据金额时使用最大余额法处理分币尾差；使用稳定的行顺序作为同余数时的最终排序键，保证相同输入得到相同结果。

当前受益人仅支持组织员工，直接关联实名 `User`。产生分配或应计历史的账号不得物理删除，只允许停用或移出组织；历史展示使用姓名快照，不依赖当前实名。

### 5.4 AccrualEntry

| 字段 | 说明 |
|---|---|
| `organization` | 所属组织，`PROTECT` |
| `beneficiary_user` | 受益人，`PROTECT` |
| `beneficiary_name_snapshot` | 受益人姓名快照 |
| `entry_type` | `allocation`、`manual_increase`、`manual_decrease`、`reversal` |
| `amount` | 非零有符号金额 |
| `currency` | 一期固定 `CNY` |
| `effective_at` | 应计生效时间，由服务端确定 |
| `effective_month` | 按 `Asia/Shanghai` 计算的月份，保存为该月第一天 |
| `allocation_share` | 原始业务分配来源，可空，非空时唯一，`PROTECT` |
| `reversal_of` | 被冲销的原流水，可空，非空时唯一，`PROTECT` |
| `reason` | 人工调整或冲销原因 |
| `created_by` | 创建人，`PROTECT` |
| `created_at` | 创建时间 |

来源和符号规则：

| 类型 | `allocation_share` | `reversal_of` | 金额 |
|---|---|---|---|
| `allocation` | 必填 | 空 | 正数 |
| `manual_increase` | 空 | 空 | 正数 |
| `manual_decrease` | 空 | 空 | 负数 |
| `reversal` | 空 | 必填 | 原流水相反数 |

冲销流水必须与原流水属于同一组织、受益人和币种。一条原流水最多被冲销一次；冲销流水本身不能再次作为冲销目标。

人工增加和扣减由有权限的管理员创建后立即生效，不需要审核，也不伪装成业务分配申请。人工调整必须填写原因；错误通过新的相反流水修正。

## 6. 状态与业务流程

### 6.1 状态机

```text
pending
├── approved
├── rejected
└── expired

approved
└── voided
```

- `rejected`、`expired`、`voided` 均为终态。
- 数据库状态使用 `rejected`，管理端可展示为“异常（审核不通过）”。
- 不存在草稿修改、重提、版本链、重新打开或恢复操作。
- 审核人可以审核本人提交的申请，但必须具备审核权限。

### 6.2 提交租约

由 `house` 模块在同一事务中：

1. 创建并激活租约；
2. 创建 `pending` 分配申请；
3. 创建计算项和分配明细；
4. 创建 `LeaseAllocation`；
5. 设置 `submitted_at` 和 `expires_at = submitted_at + 168 hours`。

提交成功后所有申请内容立即冻结，不允许修改。

### 6.3 审核通过

审核通过必须在同一事务中：

1. 锁定租约和分配申请；
2. 确认申请仍为 `pending`；
3. 确认当前时间严格早于 `expires_at`；
4. 重新校验租户、金额、权重和员工身份；
5. 为每条非零 `AllocationShare` 创建一条 `allocation` 类型的 `AccrualEntry`；
6. 将申请更新为 `approved`。

收益时间取申请提交时间，而不是审核操作时间：

```text
effective_at = AllocationRequest.submitted_at
effective_month = submitted_at 按 Asia/Shanghai 所属月份的第一天
```

例如 1 月 31 日提交、2 月 3 日通过，收益归属 1 月。

### 6.4 审核不通过

审核不通过时：

1. `AllocationRequest → rejected`；
2. 必须保存审核理由；
3. 对应 `Lease → terminated`；
4. 不生成任何 `AccrualEntry`；
5. 事务提交后通知申请人和全部受益人。

该申请不能修改或重提。再次申请必须创建新的租约及新的分配申请。

### 6.5 自动过期

达到 `expires_at` 时：

1. `AllocationRequest → expired`；
2. 对应 `Lease → terminated`；
3. 不生成任何 `AccrualEntry`；
4. 事务提交后通知申请人和全部受益人。

定时任务负责及时更新展示状态，但所有人工审核入口也必须重新检查过期时间。即使定时任务尚未执行，只要已经到达 `expires_at`，申请就不能审核通过。

### 6.6 主动作废

有权限的管理员可以直接作废已经通过的申请，不需要再次审核：

1. 必须填写作废原因；
2. 为每条原始应计流水创建一条等额负数冲销流水；
3. 冲销的 `effective_at` 取作废时间，归属作废所在月份；
4. `AllocationRequest → voided`；
5. 对应 `Lease → terminated`。

原始流水永久保留，不修改、不删除。

### 6.7 租约自身变化

租约正常到期或提前终止不会自动修改已经通过的分配申请，也不会自动冲销应计收益。只有管理员明确执行“作废分配申请”才产生冲销。

## 7. 时间和月度统计

本方案不包含月度冻结、关账或结转表。员工月度应计收益直接聚合：

```text
SUM(AccrualEntry.amount)
GROUP BY organization, beneficiary_user, effective_month
```

各类流水的月份由服务端固定：

| 流水类型 | `effective_at` |
|---|---|
| 审核通过的业务分配 | 申请提交时间 |
| 人工增加或扣减 | 创建时间 |
| 作废冲销 | 作废时间 |

管理员不能任意指定历史月份。由于审核有效期为 168 小时，跨月审核最多在提交后七天内补入提交月份；系统不承诺历史月份封账不变。

## 8. 数据库约束

至少建立以下约束：

- `LeaseAllocation.lease` 唯一。
- `LeaseAllocation.allocation_request` 唯一。
- `AllocationRequest.basis_amount >= 0`。
- `AllocationRequest.distributable_amount >= 0`。
- `currency = CNY`。
- 比例模式只能填写 `distribution_rate_bp`，范围 `0..10000`。
- 固定模式必须直接填写非负 `distributable_amount`；比例模式不得填写，由服务端计算。
- `AllocationItem.amount > 0`。
- `AllocationShare.weight_bp` 范围为 `1..10000`。
- `AllocationShare.attributed_basis_amount >= 0`。
- `AllocationShare.allocated_amount >= 0`。
- `(allocation_request, beneficiary_user)` 唯一。
- `AccrualEntry.amount != 0`。
- 非空 `AccrualEntry.allocation_share` 条件唯一。
- 非空 `AccrualEntry.reversal_of` 条件唯一。
- `entry_type`、来源字段和金额符号必须匹配。
- 审核、驳回、过期和作废状态必须与对应时间、操作人和原因字段一致。

以下跨行、跨表规则由事务内领域服务校验：

- 计算项合计等于申请的 `basis_amount`；
- 员工权重合计等于 `10000`；
- 分配金额合计不超过 `distributable_amount`；
- 租约、申请、员工和流水属于同一组织；
- 受益人在提交时是当前组织成员；
- 分配金额与服务端计算结果一致；
- 冲销金额正好等于原流水相反数；
- 冲销流水与原流水属于同一组织、员工和币种；
- 冲销目标不是冲销流水。

## 9. 事务和并发

### 9.1 固定锁顺序

涉及租约来源的所有写操作统一使用以下锁顺序：

```text
Lease
→ AllocationRequest
→ AllocationShare / AccrualEntry
```

`LeaseAllocation` 是不可修改的关系，可在锁定租约后读取并校验。

### 9.2 重复提交

提交租约时：

```text
transaction.atomic()
→ select_for_update(Lease)
→ 检查不存在 LeaseAllocation
→ 创建申请、计算项、分配明细和关联记录
```

一对一数据库唯一约束作为并发重复提交的最终防线。

### 9.3 审核与过期竞争

审核和过期任务都必须锁定同一租约和申请，并在锁内重新读取状态和时间：

- `now >= expires_at` 时只能进入 `expired`；
- 只有 `pending` 且 `now < expires_at` 才能审核；
- 第一个完成的事务决定终态，后续操作返回当前终态，不得再次生成流水。

### 9.4 审核幂等

申请状态锁和 `AccrualEntry.allocation_share` 唯一约束共同保证一条分配明细只生成一条原始应计流水。

任何一条流水创建失败，申请通过和全部流水创建必须一起回滚，不允许出现“申请已通过但收益流水不完整”。

### 9.5 作废幂等

作废时锁定申请及其原始应计流水。`reversal_of` 条件唯一约束保证原流水最多被冲销一次。重复作废返回当前 `voided` 状态，不重复生成冲销。

## 10. 通知和失败处理

通知只能在数据库事务成功提交后发送：

```text
transaction.on_commit(...)
```

通知失败不得回滚审核、驳回、过期或作废结果，也不得导致应计流水重复生成。通知使用现有通知模块和后台任务重试。

至少需要通知：

- 审核不通过：申请人和全部受益人；
- 自动过期：申请人和全部受益人；
- 主动作废：全部受益人。

建议的稳定业务错误：

```text
allocation.already_exists
allocation.not_pending
allocation.expired
allocation.invalid_basis_total
allocation.invalid_weight_total
allocation.exceeds_distributable_amount
allocation.cross_organization
allocation.lease_not_active
allocation.rejection_reason_required
allocation.void_reason_required
allocation.already_voided
allocation.entry_already_created
allocation.entry_already_reversed
```

## 11. 查询和展示

申请状态展示：

```text
pending   → 待审核
approved  → 已通过
rejected  → 异常（审核不通过）
expired   → 已过期
voided    → 已作废
```

应计流水列表至少展示：

- 受益人及姓名快照；
- 正负金额；
- 流水性质；
- 生效时间和月份；
- 业务来源摘要；
- 申请提交和审核信息；
- 人工调整或冲销原因。

业务来源通过以下关系解析：

```text
AccrualEntry
→ AllocationShare
→ AllocationRequest
→ LeaseAllocation
→ Lease
```

人工增加和扣减没有 `AllocationShare`，直接根据流水类型和原因展示。

## 12. 权限边界

- 申请人必须有提交租约及分配方案的权限。
- 审核人必须有分配审核权限，可以审核本人提交的申请。
- 人工增加、人工扣减和主动作废必须使用独立的高权限操作范围。
- 所有接口从认证会话取得当前组织，不能相信请求体中的 `organization_id`。
- 当前组织之外的租约、员工、申请和流水统一按不可见处理。
- 普通接口不提供申请内容修改、历史删除、流水修改或流水删除能力。

## 13. 测试重点

- 同一租约并发提交只能生成一份申请和关联。
- 提交后申请内容、计算项和分配明细不可修改。
- 金额明细合计不匹配时禁止提交。
- 权重合计不等于 `10000` 时禁止提交。
- 分配合计超过可分配金额时禁止提交。
- 审核人可以审核自己的申请。
- `expires_at` 前可以通过，达到边界后只能过期。
- 审核与过期任务并发时只能产生一个终态。
- 审核通过只为每条非零分配明细生成一次应计流水。
- 驳回和过期不生成流水，并把租约转为 `terminated`。
- 驳回理由和作废原因的必填约束生效。
- 租约正常到期或提前终止不会自动冲销收益。
- 主动作废生成等额负数冲销，并把租约转为 `terminated`。
- 一条流水不能被重复冲销。
- 人工增加为正、人工扣减为负，且归属创建月份。
- 跨组织租约、申请、员工和流水不能混用。
- 删除用户、租约、申请、分配明细或原流水时受到 `PROTECT` 保护。
- 通知失败不回滚业务事务，也不重复生成流水。

## 14. 分阶段实施

### 第一阶段

- 创建 `allocation` 应用及四张核心表。
- 创建 `house.LeaseAllocation`。
- 实现租约提交时的分配申请创建。
- 实现审核通过、审核不通过、自动过期和主动作废。
- 实现人工增加和人工扣减。
- 实现员工应计收益按月聚合查询。
- 接入现有通知模块。
- 建立必要的数据库约束、事务锁和测试。

### 后续按真实需求增加

- 第二种业务来源及其明确关联表；
- 三种以上来源出现重复后，再评估来源适配机制；
- 非用户受益人，如合作伙伴、门店或供应商；
- 实际付款、工资发放、钱包、财务总账和对账；
- 真正需要关账时再设计月度冻结；
- 审计量或合规要求明显提高时再设计独立操作日志；
- 外部重试确实造成重复命令风险时再设计命令幂等记录。

## 15. 明确删除或延后的设计

当前不建设：

- `PerformanceCase`；
- `PerformanceRevision`；
- `PerformanceContributor`；
- `PerformanceAction`；
- `PerformanceCommand`；
- `OrganizationStaff`；
- `source_kind`；
- `AllocationSource`；
- 来源适配器注册机制；
- 通用来源解析接口；
- `change_history`；
- 月度冻结、结转和结算占用表；
- 钱包和付款字段。

使用实名 `User` 作为当前员工身份的前提是：一旦产生分配或应计历史，相关 `PROTECT` 外键禁止物理删除该账号。离职通过移除组织成员关系或停用账号处理。

## 16. 为什么五张表不能安全合并

### LeaseAllocation

它是业务域与通用核心之间的明确接缝，同时以双向 `PROTECT` 保证租约和申请不会失去历史关联。把来源字段放回核心申请会导致核心依赖具体业务；把关系改成字符串或 JSON 会失去数据库引用完整性。

### AllocationRequest

它承载整份申请的审核生命周期和金额上限。把这些字段重复到计算项或分配明细会产生多行状态不一致。

### AllocationItem

它需要独立查询、排序和金额校验。放入 JSON 会降低约束和统计能力，当前已明确选择关系型保存。

### AllocationShare

它代表待审核的多人分配方案，需要受益人外键、同申请受益人唯一约束和权重校验。它不能与正式应计流水合并，否则所有收益查询都必须排除待审、驳回和过期记录。

### AccrualEntry

它是审核通过后的不可变生效事实，承担员工收益统计、人工增减和冲销。把它合并回申请或分配明细会失去追加式正负流水和稳定历史。

## 17. 验收标准

- 核心 `allocation` 模块不导入或依赖 `house.Lease`。
- 一个租约只能建立一个不可删除的分配申请关联。
- 申请提交后不可修改，七天内只能通过或不通过，超过边界自动过期。
- 审核通过与全部应计流水在同一事务中完成。
- 审核不通过或过期不会产生应计收益，并终止对应租约。
- 申请通过后的收益归属提交月份。
- 作废只追加冲销流水，不修改原流水，并终止对应租约。
- 租约自身到期或提前终止不会自动冲销已经认定的收益。
- 人工增加和扣减不伪装成业务分配申请。
- 月度收益只聚合不可变 `AccrualEntry`，不依赖钱包、付款或冻结表。
- 多租户、金额、权重、重复生成和重复冲销约束在并发场景下仍然成立。
