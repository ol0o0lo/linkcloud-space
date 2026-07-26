# 独立 payments App 设计

## 目标

将现有 SaaS 订阅的微信收款和钱包微信提现能力抽取为独立的 `apps.payments`，让业务 App 仅通过稳定的 Python 服务创建、发起、查询和关闭收款或打款，不需要理解微信支付的验签、加密、下单、转账或回调。

首期保持现有功能不变：

- 管理端 Native 扫码支付；
- 小程序 JSAPI 支付；
- 微信回调验签、解密和幂等处理；
- SaaS 订单超时或被替代时的微信关单；
- 超时订单的迟到付款仍可开通订阅；被替代订单的迟到付款标记为人工异常。
- 钱包提现的微信商家转账、回调验签和查单。

## 非目标

首期不实现：

- 钱包余额付款、钱包账本改造；
- 微信原路退款或通用退款模型；
- 多个支付渠道、多商户或渠道插件机制；
- `PaymentIntent`、支付尝试、支付事件/outbox、异步履约队列；
- 统一商业订单中心。

现有订阅后台的退款功能是线下退款登记与订阅状态处理，继续留在 `subscriptions`。

## 模块边界

`payments` 负责：

- 收款与出款渠道交易记录；
- 微信支付配置、请求签名、Native/JSAPI 下单、关单、商家转账与查单；
- 收款和出款回调验签、解密；
- 将已验证的收款成功或出款结果通知业务模块。

`subscriptions` 负责：

- 套餐、价格、权益、SaaS 订单和订阅状态；
- 按套餐规则计算应付金额；
- 创建业务订单后请求支付；
- 订阅开通、续费、升级、迟到付款和线下退款规则；
- 订阅订单的超时扫描任务。

`wallet` 继续负责用户账户、账本、余额冻结/解冻、提现申请与审批；它调用 `payments` 发起和查询出款，但不包含微信客户端、商户配置或渠道交易模型。

## 数据模型

将现有 `subscriptions.PaymentTransaction` 迁移为 `payments.PaymentTransaction`，并将 `wallet.WithdrawalPayout` 迁移为 `payments.PayoutTransaction`。首期不新增支付意图、支付事件或支付尝试模型。

保留并泛化的字段：

- `biz_type`、`biz_id`：业务引用，例如 `subscriptions.saas_order` 和 SaaS 订单主键；
- `transaction_no`：本地且同时作为微信 `out_trade_no` 的交易号；
- `provider`：首期固定为 `wechat`；
- `payment_mode`：`native` 或 `miniprogram`；
- `amount`、`description`、`expires_at`：渠道下单所需的业务快照；
- `status`、`provider_trade_no`、`callback_event_id`、`paid_at`；
- `request_snapshot`、`response_snapshot`。

删除对 `SaaSOrder` 的外键。业务实体不会反向依赖支付实体；列表或详情展示时由订阅服务按 `biz_type` 和 `biz_id` 查询交易。

为 `biz_type + biz_id` 建立唯一约束。每个业务订单首期只创建一笔支付交易；业务需要重新收款时创建新的业务订单。这与当前 SaaS 订单替代策略一致。

`PayoutTransaction` 使用独立模型，而不是与收款交易合并。它包含：

- `biz_type`、`biz_id`：首期为 `wallet.withdrawal` 和提现申请主键；
- `out_trade_no`、`provider_trade_no`、幂等键、渠道、状态和执行时间；
- 收款方快照、金额、请求/响应快照和渠道错误信息。

出款交易以幂等键唯一约束；同一提现申请可保留多笔出款尝试，以支持既有的失败后重试流程。

收款与打款的微信接口、状态机和资金语义不同，分别建模可避免一张万能交易表。

## 服务调用契约

`apps.payments.services` 对业务 App 暴露以下 Python 服务：

```python
create_payment(...)
start_checkout(...)
get_payment(...)
close_payment(...)
create_payout(...)
query_payout(...)
```

`create_payment` 接收业务引用、金额（分）、描述、支付方式和过期时间，创建支付交易。
`start_checkout` 返回 Native 的 `code_url` 或小程序调起参数。
`get_payment` 返回支付交易状态。
`close_payment` 向微信关闭尚未完成的交易。
`create_payout` 接收业务引用、出款金额、收款方快照和幂等键，调用微信商家转账。
`query_payout` 查询渠道出款状态。

这些服务不接受或返回订阅、租约、提现等业务模型；业务 API 继续由各业务 App 自己提供。

## 成功回调与履约

`payments` 在验证微信回调并锁定支付交易后，将交易状态改为成功，并通过 Django 内置信号 `payment_succeeded` 通知业务模块。

`subscriptions` 注册该信号的接收器。接收器仅处理 `biz_type == "subscriptions.saas_order"` 的交易，并在同一个数据库事务中：

1. 锁定 SaaS 订单；
2. 执行现有的开通、续费或升级规则；
3. 对被替代订单的迟到付款记录人工退款异常；
4. 更新 SaaS 订单状态和订阅审计日志。

信号处理失败会回滚本地支付成功状态，回调请求不会返回成功；这延续现有“支付交易与订阅开通同一事务”的一致性语义。首期不引入异步事件表或任务队列。

未来业务 App 可注册自己的信号接收器，仅按自己的 `biz_type` 处理，不需要引用微信客户端或支付配置。

出款回调或查单确认结果后，`payments` 通过 `payout_succeeded` 或 `payout_failed` 信号通知业务模块。`wallet` 监听 `biz_type == "wallet.withdrawal"` 的信号，复用现有提现成功结算或失败退回账本逻辑。支付 App 不修改钱包余额或账本。

## HTTP API 与配置迁移

微信收款回调入口从 `/api/subscriptions/payments/wechat/notify/` 移至 `/api/payments/wechat/notify/`；微信出款回调同样由 `payments` router 提供。

微信渠道配置统一使用 `PAYMENTS_WECHAT_*`。商户号、商户证书序列号、私钥、平台证书、API v3 密钥、API 基地址和超时设置为收款与出款共用；Native 和小程序 AppID、收款回调地址为收款专属；转账 AppID、转账回调地址、转账场景为出款专属。`SUBSCRIPTIONS_WECHAT_*` 和 `WALLET_WECHAT_*` 已移除，不再支持回退读取。

## 迁移步骤

1. 创建 `payments` App、收款和出款交易模型、服务、微信客户端和回调 router。
2. 增加并执行数据迁移，将订阅收款和钱包出款流水转为通用业务引用。
3. 修改订阅下单、展示、回调履约和关单任务，改为调用 `payments` 服务及监听收款成功信号。
4. 修改钱包提现打款、回调和查单任务，改为调用 `payments` 服务及监听出款结果信号。
5. 移除订阅和钱包内重复的微信客户端、provider、渠道交易模型、回调入口和相关配置。
6. 更新前端仍使用的订阅订单与提现记录响应；字段形状保持兼容。

## 验证

至少覆盖：

- 订阅订单创建后能获得 Native/JSAPI 收银台参数；
- 有效微信回调可开通订阅，重复回调不会重复开通；
- 超时订单迟到付款仍开通；
- 被替代订单迟到付款不改变订阅，且记录异常；
- 无效签名被拒绝；
- 关闭订单仍调用微信关单；
- 钱包提现成功会结算冻结余额，失败会退回余额；
- 钱包出款的重复回调或查单不会重复记账；
- 订阅和钱包的现有前端响应字段保持兼容。
