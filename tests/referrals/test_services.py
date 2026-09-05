from django.test import RequestFactory, TestCase

from model_bakery import baker

from apps.accounts.models import User
from apps.referrals.constants import ReferralRecordStatus
from apps.referrals.models import ReferralRuleConfig
from apps.referrals.services import approve_referral_reward, capture_referral_code, create_record_for_registered_user, ensure_referral_link, mark_referral_as_qualified
from apps.wallet.models import WalletLedger


class ReferralServiceTests(TestCase):
    def test_capture_referral_code_writes_session(self):
        request = RequestFactory().get("/dashboard/user/register?invite_code=ABC123&referral_source=link")
        request.session = {}

        capture_referral_code(request)

        self.assertEqual(request.session["referral_invite_code"], "ABC123")
        self.assertEqual(request.session["referral_source"], "link")

    def test_create_record_for_registered_user_uses_invite_code(self):
        inviter = baker.make(User)
        invitee = baker.make(User)
        link = ensure_referral_link(inviter)
        link.code = "INV123"
        link.save(update_fields=["code"])

        record = create_record_for_registered_user(invitee=invitee, invite_code="INV123")

        self.assertEqual(record.inviter_id, inviter.id)
        self.assertEqual(record.invitee_id, invitee.id)
        self.assertEqual(record.referral_link_id, link.id)
        self.assertEqual(record.status, "registered")

    def test_create_record_for_registered_user_is_idempotent(self):
        inviter = baker.make(User)
        invitee = baker.make(User)
        link = ensure_referral_link(inviter)

        first = create_record_for_registered_user(invitee=invitee, invite_code=link.code)
        second = create_record_for_registered_user(invitee=invitee, invite_code=link.code)

        self.assertEqual(first.id, second.id)

    def test_create_record_respects_link_and_code_switches(self):
        rule = ReferralRuleConfig.objects.create(name="default", allow_link=False, allow_code=True)
        inviter = baker.make(User)
        link = ensure_referral_link(inviter)

        link_invitee = baker.make(User)
        code_invitee = baker.make(User)

        self.assertIsNone(
            create_record_for_registered_user(
                invitee=link_invitee,
                invite_code=link.code,
                referral_source="link",
            ),
        )
        code_record = create_record_for_registered_user(
            invitee=code_invitee,
            invite_code=link.code,
            referral_source="code",
        )
        self.assertIsNotNone(code_record)

        rule.allow_link = True
        rule.allow_code = False
        rule.save(update_fields=["allow_link", "allow_code"])

        another_link_invitee = baker.make(User)
        another_code_invitee = baker.make(User)
        self.assertIsNotNone(
            create_record_for_registered_user(
                invitee=another_link_invitee,
                invite_code=link.code,
                referral_source="link",
            ),
        )
        self.assertIsNone(
            create_record_for_registered_user(
                invitee=another_code_invitee,
                invite_code=link.code,
                referral_source="code",
            ),
        )

    def test_mark_referral_as_qualified_updates_status(self):
        record = baker.make("referrals.ReferralRecord", status=ReferralRecordStatus.REGISTERED)

        mark_referral_as_qualified(invitee=record.invitee, event_type="real_name_verified")

        record.refresh_from_db()
        self.assertEqual(record.status, ReferralRecordStatus.PENDING_REVIEW)

    def test_mark_referral_as_qualified_auto_issues_both_rewards_idempotently(self):
        rule = ReferralRuleConfig.objects.create(
            name="default",
            inviter_reward_amount=888,
            invitee_reward_amount=222,
            requires_manual_review=False,
        )
        record = baker.make("referrals.ReferralRecord", status=ReferralRecordStatus.REGISTERED)

        mark_referral_as_qualified(invitee=record.invitee, event_type="real_name_verified")
        mark_referral_as_qualified(invitee=record.invitee, event_type="real_name_verified")

        record.refresh_from_db()
        self.assertEqual(record.status, ReferralRecordStatus.REWARD_ISSUED)
        inviter_ledger = WalletLedger.objects.get(wallet__user=record.inviter, biz_type="referral.reward", biz_id=str(record.pk))
        invitee_ledger = WalletLedger.objects.get(wallet__user=record.invitee, biz_type="referral.reward", biz_id=str(record.pk))
        self.assertEqual(inviter_ledger.amount_delta, rule.inviter_reward_amount)
        self.assertEqual(invitee_ledger.amount_delta, rule.invitee_reward_amount)
        self.assertEqual(WalletLedger.objects.filter(biz_type="referral.reward", biz_id=str(record.pk)).count(), 2)

    def test_approve_referral_reward_issues_wallet_credit(self):
        rule = ReferralRuleConfig.objects.create(name="default", inviter_reward_amount=888, invitee_reward_amount=222)
        reviewer = baker.make(User, is_superuser=True)
        record = baker.make("referrals.ReferralRecord", status=ReferralRecordStatus.PENDING_REVIEW)

        review = approve_referral_reward(record=record, reviewer=reviewer, remark="审核通过")

        self.assertEqual(review.referral_record_id, record.id)
        record.refresh_from_db()
        self.assertEqual(record.status, ReferralRecordStatus.REWARD_ISSUED)
        inviter_ledger = WalletLedger.objects.get(wallet__user=record.inviter, biz_type="referral.reward", biz_id=str(record.pk))
        invitee_ledger = WalletLedger.objects.get(wallet__user=record.invitee, biz_type="referral.reward", biz_id=str(record.pk))
        self.assertEqual(inviter_ledger.amount_delta, rule.inviter_reward_amount)
        self.assertEqual(invitee_ledger.amount_delta, rule.invitee_reward_amount)

        approve_referral_reward(record=record, reviewer=reviewer, remark="重复审核")
        self.assertEqual(WalletLedger.objects.filter(biz_type="referral.reward", biz_id=str(record.pk)).count(), 2)

    def test_zero_reward_does_not_create_wallet_ledger(self):
        ReferralRuleConfig.objects.create(name="default", inviter_reward_amount=0, invitee_reward_amount=0)
        reviewer = baker.make(User, is_superuser=True)
        record = baker.make("referrals.ReferralRecord", status=ReferralRecordStatus.PENDING_REVIEW)

        approve_referral_reward(record=record, reviewer=reviewer, remark="零金额规则")

        self.assertFalse(WalletLedger.objects.filter(biz_type="referral.reward", biz_id=str(record.pk)).exists())
