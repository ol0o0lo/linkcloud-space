import json

from django.test import TestCase

from model_bakery import baker

from apps.accounts.models import User
from apps.referrals.constants import ReferralRecordStatus
from apps.referrals.models import ReferralRuleConfig
from apps.referrals.services import ensure_referral_link
from tests.api_helpers import api_data


class ReferralUserAPITests(TestCase):
    def setUp(self):
        self.user = baker.make(User)
        self.client.force_login(self.user)

    def test_user_can_get_referral_summary(self):
        link = ensure_referral_link(self.user)
        baker.make("referrals.ReferralRecord", inviter=self.user, referral_link=link, status=ReferralRecordStatus.REGISTERED)

        resp = self.client.get("/api/referrals/me/summary/")

        self.assertEqual(resp.status_code, 200)
        data = api_data(resp)
        self.assertEqual(data["invite_code"], link.code)
        self.assertEqual(data["registered_count"], 1)


class ReferralAdminAPITests(TestCase):
    def setUp(self):
        self.admin = baker.make(User, is_superuser=True, is_staff=True)
        self.client.force_login(self.admin)

    def test_admin_can_get_and_patch_config(self):
        ReferralRuleConfig.objects.create(name="default", inviter_reward_amount=500)

        get_resp = self.client.get("/api/admin/referrals/config/")
        patch_resp = self.client.patch(
            "/api/admin/referrals/config/",
            data=json.dumps({"inviter_reward_amount": 888}),
            content_type="application/json",
        )

        self.assertEqual(get_resp.status_code, 200)
        self.assertEqual(patch_resp.status_code, 200)
        self.assertEqual(api_data(patch_resp)["inviter_reward_amount"], 888)

    def test_admin_can_review_referral_record(self):
        ReferralRuleConfig.objects.create(name="default", inviter_reward_amount=666)
        record = baker.make("referrals.ReferralRecord", status=ReferralRecordStatus.PENDING_REVIEW)

        resp = self.client.post(
            f"/api/admin/referrals/records/{record.pk}/review/",
            data=json.dumps({"approved": True, "remark": "通过"}),
            content_type="application/json",
        )

        self.assertEqual(resp.status_code, 200)
        record.refresh_from_db()
        self.assertEqual(record.status, ReferralRecordStatus.REWARD_ISSUED)
