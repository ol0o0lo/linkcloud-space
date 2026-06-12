# WeChat Withdrawal Payout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为现有钱包提现流程补齐“微信提现官方直连骨架”，实现微信收款快照、provider 抽象、微信提现 provider 占位实现，以及基于 provider 的发起出款链路。

**Architecture:** 保持当前钱包模型和主状态机不大改，把微信提现细节下沉到 `apps.wallet.providers`。提现提交时继续做余额冻结，但同时从 `SocialAccount` 固化微信收款快照；管理员发起打款时通过 provider registry 获取 `wechat` provider，只有 provider 明确受理成功才将提现单推进到 `paying`。

**Tech Stack:** Django 5, django-ninja, allauth SocialAccount, pytest-django, model_bakery, existing wallet app, existing AppException error pipeline.

---

## Scope

本计划覆盖：

- 微信提现 provider 抽象层与 registry
- 微信收款快照固化逻辑
- 微信提现 provider 占位实现与本地错误映射
- `create_withdrawal_payout()` 改为通过 provider 执行
- 微信商户配置骨架
- 服务层、provider 层、API 层测试

本计划不覆盖：

- 真实微信 HTTP 请求
- 商户签名、平台证书验签正式实现
- 查单补单定时任务
- 前端页面改造

## File Structure

- Create: `apps/wallet/providers/__init__.py`
  - Responsibility: provider 包初始化。
- Create: `apps/wallet/providers/base.py`
  - Responsibility: 定义 provider 结果对象、基类接口。
- Create: `apps/wallet/providers/registry.py`
  - Responsibility: 返回 `wechat` provider 实例。
- Create: `apps/wallet/providers/wechat.py`
  - Responsibility: 微信提现 provider 骨架、配置校验、请求体组装、mock 受理结果。
- Modify: `apps/wallet/constants.py`
  - Responsibility: 新增 provider / channel 相关常量（如需要）。
- Modify: `apps/wallet/exceptions.py`
  - Responsibility: 新增微信快照缺失、微信配置缺失、provider 受理失败异常。
- Modify: `apps/wallet/security.py`
  - Responsibility: 提供微信收款快照构建函数与展示脱敏规则。
- Modify: `apps/wallet/services.py`
  - Responsibility: 提现提交时固化微信快照；发起 payout 时走 provider；只有 accepted 才推进到 `paying`。
- Modify: `apps/wallet/api.py`
  - Responsibility: 发起 payout 和 callback 入口对接 provider 语义。
- Modify: `config/settings/_base.py`
  - Responsibility: 增加微信提现配置骨架。
- Modify: `tests/wallet/test_services.py`
  - Responsibility: 补提现快照、provider 接入、accepted / rejected 分支测试。
- Create: `tests/wallet/test_providers.py`
  - Responsibility: provider 请求体组装、配置缺失、快照缺失、本地受理结果测试。
- Modify: `tests/wallet/test_api.py`
  - Responsibility: 补管理员发起微信提现经由 provider 的接口测试。

## Verification Commands

从仓库根目录执行：

```bash
docker compose exec web pytest tests/wallet/test_providers.py -v
docker compose exec web pytest tests/wallet/test_services.py -v
docker compose exec web pytest tests/wallet/test_api.py -v
docker compose exec web pytest tests/wallet -v
docker compose exec web python manage.py makemigrations --check --dry-run
```

Expected result:

- `test_providers.py` 通过，覆盖微信 provider 组装与错误路径。
- `test_services.py` 通过，覆盖快照写入和 accepted / rejected 状态推进。
- `test_api.py` 通过，覆盖管理员发起微信提现 API。
- `tests/wallet` 全量通过。
- `makemigrations --check --dry-run` exits with code 0。

---

### Task 1: 搭建 provider 抽象与微信提现异常

**Files:**
- Create: `apps/wallet/providers/__init__.py`
- Create: `apps/wallet/providers/base.py`
- Create: `apps/wallet/providers/registry.py`
- Modify: `apps/wallet/exceptions.py`
- Create: `tests/wallet/test_providers.py`

- [ ] **Step 1: 写 provider 骨架测试**

在 `tests/wallet/test_providers.py` 添加：

```python
from django.test import SimpleTestCase, override_settings

from apps.wallet.exceptions import WalletWechatConfigMissingException, WalletWechatSnapshotIncompleteException
from apps.wallet.providers.registry import get_payout_provider
from apps.wallet.providers.wechat import WeChatPayoutProvider


class WeChatPayoutProviderTests(SimpleTestCase):
    def test_registry_returns_wechat_provider(self):
        provider = get_payout_provider("wechat")
        assert isinstance(provider, WeChatPayoutProvider)

    @override_settings(
        WALLET_WECHAT_PAYOUT_ENABLED=True,
        WALLET_WECHAT_MCH_ID="1900000109",
        WALLET_WECHAT_APP_ID="wx123",
        WALLET_WECHAT_SERIAL_NO="serial-1",
        WALLET_WECHAT_PRIVATE_KEY="private-key",
        WALLET_WECHAT_PLATFORM_CERT="platform-cert",
        WALLET_WECHAT_NOTIFY_URL="https://example.com/api/wallet/payout/callback/wechat/",
        WALLET_WECHAT_TRANSFER_SCENE="ORDINARY_TRANSFER",
        WALLET_WECHAT_API_BASE_URL="https://api.mch.weixin.qq.com",
    )
    def test_build_transfer_request_from_snapshot(self):
        provider = WeChatPayoutProvider()
        withdrawal = type(
            "WithdrawalStub",
            (),
            {
                "pk": 1,
                "net_amount": 900,
                "payee_account_snapshot": {
                    "channel": "wechat",
                    "social_provider": "weixin",
                    "social_uid": "wx-user-1",
                    "openid": "openid-1",
                    "unionid": "unionid-1",
                    "receiver_name": "张三",
                    "masked_account": "wx******1234",
                },
            },
        )()

        payload = provider.build_transfer_request(withdrawal, idempotency_key="payout-1")

        assert payload["appid"] == "wx123"
        assert payload["out_bill_no"] == "payout-1"
        assert payload["transfer_amount"] == 900
        assert payload["openid"] == "openid-1"

    @override_settings(WALLET_WECHAT_PAYOUT_ENABLED=False)
    def test_build_transfer_request_rejects_missing_config(self):
        provider = WeChatPayoutProvider()
        withdrawal = type("WithdrawalStub", (), {"pk": 1, "net_amount": 900, "payee_account_snapshot": {}})()

        with self.assertRaises(WalletWechatConfigMissingException):
            provider.build_transfer_request(withdrawal, idempotency_key="payout-2")

    @override_settings(
        WALLET_WECHAT_PAYOUT_ENABLED=True,
        WALLET_WECHAT_MCH_ID="1900000109",
        WALLET_WECHAT_APP_ID="wx123",
        WALLET_WECHAT_SERIAL_NO="serial-1",
        WALLET_WECHAT_PRIVATE_KEY="private-key",
        WALLET_WECHAT_PLATFORM_CERT="platform-cert",
        WALLET_WECHAT_NOTIFY_URL="https://example.com/api/wallet/payout/callback/wechat/",
        WALLET_WECHAT_TRANSFER_SCENE="ORDINARY_TRANSFER",
        WALLET_WECHAT_API_BASE_URL="https://api.mch.weixin.qq.com",
    )
    def test_build_transfer_request_rejects_incomplete_snapshot(self):
        provider = WeChatPayoutProvider()
        withdrawal = type(
            "WithdrawalStub",
            (),
            {"pk": 1, "net_amount": 900, "payee_account_snapshot": {"channel": "wechat", "receiver_name": "张三"}},
        )()

        with self.assertRaises(WalletWechatSnapshotIncompleteException):
            provider.build_transfer_request(withdrawal, idempotency_key="payout-3")
```

- [ ] **Step 2: 运行 provider 测试确认失败**

Run:

```bash
docker compose exec web pytest tests/wallet/test_providers.py -v
```

Expected:

- FAIL with import errors for `apps.wallet.providers` or missing exceptions.

- [ ] **Step 3: 写最小 provider 抽象与异常实现**

新增 `apps/wallet/providers/base.py`：

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


class BasePayoutProvider:
    code = ""

    def build_transfer_request(self, withdrawal, idempotency_key: str) -> dict:
        raise NotImplementedError

    def create_transfer(self, withdrawal, idempotency_key: str) -> ProviderTransferResult:
        raise NotImplementedError

    def query_transfer(self, payout):
        raise NotImplementedError

    def verify_callback(self, payload: dict, headers: dict) -> bool:
        raise NotImplementedError

    def parse_callback(self, payload: dict):
        raise NotImplementedError
```

修改 `apps/wallet/exceptions.py`，追加：

```python
class WalletWechatConfigMissingException(WalletException):
    code = "03"
    message = _("微信提现配置缺失")


class WalletWechatSnapshotIncompleteException(WalletException):
    code = "04"
    message = _("微信提现收款信息不完整")


class WalletPayoutProviderRejectedException(WalletException):
    code = "05"
    message = _("微信提现请求未被受理")
```

新增 `apps/wallet/providers/registry.py`：

```python
from apps.wallet.providers.wechat import WeChatPayoutProvider


def get_payout_provider(provider_code: str):
    if provider_code == "wechat":
        return WeChatPayoutProvider()
    raise ValueError(f"Unsupported payout provider: {provider_code}")
```

新增 `apps/wallet/providers/__init__.py`：

```python
__all__ = []
```

- [ ] **Step 4: 实现微信提现 provider 最小可用骨架**

新增 `apps/wallet/providers/wechat.py`：

```python
from django.conf import settings

from apps.wallet.exceptions import WalletWechatConfigMissingException, WalletWechatSnapshotIncompleteException
from apps.wallet.providers.base import BasePayoutProvider, ProviderTransferResult


class WeChatPayoutProvider(BasePayoutProvider):
    code = "wechat"

    required_settings = (
        "WALLET_WECHAT_PAYOUT_ENABLED",
        "WALLET_WECHAT_MCH_ID",
        "WALLET_WECHAT_APP_ID",
        "WALLET_WECHAT_SERIAL_NO",
        "WALLET_WECHAT_PRIVATE_KEY",
        "WALLET_WECHAT_PLATFORM_CERT",
        "WALLET_WECHAT_NOTIFY_URL",
        "WALLET_WECHAT_TRANSFER_SCENE",
        "WALLET_WECHAT_API_BASE_URL",
    )

    def _validate_settings(self):
        missing = [name for name in self.required_settings if not getattr(settings, name, "")]
        if missing:
            raise WalletWechatConfigMissingException()

    def _get_openid(self, snapshot: dict) -> str:
        openid = snapshot.get("openid", "")
        if not openid:
            raise WalletWechatSnapshotIncompleteException()
        return openid

    def build_transfer_request(self, withdrawal, idempotency_key: str) -> dict:
        self._validate_settings()
        snapshot = withdrawal.payee_account_snapshot or {}
        openid = self._get_openid(snapshot)
        if snapshot.get("channel") != "wechat":
            raise WalletWechatSnapshotIncompleteException()
        return {
            "appid": settings.WALLET_WECHAT_APP_ID,
            "mchid": settings.WALLET_WECHAT_MCH_ID,
            "out_bill_no": idempotency_key,
            "transfer_scene_id": settings.WALLET_WECHAT_TRANSFER_SCENE,
            "openid": openid,
            "user_name": snapshot.get("receiver_name", ""),
            "transfer_amount": withdrawal.net_amount,
            "notify_url": settings.WALLET_WECHAT_NOTIFY_URL,
            "remark": f"wallet-withdrawal-{withdrawal.pk}",
        }

    def create_transfer(self, withdrawal, idempotency_key: str) -> ProviderTransferResult:
        payload = self.build_transfer_request(withdrawal, idempotency_key=idempotency_key)
        return ProviderTransferResult(
            provider=self.code,
            out_trade_no=idempotency_key,
            accepted=True,
            status="processing",
            request_payload=payload,
            response_payload={"mocked": True, "accepted": True},
        )

    def query_transfer(self, payout):
        return {"supported": False, "provider": self.code, "out_trade_no": payout.out_trade_no}

    def verify_callback(self, payload: dict, headers: dict) -> bool:
        return True

    def parse_callback(self, payload: dict):
        return payload
```

- [ ] **Step 5: 运行 provider 测试确认通过**

Run:

```bash
docker compose exec web pytest tests/wallet/test_providers.py -v
```

Expected:

- PASS, 4 tests passed.


### Task 2: 提现提交时固化微信收款快照

**Files:**
- Modify: `apps/wallet/security.py`
- Modify: `apps/wallet/services.py`
- Modify: `tests/wallet/test_services.py`

- [ ] **Step 1: 写微信快照失败测试**

在 `tests/wallet/test_services.py` 追加：

```python
from allauth.socialaccount.models import SocialAccount

from apps.wallet.constants import WithdrawalPayChannel
from apps.wallet.services import submit_withdrawal


def test_submit_withdrawal_snapshots_wechat_account_fields(self):
    user = baker.make(User, real_name="张三")
    baker.make(
        SocialAccount,
        user=user,
        provider="weixin",
        uid="wx-social-1",
        extra_data={"openid": "openid-1", "unionid": "unionid-1"},
    )
    apply_wallet_credit(
        user=user,
        amount=3000,
        entry_type="promotion_reward",
        biz_type="promotion.reward",
        biz_id="reward-snapshot-1",
        idempotency_key="reward-snapshot-1",
    )

    withdrawal = submit_withdrawal(
        user=user,
        amount=1000,
        fee_amount=100,
        pay_channel=WithdrawalPayChannel.WECHAT,
        payee_account={},
        client_request_id="withdraw-snapshot-1",
    )

    assert withdrawal.payee_account_snapshot["channel"] == "wechat"
    assert withdrawal.payee_account_snapshot["social_provider"] == "weixin"
    assert withdrawal.payee_account_snapshot["social_uid"] == "wx-social-1"
    assert withdrawal.payee_account_snapshot["openid"] == "openid-1"
    assert withdrawal.payee_account_snapshot["unionid"] == "unionid-1"
```

- [ ] **Step 2: 运行单测确认当前失败**

Run:

```bash
docker compose exec web pytest tests/wallet/test_services.py::WalletWithdrawalServiceTests::test_submit_withdrawal_snapshots_wechat_account_fields -v
```

Expected:

- FAIL because current `payee_account_snapshot` only stores masked display fields.

- [ ] **Step 3: 在 security.py 增加微信快照构建函数**

在 `apps/wallet/security.py` 追加：

```python
def build_wechat_payee_snapshot(*, social_account, receiver_name: str) -> dict:
    extra_data = social_account.extra_data or {}
    raw_account = extra_data.get("openid") or social_account.uid or ""
    return {
        "channel": "wechat",
        "social_provider": social_account.provider,
        "social_uid": social_account.uid,
        "unionid": extra_data.get("unionid", ""),
        "openid": extra_data.get("openid", ""),
        "receiver_name": receiver_name,
        "masked_account": mask_account(raw_account),
    }
```

- [ ] **Step 4: 在 submit_withdrawal() 中改为写微信快照**

修改 `apps/wallet/services.py` 中的提现逻辑：

```python
from apps.wallet.security import build_payee_snapshot, build_wechat_payee_snapshot


social_account = (
    SocialAccount.objects.filter(user=user, provider__in=["weixin", "wechat_miniprogram"])
    .order_by("id")
    .first()
)
if social_account is None:
    raise WechatBindingRequiredException()

payee_snapshot = build_wechat_payee_snapshot(
    social_account=social_account,
    receiver_name=user.real_name or user.get_full_name() or user.username,
)

withdrawal = WithdrawalRequest.objects.create(
    ...,
    payee_account_snapshot=payee_snapshot,
)
```

删除旧的 `build_payee_snapshot(payee_account)` 传值依赖，仅保留兼容其他路径需要的函数，不再让微信提现从前端收款信息构建快照。

- [ ] **Step 5: 运行服务层测试确认通过**

Run:

```bash
docker compose exec web pytest tests/wallet/test_services.py -v
```

Expected:

- PASS, 现有提现服务测试仍通过，新增微信快照测试通过。


### Task 3: 用 provider 接管发起 payout 主链路

**Files:**
- Modify: `apps/wallet/services.py`
- Modify: `tests/wallet/test_services.py`

- [ ] **Step 1: 写 accepted / rejected 两条分支测试**

在 `tests/wallet/test_services.py` 添加：

```python
from unittest.mock import patch

from apps.wallet.constants import WithdrawalStatus
from apps.wallet.providers.base import ProviderTransferResult


@patch("apps.wallet.services.get_payout_provider")
def test_create_withdrawal_payout_enters_paying_only_after_provider_accepts(self, mock_get_provider):
    provider = mock_get_provider.return_value
    provider.create_transfer.return_value = ProviderTransferResult(
        provider="wechat",
        out_trade_no="wx-out-1",
        accepted=True,
        status="processing",
        request_payload={"out_bill_no": "wx-out-1"},
        response_payload={"mocked": True},
    )

    payout = create_withdrawal_payout(
        withdrawal=withdrawal,
        provider="wechat",
        out_trade_no="wx-out-1",
        request_payload={},
        idempotency_key="payout-wechat-1",
    )

    withdrawal.refresh_from_db()
    assert payout.provider == "wechat"
    assert withdrawal.status == WithdrawalStatus.PAYING


@patch("apps.wallet.services.get_payout_provider")
def test_create_withdrawal_payout_keeps_approved_when_provider_rejects(self, mock_get_provider):
    provider = mock_get_provider.return_value
    provider.create_transfer.return_value = ProviderTransferResult(
        provider="wechat",
        out_trade_no="wx-out-2",
        accepted=False,
        status="failed",
        request_payload={"out_bill_no": "wx-out-2"},
        response_payload={"mocked": True},
        error_code="LOCAL_REJECT",
        error_message="config invalid",
    )

    with self.assertRaises(WalletPayoutProviderRejectedException):
        create_withdrawal_payout(
            withdrawal=withdrawal,
            provider="wechat",
            out_trade_no="wx-out-2",
            request_payload={},
            idempotency_key="payout-wechat-2",
        )

    withdrawal.refresh_from_db()
    assert withdrawal.status == WithdrawalStatus.APPROVED
```

- [ ] **Step 2: 运行定向测试确认失败**

Run:

```bash
docker compose exec web pytest tests/wallet/test_services.py -k "provider_accepts or provider_rejects" -v
```

Expected:

- FAIL because `create_withdrawal_payout()` still writes model directly and enters `paying` immediately.

- [ ] **Step 3: 修改 services.py 通过 provider 发起 payout**

修改 `apps/wallet/services.py`：

```python
from apps.wallet.exceptions import WalletPayoutProviderRejectedException
from apps.wallet.providers.registry import get_payout_provider


provider_client = get_payout_provider(provider)
result = provider_client.create_transfer(withdrawal, idempotency_key=idempotency_key)

payout = WithdrawalPayout.objects.create(
    withdrawal_request=withdrawal,
    provider=result.provider,
    out_trade_no=result.out_trade_no,
    provider_trade_no=result.provider_trade_no,
    idempotency_key=idempotency_key,
    request_payload=result.request_payload,
    response_payload=result.response_payload,
    status=PayoutStatus.PROCESSING if result.accepted else PayoutStatus.FAILED,
    error_code=result.error_code,
    error_message=result.error_message,
    executed_at=timezone.now(),
)
if not result.accepted:
    raise WalletPayoutProviderRejectedException(result.error_message or None)

withdrawal.status = WithdrawalStatus.PAYING
withdrawal.save(update_fields=["status", "updated_at"])
return payout
```

注意顺序：只有 `result.accepted` 时才更新 `withdrawal.status = PAYING`。

- [ ] **Step 4: 补一个 rejected 结果写 payout 失败记录的断言**

在 rejected 测试后追加：

```python
failed_payout = WithdrawalPayout.objects.get(idempotency_key="payout-wechat-2")
assert failed_payout.status == PayoutStatus.FAILED
assert failed_payout.error_code == "LOCAL_REJECT"
```

- [ ] **Step 5: 运行服务层测试确认通过**

Run:

```bash
docker compose exec web pytest tests/wallet/test_services.py -v
```

Expected:

- PASS, accepted 路径进入 `paying`，rejected 路径保留 `approved` 并落失败 payout。


### Task 4: 增加微信提现配置骨架并让 API 对接 provider 语义

**Files:**
- Modify: `config/settings/_base.py`
- Modify: `apps/wallet/api.py`
- Modify: `tests/wallet/test_api.py`

- [ ] **Step 1: 写 API 行为测试**

在 `tests/wallet/test_api.py` 添加：

```python
from unittest.mock import patch

from apps.wallet.providers.base import ProviderTransferResult


@patch("apps.wallet.services.get_payout_provider")
def test_admin_payout_uses_wechat_provider(self, mock_get_provider):
    provider = mock_get_provider.return_value
    provider.create_transfer.return_value = ProviderTransferResult(
        provider="wechat",
        out_trade_no="wx-api-1",
        accepted=True,
        status="processing",
        request_payload={"out_bill_no": "wx-api-1"},
        response_payload={"mocked": True},
    )

    payout_resp = self.client.post(
        f"/api/admin/wallet/withdrawals/{withdrawal.pk}/payout/",
        data=json.dumps({"provider": "wechat", "out_trade_no": "wx-api-1", "request_payload": {}, "idempotency_key": "wx-api-1"}),
        content_type="application/json",
    )

    assert payout_resp.status_code == 200
    assert payout_resp.json()["provider"] == "wechat"
    provider.create_transfer.assert_called_once()
```

- [ ] **Step 2: 运行 API 测试确认失败**

Run:

```bash
docker compose exec web pytest tests/wallet/test_api.py -k "wechat_provider" -v
```

Expected:

- FAIL if API / service is not yet stable on the provider abstraction.

- [ ] **Step 3: 增加微信提现配置骨架**

在 `config/settings/_base.py` 追加：

```python
WALLET_WECHAT_PAYOUT_ENABLED = env.bool("WALLET_WECHAT_PAYOUT_ENABLED", default=False)
WALLET_WECHAT_MCH_ID = env("WALLET_WECHAT_MCH_ID", default="")
WALLET_WECHAT_APP_ID = env("WALLET_WECHAT_APP_ID", default="")
WALLET_WECHAT_SERIAL_NO = env("WALLET_WECHAT_SERIAL_NO", default="")
WALLET_WECHAT_PRIVATE_KEY = env("WALLET_WECHAT_PRIVATE_KEY", default="")
WALLET_WECHAT_PLATFORM_CERT = env("WALLET_WECHAT_PLATFORM_CERT", default="")
WALLET_WECHAT_NOTIFY_URL = env("WALLET_WECHAT_NOTIFY_URL", default="")
WALLET_WECHAT_TRANSFER_SCENE = env("WALLET_WECHAT_TRANSFER_SCENE", default="ORDINARY_TRANSFER")
WALLET_WECHAT_API_BASE_URL = env("WALLET_WECHAT_API_BASE_URL", default="https://api.mch.weixin.qq.com")
```

- [ ] **Step 4: 收紧 payout API 的 provider 口径**

在 `apps/wallet/api.py` 保持 `provider` 仍由 payload 传入，但测试和服务都只接受 `wechat`；必要时在 service 内统一抛出钱包业务错误，不在 API 层单独分叉。

```python
payout = create_withdrawal_payout(
    withdrawal=withdrawal,
    provider=payload.provider,
    out_trade_no=payload.out_trade_no,
    request_payload=payload.request_payload,
    idempotency_key=payload.idempotency_key,
)
```

- [ ] **Step 5: 运行 API 与 migration 检查**

Run:

```bash
docker compose exec web pytest tests/wallet/test_api.py -v
docker compose exec web python manage.py makemigrations --check --dry-run
```

Expected:

- API tests PASS.
- `No changes detected`.


### Task 5: 全量验证并提交

**Files:**
- Modify: `tests/wallet/test_providers.py`
- Modify: `tests/wallet/test_services.py`
- Modify: `tests/wallet/test_api.py`
- Modify: `apps/wallet/providers/base.py`
- Modify: `apps/wallet/providers/wechat.py`
- Modify: `apps/wallet/providers/registry.py`
- Modify: `apps/wallet/services.py`
- Modify: `apps/wallet/security.py`
- Modify: `apps/wallet/exceptions.py`
- Modify: `config/settings/_base.py`

- [ ] **Step 1: 跑钱包测试全量验证**

Run:

```bash
docker compose exec web pytest tests/wallet -v
```

Expected:

- PASS, 钱包现有闭环测试与新增微信提现骨架测试全部通过。

- [ ] **Step 2: 再跑 migration 检查**

Run:

```bash
docker compose exec web python manage.py makemigrations --check --dry-run
```

Expected:

- `No changes detected`.

- [ ] **Step 3: 整理变更并提交**

Run:

```bash
git add apps/wallet/providers apps/wallet/exceptions.py apps/wallet/security.py apps/wallet/services.py config/settings/_base.py tests/wallet/test_providers.py tests/wallet/test_services.py tests/wallet/test_api.py
git commit -m "实现微信提现骨架与provider抽象"
```

Expected:

- Commit succeeds with only the WeChat payout skeleton files staged.
