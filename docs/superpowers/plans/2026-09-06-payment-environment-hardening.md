# 真实付费环境加固 Implementation Plan

> **For agentic workers:** 本计划在当前会话内执行；遵循项目规则，不创建 worktree、不执行 git add/commit/push。每项改动使用测试先行。

**Goal:** 让管理端微信订阅支付具备可恢复、可核对、可处置的资金闭环，并补齐组织订单中心、发票和付费说明。

**Architecture:** `apps.payments` 负责微信支付结果校验、主动查单和生产配置检查；`apps.subscriptions` 负责订单幂等、待支付恢复、异常订单处置、订阅履约与通知；`frontend_admin` 通过生成的 OpenAPI client 展示完整订单状态、继续支付、主动查单、发票和平台异常处置。仍保持手动续费和线下退款，不引入自动代扣或通用账单平台。

**Tech Stack:** Django 5、django-ninja、Celery、React 19、Umi Max、Ant Design 6、React Query、Vitest。

---

### Task 1: 微信支付结果校验与主动查单

**Files:**
- Modify: `apps/payments/wechat.py`
- Modify: `apps/payments/services.py`
- Modify: `apps/payments/exceptions.py`
- Test: `tests/payments/test_services.py`

- [ ] 写失败测试：支付成功结果金额、币种、商户号或 AppID 不匹配时拒绝履约。
- [ ] 写失败测试：Native 支付请求包含与本地订单一致的 `time_expire`。
- [ ] 写失败测试：主动查单成功时复用幂等支付成功服务，未支付时保持 pending。
- [ ] 运行目标测试并确认因缺少校验、`time_expire` 和 `query_payment` 失败。
- [ ] 实现统一的微信结果校验、成功时间解析和 `query_payment()`。
- [ ] 运行目标测试确认通过。

### Task 2: 订单幂等、待支付恢复和可靠关单

**Files:**
- Modify: `apps/subscriptions/models.py`
- Modify: `apps/subscriptions/schemas.py`
- Modify: `apps/subscriptions/services.py`
- Modify: `apps/subscriptions/api.py`
- Modify: `apps/subscriptions/tasks.py`
- Create: `apps/subscriptions/migrations/0006_saasorder_idempotency_key_and_pending_constraint.py`
- Test: `tests/subscriptions/test_services.py`
- Test: `tests/subscriptions/test_api.py`

- [ ] 写失败测试：相同组织和幂等键重复下单返回同一订单。
- [ ] 写失败测试：组织订单列表返回 paid、pending、closed，并为可继续支付的 Native 订单返回二维码和失效时间。
- [ ] 写失败测试：组织可主动刷新支付状态；关单任务失败会自动重试。
- [ ] 运行目标测试确认失败。
- [ ] 锁定组织行创建订单，保存幂等键，并增加单组织唯一待支付订单约束。
- [ ] 增加订单主动查单 API；扩展订单序列化的支付信息、退款信息和发票状态。
- [ ] 将关单任务改为可重试任务；超时扫描只负责本地关闭并调度可靠关单。
- [ ] 运行目标测试确认通过。

### Task 3: 异常支付和退款处置

**Files:**
- Modify: `apps/subscriptions/services.py`
- Modify: `apps/subscriptions/api.py`
- Modify: `apps/subscriptions/schemas.py`
- Modify: `frontend_admin/src/pages/platform-management/subscriptions/index.tsx`
- Test: `tests/subscriptions/test_services.py`
- Test: `tests/subscriptions/test_api.py`
- Test: `frontend_admin/src/pages/platform-management/subscriptions/index.test.tsx`

- [ ] 写失败测试：迟到付款的 exception 支付可以登记已完成的线下退款，但必须提供凭证且不能结束后续订阅。
- [ ] 写失败测试：退款历史订单选择立即结束时，不得终止由其他后续订单提供的当前订阅。
- [ ] 写失败前端测试：平台列表显示支付状态、关闭原因和渠道交易号，并对 exception 提供异常退款操作。
- [ ] 运行目标测试确认失败。
- [ ] 扩展退款规则和订单响应；平台端增加异常字段和受约束的处置入口。
- [ ] 运行目标测试确认通过。

### Task 4: 生产收款配置护栏和生命周期通知

**Files:**
- Modify: `apps/payments/apps.py`
- Create: `apps/payments/checks.py`
- Modify: `apps/subscriptions/tasks.py`
- Modify: `apps/subscriptions/services.py`
- Modify: `config/settings/_base.py`
- Test: `tests/payments/test_checks.py`
- Test: `tests/subscriptions/test_tasks.py`

- [ ] 写失败测试：非 DEBUG 环境启用一分钱测试金额时报 system check error。
- [ ] 写失败测试：生产启用微信收款但回调不是 HTTPS 或配置缺失时报错。
- [ ] 写失败测试：支付成功、支付异常、临期和到期会给组织 owner 发送站内信，且同一到期日提醒不会重复。
- [ ] 运行目标测试确认失败。
- [ ] 实现支付配置检查和订阅生命周期通知任务，注册必达站内信类别。
- [ ] 运行目标测试确认通过。

### Task 5: 管理端订单中心、恢复支付和发票自助

**Files:**
- Modify: `apps/access/api.py`
- Modify: `apps/access/schemas.py`
- Modify: `frontend_admin/src/access.ts`
- Modify: `frontend_admin/src/services/manual/navigationAccess.ts`
- Modify: `frontend_admin/src/pages/space/subscription/index.tsx`
- Modify: `frontend_admin/src/pages/space/subscription/orders/index.tsx`
- Modify: `frontend_admin/src/pages/space/subscription/index.test.tsx`
- Modify: `frontend_admin/src/pages/space/subscription/orders/index.test.tsx`
- Modify generated: `frontend_admin/src/services/openapi/**` only through `npm run openapi`

- [ ] 写失败前端测试：套餐页展示含税、手动续费、不自动扣款和退款/协议说明。
- [ ] 写失败前端测试：订单中心展示全部状态，可继续支付、主动查单、取消待支付订单，并展示二维码失效时间。
- [ ] 写失败前端测试：有管理权限的组织用户可以维护开票资料、申请开票、查看处理状态和下载文件；仅查看权限不显示资金操作。
- [ ] 运行目标测试确认失败。
- [ ] 增加 `subscriptions_manage` 导航能力并在前端隐藏无权限操作。
- [ ] 实现订单恢复、主动查单、订单详情和发票管理 UI，复用现有 Ant Design/React Query 模式。
- [ ] 运行 `npm run openapi` 更新生成客户端，不手改生成文件。
- [ ] 运行目标测试确认通过。

### Task 6: 全量验证与浏览器验收

**Files:**
- Update: `.codex/audits/frontend-admin-payment-environment/audit.md`
- Create screenshots under: `.codex/audits/frontend-admin-payment-environment/`

- [ ] 运行支付、订阅、通知和权限后端测试。
- [ ] 运行管理端相关 Vitest、TypeScript、Biome 和构建。
- [ ] 运行 Django system check 和 migration check。
- [ ] 浏览器验证套餐说明、待支付恢复、订单状态、发票管理和平台异常字段。
- [ ] 更新审计报告，明确真实微信付款、真实退款和真实开票仍未执行的边界。
