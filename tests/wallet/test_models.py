from django.db import IntegrityError
from django.test import TestCase

from model_bakery import baker

from apps.accounts.models import User
from apps.payments.models import PayoutTransaction
from apps.wallet.constants import WithdrawalPayChannel
from apps.wallet.models import WalletAccount, WalletLedger, WithdrawalRequest


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
            pay_channel=WithdrawalPayChannel.WECHAT,
            payee_account_snapshot={"masked_account": "***0001"},
        )
        PayoutTransaction.objects.create(
            biz_type="wallet.withdrawal",
            biz_id=str(withdrawal.pk),
            provider="wechat",
            out_trade_no="out-1",
            idempotency_key="payout-1",
            amount=withdrawal.net_amount,
            payee_snapshot=withdrawal.payee_account_snapshot,
            status="pending",
        )

        with self.assertRaises(IntegrityError):
            PayoutTransaction.objects.create(
                biz_type="wallet.withdrawal",
                biz_id=str(withdrawal.pk),
                provider="wechat",
                out_trade_no="out-1",
                idempotency_key="payout-2",
                amount=withdrawal.net_amount,
                payee_snapshot=withdrawal.payee_account_snapshot,
                status="pending",
            )
