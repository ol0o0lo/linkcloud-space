import json

from django.test import TestCase

from apps.accounts.constants import RealNameLogAction, RealNameStatus
from apps.accounts.models import RealNameVerification, User
from apps.referrals.constants import ReferralRecordStatus
from apps.referrals.models import ReferralRecord
from apps.referrals.services import ensure_referral_link
from tests.api_helpers import api_data


def build_cn_id(prefix17: str) -> str:
    weights = (7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2)
    checksums = ("1", "0", "X", "9", "8", "7", "6", "5", "4", "3", "2")
    total = sum(int(char) * weight for char, weight in zip(prefix17, weights, strict=False))
    return f"{prefix17}{checksums[total % 11]}"


class TestRealNameAPI(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="alice",
            email="alice@example.com",
            password="secret123",  # noqa: S106
            phone="+8613900001111",
            phone_verified=True,
        )
        self.admin = User.objects.create_superuser(
            username="super-admin",
            email="admin@example.com",
            password="secret123",  # noqa: S106
        )
        self.valid_id = build_cn_id("11010519900101001")
        self.second_valid_id = build_cn_id("11010519900101002")

    def test_submit_valid_real_name_marks_user_verified(self):
        self.client.force_login(self.user)

        resp = self.client.post(
            "/api/users/me/real-name/submit/",
            data=json.dumps(
                {
                    "id_number": self.valid_id,
                    "real_name": "张三",
                    "source": "user_submit",
                }
            ),
            content_type="application/json",
        )

        self.assertEqual(resp.status_code, 200, resp.content)
        self.user.refresh_from_db()
        verification = RealNameVerification.objects.get(user=self.user, is_current=True)
        self.assertEqual(verification.status, RealNameStatus.VERIFIED)
        self.assertEqual(self.user.real_name_status, RealNameStatus.VERIFIED)
        self.assertEqual(self.user.real_name_masked, "张*")
        self.assertTrue(self.user.id_number_masked.endswith(self.valid_id[-4:]))
        self.assertEqual(verification.logs.count(), 2)
        self.assertEqual(verification.logs.last().action, RealNameLogAction.AUTO_VERIFIED)

    def test_submit_valid_real_name_marks_referral_record_pending_review(self):
        inviter = User.objects.create_user(username="inviter", email="inviter@example.com", password="secret123")  # noqa: S106
        link = ensure_referral_link(inviter)
        ReferralRecord.objects.create(
            inviter=inviter,
            invitee=self.user,
            referral_link=link,
            status=ReferralRecordStatus.REGISTERED,
        )
        self.client.force_login(self.user)

        resp = self.client.post(
            "/api/users/me/real-name/submit/",
            data=json.dumps(
                {
                    "id_number": self.valid_id,
                    "real_name": "张三",
                    "source": "user_submit",
                }
            ),
            content_type="application/json",
        )

        self.assertEqual(resp.status_code, 200, resp.content)
        record = ReferralRecord.objects.get(invitee=self.user)
        self.assertEqual(record.status, ReferralRecordStatus.PENDING_REVIEW)

    def test_submit_invalid_real_name_is_rejected(self):
        self.client.force_login(self.user)

        resp = self.client.post(
            "/api/users/me/real-name/submit/",
            data=json.dumps(
                {
                    "id_number": "110105199001010019",
                    "real_name": "张三",
                    "source": "user_submit",
                }
            ),
            content_type="application/json",
        )

        self.assertEqual(resp.status_code, 200, resp.content)
        self.user.refresh_from_db()
        verification = RealNameVerification.objects.get(user=self.user, is_current=True)
        self.assertEqual(verification.status, RealNameStatus.REJECTED)
        self.assertEqual(self.user.real_name_status, RealNameStatus.REJECTED)
        self.assertIn("校验位无效", verification.failure_reason)

    def test_duplicate_verified_identity_moves_second_user_to_manual_review(self):
        first = self.user
        second = User.objects.create_user(username="bob", email="bob@example.com", password="secret123")  # noqa: S106

        self.client.force_login(first)
        first_resp = self.client.post(
            "/api/users/me/real-name/submit/",
            data=json.dumps(
                {
                    "id_number": self.valid_id,
                    "real_name": "张三",
                    "source": "user_submit",
                }
            ),
            content_type="application/json",
        )
        self.assertEqual(first_resp.status_code, 200, first_resp.content)

        self.client.force_login(second)
        second_resp = self.client.post(
            "/api/users/me/real-name/submit/",
            data=json.dumps(
                {
                    "id_number": self.valid_id,
                    "real_name": "李四",
                    "source": "business_gate",
                }
            ),
            content_type="application/json",
        )

        self.assertEqual(second_resp.status_code, 200, second_resp.content)
        second.refresh_from_db()
        verification = RealNameVerification.objects.get(user=second, is_current=True)
        self.assertEqual(verification.status, RealNameStatus.MANUAL_REVIEW)
        self.assertEqual(second.real_name_status, RealNameStatus.MANUAL_REVIEW)

    def test_retry_after_rejection_creates_new_current_record(self):
        self.client.force_login(self.user)
        rejected_resp = self.client.post(
            "/api/users/me/real-name/submit/",
            data=json.dumps(
                {
                    "id_number": "110105199001010019",
                    "real_name": "张三",
                }
            ),
            content_type="application/json",
        )
        self.assertEqual(rejected_resp.status_code, 200, rejected_resp.content)
        first_verification = RealNameVerification.objects.get(user=self.user, is_current=True)
        self.assertEqual(first_verification.status, RealNameStatus.REJECTED)

        retry_resp = self.client.post(
            "/api/users/me/real-name/retry/",
            data=json.dumps(
                {
                    "id_number": self.second_valid_id,
                    "real_name": "张三",
                    "source": "user_submit",
                }
            ),
            content_type="application/json",
        )

        self.assertEqual(retry_resp.status_code, 200, retry_resp.content)
        first_verification.refresh_from_db()
        self.assertFalse(first_verification.is_current)
        latest = RealNameVerification.objects.get(user=self.user, is_current=True)
        self.assertEqual(latest.status, RealNameStatus.VERIFIED)

    def test_admin_can_review_and_approve_real_name_verification(self):
        member = User.objects.create_user(username="carol", email="carol@example.com", password="secret123")  # noqa: S106
        self.client.force_login(self.user)
        submit_resp = self.client.post(
            "/api/users/me/real-name/submit/",
            data=json.dumps(
                {
                    "id_number": self.valid_id,
                    "real_name": "张三",
                    "source": "user_submit",
                }
            ),
            content_type="application/json",
        )
        self.assertEqual(submit_resp.status_code, 200, submit_resp.content)

        self.client.force_login(member)
        conflict_resp = self.client.post(
            "/api/users/me/real-name/submit/",
            data=json.dumps(
                {
                    "id_number": self.valid_id,
                    "real_name": "王五",
                    "source": "business_gate",
                }
            ),
            content_type="application/json",
        )
        self.assertEqual(conflict_resp.status_code, 200, conflict_resp.content)
        verification = RealNameVerification.objects.get(user=member, is_current=True)
        self.assertEqual(verification.status, RealNameStatus.MANUAL_REVIEW)

        self.client.force_login(self.admin)
        list_resp = self.client.get("/api/admin/real-name-verifications/?status=manual_review")
        self.assertEqual(list_resp.status_code, 200, list_resp.content)
        list_data = api_data(list_resp)
        self.assertEqual(list_data["total"], 1)
        self.assertEqual(list_data["page"], 1)

        detail_resp = self.client.get(f"/api/admin/real-name-verifications/{verification.pk}/")
        self.assertEqual(detail_resp.status_code, 200, detail_resp.content)
        self.assertEqual(api_data(detail_resp)["id_number"], self.valid_id)

        approve_resp = self.client.post(
            f"/api/admin/real-name-verifications/{verification.pk}/approve/",
            data=json.dumps({"note": "人工核验通过"}),
            content_type="application/json",
        )
        self.assertEqual(approve_resp.status_code, 200, approve_resp.content)
        verification.refresh_from_db()
        member.refresh_from_db()
        self.assertEqual(verification.status, RealNameStatus.VERIFIED)
        self.assertEqual(member.real_name_status, RealNameStatus.VERIFIED)
        self.assertEqual(verification.logs.last().action, RealNameLogAction.MANUAL_APPROVED)
