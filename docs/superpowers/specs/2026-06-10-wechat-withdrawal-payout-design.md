# 微信提现出款骨架设计（一期）

日期：2026-06-10  
状态：已评审（待实现计划）

## 1. 背景与目标

在现有钱包基础闭环之上，平台需要补齐“微信提现”这条真实业务主线的后端设计，目标为后续直连微信官方商户出款能力做好结构准备。

本期目标不是直接发起真实线上微信请求，而是先完成以下内容：

- 明确微信提现的业务口径与状态流转
- 在钱包侧固化微信收款信息快照
- 建立微信提现 provider 抽象层
- 预留微信商户配置、证书、验签、查单接口骨架
- 保持当前钱包账务与状态机闭环不被破坏

## 2. 范围与非范围

### 2.1 范围内

- 提现渠道收口为 `wechat`
- 提现提交时校验微信绑定并固化收款快照
- 微信出款 provider 抽象与 `wechat` provider 骨架
- 管理员发起出款时通过 provider 执行，而不是直接写 payout 记录
- 预留微信回调验签、查单、错误码映射接口
- 增加配置项、安全边界与测试骨架

### 2.2 范围外

- 真实联网调用微信官方商户出款 API
- 商户私钥签名、平台证书验签的正式实现
- 真实查单补单任务
- 新增钱包侧独立微信绑定表
- 支持银行卡、支付宝等其他提现渠道

## 3. 业务约束

### 3.1 提现渠道

- 当前提现仅支持 `pay_channel=wechat`
- 前端提交提现时必须显式传 `pay_channel`
- 非 `wechat` 值按钱包业务错误处理，不进入提现状态机

### 3.2 微信绑定校验

- 提现提交时必须检查用户是否已绑定微信
- 微信绑定来源继续复用账号体系中的 `SocialAccount`
- 允许的 provider：`weixin`、`wechat_miniprogram`
- 未绑定微信时直接拒绝提现申请，不创建提现单，不冻结余额

### 3.3 收款信息来源

- 钱包侧不新增独立微信绑定表
- 提现提交时从当前绑定关系中提取出款所需字段
- 成功提交提现后，将收款信息固化到 `WithdrawalRequest.payee_account_snapshot`
- 后续审核、出款、回调、重试，都只使用这份快照

## 4. 数据设计

### 4.1 WithdrawalRequest.pay_channel

- 继续保留 `pay_channel` 字段
- 使用枚举 `wechat`
- 模型层和服务层都做收口校验

### 4.2 WithdrawalRequest.payee_account_snapshot

该字段从“展示性收款快照”升级为“展示 + 出款必要字段快照”。

建议结构：

```json
{
  "channel": "wechat",
  "social_provider": "weixin",
  "social_uid": "social-account-uid",
  "unionid": "wechat-unionid",
  "openid": "wechat-openid",
  "receiver_name": "张三",
  "masked_account": "wx******1234"
}
```

约束如下：

- `channel` 固定为 `wechat`
- `social_provider` 标识快照来源是 `weixin` 还是 `wechat_miniprogram`
- `social_uid` 用于审计排障
- `unionid`、`openid` 预留给真实微信出款请求使用
- `receiver_name` 用于实名校验或展示
- `masked_account` 只给前端展示

### 4.3 WithdrawalPayout

保留现有模型，补充微信提现语义：

- `provider`：本期固定可用值为 `wechat`
- `request_payload`：记录 provider 组装后的业务请求报文快照
- `response_payload`：记录 provider 返回或 mock 返回报文
- `error_code`、`error_message`：记录微信错误码映射结果

本期不要求新增字段，只要求后续写入逻辑通过 provider 抽象统一落库。

## 5. 模块拆分

建议新增以下模块：

- `apps/wallet/providers/base.py`
- `apps/wallet/providers/wechat.py`
- `apps/wallet/providers/registry.py`

### 5.1 BasePayoutProvider

定义统一接口：

- `build_transfer_request(withdrawal, idempotency_key)`
- `create_transfer(withdrawal, idempotency_key)`
- `query_transfer(payout)`
- `verify_callback(payload, headers)`
- `parse_callback(payload)`

### 5.2 WeChatPayoutProvider

本期提供微信提现骨架实现：

- 从 `WithdrawalRequest.payee_account_snapshot` 组装微信出款请求
- 校验必要配置是否存在
- 校验收款快照字段是否完整
- 返回统一 provider 结果对象
- 不发起真实 HTTP 请求，仅返回 mock 的“已受理/本地失败”结果

### 5.3 Provider Registry

根据 `provider` 或 `pay_channel` 返回具体 provider 实例。

本期只注册：

- `wechat`

## 6. 服务层设计

### 6.1 提现提交

`submit_withdrawal()` 在现有校验基础上增加：

- `pay_channel` 必须为 `wechat`
- 用户必须存在微信绑定关系
- 提现成功时把微信收款必要字段快照进 `payee_account_snapshot`

### 6.2 发起出款

`create_withdrawal_payout()` 不再只负责写 `WithdrawalPayout`，而是改为：

1. 校验提现单状态必须是 `approved`
2. 通过 registry 获取 `WeChatPayoutProvider`
3. 调用 `provider.create_transfer()`
4. 根据 provider 结果写入 `WithdrawalPayout`
5. 只有 provider 明确返回“已受理”后，提现状态才从 `approved` 进入 `paying`

### 6.3 查询与回调

本期先预留接口，不做真实微信协议实现：

- `query_transfer()`：供后续查单补偿使用
- `verify_callback()`：供后续替换为微信平台证书验签
- `parse_callback()`：将微信回调映射为钱包内部统一状态

## 7. 状态机口径

沿用现有提现主状态：

- `pending_review`
- `cancelled`
- `rejected`
- `approved`
- `paying`
- `paid`
- `failed`

主线路规则：

1. 用户提交提现：`none -> pending_review`
2. 用户撤销提现：`pending_review -> cancelled`
3. 管理员审核拒绝：`pending_review -> rejected`
4. 管理员审核通过：`pending_review -> approved`
5. Provider 受理成功：`approved -> paying`
6. 微信回调成功：`paying -> paid`
7. 微信回调失败：`paying -> failed`
8. 内部重试：`failed -> approved -> paying`

关键约束：

- provider 调用失败、配置缺失、快照字段缺失时，不允许进入 `paying`
- 这类失败应保留在 `approved`，同时记录本地失败原因
- `paid`、`cancelled`、`rejected` 为终态

## 8. 错误处理

继续使用项目现有 `AppException` 体系，不额外引入字符串错误码规范。

本期至少需要覆盖以下错误：

- 不支持的提现渠道
- 未绑定微信
- 微信收款快照不完整
- 微信商户配置缺失
- provider 本地受理失败

这些错误应返回统一的 `detail + code` 结构，前端根据错误码做跳转或提示。

## 9. 配置与安全

建议在 `config/settings/_base.py` 预留以下配置：

- `WALLET_WECHAT_PAYOUT_ENABLED`
- `WALLET_WECHAT_MCH_ID`
- `WALLET_WECHAT_APP_ID`
- `WALLET_WECHAT_SERIAL_NO`
- `WALLET_WECHAT_PRIVATE_KEY`
- `WALLET_WECHAT_PLATFORM_CERT`
- `WALLET_WECHAT_NOTIFY_URL`
- `WALLET_WECHAT_TRANSFER_SCENE`
- `WALLET_WECHAT_API_BASE_URL`

敏感信息边界：

- `payee_account_snapshot` 可以存必要出款标识，但前端返回时只暴露脱敏字段
- `request_payload`、`response_payload` 可落库，但不得记录私钥、完整签名串、完整敏感请求头
- 日志中只记录 `withdrawal_id`、`out_trade_no`、`provider_trade_no`、`error_code`
- 商户私钥、平台证书仅通过配置读取，不写入数据库

## 10. 测试策略

### 10.1 服务层测试

- 提现时正确固化微信收款快照
- 未绑定微信时提现失败
- provider 受理成功时进入 `paying`
- provider 本地失败时保持在 `approved`

### 10.2 Provider 测试

- 微信请求报文组装正确
- 收款快照缺字段时报错
- 微信商户配置缺失时报错
- mock provider 返回 accepted / rejected 两条路径

### 10.3 API 测试

- 管理员发起 payout 时实际走 provider 抽象层
- 回调入口预留 provider 化验签接口
- 微信相关错误走统一业务错误码

## 11. 实施建议

推荐分两步实施：

1. 本期完成微信提现骨架、快照、provider 抽象、配置骨架与测试
2. 下一期替换 `WeChatPayoutProvider` 的 mock 逻辑为真实微信官方商户请求、验签、查单与回调实现

这样可以保证钱包基础功能持续可用，同时为真实接微信留出稳定边界，避免把签名、证书、查单逻辑直接堆进钱包状态机服务。
