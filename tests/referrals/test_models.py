from django.db import IntegrityError
from django.test import TestCase

from model_bakery import baker

from apps.accounts.models import User
from apps.referrals.models import ReferralLink, ReferralRecord, ReferralRuleConfig


class ReferralModelTests(TestCase):
    def test_rule_config_name_is_unique(self):
        ReferralRuleConfig.objects.create(name="default")

        with self.assertRaises(IntegrityError):
            ReferralRuleConfig.objects.create(name="default")

    def test_referral_link_belongs_to_single_inviter(self):
        inviter = baker.make(User)

        link = ReferralLink.objects.create(inviter=inviter, code="ABC123")

        self.assertEqual(link.inviter_id, inviter.id)

    def test_same_invitee_cannot_have_two_records(self):
        inviter = baker.make(User)
        invitee = baker.make(User)
        link = baker.make(ReferralLink, inviter=inviter)

        ReferralRecord.objects.create(inviter=inviter, invitee=invitee, referral_link=link, status="registered")

        with self.assertRaises(IntegrityError):
            ReferralRecord.objects.create(inviter=inviter, invitee=invitee, referral_link=link, status="registered")
