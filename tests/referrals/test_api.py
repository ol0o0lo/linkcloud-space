import json

from django.test import TestCase

from model_bakery import baker

from apps.accounts.models import User
from apps.referrals.constants import ReferralDisplayLevel, ReferralRecordStatus, ReferralTriggerEvent
from apps.referrals.models import ReferralRuleConfig
from apps.referrals.services import ensure_referral_link
from tests.api_helpers import api_data


class ReferralUserAPITests(TestCase):
    def setUp(self):
        self.user = baker.make(User)
        self.client.force_login(self.user)

    def test_user_can_get_referral_summary(self):
        ReferralRuleConfig.objects.create(name="default", allow_link=True, allow_code=True)
        link = ensure_referral_link(self.user)
        baker.make("referrals.ReferralRecord", inviter=self.user, referral_link=link, status=ReferralRecordStatus.REGISTERED)

        resp = self.client.get("/api/referrals/me/summary/")

        self.assertEqual(resp.status_code, 200)
        data = api_data(resp)
        self.assertEqual(data["invite_code"], link.code)
        self.assertEqual(data["share_link"], f"/dashboard/user/register?invite_code={link.code}&referral_source=link")
        self.assertTrue(data["allow_link"])
        self.assertTrue(data["allow_code"])
        self.assertEqual(data["registered_count"], 1)

        records_resp = self.client.get("/api/referrals/me/records/")

        self.assertEqual(records_resp.status_code, 200)
        record = api_data(records_resp)["items"][0]
        self.assertEqual(record["status__mapping"], ReferralRecordStatus.get_choice_label(record["status"]))

    def test_disabled_referral_channels_are_not_exposed(self):
        ReferralRuleConfig.objects.create(name="default", allow_link=False, allow_code=False)

        resp = self.client.get("/api/referrals/me/summary/")

        self.assertEqual(resp.status_code, 200)
        data = api_data(resp)
        self.assertIsNone(data["invite_code"])
        self.assertIsNone(data["share_link"])
        self.assertFalse(data["allow_link"])
        self.assertFalse(data["allow_code"])


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
        get_data = api_data(get_resp)
        patch_data = api_data(patch_resp)
        self.assertEqual(get_data["trigger_event__mapping"], ReferralTriggerEvent.get_choice_label(get_data["trigger_event"]))
        self.assertEqual(get_data["display_level__mapping"], ReferralDisplayLevel.get_choice_label(get_data["display_level"]))
        self.assertEqual(patch_data["inviter_reward_amount"], 888)
        self.assertEqual(patch_data["trigger_event__mapping"], ReferralTriggerEvent.get_choice_label(patch_data["trigger_event"]))
        self.assertEqual(patch_data["display_level__mapping"], ReferralDisplayLevel.get_choice_label(patch_data["display_level"]))

    def test_admin_can_review_referral_record(self):
        ReferralRuleConfig.objects.create(name="default", inviter_reward_amount=666)
        record = baker.make("referrals.ReferralRecord", status=ReferralRecordStatus.PENDING_REVIEW)

        resp = self.client.post(
            f"/api/admin/referrals/records/{record.pk}/review/",
            data=json.dumps({"approved": True, "remark": "通过"}),
            content_type="application/json",
        )

        self.assertEqual(resp.status_code, 200)
        data = api_data(resp)
        self.assertEqual(data["status__mapping"], ReferralRecordStatus.get_choice_label(data["status"]))
        record.refresh_from_db()
        self.assertEqual(record.status, ReferralRecordStatus.REWARD_ISSUED)
