import json

from django.core.exceptions import ValidationError
from django.test import TestCase

from apps.accounts.constants import RealNameLogAction, RealNameStatus
from apps.accounts.models import RealNameVerification, User
from apps.accounts.services import serialize_real_name_verification
from apps.media.models import MediaFile
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

    def make_id_card_media(self):
        front = MediaFile.objects.create(
            uploader=self.user,
            resource_type="real_name_id_card",
            original_filename="front.png",
            file="uploads/users/1/front.png",
            file_size=123,
        )
        back = MediaFile.objects.create(
            uploader=self.user,
            resource_type="real_name_id_card",
            original_filename="back.png",
            file="uploads/users/1/back.png",
            file_size=124,
        )
        return [
            {"media_id": front.pk, "media_type": "image", "side": "front"},
            {"media_id": back.pk, "media_type": "image", "side": "back"},
        ]

    def test_submit_valid_real_name_creates_pending_application_with_id_card_media(self):
        self.client.force_login(self.user)
        id_card_media = self.make_id_card_media()

        resp = self.client.post(
            "/api/users/me/real-name/submit/",
            data=json.dumps(
                {
                    "id_number": self.valid_id,
                    "id_card_media": id_card_media,
                    "real_name": "张三",
                    "source": "user_submit",
                }
            ),
            content_type="application/json",
        )

        self.assertEqual(resp.status_code, 200, resp.content)
        self.user.refresh_from_db()
        verification = RealNameVerification.objects.get(user=self.user, is_current=True)
        self.assertEqual(verification.status, RealNameStatus.PENDING)
        self.assertEqual(self.user.real_name_status, RealNameStatus.PENDING)
        self.assertEqual(self.user.real_name_masked, "张*")
        self.assertTrue(self.user.id_number_masked.endswith(self.valid_id[-4:]))
        self.assertEqual(verification.id_card_media, id_card_media)
        self.assertEqual(verification.logs.count(), 1)
        self.assertEqual(verification.logs.last().action, RealNameLogAction.SUBMITTED)
        data = api_data(resp)
        self.assertEqual(data["status"], RealNameStatus.PENDING)
        self.assertEqual(data["status__mapping"], "待校验")
        self.assertEqual(data["source__mapping"], "用户主动提交")
        self.assertEqual(data["provider__mapping"], "模拟自动校验")
        self.assertNotIn("id_number_last4", data)
        self.assertEqual(data["id_card_media"][0]["side"], "front")
        self.assertEqual(data["id_card_media"][0]["media_id"], id_card_media[0]["media_id"])
        self.assertIn("url", data["id_card_media"][0])

    def test_submit_strips_platform_media_fields_before_storing_id_card_media(self):
        self.client.force_login(self.user)
        id_card_media = self.make_id_card_media()
        submitted_media = [
            {
                **id_card_media[0],
                "url": "stale-signed-url",
                "resource_type": "wrong",
                "original_filename": "wrong.png",
                "thumbnail": "wrong-thumbnail",
                "file_size": 999,
                "created_at": "stale-created-at",
            },
            id_card_media[1],
        ]

        resp = self.client.post(
            "/api/users/me/real-name/submit/",
            data=json.dumps(
                {
                    "id_number": self.valid_id,
                    "id_card_media": submitted_media,
                    "real_name": "张三",
                    "source": "user_submit",
                }
            ),
            content_type="application/json",
        )

        self.assertEqual(resp.status_code, 200, resp.content)
        verification = RealNameVerification.objects.get(user=self.user, is_current=True)
        self.assertEqual(verification.id_card_media[0], id_card_media[0])
        response_front = api_data(resp)["id_card_media"][0]
        self.assertNotEqual(response_front["url"], "stale-signed-url")
        self.assertEqual(response_front["resource_type"], "real_name_id_card")
        self.assertEqual(response_front["original_filename"], "front.png")
        self.assertEqual(response_front["file_size"], 123)

    def test_real_name_verification_resolves_id_card_media_without_mutating_storage_value(self):
        id_card_media = self.make_id_card_media()
        verification = RealNameVerification.objects.create(
            user=self.user,
            status=RealNameStatus.PENDING,
            source="user_submit",
            provider="mock_auto",
            real_name_encrypted="encrypted-name",
            id_number_encrypted="encrypted-id",
            real_name_masked="张*",
            id_number_masked="110***********0019",
            id_number_hash="hash-pending",
            id_card_media=[
                {
                    **id_card_media[0],
                    "url": "stale-signed-url",
                    "file_size": 999,
                },
                id_card_media[1],
            ],
            is_current=True,
        )

        resolved = serialize_real_name_verification(verification)["id_card_media"]
        verification.refresh_from_db()

        self.assertNotIn("url", verification.id_card_media[0])
        self.assertNotIn("file_size", verification.id_card_media[0])
        self.assertNotEqual(resolved[0]["url"], "stale-signed-url")
        self.assertEqual(resolved[0]["file_size"], 123)
        self.assertEqual(verification.id_card_media_resolved[0]["file_size"], 123)

    def test_real_name_media_field_rejects_wrong_resource_type(self):
        id_card_media = self.make_id_card_media()
        wrong_media = MediaFile.objects.create(
            uploader=self.user,
            resource_type="avatar",
            original_filename="avatar.png",
            file="uploads/users/1/avatar.png",
            file_size=123,
        )

        with self.assertRaisesMessage(ValidationError, "身份证图片资源类型不正确。"):
            RealNameVerification.objects.create(
                user=self.user,
                status=RealNameStatus.PENDING,
                source="user_submit",
                provider="mock_auto",
                real_name_encrypted="encrypted-name",
                id_number_encrypted="encrypted-id",
                real_name_masked="张*",
                id_number_masked="110***********0019",
                id_number_hash="hash-pending",
                id_card_media=[
                    {"media_id": wrong_media.pk, "media_type": "image", "side": "front"},
                    id_card_media[1],
                ],
                is_current=True,
            )

    def test_admin_approval_marks_referral_record_pending_review(self):
        inviter = User.objects.create_user(username="inviter", email="inviter@example.com", password="secret123")  # noqa: S106
        link = ensure_referral_link(inviter)
        ReferralRecord.objects.create(
            inviter=inviter,
            invitee=self.user,
            referral_link=link,
            status=ReferralRecordStatus.REGISTERED,
        )
        self.client.force_login(self.user)
        id_card_media = self.make_id_card_media()

        resp = self.client.post(
            "/api/users/me/real-name/submit/",
            data=json.dumps(
                {
                    "id_number": self.valid_id,
                    "id_card_media": id_card_media,
                    "real_name": "张三",
                    "source": "user_submit",
                }
            ),
            content_type="application/json",
        )

        self.assertEqual(resp.status_code, 200, resp.content)
        verification = RealNameVerification.objects.get(user=self.user, is_current=True)
        record = ReferralRecord.objects.get(invitee=self.user)
        self.assertEqual(record.status, ReferralRecordStatus.REGISTERED)

        self.client.force_login(self.admin)
        approve_resp = self.client.post(
            f"/api/admin/real-name-verifications/{verification.pk}/approve/",
            data=json.dumps({"note": "人工核验通过"}),
            content_type="application/json",
        )
        self.assertEqual(approve_resp.status_code, 200, approve_resp.content)
        record.refresh_from_db()
        self.assertEqual(record.status, ReferralRecordStatus.PENDING_REVIEW)

    def test_submit_invalid_real_name_is_rejected_before_creating_application(self):
        self.client.force_login(self.user)
        id_card_media = self.make_id_card_media()

        resp = self.client.post(
            "/api/users/me/real-name/submit/",
            data=json.dumps(
                {
                    "id_number": "110105199001010019",
                    "id_card_media": id_card_media,
                    "real_name": "张三",
                    "source": "user_submit",
                }
            ),
            content_type="application/json",
        )

        self.assertEqual(resp.status_code, 400, resp.content)
        self.user.refresh_from_db()
        self.assertFalse(RealNameVerification.objects.filter(user=self.user, is_current=True).exists())
        self.assertEqual(self.user.real_name_status, RealNameStatus.UNVERIFIED)

    def test_submit_requires_front_and_back_id_card_media(self):
        self.client.force_login(self.user)
        media = self.make_id_card_media()

        resp = self.client.post(
            "/api/users/me/real-name/submit/",
            data=json.dumps(
                {
                    "id_number": self.valid_id,
                    "id_card_media": [media[0]],
                    "real_name": "张三",
                    "source": "user_submit",
                }
            ),
            content_type="application/json",
        )

        self.assertEqual(resp.status_code, 400, resp.content)
        self.assertFalse(RealNameVerification.objects.filter(user=self.user, is_current=True).exists())

    def test_submit_rejects_invalid_source_in_schema(self):
        self.client.force_login(self.user)
        media = self.make_id_card_media()

        resp = self.client.post(
            "/api/users/me/real-name/submit/",
            data=json.dumps(
                {
                    "id_number": self.valid_id,
                    "id_card_media": media,
                    "real_name": "张三",
                    "source": "unknown",
                }
            ),
            content_type="application/json",
        )

        self.assertEqual(resp.status_code, 400, resp.content)
        self.assertFalse(RealNameVerification.objects.filter(user=self.user, is_current=True).exists())

    def test_submit_rejects_more_than_two_id_card_media_in_schema(self):
        self.client.force_login(self.user)
        media = self.make_id_card_media()

        resp = self.client.post(
            "/api/users/me/real-name/submit/",
            data=json.dumps(
                {
                    "id_number": self.valid_id,
                    "id_card_media": [*media, media[0]],
                    "real_name": "张三",
                    "source": "user_submit",
                }
            ),
            content_type="application/json",
        )

        self.assertEqual(resp.status_code, 400, resp.content)
        self.assertFalse(RealNameVerification.objects.filter(user=self.user, is_current=True).exists())

    def test_submit_rejects_incomplete_id_card_media_in_schema(self):
        self.client.force_login(self.user)

        resp = self.client.post(
            "/api/users/me/real-name/submit/",
            data=json.dumps(
                {
                    "id_number": self.valid_id,
                    "id_card_media": [
                        {"media_id": 1, "media_type": "image", "side": "front"},
                        {"media_id": 2, "media_type": "image"},
                    ],
                    "real_name": "张三",
                    "source": "user_submit",
                }
            ),
            content_type="application/json",
        )

        self.assertEqual(resp.status_code, 400, resp.content)
        self.assertFalse(RealNameVerification.objects.filter(user=self.user, is_current=True).exists())

    def test_submit_rejects_non_image_id_card_media_type_in_schema(self):
        self.client.force_login(self.user)
        media = self.make_id_card_media()

        resp = self.client.post(
            "/api/users/me/real-name/submit/",
            data=json.dumps(
                {
                    "id_number": self.valid_id,
                    "id_card_media": [
                        {**media[0], "media_type": "video"},
                        media[1],
                    ],
                    "real_name": "张三",
                    "source": "user_submit",
                }
            ),
            content_type="application/json",
        )

        self.assertEqual(resp.status_code, 400, resp.content)
        self.assertFalse(RealNameVerification.objects.filter(user=self.user, is_current=True).exists())

    def test_submit_rejects_same_side_id_card_media_in_schema(self):
        self.client.force_login(self.user)
        media = self.make_id_card_media()

        resp = self.client.post(
            "/api/users/me/real-name/submit/",
            data=json.dumps(
                {
                    "id_number": self.valid_id,
                    "id_card_media": [
                        {**media[0], "side": "front"},
                        {**media[1], "side": "front"},
                    ],
                    "real_name": "张三",
                    "source": "user_submit",
                }
            ),
            content_type="application/json",
        )

        self.assertEqual(resp.status_code, 400, resp.content)
        self.assertFalse(RealNameVerification.objects.filter(user=self.user, is_current=True).exists())

    def test_duplicate_verified_identity_can_submit_pending_application(self):
        first = self.user
        second = User.objects.create_user(username="bob", email="bob@example.com", password="secret123")  # noqa: S106

        self.client.force_login(first)
        first_media = self.make_id_card_media()
        first_resp = self.client.post(
            "/api/users/me/real-name/submit/",
            data=json.dumps(
                {
                    "id_number": self.valid_id,
                    "id_card_media": first_media,
                    "real_name": "张三",
                    "source": "user_submit",
                }
            ),
            content_type="application/json",
        )
        self.assertEqual(first_resp.status_code, 200, first_resp.content)
        first_verification = RealNameVerification.objects.get(user=first, is_current=True)
        self.client.force_login(self.admin)
        self.client.post(
            f"/api/admin/real-name-verifications/{first_verification.pk}/approve/",
            data=json.dumps({"note": "人工核验通过"}),
            content_type="application/json",
        )

        self.client.force_login(second)
        second_front = MediaFile.objects.create(uploader=second, resource_type="real_name_id_card", original_filename="front.png", file="uploads/users/2/front.png", file_size=123)
        second_back = MediaFile.objects.create(uploader=second, resource_type="real_name_id_card", original_filename="back.png", file="uploads/users/2/back.png", file_size=124)
        second_resp = self.client.post(
            "/api/users/me/real-name/submit/",
            data=json.dumps(
                {
                    "id_number": self.valid_id,
                    "id_card_media": [
                        {"media_id": second_front.pk, "media_type": "image", "side": "front"},
                        {"media_id": second_back.pk, "media_type": "image", "side": "back"},
                    ],
                    "real_name": "李四",
                    "source": "business_gate",
                }
            ),
            content_type="application/json",
        )

        self.assertEqual(second_resp.status_code, 200, second_resp.content)
        second.refresh_from_db()
        verification = RealNameVerification.objects.get(user=second, is_current=True)
        self.assertEqual(verification.status, RealNameStatus.PENDING)
        self.assertEqual(second.real_name_status, RealNameStatus.PENDING)

    def test_retry_after_rejection_creates_new_current_record(self):
        self.client.force_login(self.user)
        first_verification = RealNameVerification.objects.create(
            user=self.user,
            status=RealNameStatus.REJECTED,
            source="user_submit",
            provider="mock_auto",
            real_name_encrypted="encrypted-name",
            id_number_encrypted="encrypted-id",
            real_name_masked="张*",
            id_number_masked="110***********0019",
            id_number_hash="hash-rejected",
            failure_reason="身份证号格式或校验位无效。",
            is_current=True,
        )
        id_card_media = self.make_id_card_media()

        retry_resp = self.client.post(
            "/api/users/me/real-name/retry/",
            data=json.dumps(
                {
                    "id_number": self.second_valid_id,
                    "id_card_media": id_card_media,
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
        self.assertEqual(latest.status, RealNameStatus.PENDING)

    def test_admin_can_review_and_approve_real_name_verification(self):
        member = User.objects.create_user(username="carol", email="carol@example.com", password="secret123")  # noqa: S106
        self.client.force_login(self.user)
        user_media = self.make_id_card_media()
        submit_resp = self.client.post(
            "/api/users/me/real-name/submit/",
            data=json.dumps(
                {
                    "id_number": self.valid_id,
                    "id_card_media": user_media,
                    "real_name": "张三",
                    "source": "user_submit",
                }
            ),
            content_type="application/json",
        )
        self.assertEqual(submit_resp.status_code, 200, submit_resp.content)
        first_verification = RealNameVerification.objects.get(user=self.user, is_current=True)
        self.client.force_login(self.admin)
        self.client.post(
            f"/api/admin/real-name-verifications/{first_verification.pk}/approve/",
            data=json.dumps({"note": "人工核验通过"}),
            content_type="application/json",
        )

        self.client.force_login(member)
        member_front = MediaFile.objects.create(uploader=member, resource_type="real_name_id_card", original_filename="front.png", file="uploads/users/3/front.png", file_size=123)
        member_back = MediaFile.objects.create(uploader=member, resource_type="real_name_id_card", original_filename="back.png", file="uploads/users/3/back.png", file_size=124)
        conflict_resp = self.client.post(
            "/api/users/me/real-name/submit/",
            data=json.dumps(
                {
                    "id_number": self.valid_id,
                    "id_card_media": [
                        {"media_id": member_front.pk, "media_type": "image", "side": "front"},
                        {"media_id": member_back.pk, "media_type": "image", "side": "back"},
                    ],
                    "real_name": "王五",
                    "source": "business_gate",
                }
            ),
            content_type="application/json",
        )
        self.assertEqual(conflict_resp.status_code, 200, conflict_resp.content)
        verification = RealNameVerification.objects.get(user=member, is_current=True)
        self.assertEqual(verification.status, RealNameStatus.PENDING)

        self.client.force_login(self.admin)
        list_resp = self.client.get("/api/admin/real-name-verifications/?status=pending")
        self.assertEqual(list_resp.status_code, 200, list_resp.content)
        list_data = api_data(list_resp)
        self.assertEqual(list_data["total"], 1)
        self.assertEqual(list_data["page"], 1)

        detail_resp = self.client.get(f"/api/admin/real-name-verifications/{verification.pk}/")
        self.assertEqual(detail_resp.status_code, 200, detail_resp.content)
        self.assertEqual(api_data(detail_resp)["id_number"], self.valid_id)
        self.assertEqual(api_data(detail_resp)["id_card_media"][0]["side"], "front")
        self.assertIn("url", api_data(detail_resp)["id_card_media"][0])

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

    def test_get_my_real_name_returns_id_card_media_with_url_after_rejection(self):
        """驳回后查询实名状态应返回已上传的证件照片 URL，前端据此回显图片。"""
        self.client.force_login(self.user)
        id_card_media = self.make_id_card_media()
        submit_resp = self.client.post(
            "/api/users/me/real-name/submit/",
            data=json.dumps(
                {
                    "id_number": self.valid_id,
                    "id_card_media": id_card_media,
                    "real_name": "张三",
                    "source": "user_submit",
                }
            ),
            content_type="application/json",
        )
        self.assertEqual(submit_resp.status_code, 200, submit_resp.content)
        verification = RealNameVerification.objects.get(user=self.user, is_current=True)

        # 模拟驳回
        from apps.accounts.services import admin_transition_real_name

        admin_transition_real_name(
            verification,
            operator=self.admin,
            to_status=RealNameStatus.REJECTED,
            action=RealNameLogAction.MANUAL_REJECTED,
            note="身份证照片不清晰",
        )

        # 查询当前实名状态
        get_resp = self.client.get("/api/users/me/real-name/")
        self.assertEqual(get_resp.status_code, 200, get_resp.content)
        data = api_data(get_resp)
        self.assertEqual(data["status"], RealNameStatus.REJECTED)
        self.assertEqual(data["status__mapping"], "已驳回")
        self.assertEqual(len(data["id_card_media"]), 2)
        front_media = next(item for item in data["id_card_media"] if item["side"] == "front")
        self.assertIn("url", front_media)
        self.assertTrue(front_media["url"], "front side url should be non-empty")
        back_media = next(item for item in data["id_card_media"] if item["side"] == "back")
        self.assertIn("url", back_media)
        self.assertTrue(back_media["url"], "back side url should be non-empty")

    def test_real_name_logs_include_mapping_fields(self):
        self.client.force_login(self.user)
        id_card_media = self.make_id_card_media()
        submit_resp = self.client.post(
            "/api/users/me/real-name/submit/",
            data=json.dumps(
                {
                    "id_number": self.valid_id,
                    "id_card_media": id_card_media,
                    "real_name": "张三",
                    "source": "user_submit",
                }
            ),
            content_type="application/json",
        )
        self.assertEqual(submit_resp.status_code, 200, submit_resp.content)

        logs_resp = self.client.get("/api/users/me/real-name/logs/")
        self.assertEqual(logs_resp.status_code, 200, logs_resp.content)
        timeline = api_data(logs_resp)
        self.assertEqual(len(timeline), 1)
        self.assertEqual(timeline[0]["action__mapping"], "提交认证")
        self.assertEqual(timeline[0]["from_status__mapping"], "未实名")
        self.assertEqual(timeline[0]["to_status__mapping"], "待校验")
