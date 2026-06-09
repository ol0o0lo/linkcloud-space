from django.test import RequestFactory, TestCase

from model_bakery import baker

from apps.accounts.models import User
from apps.referrals.constants import ReferralRecordStatus
from apps.referrals.models import ReferralRuleConfig
from apps.referrals.services import approve_referral_reward, capture_referral_code, create_record_for_registered_user, ensure_referral_link, mark_referral_as_qualified
from apps.wallet.models import WalletLedger


class ReferralServiceTests(TestCase):
    def test_capture_referral_code_writes_session(self):
        request = RequestFactory().get("/accounts/signup/?invite_code=ABC123")
        request.session = {}

        capture_referral_code(request)

        self.assertEqual(request.session["referral_invite_code"], "ABC123")

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

    def test_mark_referral_as_qualified_updates_status(self):
        record = baker.make("referrals.ReferralRecord", status=ReferralRecordStatus.REGISTERED)

        mark_referral_as_qualified(invitee=record.invitee, event_type="real_name_verified")

        record.refresh_from_db()
        self.assertEqual(record.status, ReferralRecordStatus.PENDING_REVIEW)

    def test_approve_referral_reward_issues_wallet_credit(self):
        rule = ReferralRuleConfig.objects.create(name="default", inviter_reward_amount=888)
        reviewer = baker.make(User, is_superuser=True)
        record = baker.make("referrals.ReferralRecord", status=ReferralRecordStatus.PENDING_REVIEW)

        review = approve_referral_reward(record=record, reviewer=reviewer, remark="审核通过")

        self.assertEqual(review.referral_record_id, record.id)
        record.refresh_from_db()
        self.assertEqual(record.status, ReferralRecordStatus.REWARD_ISSUED)
        ledger = WalletLedger.objects.get(biz_type="referral.reward", biz_id=str(record.pk))
        self.assertEqual(ledger.amount_delta, rule.inviter_reward_amount)
