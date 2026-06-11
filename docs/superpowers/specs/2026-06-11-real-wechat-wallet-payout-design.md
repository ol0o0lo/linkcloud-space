# 真实微信提现企业级接入设计

日期：2026-06-11  
状态：已评审（待实现计划）

## 1. 背景与目标

当前钱包提现链路已经具备：

- 钱包账户与流水闭环
- 提现申请、审核、出款、回调、重试状态机
- `wechat` payout provider 骨架
- 运营后台可发起微信提现、失败重试

但后端还没有真正接入微信官方“商家转账到零钱”接口，当前 `WeChatPayoutProvider` 仅返回 mocked 结果，无法满足真实生产出款。

本次目标是把微信提现从“骨架 provider”升级为“完整企业级接入”，要求：

- 真实发起微信商家转账到零钱
- 真实处理微信回调验签与解密
- 以回调为主、主动查单为兜底完成状态确认
- 保持现有钱包冻结、退款、结算、重试状态机一致
- 增加最小可用的补偿、对账与告警能力

## 2. 核心决策

本次设计基于以下确认结论：

- 接入级别：完整企业级接入
- 状态确认策略：回调为主，主动查询兜底
- 技术路线：优先使用成熟 SDK
- 出款产品：商家转账到零钱

本次不做银行卡打款，不引入其他提现渠道。

## 3. 范围与非范围

### 3.1 范围内

- 真实接入微信“商家转账到零钱”接口
- 用 SDK 处理签名、验签、证书与基础请求能力
- 在 `wallet provider` 内接入真实 create/query/callback 能力
- 微信回调验签、解密、状态映射
- 超时未回调提现的主动查单补偿任务
- 微信错误码、请求报文、响应报文、流水和提现主单的一致性设计
- 对账与告警最小闭环

### 3.2 范围外

- 银行卡代付
- 支付宝等其他出款渠道
- 提现手续费新规则
- 钱包主模型大改造
- 独立支付中台抽象

## 4. 整体架构

推荐结构为四层：

1. **Wallet Service 层**  
   保持钱包领域规则中心地位，负责提现状态机、冻结/退款/结算、幂等与流水落账。

2. **WeChat Provider 层**  
   负责把 `WithdrawalRequest` 映射为微信“商家转账到零钱”请求，并把微信响应、回调、查单结果翻译成钱包可理解的统一结果。

3. **WeChat Client 层**  
   优先基于成熟的微信支付 Python SDK 或等价稳定封装实现，处理：
   - 商户私钥加载
   - 平台证书缓存与校验
   - 请求签名
   - 回调验签与解密
   - 查单请求
   - 微信错误码与原始报文保留

4. **异步补偿层**  
   通过 Celery 定时任务扫描超时未回调的 `paying` 提现，主动查单补推进状态。

不建议把整个钱包直接改造成通用支付中台。本次仍以 `apps/wallet` 为主边界，在其内补齐真实微信提现基础设施。

## 5. 模块拆分

建议在现有钱包模块下新增或扩展以下结构：

- `apps/wallet/providers/base.py`
- `apps/wallet/providers/wechat.py`
- `apps/wallet/providers/registry.py`
- `apps/wallet/wechat_client.py`
- `apps/wallet/tasks.py`
- `apps/wallet/error_mapping.py`

职责划分如下。

### 5.1 `wechat_client.py`

负责和 SDK/微信 API 打交道：

- 初始化 SDK client
- 读取商户私钥、证书序列号、平台证书
- 发起“商家转账到零钱”请求
- 发起查单请求
- 校验微信回调头签名
- 解密微信回调资源报文

该层不改钱包余额，不写钱包状态，只返回基础结果。

### 5.2 `providers/wechat.py`

负责钱包领域到微信支付领域的翻译：

- 从 `WithdrawalRequest.payee_account_snapshot` 提取 `openid`
- 根据提现主单生成微信请求
- 调用 `wechat_client`
- 把微信响应翻译为统一 `ProviderTransferResult`
- 把微信回调与查单结果翻译成内部 callback/query result

### 5.3 `services.py`

继续作为唯一状态推进入口：

- `create_withdrawal_payout()`
- `retry_withdrawal_payout()`
- `handle_payout_callback()`
- 新增 `sync_processing_withdrawals()` 或等价补偿入口

钱包余额、冻结余额、提现状态、流水落账都只允许在 service 层发生。

## 6. 数据模型与字段语义

### 6.1 `WithdrawalRequest`

继续保留现有主单，不新增新的提现主模型。

状态保持：

- `pending_review`
- `approved`
- `paying`
- `paid`
- `failed`
- `rejected`
- `cancelled`

`payee_account_snapshot` 继续作为真实出款快照来源，后续出款、回调、重试都只依赖这份固化快照，不再接受前端重新传收款信息。

### 6.2 `WithdrawalPayout`

继续作为“每次微信代付尝试”的子单。

一个 `WithdrawalRequest` 可以对应多条 `WithdrawalPayout`，例如：

- 首次发起
- 失败后重试
- 补偿查单后回写最终状态

字段语义明确如下：

- `provider`：本次固定为 `wechat`
- `out_trade_no`：我方发给微信的商家单号
- `provider_trade_no`：微信侧转账单号
- `idempotency_key`：本地发起幂等键
- `request_payload`：发送给微信的业务报文快照，需脱敏裁剪
- `response_payload`：微信同步响应、查单结果或回调核心报文，需脱敏裁剪
- `status`：本次子单状态
- `error_code` / `error_message`：微信错误码和错误文案

本次不强制新增字段，但要求在实现中明确保存同步响应、回调结果与查单结果。

## 7. 状态机硬规则

### 7.1 提现主单 `WithdrawalRequest`

- `pending_review -> approved`：管理员审核通过
- `pending_review -> rejected`：管理员审核驳回，同时解冻金额
- `pending_review -> cancelled`：用户撤销，同时解冻金额
- `approved -> paying`：微信同步受理成功
- `approved -> failed`：微信同步明确拒绝，同时退款回可用余额
- `paying -> paid`：微信回调成功，或主动查单确认成功
- `paying -> failed`：微信回调失败，或主动查单确认失败，同时退款回可用余额
- `failed -> approved`：管理员/系统发起重试，重新冻结金额
- `approved -> paying`：重试后微信再次受理成功

除上述路径外，其他流转全部拒绝。

### 7.2 代付子单 `WithdrawalPayout`

- `pending/processing -> succeeded`
- `pending/processing -> failed`

已经进入 `succeeded` 或 `failed` 的 payout 不允许再改成其他终态，除非只是幂等重复通知且结果一致。

### 7.3 资金规则

- 金额冻结发生在用户提交提现时
- 审核驳回/用户撤销时解冻
- 微信同步拒绝或最终失败时退款回可用余额
- 微信成功时扣减冻结余额，累计提现增加
- Provider 不直接动余额，只返回结果给 service 层处理

## 8. 微信接入设计

### 8.1 发起转账

`WeChatPayoutProvider.create_transfer()` 负责：

1. 校验钱包提现快照中的 `channel=wechat` 且 `openid` 信息完整
2. 通过 `wechat_client` 发起“商家转账到零钱”请求
3. 把微信同步响应翻译为：
   - 已受理：`accepted=True`，提现主单进入 `paying`
   - 同步明确拒绝：`accepted=False`，提现主单进入 `failed`
   - 网络异常或未知异常：本次发起不直接推进到 `paying` 或 `failed`，必须保留可追踪错误并进入后续人工或系统补偿判定

发起请求时禁止信任前端透传的核心字段，以下字段全部由后端生成：

- `openid`
- `transfer_amount`
- `out_bill_no`
- `notify_url`
- `remark`

### 8.2 回调验签与解密

回调处理必须包含两步：

1. 校验微信回调头签名
2. 解密回调资源获取业务明文

然后统一映射成内部 payload，再进入钱包 service 推进状态。

回调验签失败时：

- 不推进任何钱包状态
- 记录安全日志
- 触发告警

### 8.3 主动查单补偿

定时任务扫描：

- `WithdrawalRequest.status = paying`
- `WithdrawalPayout.status = processing`
- 超过设定时间仍未收到回调

查单处理规则：

- 微信确认成功：推进到 `paid`
- 微信确认失败：推进到 `failed`
- 微信仍处理中：保留 `paying`，更新时间，等待下一轮
- 微信暂时错误或网络异常：记录失败次数并重试
- 超过阈值仍未确认：打告警，等待人工处理

## 9. 配置与密钥

保留并正式启用以下配置：

- `WALLET_WECHAT_PAYOUT_ENABLED`
- `WALLET_WECHAT_MCH_ID`
- `WALLET_WECHAT_APP_ID`
- `WALLET_WECHAT_SERIAL_NO`
- `WALLET_WECHAT_PRIVATE_KEY`
- `WALLET_WECHAT_PLATFORM_CERT`
- `WALLET_WECHAT_NOTIFY_URL`
- `WALLET_WECHAT_TRANSFER_SCENE`
- `WALLET_WECHAT_API_BASE_URL`

建议新增：

- `WALLET_WECHAT_TIMEOUT_SECONDS`
- `WALLET_WECHAT_QUERY_RETRY_MINUTES`
- `WALLET_WECHAT_QUERY_MAX_RETRIES`
- `WALLET_WECHAT_CERT_REFRESH_SECONDS`

### 9.1 证书策略

- 平台证书优先读本地缓存
- 序列号不匹配或过期时自动刷新
- 刷新失败时不立即清空旧缓存，避免短时中断
- 私钥和平台证书只从环境配置读取，不写数据库

## 10. 幂等、对账与告警

### 10.1 幂等

- 发起代付：按 `WithdrawalPayout.idempotency_key`
- 回调处理：按 `provider + out_trade_no + 回调事件去重键`
- 查单补偿：按 payout 当前状态 + 任务扫描逻辑，重复执行不得重复落账
- 失败重试：每次必须新建 payout 子单，但挂同一个 `WithdrawalRequest`

### 10.2 对账

至少做两类：

1. **钱包内对账**  
   `WalletAccount` 当前余额 vs 最近一条 `WalletLedger` 快照

2. **微信外部对账**  
   本地 `WithdrawalPayout` vs 微信查单结果

重点关注：

- 本地 `processing`，微信已终态
- 本地 `failed`，微信实际成功
- 本地 `paid`，微信查无此单

能自动修正的自动修正，不能自动修正的进入人工核查并告警。

### 10.3 告警

至少包括：

- 微信回调验签失败
- 微信查单连续失败超过阈值
- `paying` 状态超时积压
- 钱包余额快照与流水快照不一致
- 配置缺失或证书加载失败
- 同一提现单发生异常重复推进

## 11. 安全与敏感信息边界

- 前端不能控制微信出款核心字段
- `payee_account_snapshot` 仅信冻结时固化的数据
- `request_payload` / `response_payload` 只落脱敏必要字段
- 日志里不记录私钥、完整签名串、完整敏感报文
- 回调必须验签，失败即拒绝
- 普通用户不能直接触发失败重试

## 12. 测试策略

### 12.1 Provider 单测

- 请求组装正确
- `openid` 缺失时报错
- 配置缺失时报错
- 微信同步受理、同步拒绝、未知异常映射正确
- 回调验签失败、解密失败被正确拒绝

### 12.2 Service 单测

- `approved -> paying`
- `approved -> failed`
- `paying -> paid`
- `paying -> failed`
- `failed -> retry -> approved/paying`
- 幂等回调、重复查单、重复重试不重复落账

### 12.3 补偿任务测试

- 超时未回调时触发查单
- 查单成功/失败/处理中/异常分支
- 超过重试阈值触发告警

### 12.4 集成测试

- 模拟微信 SDK/HTTP 返回
- 从管理员发起提现到回调成功/失败完整跑通
- 验证钱包余额、冻结余额、提现主单、payout 子单、流水五者一致

## 13. 完成标准

只有满足以下条件，才算“真实微信提现接入完成”：

- 能真实发起微信商家转账到零钱
- 能真实验签并处理微信回调
- 没有回调时能主动查单补偿
- 成功、失败、同步拒绝、超时查询四类链路全部闭环
- 钱包余额、冻结余额、提现主单、payout 子单、流水保持一致
- 有最小可用的对账和告警能力

## 14. 实施建议

推荐按以下顺序推进：

1. 引入 SDK 与 `wechat_client`
2. 把 `WeChatPayoutProvider` 从 mock 改为真实 create/query/callback
3. 打通 service 状态推进与幂等处理
4. 增加 Celery 查单补偿任务
5. 增加对账与告警
6. 用沙箱或测试商户完成端到端联调

该设计是对 `2026-06-10-wechat-withdrawal-payout-design.md` 骨架版的升级，后续实现应以本文件为主。
