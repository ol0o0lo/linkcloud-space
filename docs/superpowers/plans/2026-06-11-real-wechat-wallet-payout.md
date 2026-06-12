# Real WeChat Wallet Payout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为钱包提现链路接入真实微信“商家转账到零钱”能力，补齐 SDK 调用、回调验签解密、查单补偿、对账与告警最小闭环。

**Architecture:** 保持 `apps/wallet/services.py` 作为唯一资金与状态推进中心，把微信 SDK 交互下沉到 `apps/wallet/wechat_client.py`，由 `apps/wallet/providers/wechat.py` 负责领域映射。回调和查单都汇总到统一 service 入口推进状态，Celery 任务仅做扫描与调度，不直接改余额。

**Tech Stack:** Django 5, django-ninja, Celery, Redis, model-bakery, pytest, mature WeChat Pay Python SDK (`wechatpayv3`), cryptography.

---

## Scope

本计划覆盖：

- 引入真实微信支付 SDK 依赖与配置项
- 新增 `wechat_client`，处理真实发起、查单、回调验签解密
- 重写 `WeChatPayoutProvider` 以调用真实 client
- 将回调验签从自定义 HMAC 切换为微信回调头校验
- 增加主动查单补偿任务
- 增强服务层对同步拒绝、回调成功/失败、查询补偿的状态推进
- 增加 provider、service、api、task 测试

本计划不覆盖：

- 银行卡代付
- 新的提现手续费规则
- 统一支付中台重构
- 运营后台 UI 改版

## File Structure

- Modify: `pyproject.toml`
  - Responsibility: 增加微信支付 SDK 依赖。
- Modify: `config/settings/_base.py`
  - Responsibility: 增加微信代付超时、查单重试、证书缓存配置。
- Create: `apps/wallet/wechat_client.py`
  - Responsibility: 真实微信请求、查单、回调验签解密、证书装载。
- Create: `apps/wallet/error_mapping.py`
  - Responsibility: 微信错误码到钱包业务错误文案/是否受理的映射。
- Modify: `apps/wallet/providers/base.py`
  - Responsibility: 扩展 provider 查询/回调结果契约。
- Modify: `apps/wallet/providers/wechat.py`
  - Responsibility: 用真实 client 发起微信提现、查单、验签与报文翻译。
- Modify: `apps/wallet/security.py`
  - Responsibility: 删除旧的自定义 HMAC 回调签名依赖，保留 payee snapshot 能力。
- Modify: `apps/wallet/services.py`
  - Responsibility: 统一处理同步受理、同步拒绝、回调终态、查单补偿和幂等。
- Modify: `apps/wallet/api.py`
  - Responsibility: 回调入口改为读取微信回调头和原始请求体；新增内部补偿入口（如果复用 service 则保持轻薄）。
- Modify: `apps/wallet/tasks.py`
  - Responsibility: 定时扫描 `paying` 提现并调用查单补偿。
- Modify: `tests/wallet/test_providers.py`
  - Responsibility: provider 组装、同步受理/拒绝、回调解析测试。
- Create: `tests/wallet/test_wechat_client.py`
  - Responsibility: SDK client 配置、回调验签解密、查单结果映射测试。
- Modify: `tests/wallet/test_services.py`
  - Responsibility: 同步拒绝、回调成功/失败、查单补偿、重试幂等测试。
- Modify: `tests/wallet/test_api.py`
  - Responsibility: payout callback API 与内部补偿 API 测试。
- Create: `tests/wallet/test_tasks.py`
  - Responsibility: Celery 扫描与查单补偿测试。

## Verification Commands

从仓库根目录执行：

```bash
docker compose exec web pytest tests/wallet/test_wechat_client.py tests/wallet/test_providers.py tests/wallet/test_services.py tests/wallet/test_api.py tests/wallet/test_tasks.py -q
docker compose exec web pytest tests/wallet -q
docker compose exec web python manage.py makemigrations --check --dry-run
```

Expected result:

- 钱包微信 client / provider / service / api / task 测试全部通过。
- `tests/wallet` 全量通过，没有提现状态机回归。
- `makemigrations --check --dry-run` 输出 `No changes detected`。

### Task 1: 引入微信 SDK 与基础 Client

**Files:**
- Modify: `pyproject.toml`
- Modify: `config/settings/_base.py`
- Create: `apps/wallet/wechat_client.py`
- Create: `tests/wallet/test_wechat_client.py`

- [ ] **Step 1: 写失败测试，先锁定 client 配置校验与回调解包行为**

在 `tests/wallet/test_wechat_client.py` 新增：

```python
from django.test import SimpleTestCase, override_settings

from apps.wallet.exceptions import WalletWechatConfigMissingException
from apps.wallet.wechat_client import WechatCallbackResult, WechatClientConfig, build_wechat_client_config, parse_wechat_callback_resource


class WechatClientTests(SimpleTestCase):
    @override_settings(WALLET_WECHAT_PAYOUT_ENABLED=False)
    def test_build_wechat_client_config_rejects_missing_required_settings(self):
        with self.assertRaises(WalletWechatConfigMissingException):
            build_wechat_client_config()

    @override_settings(
        WALLET_WECHAT_PAYOUT_ENABLED=True,
        WALLET_WECHAT_MCH_ID="1900000109",
        WALLET_WECHAT_APP_ID="wx123",
        WALLET_WECHAT_SERIAL_NO="serial-1",
        WALLET_WECHAT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----",
        WALLET_WECHAT_PLATFORM_CERT="-----BEGIN CERTIFICATE-----\nabc\n-----END CERTIFICATE-----",
        WALLET_WECHAT_NOTIFY_URL="https://example.com/api/wallet/payout/callback/wechat/",
        WALLET_WECHAT_TRANSFER_SCENE="ORDINARY_TRANSFER",
        WALLET_WECHAT_API_BASE_URL="https://api.mch.weixin.qq.com",
        WALLET_WECHAT_TIMEOUT_SECONDS=8,
        WALLET_WECHAT_QUERY_RETRY_MINUTES=10,
        WALLET_WECHAT_QUERY_MAX_RETRIES=6,
        WALLET_WECHAT_CERT_REFRESH_SECONDS=3600,
    )
    def test_build_wechat_client_config_reads_runtime_settings(self):
        config = build_wechat_client_config()

        self.assertIsInstance(config, WechatClientConfig)
        self.assertEqual(config.mch_id, "1900000109")
        self.assertEqual(config.timeout_seconds, 8)
        self.assertEqual(config.query_max_retries, 6)

    def test_parse_wechat_callback_resource_maps_terminal_statuses(self):
        result = parse_wechat_callback_resource({
            "out_bill_no": "out-1",
            "state": "SUCCESS",
            "transfer_bill_no": "wx-1",
        })

        self.assertEqual(result, WechatCallbackResult(out_trade_no="out-1", provider_trade_no="wx-1", callback_status="success", response_payload={"state": "SUCCESS"}))
```

- [ ] **Step 2: 运行测试确认当前失败**

Run:

```bash
docker compose exec web pytest tests/wallet/test_wechat_client.py -q
```

Expected:

- FAIL with `ModuleNotFoundError: No module named 'apps.wallet.wechat_client'` or missing symbol errors.

- [ ] **Step 3: 增加 SDK 依赖与基础配置读取代码**

修改 `pyproject.toml` dependencies：

```toml
dependencies = [
    "Django~=5.0",
    "Pillow~=12.2",
    "boto3~=1.34",
    "celery~=5.5",
    "django-alive~=2.0",
    "django-allauth[mfa,socialaccount]~=65.16",
    "django-hijack~=3.7",
    "django-maintenance-mode~=0.19",
    "django-ninja~=1.4",
    "django-storages~=1.8",
    "epicenv[django]~=1.2",
    "fido2~=2.2",
    "gunicorn~=25.0",
    "hiredis~=3.0",
    "psycopg2-binary~=2.9",
    "python-json-logger~=4.1",
    "redis~=7.1",
    "whitenoise~=6.7",
    "wechatpayv3~=2.0",
    "alibabacloud-dysmsapi20170525>=2.0.0",
    "alibabacloud-sts20150401>=1.0.0",
    "tencentcloud-sdk-python-sms>=3.0.0",
]
```

在 `config/settings/_base.py` 的钱包微信提现配置旁追加：

```python
WALLET_WECHAT_TIMEOUT_SECONDS = env.int("WALLET_WECHAT_TIMEOUT_SECONDS", default=8)
WALLET_WECHAT_QUERY_RETRY_MINUTES = env.int("WALLET_WECHAT_QUERY_RETRY_MINUTES", default=10)
WALLET_WECHAT_QUERY_MAX_RETRIES = env.int("WALLET_WECHAT_QUERY_MAX_RETRIES", default=6)
WALLET_WECHAT_CERT_REFRESH_SECONDS = env.int("WALLET_WECHAT_CERT_REFRESH_SECONDS", default=3600)
```

创建 `apps/wallet/wechat_client.py`：

```python
from dataclasses import dataclass

from django.conf import settings

from apps.wallet.exceptions import WalletWechatConfigMissingException


@dataclass(slots=True)
class WechatClientConfig:
    app_id: str
    api_base_url: str
    cert_refresh_seconds: int
    mch_id: str
    platform_cert: str
    private_key: str
    query_max_retries: int
    query_retry_minutes: int
    serial_no: str
    timeout_seconds: int
    transfer_scene: str
    notify_url: str


@dataclass(slots=True)
class WechatCallbackResult:
    out_trade_no: str
    provider_trade_no: str
    callback_status: str
    response_payload: dict


def build_wechat_client_config() -> WechatClientConfig:
    required = {
        "mch_id": getattr(settings, "WALLET_WECHAT_MCH_ID", ""),
        "app_id": getattr(settings, "WALLET_WECHAT_APP_ID", ""),
        "serial_no": getattr(settings, "WALLET_WECHAT_SERIAL_NO", ""),
        "private_key": getattr(settings, "WALLET_WECHAT_PRIVATE_KEY", ""),
        "platform_cert": getattr(settings, "WALLET_WECHAT_PLATFORM_CERT", ""),
        "notify_url": getattr(settings, "WALLET_WECHAT_NOTIFY_URL", ""),
        "transfer_scene": getattr(settings, "WALLET_WECHAT_TRANSFER_SCENE", ""),
        "api_base_url": getattr(settings, "WALLET_WECHAT_API_BASE_URL", ""),
    }
    if not getattr(settings, "WALLET_WECHAT_PAYOUT_ENABLED", False) or any(not value for value in required.values()):
        raise WalletWechatConfigMissingException()

    return WechatClientConfig(
        mch_id=required["mch_id"],
        app_id=required["app_id"],
        serial_no=required["serial_no"],
        private_key=required["private_key"],
        platform_cert=required["platform_cert"],
        notify_url=required["notify_url"],
        transfer_scene=required["transfer_scene"],
        api_base_url=required["api_base_url"],
        timeout_seconds=getattr(settings, "WALLET_WECHAT_TIMEOUT_SECONDS", 8),
        query_retry_minutes=getattr(settings, "WALLET_WECHAT_QUERY_RETRY_MINUTES", 10),
        query_max_retries=getattr(settings, "WALLET_WECHAT_QUERY_MAX_RETRIES", 6),
        cert_refresh_seconds=getattr(settings, "WALLET_WECHAT_CERT_REFRESH_SECONDS", 3600),
    )


def parse_wechat_callback_resource(resource: dict) -> WechatCallbackResult:
    state = resource.get("state", "")
    callback_status = "success" if state == "SUCCESS" else "failed"
    return WechatCallbackResult(
        out_trade_no=resource.get("out_bill_no", ""),
        provider_trade_no=resource.get("transfer_bill_no", ""),
        callback_status=callback_status,
        response_payload={"state": state},
    )
```

- [ ] **Step 4: 运行测试确认通过**

Run:

```bash
docker compose exec web pytest tests/wallet/test_wechat_client.py -q
```

Expected:

- PASS，说明 client 配置读取和回调状态解析基础能力已建立。

- [ ] **Step 5: Commit**

```bash
git add pyproject.toml config/settings/_base.py apps/wallet/wechat_client.py tests/wallet/test_wechat_client.py
git commit -m "补齐微信提现客户端基础设施"
```

### Task 2: 接入真实 Provider 与回调验签解密入口

**Files:**
- Modify: `apps/wallet/providers/base.py`
- Modify: `apps/wallet/providers/wechat.py`
- Modify: `apps/wallet/security.py`
- Modify: `tests/wallet/test_providers.py`

- [ ] **Step 1: 写失败测试，锁定 provider 的 create/query/callback 契约**

在 `tests/wallet/test_providers.py` 追加：

```python
from unittest.mock import patch

from apps.wallet.providers.base import ProviderTransferResult


@patch("apps.wallet.providers.wechat.WechatPayClient")
def test_create_transfer_maps_client_accept_response(self, mock_client_cls):
    provider = WeChatPayoutProvider()
    withdrawal = type("WithdrawalStub", (), {"pk": 9, "net_amount": 900, "payee_account_snapshot": {"channel": "wechat", "openid": "openid-9", "receiver_name": "张三"}})()
    mock_client_cls.return_value.create_transfer.return_value = {
        "accepted": True,
        "out_trade_no": "out-9",
        "provider_trade_no": "wx-9",
        "request_payload": {"out_bill_no": "out-9"},
        "response_payload": {"state": "ACCEPTED"},
    }

    result = provider.create_transfer(withdrawal, idempotency_key="out-9")

    self.assertEqual(result, ProviderTransferResult(provider="wechat", out_trade_no="out-9", accepted=True, status="processing", request_payload={"out_bill_no": "out-9"}, response_payload={"state": "ACCEPTED"}, provider_trade_no="wx-9"))


@patch("apps.wallet.providers.wechat.WechatPayClient")
def test_parse_callback_uses_client_verified_resource(self, mock_client_cls):
    provider = WeChatPayoutProvider()
    mock_client_cls.return_value.parse_callback.return_value = {
        "out_trade_no": "out-10",
        "provider_trade_no": "wx-10",
        "callback_status": "success",
        "response_payload": {"state": "SUCCESS"},
    }

    result = provider.parse_callback(payload={"id": "cb-1"}, headers={"Wechatpay-Signature": "sig"})

    self.assertEqual(result["out_trade_no"], "out-10")
    self.assertEqual(result["callback_status"], "success")
```

- [ ] **Step 2: 运行测试确认当前失败**

Run:

```bash
docker compose exec web pytest tests/wallet/test_providers.py -q
```

Expected:

- FAIL with missing `WechatPayClient` import or callback method signature mismatch.

- [ ] **Step 3: 实现 provider 到 client 的真实映射**

修改 `apps/wallet/providers/base.py`：

```python
from dataclasses import dataclass, field


@dataclass(slots=True)
class ProviderTransferResult:
    provider: str
    out_trade_no: str
    accepted: bool
    status: str
    request_payload: dict = field(default_factory=dict)
    response_payload: dict = field(default_factory=dict)
    provider_trade_no: str = ""
    error_code: str = ""
    error_message: str = ""


@dataclass(slots=True)
class ProviderQueryResult:
    out_trade_no: str
    provider_trade_no: str
    payout_status: str
    response_payload: dict = field(default_factory=dict)
    error_code: str = ""
    error_message: str = ""
```

修改 `apps/wallet/providers/wechat.py` 关键实现：

```python
from apps.wallet.providers.base import BasePayoutProvider, ProviderQueryResult, ProviderTransferResult
from apps.wallet.wechat_client import WechatPayClient


class WeChatPayoutProvider(BasePayoutProvider):
    code = "wechat"

    def __init__(self):
        self.client = WechatPayClient()

    def create_transfer(self, withdrawal, idempotency_key: str) -> ProviderTransferResult:
        payload = self.build_transfer_request(withdrawal, idempotency_key=idempotency_key)
        result = self.client.create_transfer(payload)
        return ProviderTransferResult(
            provider=self.code,
            out_trade_no=result["out_trade_no"],
            accepted=result["accepted"],
            status="processing" if result["accepted"] else "failed",
            request_payload=result.get("request_payload", payload),
            response_payload=result.get("response_payload", {}),
            provider_trade_no=result.get("provider_trade_no", ""),
            error_code=result.get("error_code", ""),
            error_message=result.get("error_message", ""),
        )

    def query_transfer(self, payout) -> ProviderQueryResult:
        result = self.client.query_transfer(out_trade_no=payout.out_trade_no)
        return ProviderQueryResult(
            out_trade_no=payout.out_trade_no,
            provider_trade_no=result.get("provider_trade_no", ""),
            payout_status=result["payout_status"],
            response_payload=result.get("response_payload", {}),
            error_code=result.get("error_code", ""),
            error_message=result.get("error_message", ""),
        )

    def verify_callback(self, payload: dict, headers: dict) -> bool:
        return self.client.verify_callback(headers=headers, payload=payload)

    def parse_callback(self, payload: dict, headers: dict):
        return self.client.parse_callback(headers=headers, payload=payload)
```

修改 `apps/wallet/security.py`，删除以下旧签名函数：

```python
def _callback_secret(provider: str) -> str:
    ...


def build_callback_signature(*, provider: str, payload: dict) -> str:
    ...


def verify_callback_signature(*, provider: str, payload: dict, signature: str) -> bool:
    ...
```

保留 `build_wechat_payee_snapshot()`、`mask_account()`、`encrypt_wallet_payload()` 等快照能力不变。

- [ ] **Step 4: 运行 provider 测试确认通过**

Run:

```bash
docker compose exec web pytest tests/wallet/test_providers.py -q
```

Expected:

- PASS，说明 provider 已不再返回 mocked 固定结果，而是通过真实 client 契约工作。

- [ ] **Step 5: Commit**

```bash
git add apps/wallet/providers/base.py apps/wallet/providers/wechat.py apps/wallet/security.py tests/wallet/test_providers.py
git commit -m "重构微信提现提供方契约"
```

### Task 3: 服务层统一处理同步拒绝、回调终态与查询补偿

**Files:**
- Modify: `apps/wallet/services.py`
- Modify: `tests/wallet/test_services.py`

- [ ] **Step 1: 写失败测试，锁定查询补偿与未知错误不误落账**

在 `tests/wallet/test_services.py` 追加：

```python
@patch("apps.wallet.services.get_payout_provider")
def test_sync_processing_withdrawals_marks_paid_when_query_confirms_success(self, mock_get_provider):
    user = baker.make(User)
    admin = baker.make(User)
    baker.make(SocialAccount, user=user, provider="weixin", uid="wx-sync-user", extra_data={"openid": "openid-sync"})
    apply_wallet_credit(user=user, amount=3000, entry_type="promotion_reward", biz_type="promotion.reward", biz_id="reward-sync", idempotency_key="reward-sync")
    withdrawal = submit_withdrawal(user=user, amount=1000, fee_amount=100, pay_channel=WithdrawalPayChannel.WECHAT, payee_account={"name": "张三", "account": "13800138000"}, client_request_id="withdraw-sync-1")
    approve_withdrawal(withdrawal=withdrawal, operator=admin, approved=True, reason="ok", idempotency_key="review-sync-1")
    provider = mock_get_provider.return_value
    provider.create_transfer.return_value = ProviderTransferResult(provider="wechat", out_trade_no="out-sync-1", accepted=True, status="processing", request_payload={}, response_payload={})
    payout = create_withdrawal_payout(withdrawal=withdrawal, provider="wechat", out_trade_no="out-sync-1", request_payload={}, idempotency_key="payout-sync-1")
    provider.query_transfer.return_value = ProviderQueryResult(out_trade_no="out-sync-1", provider_trade_no="wx-sync-1", payout_status="succeeded", response_payload={"state": "SUCCESS"})

    sync_processing_withdrawals()

    withdrawal.refresh_from_db()
    self.assertEqual(withdrawal.status, WithdrawalStatus.PAID)


@patch("apps.wallet.services.get_payout_provider")
def test_create_withdrawal_payout_keeps_approved_when_transport_error_occurs(self, mock_get_provider):
    user = baker.make(User)
    admin = baker.make(User)
    baker.make(SocialAccount, user=user, provider="weixin", uid="wx-network-user", extra_data={"openid": "openid-network"})
    apply_wallet_credit(user=user, amount=3000, entry_type="promotion_reward", biz_type="promotion.reward", biz_id="reward-network", idempotency_key="reward-network")
    withdrawal = submit_withdrawal(user=user, amount=1000, fee_amount=100, pay_channel=WithdrawalPayChannel.WECHAT, payee_account={"name": "张三", "account": "13800138000"}, client_request_id="withdraw-network-1")
    approve_withdrawal(withdrawal=withdrawal, operator=admin, approved=True, reason="ok", idempotency_key="review-network-1")
    mock_get_provider.return_value.create_transfer.side_effect = TimeoutError("wechat timeout")

    with self.assertRaises(TimeoutError):
        create_withdrawal_payout(withdrawal=withdrawal, provider="wechat", out_trade_no="out-network-1", request_payload={}, idempotency_key="payout-network-1")

    withdrawal.refresh_from_db()
    wallet = ensure_wallet_account(user)
    self.assertEqual(withdrawal.status, WithdrawalStatus.APPROVED)
    self.assertEqual(wallet.available_balance, 2000)
    self.assertEqual(wallet.frozen_balance, 1000)
```

- [ ] **Step 2: 运行测试确认当前失败**

Run:

```bash
docker compose exec web pytest tests/wallet/test_services.py -q
```

Expected:

- FAIL with missing `ProviderQueryResult`/`sync_processing_withdrawals()` or wrong service behavior.

- [ ] **Step 3: 最小实现查询补偿与未知异常处理**

在 `apps/wallet/services.py` 中：

1. 把 `create_withdrawal_payout()` 里的 provider 调用包在事务外层，避免未知异常误改状态：

```python
def create_withdrawal_payout(*, withdrawal, provider, out_trade_no, request_payload, idempotency_key):
    existing = WithdrawalPayout.objects.filter(idempotency_key=idempotency_key).first()
    if existing is not None:
        return existing

    withdrawal = WithdrawalRequest.objects.select_related("wallet").get(pk=withdrawal.pk)
    if withdrawal.status == WithdrawalStatus.PAYING:
        return withdrawal.payouts.order_by("-created_at", "-pk").first()
    if withdrawal.status != WithdrawalStatus.APPROVED:
        raise ValueError("Only approved withdrawals can start payout.")

    provider_client = get_payout_provider(provider)
    result = provider_client.create_transfer(withdrawal, idempotency_key=idempotency_key)
    ...
```

2. 新增 `sync_processing_withdrawals()`：

```python
@transaction.atomic
def sync_processing_withdrawals(*, withdrawal_ids=None):
    queryset = WithdrawalRequest.objects.filter(status=WithdrawalStatus.PAYING).order_by("pk")
    if withdrawal_ids:
        queryset = queryset.filter(pk__in=withdrawal_ids)

    for withdrawal in queryset.select_for_update():
        payout = withdrawal.payouts.filter(status=PayoutStatus.PROCESSING).order_by("-created_at", "-pk").first()
        if payout is None:
            continue
        provider_client = get_payout_provider(payout.provider)
        result = provider_client.query_transfer(payout)
        if result.payout_status == "succeeded":
            handle_payout_callback(
                provider=payout.provider,
                out_trade_no=payout.out_trade_no,
                provider_trade_no=result.provider_trade_no,
                callback_status="success",
                response_payload=result.response_payload,
            )
        elif result.payout_status == "failed":
            handle_payout_callback(
                provider=payout.provider,
                out_trade_no=payout.out_trade_no,
                provider_trade_no=result.provider_trade_no,
                callback_status="failed",
                response_payload=result.response_payload,
            )
```

- [ ] **Step 4: 运行服务测试确认通过**

Run:

```bash
docker compose exec web pytest tests/wallet/test_services.py -q
```

Expected:

- PASS，说明同步拒绝、未知异常、查单补偿都不会破坏资金一致性。

- [ ] **Step 5: Commit**

```bash
git add apps/wallet/services.py tests/wallet/test_services.py
git commit -m "补齐微信提现服务状态补偿"
```

### Task 4: 改造 API 回调入口与补偿任务

**Files:**
- Modify: `apps/wallet/api.py`
- Modify: `apps/wallet/tasks.py`
- Modify: `tests/wallet/test_api.py`
- Create: `tests/wallet/test_tasks.py`

- [ ] **Step 1: 写失败测试，锁定回调入口不再依赖旧 HMAC**

在 `tests/wallet/test_api.py` 追加：

```python
@patch("apps.wallet.api.get_payout_provider")
@patch("apps.wallet.api.handle_payout_callback")
def test_payout_callback_uses_provider_verification_and_parse(self, mock_handle_callback, mock_get_provider):
    provider = mock_get_provider.return_value
    provider.verify_callback.return_value = True
    provider.parse_callback.return_value = {
        "out_trade_no": "out-cb-1",
        "provider_trade_no": "wx-cb-1",
        "callback_status": "success",
        "response_payload": {"state": "SUCCESS"},
    }
    mock_handle_callback.return_value = baker.make("wallet.WithdrawalPayout", provider="wechat", out_trade_no="out-cb-1")

    resp = self.client.post(
        "/api/wallet/payout/callback/wechat/",
        data=json.dumps({"id": "notify-1"}),
        content_type="application/json",
        HTTP_WECHATPAY_SIGNATURE="sig",
        HTTP_WECHATPAY_TIMESTAMP="1710000000",
        HTTP_WECHATPAY_NONCE="nonce-1",
        HTTP_WECHATPAY_SERIAL="serial-1",
    )

    self.assertEqual(resp.status_code, 200)
    provider.verify_callback.assert_called_once()
    provider.parse_callback.assert_called_once()
    mock_handle_callback.assert_called_once_with(provider="wechat", out_trade_no="out-cb-1", provider_trade_no="wx-cb-1", callback_status="success", response_payload={"state": "SUCCESS"})
```

创建 `tests/wallet/test_tasks.py`：

```python
from django.test import TestCase
from unittest.mock import patch

from apps.wallet.tasks import sync_processing_withdrawals_task


class WalletTaskTests(TestCase):
    @patch("apps.wallet.tasks.sync_processing_withdrawals")
    def test_sync_processing_withdrawals_task_calls_service(self, mock_sync):
        sync_processing_withdrawals_task()

        mock_sync.assert_called_once_with()
```

- [ ] **Step 2: 运行测试确认当前失败**

Run:

```bash
docker compose exec web pytest tests/wallet/test_api.py tests/wallet/test_tasks.py -q
```

Expected:

- FAIL because callback API still imports `verify_callback_signature` and task entrypoint does not exist.

- [ ] **Step 3: 实现 API 回调与 Celery 任务最小代码**

修改 `apps/wallet/api.py`：

```python
from apps.wallet.providers.registry import get_payout_provider


@router.post("/payout/callback/{provider}/", auth=None, response=WithdrawalPayoutOut, summary="处理代付回调")
def payout_callback(request, provider: str, payload: PayoutCallbackIn):
    provider_client = get_payout_provider(provider)
    headers = {key: value for key, value in request.headers.items()}
    if not provider_client.verify_callback(payload=payload.dict(), headers=headers):
        raise HttpError(403, "Invalid callback signature.")
    parsed = provider_client.parse_callback(payload=payload.dict(), headers=headers)
    return handle_payout_callback(provider=provider, **parsed)
```

修改 `apps/wallet/tasks.py`：

```python
from celery import shared_task

from apps.wallet.services import sync_processing_withdrawals


@shared_task
def sync_processing_withdrawals_task():
    sync_processing_withdrawals()
```

- [ ] **Step 4: 运行 API 与任务测试确认通过**

Run:

```bash
docker compose exec web pytest tests/wallet/test_api.py tests/wallet/test_tasks.py -q
```

Expected:

- PASS，说明回调入口已经完全走 provider 验签与解析，补偿任务也可被 Celery 调度。

- [ ] **Step 5: Commit**

```bash
git add apps/wallet/api.py apps/wallet/tasks.py tests/wallet/test_api.py tests/wallet/test_tasks.py
git commit -m "补齐微信提现回调与补偿任务"
```

### Task 5: 全量回归与整理

**Files:**
- Modify: `apps/wallet/wechat_client.py`
- Modify: `apps/wallet/providers/base.py`
- Modify: `apps/wallet/providers/wechat.py`
- Modify: `apps/wallet/services.py`
- Modify: `apps/wallet/api.py`
- Modify: `apps/wallet/tasks.py`
- Modify: `apps/wallet/error_mapping.py`
- Modify: `tests/wallet/test_wechat_client.py`
- Modify: `tests/wallet/test_providers.py`
- Modify: `tests/wallet/test_services.py`
- Modify: `tests/wallet/test_api.py`
- Modify: `tests/wallet/test_tasks.py`
- Modify: `pyproject.toml`
- Modify: `config/settings/_base.py`

- [ ] **Step 1: 跑微信相关测试集**

Run:

```bash
docker compose exec web pytest tests/wallet/test_wechat_client.py tests/wallet/test_providers.py tests/wallet/test_services.py tests/wallet/test_api.py tests/wallet/test_tasks.py -q
```

Expected:

- PASS，真实微信提现关键链路测试全部通过。

- [ ] **Step 2: 跑钱包全量测试**

Run:

```bash
docker compose exec web pytest tests/wallet -q
```

Expected:

- PASS，没有钱包现有闭环回归。

- [ ] **Step 3: 检查迁移与依赖状态**

Run:

```bash
docker compose exec web python manage.py makemigrations --check --dry-run
```

Expected:

- `No changes detected`。

- [ ] **Step 4: 提交最终改动**

```bash
git add pyproject.toml config/settings/_base.py apps/wallet/wechat_client.py apps/wallet/error_mapping.py apps/wallet/providers/base.py apps/wallet/providers/wechat.py apps/wallet/security.py apps/wallet/services.py apps/wallet/api.py apps/wallet/tasks.py tests/wallet/test_wechat_client.py tests/wallet/test_providers.py tests/wallet/test_services.py tests/wallet/test_api.py tests/wallet/test_tasks.py
git commit -m "实现真实微信提现企业级接入"
```

Expected:

- Commit succeeds with only wallet real-wechat payout implementation files staged.
