from django.test import RequestFactory, TestCase

from model_bakery import baker

from apps.accounts.models import User
from apps.referrals.services import capture_referral_code, create_record_for_registered_user, ensure_referral_link


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
