# 钱包闭环能力设计（一期）

日期：2026-06-08  
状态：已评审（待实现计划）

## 1. 背景与目标

平台需要为用户提供可运营、可审计的钱包能力，用于承接推广奖励并支持用户提现申请，形成完整资金闭环。  
一期明确边界如下：

- 钱包主体：仅个人钱包（每个用户一个钱包）
- 入账来源：推广奖励、超级管理员调账
- 提现审核：全人工审核
- 打款方式：审核通过后由系统发起第三方代付
- 一期不做：用户主动充值

## 2. 范围与非范围

### 2.1 范围内

- 钱包账户余额管理（可用余额、冻结余额）
- 钱包流水总账（所有资金变动必记账）
- 通用钱包入账发放（含幂等约束）
- 提现申请、审核、代付、回调、失败补偿
- 管理端调账与审核操作审计

### 2.2 范围外

- 用户充值、退款
- 多币种钱包
- 组织钱包
- 自动风控审核与自动打款

## 3. 方案选型

### 3.1 备选方案

方案A（推荐）：钱包账户 + 流水 + 提现申请 + 代付记录 + 通用入账发放记录。  
方案B：极简模式，仅账户与提现，弱化资金流水。  
方案C：中台化抽象，提前支持多钱包、多资产。

### 3.2 选型结论

采用方案A。理由：

- 能在一期实现完整业务闭环
- 审计与对账能力完整
- 后续扩展充值、通用余额能力时无需推翻模型
- 复杂度可控，符合当前项目阶段

## 4. 领域模型设计

一期采用 5 个核心模型。

### 4.1 WalletAccount（钱包账户）

用途：用户资金账户主表。  
关键字段建议：

- `user`（OneToOne 到用户）
- `available_balance`（可用余额，单位分）
- `frozen_balance`（冻结余额，单位分）
- `total_income`（累计入账，单位分）
- `total_withdrawn`（累计提现成功，单位分）
- `created_at`、`updated_at`

约束建议：余额字段非负。

### 4.2 WalletLedger（钱包流水总账）

用途：记录所有资金变化，作为审计和对账事实来源。  
关键字段建议：

- `wallet`（FK）
- `entry_type`（例如：`promotion_reward`、`admin_adjustment_increase`、`admin_adjustment_decrease`、`withdraw_freeze`、`withdraw_unfreeze`、`withdraw_settle`、`withdraw_refund`）
- `amount_delta`（正负金额，单位分）
- `available_balance_after`（变动后可用余额快照，单位分）
- `frozen_balance_after`（变动后冻结余额快照，单位分）
- `biz_type`、`biz_id`（业务关联）
- `idempotency_key`（高风险动作幂等键）
- `remark`
- `operator`（可空，系统动作允许为空）
- `created_at`

说明：钱包流水不再只保留单一余额快照，必须同时保留可用余额与冻结余额快照，才能完整表达提现冻结、解冻、结算场景下的资金变化。

### 4.3 WalletCreditGrant（通用钱包入账发放记录）

用途：独立沉淀“外部业务向钱包发起一笔入账”的事实记录与幂等控制。该模型属于钱包域，不直接绑定推广业务，可承接推广奖励、活动补贴、任务奖励、后台补发等入账场景。  
关键字段建议：

- `user`
- `credit_type`（如 `promotion_reward`、`campaign_bonus`、`manual_bonus`）
- `source_type`（如 `invite_register`、`campaign_task`、`ops_manual`）
- `source_id`（外部业务主键或事件主键）
- `amount`（单位分）
- `status`（`granted`/`revoked` 预留）
- `idempotency_key`
- `granted_at`
- `created_at`、`updated_at`

约束建议：`idempotency_key` 唯一；或 `(user, credit_type, source_type, source_id)` 唯一（二选一，建议前者）。

联动规则：

- 推广模块、活动模块等外部业务只负责判定“该不该发这笔钱”
- 一旦需要入账，由外部业务调用 wallet service 的统一 credit 接口
- wallet service 负责创建 `WalletCreditGrant`、更新 `WalletAccount`、写入 `WalletLedger`
- 外部业务侧保存 wallet 返回的 grant id 或 ledger 关联信息，用于后续对账与追踪
- 钱包域不承载推广规则本身，只承载资金入账事实

### 4.4 WithdrawalRequest（提现申请）

用途：提现业务主单。  
关键字段建议：

- `user`
- `amount`（用户申请提现金额，单位分，指从钱包扣减的总金额）
- `fee_amount`（手续费，单位分）
- `net_amount`（预计到账金额，单位分，`amount - fee_amount`）
- `status`
- `pay_channel`（代付渠道）
- `payee_account_snapshot`（收款信息快照，加密存储）
- `reviewed_by`、`reviewed_at`、`reject_reason`
- `created_at`、`updated_at`

状态建议：`pending_review`、`cancelled`、`rejected`、`approved`、`paying`、`paid`、`failed`。

### 4.5 WithdrawalPayout（代付执行记录）

用途：第三方代付请求与回调事实记录。  
关键字段建议：

- `withdrawal_request`
- `provider`
- `out_trade_no`
- `provider_trade_no`
- `request_payload`、`response_payload`（敏感字段脱敏后落库，必要字段可加密保留原文）
- `idempotency_key`
- `status`
- `error_code`、`error_message`
- `executed_at`
- `created_at`、`updated_at`

约束建议：`out_trade_no` 唯一，`idempotency_key` 唯一。

## 5. API 设计

一期建议总计 16 个 API，分四组。

### 5.1 用户侧 API（6）

- `GET /api/wallet/me/summary/` 钱包总览
- `GET /api/wallet/me/ledger/` 流水列表
- `POST /api/wallet/me/withdrawals/` 提交提现申请
- `GET /api/wallet/me/withdrawals/` 提现申请列表
- `GET /api/wallet/me/withdrawals/{id}/` 提现详情
- `POST /api/wallet/me/withdrawals/{id}/cancel/` 撤销申请（仅 `pending_review`）

### 5.2 超管运营 API（6）

- `GET /api/admin/wallet/accounts/` 钱包账户列表
- `GET /api/admin/wallet/accounts/{user_id}/ledger/` 指定用户流水
- `POST /api/admin/wallet/adjustments/` 管理员调账
- `POST /api/admin/wallet/credits/grant/` 发起钱包入账发放（幂等）
- `GET /api/admin/wallet/withdrawals/` 提现审核列表
- `POST /api/admin/wallet/withdrawals/{id}/review/` 审核通过/拒绝

### 5.3 代付执行 API（2）

- `POST /api/admin/wallet/withdrawals/{id}/payout/` 发起代付
- `POST /api/wallet/payout/callback/{provider}/` 代付回调

### 5.4 内部补偿 API（2）

- `POST /api/internal/wallet/withdrawals/{id}/retry/` 代付失败重试
- `POST /api/internal/wallet/reconcile/` 对账触发

## 6. 提现状态机与资金一致性

### 6.0 手续费口径

一期提现金额口径统一如下：

- `amount`：用户申请从钱包扣减的总金额，也是冻结金额
- `fee_amount`：平台从 `amount` 中收取的手续费
- `net_amount`：用户实际到账金额，计算公式为 `amount - fee_amount`

由此约束：

- 提现申请创建时，冻结的是 `amount`，不是 `net_amount`
- 审核拒绝或代付失败时，解冻返还的是 `amount`
- 代付成功时，钱包实际扣减的是 `amount`，第三方代付打给用户的是 `net_amount`
- 手续费不单独二次冻结，也不在成功时额外再扣一次

这样可以避免提现处理中出现“手续费另扣一次”或“冻结净额但账面少扣手续费”的口径分叉。

### 6.1 状态流转

1. `pending_review`：用户申请后即冻结资金。  
2. `rejected`：审核拒绝，解冻返还。  
3. `approved`：审核通过，等待代付。  
4. `paying`：已发起代付。  
5. `paid`：代付成功，冻结资金转为提现成功。  
6. `failed`：代付失败，解冻返还。

严格流转规则：

- 用户提交申请：`none -> pending_review`
- 用户撤销申请：`pending_review -> cancelled`
- 管理员审核拒绝：`pending_review -> rejected`
- 管理员审核通过：`pending_review -> approved`
- 系统发起代付：`approved -> paying`
- 第三方回调成功：`paying -> paid`
- 第三方回调失败：`paying -> failed`
- 内部超时关闭或人工兜底失败：`approved -> failed` 或 `paying -> failed`，但必须附补偿说明

拒绝规则：

- 非 `pending_review` 状态不允许取消、审核通过、审核拒绝
- 非 `approved` 状态不允许发起代付
- 非 `paying` 状态不接受成功/失败回调更新终态
- `paid`、`rejected`、`failed`、`cancelled` 为终态，不允许再流转到其他状态

### 6.2 记账规则

- 申请提现：`available -= amount`，`frozen += amount`，流水记 `withdraw_freeze`
- 用户撤销：`available += amount`，`frozen -= amount`，流水记 `withdraw_cancel`
- 审核拒绝：`available += amount`，`frozen -= amount`，流水记 `withdraw_unfreeze`
- 代付成功：`frozen -= amount`，`total_withdrawn += amount`，流水记 `withdraw_settle`
- 代付失败：`available += amount`，`frozen -= amount`，流水记 `withdraw_refund`

手续费结算规则：

- `withdraw_settle` 以 `amount` 为资金扣减值
- 平台侧如需统计提现手续费收入，一期不单独入用户钱包流水，改由提现单上的 `fee_amount` 汇总统计
- 如果后续需要做平台资金账，再新增平台资金流水，不在本期个人钱包账本中混记

### 6.3 一致性硬约束

- 余额变更、流水写入、状态迁移必须同事务提交
- 钱包账户行更新使用 `select_for_update()` 防并发超提
- 代付回调按交易号和事件结果做幂等，重复回调不得重复记账
- 任意时刻 `available_balance`、`frozen_balance` 不得为负
- 推广奖励和管理员调账均禁止直接改余额字段，必须通过服务层统一记账
- `WithdrawalRequest`、`WithdrawalPayout`、`WalletLedger` 的业务写入都必须通过统一 wallet service 完成，禁止绕过服务层直接写模型

### 6.4 幂等矩阵

一期高风险动作统一需要幂等约束：

- 通用入账发放：由 `WalletCreditGrant.idempotency_key` 保证，同一外部业务事件只发放一次
- 管理员调账：请求必须带 `idempotency_key`，并在 `WalletLedger` 上唯一约束，避免重复提交或页面重放
- 提现申请：前端可选带 `client_request_id`，后端可按用户 + 请求键去重，避免连点重复申请
- 提现审核：审核请求必须带操作幂等键，避免后台重复点击导致状态重复推进
- 代付发起：`WithdrawalPayout.idempotency_key` 与 `out_trade_no` 双重约束，同一提现单同一轮代付只允许创建一次有效请求
- 代付回调：按 `provider + provider_trade_no + callback_status` 或等效业务键去重，重复回调只做幂等确认，不重复更新余额
- 内部重试：重试必须创建新的代付轮次标识，但不能重复结算同一提现成功结果

## 7. 敏感信息与日志边界

### 7.1 敏感字段

- `payee_account_snapshot` 属于敏感收款信息，按现有实名信息同等级处理
- `request_payload`、`response_payload` 可能包含姓名、账号、手机号、身份证号、渠道凭证等敏感内容

### 7.2 存储规则

- 收款账户快照原文加密存储
- 面向列表与后台展示时，提供脱敏字段，例如账户后四位、姓名脱敏值
- 代付报文默认保存脱敏版本；仅在排障确有必要的字段上保留加密原文副本
- 原始敏感报文不得直接出现在应用日志、异常栈、通知正文中

### 7.3 日志与审计规则

- 审核动作记录操作者、时间、动作、原因
- 调账动作记录操作者、原因、请求来源标识
- 代付回调记录验签结果、回调摘要、处理结果，不记录完整敏感原文

## 8. 对账与补偿设计

### 8.1 对账对象

- `WithdrawalRequest` 与 `WithdrawalPayout` 的状态一致性
- 平台本地 `WithdrawalPayout` 与第三方代付渠道账单一致性
- 钱包账户聚合余额与 `WalletLedger` 累积结果一致性

### 8.2 差异类型

- 本地显示成功，渠道无记录
- 渠道成功，本地仍停留在 `paying`
- 本地失败，但渠道实际成功
- 钱包余额与流水聚合结果不一致

### 8.3 处理方式

- 可自动确认的差异：写补偿任务推进状态或回退余额
- 需要人工确认的差异：标记为 `reconcile_exception` 并进入后台待处理列表
- 任意补偿动作必须再次写入流水或审计记录，禁止静默修账

### 8.4 触发机制

- 主动触发：`/api/internal/wallet/reconcile/`
- 定时触发：后续由 Celery beat 按日或按小时执行
- 被动触发：代付超时未回调时，系统自动发起状态查询或对账检查

## 9. 错误处理与风控最小集

### 9.1 错误处理

- 提现参数非法：`400`
- 并发冲突：返回业务码（例如 `WALLET_BALANCE_CHANGED`）
- 非法状态流转：`409`
- 代付通道错误：记录失败并执行资金补偿
- 回调验签失败：记录安全日志，拒绝更新状态

### 9.2 风控最小集

- 日提现次数上限（例如 3 次）
- 单笔最小/最大提现金额
- 仅实名通过用户可提现（复用现有实名认证能力）
- 审核动作留痕：审核人、时间、原因
- 管理员调账必须填写原因并记录操作者

## 10. 测试策略

- 服务层单测：余额变更、冻结/解冻、状态机、幂等
- API 测试：申请、取消、审核、代付发起、回调
- 并发测试：同一用户并发提现防超提
- 补偿测试：代付失败后余额回退
- 权限测试：普通用户不可访问超管接口
- 回归测试：通用入账发放与调账均能稳定入账并可查询
- 脱敏测试：敏感字段在列表、日志、错误响应中不泄露原文
- 对账测试：模拟渠道与本地状态不一致，验证差异识别与补偿分流

## 11. 里程碑建议

1. `M1`：模型与迁移、服务层记账引擎、基础单测
2. `M2`：用户端 API（查询/申请/取消）
3. `M3`：超管调账、入账发放、提现审核 API
4. `M4`：代付接口与回调、补偿与对账任务
5. `M5`：联调、压测、灰度上线

## 12. 后续扩展位

- 用户充值（新增充值单与支付回调，不破坏现有模型）
- 通用账户余额能力（基于 `WalletLedger` 扩展交易类型）
- 组织钱包（新增账户归属维度与权限隔离）
- 风控策略中心（规则引擎、黑名单、限流）

## 13. 跨模块联动建议

后续如果新增独立的推广奖励模块，建议采用“业务域判定 + 钱包域入账”的协作方式：

- 推广模块维护邀请关系、返奖规则、奖励状态、活动统计
- 推广模块在奖励确认后，调用钱包统一入账接口，并传入明确的 `credit_type`、`source_type`、`source_id`、`idempotency_key`
- 钱包模块只负责资金记账、幂等、防重复入账和资金审计
- 两边通过 `source_type/source_id` 或 wallet 返回的 grant id 建立追踪关系

这样处理后，推广模块未来即使独立拆分，钱包模型和 API 仍然保持通用，不需要再从 `WalletRewardGrant` 重命名或迁移到更抽象的结构。
