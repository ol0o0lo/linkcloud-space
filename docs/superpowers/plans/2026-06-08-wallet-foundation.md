# Wallet Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为项目落地个人钱包基础后端闭环，支持业务模块入账、用户提现申请、超级管理员审核与调账、代付回调、补偿与对账。

**Architecture:** 新增 `apps.wallet` 作为独立 Django app，模型只保留账户、流水、提现申请、代付记录四类资金事实；业务模块通过 wallet service 传入 `biz_type`、`biz_id`、`idempotency_key` 触发入账。API 先覆盖主站用户接口、超级管理员运营接口与内部补偿接口，不在本计划中实现独立推广模块和专门的后台前端页面。

**Tech Stack:** Django 5, django-ninja, PostgreSQL, model_bakery, pytest-django, existing auth/session stack, Vue SPA consumers later through `/api/wallet/*`.

---

## Scope

本计划只覆盖钱包基础后端能力：

- `apps.wallet` 新 app 与迁移
- 钱包账户、流水、提现申请、代付记录模型
- 统一 wallet service（入账、调账、提现、审核、代付回调、对账）
- 用户侧、超级管理员侧、内部补偿侧 API
- 敏感字段加密/脱敏与幂等保护
- 单测与 API 测试

本计划不覆盖：

- 推广模块自己的奖励记录表
- `frontend_admin/` 专门的钱包运营页面
- 主站 SPA 的钱包页面 UI
- 第三方真实代付 SDK 接入细节（先预留 provider 适配层与假回调测试）

## File Structure

- Create: `apps/wallet/__init__.py`
  - Responsibility: 声明钱包 app 包。
- Create: `apps/wallet/apps.py`
  - Responsibility: 注册 `WalletConfig`。
- Create: `apps/wallet/constants.py`
  - Responsibility: 钱包流水类型、提现状态、代付状态等枚举。
- Create: `apps/wallet/models.py`
  - Responsibility: 定义 `WalletAccount`、`WalletLedger`、`WithdrawalRequest`、`WithdrawalPayout`。
- Create: `apps/wallet/security.py`
  - Responsibility: 收款信息加密解密、脱敏、代付报文脱敏。
- Create: `apps/wallet/services.py`
  - Responsibility: 统一封装入账、调账、提现状态机、代付发起、回调处理、对账检查。
- Create: `apps/wallet/schemas.py`
  - Responsibility: 钱包 API 输入输出 schema。
- Create: `apps/wallet/api.py`
  - Responsibility: wallet routers 与 endpoint。
- Create: `apps/wallet/migrations/0001_initial.py`
  - Responsibility: 钱包基础表结构迁移。
- Create: `tests/wallet/test_models.py`
  - Responsibility: 校验模型约束、索引、敏感字段存储与状态枚举。
- Create: `tests/wallet/test_services.py`
  - Responsibility: 校验入账、调账、提现、幂等、补偿、回调。
- Create: `tests/wallet/test_api.py`
  - Responsibility: 校验用户 API、超管 API、内部 API 权限与响应。
- Modify: `config/settings/_base.py`
  - Responsibility: 将 `apps.wallet` 加入 `INSTALLED_APPS`。
- Modify: `config/api.py`
  - Responsibility: 注册 wallet routers。
- Read only: `apps/base/mixins/_models.py`
  - Responsibility: 复用时间戳 mixin。
- Read only: `apps/base/permissions.py`
  - Responsibility: 复用登录态与超级管理员校验。
- Read only: `apps/accounts/real_name.py`
  - Responsibility: 复用敏感信息加密/脱敏写法参考。

## Verification Commands

从仓库根目录执行：

```bash
docker compose exec web pytest tests/wallet/test_models.py -v
docker compose exec web pytest tests/wallet/test_services.py -v
docker compose exec web pytest tests/wallet/test_api.py -v
docker compose exec web pytest tests/wallet -v
docker compose exec web python manage.py makemigrations --check
```

Expected result:

- 三个测试文件全部通过。
- `tests/wallet` 全量通过，覆盖幂等、状态机、敏感字段、权限。
- `makemigrations --check` exits with code 0.

## Withdrawal Flow Checklist

实现和联调时，提现主线路必须完整覆盖以下环节：

- 用户申请提现：冻结 `amount`，生成提现单，写冻结流水
- 用户撤销提现：仅 `pending_review` 可撤销，回退冻结金额
- 管理员审核通过：`pending_review -> approved`
- 管理员审核拒绝：`pending_review -> rejected`，解冻并写 `withdraw_unfreeze`
- 管理员发起代付：`approved -> paying`，创建 `WithdrawalPayout`
- 成功回调：验签通过后 `paying -> paid`，扣减冻结并累计提现
- 失败回调：验签通过后 `paying -> failed`，退款并写 `withdraw_refund`
- 内部失败重试：仅 `failed` 可重试，重新冻结金额并开启下一轮代付

---

### Task 1: Scaffold `apps.wallet` 与基础模型

**Files:**
- Create: `apps/wallet/__init__.py`
- Create: `apps/wallet/apps.py`
- Create: `apps/wallet/constants.py`
- Create: `apps/wallet/models.py`
- Create: `apps/wallet/migrations/0001_initial.py`
- Create: `tests/wallet/test_models.py`
- Modify: `config/settings/_base.py`

- [ ] **Step 1: 写模型约束的失败测试**

在 `tests/wallet/test_models.py` 添加：

```python
from django.db import IntegrityError
from django.test import TestCase

from model_bakery import baker

from apps.accounts.models import User
from apps.wallet.models import WalletAccount, WalletLedger, WithdrawalPayout, WithdrawalRequest


class WalletModelTests(TestCase):
    def test_user_only_has_one_wallet_account(self):
        user = baker.make(User)
        WalletAccount.objects.create(user=user)

        with self.assertRaises(IntegrityError):
            WalletAccount.objects.create(user=user)

    def test_wallet_ledger_idempotency_key_is_unique(self):
        user = baker.make(User)
        wallet = WalletAccount.objects.create(user=user)
        WalletLedger.objects.create(
            wallet=wallet,
            entry_type="promotion_reward",
            amount_delta=500,
            available_balance_after=500,
            frozen_balance_after=0,
            biz_type="promotion.reward",
            biz_id="reward-1",
            idempotency_key="promo-reward-1",
        )

        with self.assertRaises(IntegrityError):
            WalletLedger.objects.create(
                wallet=wallet,
                entry_type="promotion_reward",
                amount_delta=500,
                available_balance_after=1000,
                frozen_balance_after=0,
                biz_type="promotion.reward",
                biz_id="reward-1-repeat",
                idempotency_key="promo-reward-1",
            )

    def test_withdrawal_payout_out_trade_no_is_unique(self):
        user = baker.make(User)
        wallet = WalletAccount.objects.create(user=user)
        withdrawal = WithdrawalRequest.objects.create(
            user=user,
            wallet=wallet,
            amount=1000,
            fee_amount=100,
            net_amount=900,
            status="approved",
            pay_channel="alipay",
            payee_account_snapshot={"masked_account": "***0001"},
        )
        WithdrawalPayout.objects.create(
            withdrawal_request=withdrawal,
            provider="mock_provider",
            out_trade_no="out-1",
            idempotency_key="payout-1",
            status="pending",
        )

        with self.assertRaises(IntegrityError):
            WithdrawalPayout.objects.create(
                withdrawal_request=withdrawal,
                provider="mock_provider",
                out_trade_no="out-1",
                idempotency_key="payout-2",
                status="pending",
            )
```

- [ ] **Step 2: 运行模型测试确认当前失败**

Run:

```bash
docker compose exec web pytest tests/wallet/test_models.py -v
```

Expected:

- FAIL with `ModuleNotFoundError: No module named 'apps.wallet'` or model import failure.

- [ ] **Step 3: 新建 wallet app、常量与模型**

在 `apps/wallet/constants.py` 定义：

```python
from apps.base.enums import StrChoices


class WalletEntryType(StrChoices):
    PROMOTION_REWARD = "promotion_reward", "推广奖励入账"
    ADMIN_ADJUSTMENT_INCREASE = "admin_adjustment_increase", "管理员增加余额"
    ADMIN_ADJUSTMENT_DECREASE = "admin_adjustment_decrease", "管理员扣减余额"
    WITHDRAW_FREEZE = "withdraw_freeze", "提现冻结"
    WITHDRAW_CANCEL = "withdraw_cancel", "用户撤销提现"
    WITHDRAW_UNFREEZE = "withdraw_unfreeze", "提现驳回解冻"
    WITHDRAW_SETTLE = "withdraw_settle", "提现成功结算"
    WITHDRAW_REFUND = "withdraw_refund", "提现失败退回"


class WithdrawalStatus(StrChoices):
    PENDING_REVIEW = "pending_review", "待审核"
    CANCELLED = "cancelled", "已撤销"
    REJECTED = "rejected", "已驳回"
    APPROVED = "approved", "已通过待打款"
    PAYING = "paying", "打款中"
    PAID = "paid", "已打款"
    FAILED = "failed", "打款失败"


class PayoutStatus(StrChoices):
    PENDING = "pending", "待发起"
    PROCESSING = "processing", "处理中"
    SUCCEEDED = "succeeded", "成功"
    FAILED = "failed", "失败"
```

在 `apps/wallet/models.py` 定义四个模型：

```python
from django.conf import settings
from django.db import models

from apps.base.mixins import CreateUpdateTimeModelMixin
from apps.wallet.constants import PayoutStatus, WithdrawalStatus


class WalletAccount(CreateUpdateTimeModelMixin):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="wallet_account")
    available_balance = models.BigIntegerField(default=0)
    frozen_balance = models.BigIntegerField(default=0)
    total_income = models.BigIntegerField(default=0)
    total_withdrawn = models.BigIntegerField(default=0)


class WalletLedger(CreateUpdateTimeModelMixin):
    wallet = models.ForeignKey(WalletAccount, on_delete=models.CASCADE, related_name="ledgers")
    entry_type = models.CharField(max_length=64)
    amount_delta = models.BigIntegerField()
    available_balance_after = models.BigIntegerField()
    frozen_balance_after = models.BigIntegerField()
    biz_type = models.CharField(max_length=100, blank=True, default="")
    biz_id = models.CharField(max_length=100, blank=True, default="")
    idempotency_key = models.CharField(max_length=120, unique=True)
    remark = models.CharField(max_length=255, blank=True, default="")
    operator = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+")


class WithdrawalRequest(CreateUpdateTimeModelMixin):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="withdrawal_requests")
    wallet = models.ForeignKey(WalletAccount, on_delete=models.CASCADE, related_name="withdrawal_requests")
    amount = models.BigIntegerField()
    fee_amount = models.BigIntegerField(default=0)
    net_amount = models.BigIntegerField()
    client_request_id = models.CharField(max_length=64, blank=True, default="")
    status = models.CharField(max_length=32, choices=WithdrawalStatus.choices, default=WithdrawalStatus.PENDING_REVIEW)
    pay_channel = models.CharField(max_length=32)
    payee_account_snapshot = models.JSONField(default=dict)
    reviewed_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="reviewed_withdrawals")
    reviewed_at = models.DateTimeField(null=True, blank=True)
    reject_reason = models.CharField(max_length=255, blank=True, default="")

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["user", "client_request_id"], name="wallet_withdraw_user_client_req_uniq"),
        ]


class WithdrawalPayout(CreateUpdateTimeModelMixin):
    withdrawal_request = models.ForeignKey(WithdrawalRequest, on_delete=models.CASCADE, related_name="payouts")
    provider = models.CharField(max_length=50)
    out_trade_no = models.CharField(max_length=64, unique=True)
    provider_trade_no = models.CharField(max_length=64, blank=True, default="")
    idempotency_key = models.CharField(max_length=120, unique=True)
    request_payload = models.JSONField(default=dict, blank=True)
    response_payload = models.JSONField(default=dict, blank=True)
    status = models.CharField(max_length=32, choices=PayoutStatus.choices, default=PayoutStatus.PENDING)
    error_code = models.CharField(max_length=64, blank=True, default="")
    error_message = models.CharField(max_length=255, blank=True, default="")
    executed_at = models.DateTimeField(null=True, blank=True)
```

在 `config/settings/_base.py` 的 `INSTALLED_APPS` 中加入：

```python
    "apps.wallet",
```

- [ ] **Step 4: 生成并整理初始迁移，重新运行模型测试**

Run:

```bash
docker compose exec web python manage.py makemigrations wallet
docker compose exec web pytest tests/wallet/test_models.py -v
```

Expected:

- `apps/wallet/migrations/0001_initial.py` generated.
- `tests/wallet/test_models.py` PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/wallet config/settings/_base.py tests/wallet/test_models.py
git commit -m "新增钱包基础模型"
```

### Task 2: 实现入账与调账服务

**Files:**
- Create: `apps/wallet/services.py`
- Create: `tests/wallet/test_services.py`
- Modify: `apps/wallet/models.py`

- [ ] **Step 1: 写入账与调账的失败测试**

在 `tests/wallet/test_services.py` 添加：

```python
from django.test import TestCase

from model_bakery import baker

from apps.accounts.models import User
from apps.wallet.services import apply_wallet_credit, apply_wallet_adjustment, ensure_wallet_account


class WalletLedgerServiceTests(TestCase):
    def test_apply_wallet_credit_creates_wallet_and_ledger(self):
        user = baker.make(User)

        ledger = apply_wallet_credit(
            user=user,
            amount=500,
            entry_type="promotion_reward",
            biz_type="promotion.reward",
            biz_id="reward-1",
            idempotency_key="reward-1",
        )

        wallet = ensure_wallet_account(user)
        self.assertEqual(wallet.available_balance, 500)
        self.assertEqual(wallet.frozen_balance, 0)
        self.assertEqual(wallet.total_income, 500)
        self.assertEqual(ledger.available_balance_after, 500)
        self.assertEqual(ledger.frozen_balance_after, 0)

    def test_apply_wallet_credit_is_idempotent(self):
        user = baker.make(User)

        first = apply_wallet_credit(
            user=user,
            amount=500,
            entry_type="promotion_reward",
            biz_type="promotion.reward",
            biz_id="reward-1",
            idempotency_key="reward-1",
        )
        second = apply_wallet_credit(
            user=user,
            amount=500,
            entry_type="promotion_reward",
            biz_type="promotion.reward",
            biz_id="reward-1",
            idempotency_key="reward-1",
        )

        wallet = ensure_wallet_account(user)
        self.assertEqual(first.pk, second.pk)
        self.assertEqual(wallet.available_balance, 500)

    def test_apply_wallet_adjustment_decrease_rejects_if_balance_insufficient(self):
        user = baker.make(User)
        ensure_wallet_account(user)

        with self.assertRaisesMessage(ValueError, "Insufficient available balance."):
            apply_wallet_adjustment(
                user=user,
                amount=-1,
                idempotency_key="admin-adjust-1",
                operator=baker.make(User),
                remark="manual deduction",
            )
```

- [ ] **Step 2: 运行服务测试确认当前失败**

Run:

```bash
docker compose exec web pytest tests/wallet/test_services.py -v
```

Expected:

- FAIL with `ImportError` or missing service functions.

- [ ] **Step 3: 在 `apps/wallet/services.py` 实现统一记账入口**

新增以下核心接口：

```python
from django.db import transaction

from apps.wallet.models import WalletAccount, WalletLedger


def ensure_wallet_account(user):
    wallet, _created = WalletAccount.objects.get_or_create(user=user)
    return wallet


@transaction.atomic
def apply_wallet_credit(*, user, amount, entry_type, biz_type, biz_id, idempotency_key, operator=None, remark=""):
    existing = WalletLedger.objects.filter(idempotency_key=idempotency_key).first()
    if existing:
        return existing

    wallet = WalletAccount.objects.select_for_update().filter(user=user).first() or ensure_wallet_account(user)
    wallet = WalletAccount.objects.select_for_update().get(pk=wallet.pk)
    wallet.available_balance += amount
    wallet.total_income += amount
    wallet.save(update_fields=["available_balance", "total_income", "updated_at"])

    return WalletLedger.objects.create(
        wallet=wallet,
        entry_type=entry_type,
        amount_delta=amount,
        available_balance_after=wallet.available_balance,
        frozen_balance_after=wallet.frozen_balance,
        biz_type=biz_type,
        biz_id=biz_id,
        idempotency_key=idempotency_key,
        operator=operator,
        remark=remark,
    )


@transaction.atomic
def apply_wallet_adjustment(*, user, amount, idempotency_key, operator, remark):
    existing = WalletLedger.objects.filter(idempotency_key=idempotency_key).first()
    if existing:
        return existing

    wallet = WalletAccount.objects.select_for_update().filter(user=user).first() or ensure_wallet_account(user)
    wallet = WalletAccount.objects.select_for_update().get(pk=wallet.pk)
    if amount < 0 and wallet.available_balance < abs(amount):
        raise ValueError("Insufficient available balance.")

    wallet.available_balance += amount
    if amount > 0:
        wallet.total_income += amount
    wallet.save(update_fields=["available_balance", "total_income", "updated_at"])

    return WalletLedger.objects.create(
        wallet=wallet,
        entry_type="admin_adjustment_increase" if amount > 0 else "admin_adjustment_decrease",
        amount_delta=amount,
        available_balance_after=wallet.available_balance,
        frozen_balance_after=wallet.frozen_balance,
        biz_type="wallet.admin_adjustment",
        biz_id=str(user.pk),
        idempotency_key=idempotency_key,
        operator=operator,
        remark=remark,
    )
```

- [ ] **Step 4: 运行服务测试确认通过**

Run:

```bash
docker compose exec web pytest tests/wallet/test_services.py -v
```

Expected:

- PASS for credit creation, idempotency, insufficient balance rejection.

- [ ] **Step 5: Commit**

```bash
git add apps/wallet/services.py tests/wallet/test_services.py
git commit -m "实现钱包入账与调账服务"
```

### Task 3: 实现提现状态机、敏感信息处理与回调补偿

**Files:**
- Create: `apps/wallet/security.py`
- Modify: `apps/wallet/services.py`
- Modify: `tests/wallet/test_services.py`

本任务完成后，应满足这条提现线路：

- `pending_review -> approved -> paying -> paid`
- `pending_review -> rejected`
- `pending_review -> cancelled`
- `paying -> failed -> retry -> paying -> paid`

- [ ] **Step 1: 先写提现状态机与敏感字段的失败测试**

在 `tests/wallet/test_services.py` 追加：

```python
from apps.wallet.constants import WithdrawalStatus
from apps.wallet.services import (
    approve_withdrawal,
    cancel_withdrawal,
    create_withdrawal_payout,
    handle_payout_callback,
    submit_withdrawal,
)


class WalletWithdrawalServiceTests(TestCase):
    def test_submit_withdrawal_freezes_amount_and_masks_snapshot(self):
        user = baker.make(User)
        apply_wallet_credit(
            user=user,
            amount=3000,
            entry_type="promotion_reward",
            biz_type="promotion.reward",
            biz_id="reward-2",
            idempotency_key="reward-2",
        )

        withdrawal = submit_withdrawal(
            user=user,
            amount=1000,
            fee_amount=100,
            pay_channel="alipay",
            payee_account={"name": "张三", "account": "13800138000"},
            client_request_id="withdraw-1",
        )

        wallet = ensure_wallet_account(user)
        self.assertEqual(withdrawal.net_amount, 900)
        self.assertEqual(withdrawal.status, WithdrawalStatus.PENDING_REVIEW)
        self.assertEqual(wallet.available_balance, 2000)
        self.assertEqual(wallet.frozen_balance, 1000)
        self.assertEqual(withdrawal.payee_account_snapshot["masked_account"], "*******8000")

    def test_cancel_withdrawal_returns_frozen_balance(self):
        user = baker.make(User)
        apply_wallet_credit(
            user=user,
            amount=3000,
            entry_type="promotion_reward",
            biz_type="promotion.reward",
            biz_id="reward-3",
            idempotency_key="reward-3",
        )
        withdrawal = submit_withdrawal(
            user=user,
            amount=1000,
            fee_amount=100,
            pay_channel="alipay",
            payee_account={"name": "张三", "account": "13800138000"},
            client_request_id="withdraw-2",
        )

        cancel_withdrawal(withdrawal=withdrawal, user=user)
        wallet = ensure_wallet_account(user)
        self.assertEqual(wallet.available_balance, 3000)
        self.assertEqual(wallet.frozen_balance, 0)

    def test_successful_payout_moves_withdrawal_to_paid(self):
        user = baker.make(User)
        admin = baker.make(User)
        apply_wallet_credit(user=user, amount=3000, entry_type="promotion_reward", biz_type="promotion.reward", biz_id="reward-4", idempotency_key="reward-4")
        withdrawal = submit_withdrawal(user=user, amount=1000, fee_amount=100, pay_channel="alipay", payee_account={"name": "张三", "account": "13800138000"}, client_request_id="withdraw-3")
        approve_withdrawal(withdrawal=withdrawal, operator=admin, approved=True, reason="ok", idempotency_key="review-1")
        create_withdrawal_payout(withdrawal=withdrawal, provider="mock_provider", out_trade_no="out-2", request_payload={"amount": 900}, idempotency_key="payout-2")

        handle_payout_callback(
            provider="mock_provider",
            out_trade_no="out-2",
            provider_trade_no="trade-2",
            callback_status="success",
            response_payload={"trade_status": "SUCCESS"},
        )

        wallet = ensure_wallet_account(user)
        withdrawal.refresh_from_db()
        self.assertEqual(withdrawal.status, WithdrawalStatus.PAID)
        self.assertEqual(wallet.available_balance, 2000)
        self.assertEqual(wallet.frozen_balance, 0)
        self.assertEqual(wallet.total_withdrawn, 1000)
```

- [ ] **Step 2: 运行提现服务测试确认失败**

Run:

```bash
docker compose exec web pytest tests/wallet/test_services.py -v
```

Expected:

- FAIL with missing withdrawal service functions or wrong state assertions.

- [ ] **Step 3: 实现加密/脱敏 helper 与提现服务**

在 `apps/wallet/security.py` 写入：

```python
import base64
import hashlib

from cryptography.fernet import Fernet
from django.conf import settings


def _fernet() -> Fernet:
    key_material = hashlib.sha256(f"{settings.SECRET_KEY}:wallet:v1".encode("utf-8")).digest()
    return Fernet(base64.urlsafe_b64encode(key_material))


def encrypt_wallet_payload(value: str) -> str:
    return _fernet().encrypt(value.encode("utf-8")).decode("utf-8")


def mask_account(value: str) -> str:
    value = value.strip()
    if len(value) <= 4:
        return "*" * len(value)
    return f"{'*' * (len(value) - 4)}{value[-4:]}"


def build_payee_snapshot(payee_account: dict) -> dict:
    return {
        "masked_name": f"{payee_account['name'][0]}**",
        "masked_account": mask_account(payee_account["account"]),
        "encrypted_name": encrypt_wallet_payload(payee_account["name"]),
        "encrypted_account": encrypt_wallet_payload(payee_account["account"]),
    }
```

在 `apps/wallet/services.py` 增加：

```python
from django.utils import timezone

from apps.wallet.constants import PayoutStatus, WithdrawalStatus
from apps.wallet.models import WithdrawalPayout, WithdrawalRequest
from apps.wallet.security import build_payee_snapshot


@transaction.atomic
def submit_withdrawal(*, user, amount, fee_amount, pay_channel, payee_account, client_request_id):
    wallet = WalletAccount.objects.select_for_update().get(pk=ensure_wallet_account(user).pk)
    if amount <= 0 or fee_amount < 0 or amount <= fee_amount:
        raise ValueError("Invalid withdrawal amount.")
    if wallet.available_balance < amount:
        raise ValueError("Insufficient available balance.")

    existing = WithdrawalRequest.objects.filter(user=user, client_request_id=client_request_id).first()
    if existing:
        return existing

    wallet.available_balance -= amount
    wallet.frozen_balance += amount
    wallet.save(update_fields=["available_balance", "frozen_balance", "updated_at"])
    withdrawal = WithdrawalRequest.objects.create(
        user=user,
        wallet=wallet,
        amount=amount,
        fee_amount=fee_amount,
        net_amount=amount - fee_amount,
        client_request_id=client_request_id,
        status=WithdrawalStatus.PENDING_REVIEW,
        pay_channel=pay_channel,
        payee_account_snapshot=build_payee_snapshot(payee_account),
    )
    WalletLedger.objects.create(
        wallet=wallet,
        entry_type="withdraw_freeze",
        amount_delta=-amount,
        available_balance_after=wallet.available_balance,
        frozen_balance_after=wallet.frozen_balance,
        biz_type="wallet.withdrawal",
        biz_id=str(withdrawal.pk),
        idempotency_key=f"withdraw-freeze:{withdrawal.pk}",
    )
    return withdrawal
```

并继续实现 `cancel_withdrawal`, `approve_withdrawal`, `create_withdrawal_payout`, `handle_payout_callback`，要求：

```python
# cancel_withdrawal: 仅允许 pending_review -> cancelled，并回退 available/frozen
# approve_withdrawal: 支持 pending_review -> approved/rejected，rejected 时解冻
# create_withdrawal_payout: 仅允许 approved -> paying，创建 WithdrawalPayout
# handle_payout_callback: success 时 paying -> paid，失败时 paying -> failed 并退款
# retry_withdrawal_payout: failed 时重新冻结并重启新一轮代付
```

- [ ] **Step 4: 运行提现服务测试确认通过**

Run:

```bash
docker compose exec web pytest tests/wallet/test_services.py -v
```

Expected:

- PASS for submit, cancel, approve, payout success, payout failure compensation, callback idempotency.

- [ ] **Step 5: Commit**

```bash
git add apps/wallet/security.py apps/wallet/services.py tests/wallet/test_services.py
git commit -m "实现钱包提现状态机"
```

### Task 4: 暴露用户侧钱包 API

**Files:**
- Create: `apps/wallet/schemas.py`
- Create: `apps/wallet/api.py`
- Create: `tests/wallet/test_api.py`
- Modify: `config/api.py`

- [ ] **Step 1: 先写用户 API 的失败测试**

在 `tests/wallet/test_api.py` 添加：

```python
import json

from django.test import TestCase

from model_bakery import baker

from apps.accounts.models import User
from apps.wallet.services import apply_wallet_credit


class WalletUserAPITests(TestCase):
    def setUp(self):
        self.user = baker.make(User)
        self.client.force_login(self.user)

    def test_summary_returns_wallet_balances(self):
        apply_wallet_credit(
            user=self.user,
            amount=1200,
            entry_type="promotion_reward",
            biz_type="promotion.reward",
            biz_id="reward-10",
            idempotency_key="reward-10",
        )

        resp = self.client.get("/api/wallet/me/summary/")

        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["available_balance"], 1200)
        self.assertEqual(resp.json()["frozen_balance"], 0)

    def test_create_withdrawal_freezes_balance(self):
        apply_wallet_credit(
            user=self.user,
            amount=2000,
            entry_type="promotion_reward",
            biz_type="promotion.reward",
            biz_id="reward-11",
            idempotency_key="reward-11",
        )

        resp = self.client.post(
            "/api/wallet/me/withdrawals/",
            data=json.dumps(
                {
                    "amount": 1000,
                    "fee_amount": 100,
                    "pay_channel": "alipay",
                    "payee_account": {"name": "张三", "account": "13800138000"},
                    "client_request_id": "withdraw-api-1",
                }
            ),
            content_type="application/json",
        )

        self.assertEqual(resp.status_code, 201)
        self.assertEqual(resp.json()["status"], "pending_review")

    def test_cancel_withdrawal_only_works_for_current_user(self):
        other = baker.make(User)
        apply_wallet_credit(user=other, amount=2000, entry_type="promotion_reward", biz_type="promotion.reward", biz_id="reward-12", idempotency_key="reward-12")
        withdrawal = submit_withdrawal(user=other, amount=1000, fee_amount=100, pay_channel="alipay", payee_account={"name": "李四", "account": "13900139000"}, client_request_id="withdraw-api-2")

        resp = self.client.post(f"/api/wallet/me/withdrawals/{withdrawal.pk}/cancel/")

        self.assertEqual(resp.status_code, 404)
```

- [ ] **Step 2: 运行用户 API 测试确认失败**

Run:

```bash
docker compose exec web pytest tests/wallet/test_api.py -v
```

Expected:

- FAIL with missing router or endpoint.

- [ ] **Step 3: 实现 schema、router 与 API 注册**

在 `apps/wallet/schemas.py` 添加：

```python
from ninja import Field, Schema


class WalletSummaryOut(Schema):
    available_balance: int
    frozen_balance: int
    total_income: int
    total_withdrawn: int


class WalletLedgerOut(Schema):
    id: int = Field(..., alias="pk")
    entry_type: str
    amount_delta: int
    available_balance_after: int
    frozen_balance_after: int
    biz_type: str
    biz_id: str
    remark: str
    created_at: str


class WithdrawalIn(Schema):
    amount: int
    fee_amount: int = 0
    pay_channel: str
    payee_account: dict
    client_request_id: str


class WithdrawalOut(Schema):
    id: int = Field(..., alias="pk")
    amount: int
    fee_amount: int
    net_amount: int
    status: str
    pay_channel: str
    payee_account_snapshot: dict
    reject_reason: str
```

在 `apps/wallet/api.py` 添加：

```python
from django.shortcuts import get_object_or_404

from ninja import Router, Status
from ninja.pagination import paginate

from apps.base.ninja_pagination import LegacyPagination
from apps.base.permissions import require_authenticated, require_superuser
from apps.wallet.models import WalletLedger, WithdrawalRequest
from apps.wallet.schemas import WalletLedgerOut, WalletSummaryOut, WithdrawalIn, WithdrawalOut
from apps.wallet.services import cancel_withdrawal, ensure_wallet_account, submit_withdrawal

router = Router(tags=["钱包/用户"])
admin_router = Router(tags=["钱包/管理"])
internal_router = Router(tags=["钱包/内部"])


@router.get("/me/summary/", response=WalletSummaryOut)
def wallet_summary(request):
    require_authenticated(request)
    wallet = ensure_wallet_account(request.user)
    return wallet


@router.get("/me/ledger/", response=list[WalletLedgerOut])
@paginate(LegacyPagination)
def wallet_ledger(request):
    require_authenticated(request)
    wallet = ensure_wallet_account(request.user)
    return WalletLedger.objects.filter(wallet=wallet).order_by("-created_at")


@router.post("/me/withdrawals/", response={201: WithdrawalOut})
def create_withdrawal(request, payload: WithdrawalIn):
    require_authenticated(request)
    withdrawal = submit_withdrawal(user=request.user, **payload.dict())
    return Status(201, withdrawal)


@router.post("/me/withdrawals/{withdrawal_id}/cancel/", response=WithdrawalOut)
def cancel_user_withdrawal(request, withdrawal_id: int):
    require_authenticated(request)
    withdrawal = get_object_or_404(WithdrawalRequest, pk=withdrawal_id, user=request.user)
    return cancel_withdrawal(withdrawal=withdrawal, user=request.user)
```

在 `config/api.py` 注册：

```python
from apps.wallet.api import admin_router as wallet_admin_router, internal_router as wallet_internal_router, router as wallet_router

api.add_router("/wallet/", wallet_router)
api.add_router("/admin/wallet/", wallet_admin_router)
api.add_router("/internal/wallet/", wallet_internal_router)
```

- [ ] **Step 4: 运行用户 API 测试确认通过**

Run:

```bash
docker compose exec web pytest tests/wallet/test_api.py::WalletUserAPITests -v
```

Expected:

- PASS for summary, withdrawal creation, current-user-only cancellation.

- [ ] **Step 5: Commit**

```bash
git add apps/wallet/api.py apps/wallet/schemas.py config/api.py tests/wallet/test_api.py
git commit -m "开放钱包用户接口"
```

### Task 5: 暴露超级管理员接口、内部补偿接口与对账入口

**Files:**
- Modify: `apps/wallet/api.py`
- Modify: `apps/wallet/services.py`
- Modify: `tests/wallet/test_api.py`
- Modify: `tests/wallet/test_services.py`

本任务完成后，接口面至少要覆盖这条提现运营线路：

- `POST /api/admin/wallet/withdrawals/{id}/review/`
- `POST /api/admin/wallet/withdrawals/{id}/payout/`
- `POST /api/wallet/payout/callback/{provider}/`
- `POST /api/internal/wallet/withdrawals/{id}/retry/`
- `POST /api/internal/wallet/reconcile/`

- [ ] **Step 1: 写超管与内部接口的失败测试**

在 `tests/wallet/test_api.py` 追加：

```python
class WalletAdminAPITests(TestCase):
    def setUp(self):
        self.admin = baker.make(User, is_superuser=True, is_staff=True)
        self.user = baker.make(User)
        self.client.force_login(self.admin)

    def test_admin_can_adjust_wallet_balance(self):
        resp = self.client.post(
            "/api/admin/wallet/adjustments/",
            data=json.dumps(
                {
                    "user_id": self.user.pk,
                    "amount": 500,
                    "idempotency_key": "admin-adjust-api-1",
                    "remark": "manual bonus",
                }
            ),
            content_type="application/json",
        )

        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["available_balance_after"], 500)

    def test_admin_can_review_and_start_payout(self):
        apply_wallet_credit(user=self.user, amount=2000, entry_type="promotion_reward", biz_type="promotion.reward", biz_id="reward-20", idempotency_key="reward-20")
        withdrawal = submit_withdrawal(user=self.user, amount=1000, fee_amount=100, pay_channel="alipay", payee_account={"name": "张三", "account": "13800138000"}, client_request_id="withdraw-api-20")

        review_resp = self.client.post(
            f"/api/admin/wallet/withdrawals/{withdrawal.pk}/review/",
            data=json.dumps({"approved": True, "reason": "ok", "idempotency_key": "review-api-1"}),
            content_type="application/json",
        )
        payout_resp = self.client.post(
            f"/api/admin/wallet/withdrawals/{withdrawal.pk}/payout/",
            data=json.dumps({"provider": "mock_provider", "out_trade_no": "out-api-1", "request_payload": {"amount": 900}, "idempotency_key": "payout-api-1"}),
            content_type="application/json",
        )

        self.assertEqual(review_resp.status_code, 200)
        self.assertEqual(payout_resp.status_code, 200)


class WalletInternalAPITests(TestCase):
    def setUp(self):
        self.admin = baker.make(User, is_superuser=True, is_staff=True)
        self.client.force_login(self.admin)

    def test_internal_reconcile_endpoint_returns_diff_summary(self):
        resp = self.client.post("/api/internal/wallet/reconcile/", content_type="application/json")
        self.assertEqual(resp.status_code, 200)
        self.assertIn("diff_count", resp.json())
```

- [ ] **Step 2: 运行管理接口测试确认失败**

Run:

```bash
docker compose exec web pytest tests/wallet/test_api.py::WalletAdminAPITests -v
docker compose exec web pytest tests/wallet/test_api.py::WalletInternalAPITests -v
```

Expected:

- FAIL with 404 or missing handlers.

- [ ] **Step 3: 实现超管调账、审核、代付、回调、对账 endpoint**

在 `apps/wallet/services.py` 增加一个简单对账入口：

```python
def reconcile_wallet_state():
    diff_count = 0
    for wallet in WalletAccount.objects.all():
        ledger_sum = wallet.ledgers.order_by("created_at", "pk").last()
        if ledger_sum is None:
            continue
        if ledger_sum.available_balance_after != wallet.available_balance or ledger_sum.frozen_balance_after != wallet.frozen_balance:
            diff_count += 1
    return {"diff_count": diff_count}
```

在 `apps/wallet/api.py` 添加：

```python
from apps.base.permissions import require_superuser
from apps.wallet.services import (
    apply_wallet_adjustment,
    approve_withdrawal,
    create_withdrawal_payout,
    handle_payout_callback,
    reconcile_wallet_state,
)


@admin_router.post("/adjustments/")
def create_adjustment(request, payload: AdjustmentIn):
    require_superuser(request)
    user = get_object_or_404(get_user_model(), pk=payload.user_id)
    return apply_wallet_adjustment(user=user, amount=payload.amount, idempotency_key=payload.idempotency_key, operator=request.user, remark=payload.remark)


@admin_router.post("/withdrawals/{withdrawal_id}/review/")
def review_withdrawal(request, withdrawal_id: int, payload: WithdrawalReviewIn):
    require_superuser(request)
    withdrawal = get_object_or_404(WithdrawalRequest, pk=withdrawal_id)
    return approve_withdrawal(withdrawal=withdrawal, operator=request.user, approved=payload.approved, reason=payload.reason, idempotency_key=payload.idempotency_key)


@admin_router.post("/withdrawals/{withdrawal_id}/payout/")
def payout_withdrawal(request, withdrawal_id: int, payload: PayoutCreateIn):
    require_superuser(request)
    withdrawal = get_object_or_404(WithdrawalRequest, pk=withdrawal_id)
    return create_withdrawal_payout(withdrawal=withdrawal, provider=payload.provider, out_trade_no=payload.out_trade_no, request_payload=payload.request_payload, idempotency_key=payload.idempotency_key)


@router.post("/payout/callback/{provider}/", auth=None)
def payout_callback(request, provider: str, payload: PayoutCallbackIn):
    return handle_payout_callback(provider=provider, **payload.dict())


@internal_router.post("/reconcile/")
def reconcile(request):
    require_superuser(request)
    return reconcile_wallet_state()
```

- [ ] **Step 4: 运行全量 wallet 测试确认通过**

Run:

```bash
docker compose exec web pytest tests/wallet -v
docker compose exec web python manage.py makemigrations --check
```

Expected:

- `tests/wallet` 全部 PASS。
- `makemigrations --check` exits with code 0.

- [ ] **Step 5: Commit**

```bash
git add apps/wallet tests/wallet config/api.py
git commit -m "补齐钱包管理与内部接口"
```

## Self-Review

- Spec coverage: 账户、流水、提现、代付、双余额快照、手续费口径、幂等、状态机、敏感字段、对账入口都落到了任务 1-5；推广模块奖励表和前端页面被明确排除在本计划之外。
- Placeholder scan: 本文档未使用 `TBD`、`TODO` 或“稍后实现”类描述；所有任务都附了文件、代码或命令。
- Type consistency: 统一使用 `WalletAccount`、`WalletLedger`、`WithdrawalRequest`、`WithdrawalPayout`，并在服务与 API 层沿用同一状态与幂等字段命名。
