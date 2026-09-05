import json
from datetime import date, timedelta
from decimal import Decimal
from unittest.mock import patch
from urllib.parse import urlparse
from uuid import uuid4

from django.core.cache import cache
from django.test import TestCase, override_settings

from model_bakery import baker

from apps.accounts.models import User
from apps.house.constants import ContactRole, EstatePropertyType, HouseStatus
from apps.house.landlord_invitations import get_landlord_invitation
from apps.house.models import Building, Contact, Estate, House, Lease
from tests.api_helpers import api_data, api_error

LANDLORD_TEST_CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
        "LOCATION": "landlord-invitation-tests",
    }
}


@override_settings(CACHES=LANDLORD_TEST_CACHES)
class LandlordPortalApiTestCase(TestCase):
    def setUp(self):
        cache.clear()
        self.inviter = User.objects.create_user(username="landlord-inviter", password="secret")  # noqa: S106
        self.organization = baker.make("organizations.Organization", name="甲中介", slug="landlord-org-a")
        baker.make("organizations.OrganizationMember", organization=self.organization, user=self.inviter, is_owner=True)
        self.client.force_login(self.inviter)
        self.select_organization(self.organization)

    def select_organization(self, organization):
        session = self.client.session
        session["organization_data"] = json.dumps(
            {
                "pk": organization.pk,
                "id": organization.pk,
                "name": organization.name,
                "slug": organization.slug,
                "is_owner": True,
            }
        )
        session.save()

    def make_contact(self, *, organization=None, phone="13800138001", name="张房东", roles=None, user=None, is_active=True):
        return Contact.objects.create(
            organization=organization or self.organization,
            name=name,
            phone=phone,
            roles=roles or [ContactRole.LANDLORD],
            user=user,
            is_active=is_active,
        )

    def make_verified_user(self, *, username="landlord-user", phone="+8613800138001"):
        user = User.objects.create_user(username=username, password="secret")  # noqa: S106
        user.set_phone_number(phone, verified=True)
        user.save(update_fields=["phone_country_code", "phone_national_number", "phone_verified"])
        return user

    def create_invitation(self, contact):
        with patch("apps.house.api.send_invitation_sms") as send_sms:
            response = self.client.post(f"/api/house/contacts/{contact.pk}/landlord-invite/")
        self.assertEqual(response.status_code, 200)
        payload = api_data(response)
        token = urlparse(payload["action_url"]).path.rstrip("/").split("/")[-1]
        send_sms.assert_called_once_with("+8613800138001", payload["action_url"], 7)
        return token, payload

    def make_building(self, *, organization=None, suffix="a"):
        organization = organization or self.organization
        estate = Estate.objects.create(
            organization=organization,
            name=f"云岸-{suffix}",
            display_name=f"云岸-{suffix}",
            property_type=EstatePropertyType.RESIDENTIAL,
            province="广东",
            city="深圳",
            district="南山",
            address="科技园路",
        )
        return Building.objects.create(organization=organization, estate=estate, name=f"1栋-{suffix}", address="科技园路 1 号", floors=20)

    def test_invitation_resend_invalidates_old_token_and_exposes_derived_status(self):
        contact = self.make_contact()

        first_token, _ = self.create_invitation(contact)
        first_payload = get_landlord_invitation(first_token)
        second_token, second_response = self.create_invitation(contact)

        self.assertNotEqual(first_token, second_token)
        self.assertIsNotNone(first_payload)
        self.assertIsNone(get_landlord_invitation(first_token))
        self.assertIsNotNone(get_landlord_invitation(second_token))
        self.assertEqual(self.client.get(f"/api/house/landlord/invites/{first_token}/").status_code, 404)
        self.client.logout()
        self.assertEqual(api_data(self.client.get(f"/api/house/landlord/invites/{second_token}/"))["invitee_phone_masked"], "+86****8001")
        self.assertEqual(self.client.post(f"/api/house/landlord/invites/{second_token}/accept/").status_code, 401)

        self.client.force_login(self.inviter)
        self.select_organization(self.organization)

        contact_payload = api_data(self.client.get("/api/house/contacts/?role=landlord"))["items"][0]
        self.assertEqual(contact_payload["landlord_binding_status"], "invited")
        self.assertEqual(contact_payload["landlord_invite_expires_at"], second_response["expires_at"])

    def test_manual_invitation_returns_share_link_without_sending_sms(self):
        contact = self.make_contact()

        with patch("apps.house.api.send_invitation_sms") as send_sms:
            response = self.client.post(f"/api/house/contacts/{contact.pk}/landlord-invite/?delivery_method=manual")

        self.assertEqual(response.status_code, 200)
        payload = api_data(response)
        self.assertIn("/dashboard/landlord-invitations/", payload["action_url"])
        send_sms.assert_not_called()

    def test_invitation_rejects_unknown_delivery_method(self):
        contact = self.make_contact()

        response = self.client.post(f"/api/house/contacts/{contact.pk}/landlord-invite/?delivery_method=email")

        self.assertEqual(response.status_code, 400)

    def test_invitation_rejects_inactive_non_landlord_bound_and_invalid_phone_contacts(self):
        inactive = self.make_contact(phone="13800138002", is_active=False)
        tenant = self.make_contact(phone="13800138003", roles=[ContactRole.TENANT])
        bound = self.make_contact(phone="13800138004", user=User.objects.create_user(username="already-bound", password="secret"))  # noqa: S106
        invalid_phone = self.make_contact(phone="not-a-phone")

        self.assertEqual(self.client.post(f"/api/house/contacts/{inactive.pk}/landlord-invite/").status_code, 422)
        self.assertEqual(self.client.post(f"/api/house/contacts/{tenant.pk}/landlord-invite/").status_code, 422)
        self.assertEqual(self.client.post(f"/api/house/contacts/{bound.pk}/landlord-invite/").status_code, 409)
        self.assertEqual(self.client.post(f"/api/house/contacts/{invalid_phone.pk}/landlord-invite/").status_code, 422)

    def test_matching_verified_phone_accepts_invitation_and_is_idempotent_while_token_exists(self):
        contact = self.make_contact()
        token, _ = self.create_invitation(contact)
        landlord = self.make_verified_user()
        self.client.force_login(landlord)

        with self.captureOnCommitCallbacks(execute=False):
            first = self.client.post(f"/api/house/landlord/invites/{token}/accept/")
            second = self.client.post(f"/api/house/landlord/invites/{token}/accept/")

        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 200)
        contact.refresh_from_db()
        self.assertEqual(contact.user, landlord)
        self.assertIsNotNone(contact.public_key)
        self.assertEqual(api_data(first)["public_key"], str(contact.public_key))

    def test_accept_rejects_unverified_mismatched_invalid_and_already_bound_invites(self):
        contact = self.make_contact()
        token, _ = self.create_invitation(contact)

        unverified = User.objects.create_user(username="unverified-landlord", password="secret")  # noqa: S106
        unverified.set_phone_number("+8613800138001", verified=False)
        unverified.save(update_fields=["phone_country_code", "phone_national_number", "phone_verified"])
        self.client.force_login(unverified)
        unverified_response = self.client.post(f"/api/house/landlord/invites/{token}/accept/")
        self.assertEqual(unverified_response.status_code, 403)

        mismatched = self.make_verified_user(username="mismatched-landlord", phone="+8613900139001")
        self.client.force_login(mismatched)
        mismatched_response = self.client.post(f"/api/house/landlord/invites/{token}/accept/")
        self.assertEqual(mismatched_response.status_code, 403)

        self.assertEqual(self.client.post("/api/house/landlord/invites/not-found/accept/").status_code, 404)

        owner = User.objects.create_user(username="bound-landlord", password="secret")  # noqa: S106
        contact.user = owner
        contact.save(update_fields=["user", "updated_at"])
        other = self.make_verified_user(username="other-landlord", phone="+8613700137001")
        self.client.force_login(other)
        conflict = self.client.post(f"/api/house/landlord/invites/{token}/accept/")
        self.assertEqual(conflict.status_code, 409)
        contact.refresh_from_db()
        self.assertEqual(contact.user, owner)

    def test_one_user_can_switch_multiple_relationships_with_strict_contact_isolation(self):
        landlord = self.make_verified_user()
        second_org = baker.make("organizations.Organization", name="乙中介", slug="landlord-org-b")
        first_contact = self.make_contact(user=landlord, name="甲档案")
        second_contact = self.make_contact(organization=second_org, phone="13800138002", user=landlord, name="乙档案")
        foreign_user = self.make_verified_user(username="foreign-landlord", phone="+8613800138003")
        foreign_contact = self.make_contact(organization=second_org, phone="13800138003", user=foreign_user, name="其他房东")

        first_building = self.make_building(suffix="first")
        second_building = self.make_building(organization=second_org, suffix="second")
        first_house = House.objects.create(building=first_building, landlord=first_contact, room_number="101", status=HouseStatus.INACTIVE)
        second_house = House.objects.create(building=second_building, landlord=second_contact, room_number="202", status=HouseStatus.RENTED)
        foreign_house = House.objects.create(building=second_building, landlord=foreign_contact, room_number="303", status=HouseStatus.VACANT)
        tenant = self.make_contact(organization=second_org, phone="13900139002", name="李租客", roles=[ContactRole.TENANT])
        lease = Lease.objects.create(
            organization=second_org,
            house=second_house,
            tenant=tenant,
            start_date=date.today(),
            end_date=date.today() + timedelta(days=365),
            monthly_rent=Decimal("3200"),
        )

        self.client.force_login(landlord)
        relationships = api_data(self.client.get("/api/house/landlord/relationships/"))
        self.assertEqual({item["contact_id"] for item in relationships}, {first_contact.pk, second_contact.pk})

        first_items = api_data(self.client.get(f"/api/house/landlord/contacts/{first_contact.pk}/houses/"))["items"]
        second_items = api_data(self.client.get(f"/api/house/landlord/contacts/{second_contact.pk}/houses/"))["items"]
        lease_items = api_data(self.client.get(f"/api/house/landlord/contacts/{second_contact.pk}/leases/"))["items"]
        self.assertEqual([item["id"] for item in first_items], [first_house.pk])
        self.assertEqual([item["id"] for item in second_items], [second_house.pk])
        self.assertEqual([item["id"] for item in lease_items], [lease.pk])
        self.assertEqual(self.client.get(f"/api/house/landlord/contacts/{foreign_contact.pk}/houses/").status_code, 404)
        self.assertNotIn(foreign_house.pk, {item["id"] for item in second_items})

    def test_public_store_only_exposes_listed_houses_and_scopes_detail_to_contact(self):
        landlord = self.make_verified_user()
        contact = self.make_contact(user=landlord)
        other_contact = self.make_contact(phone="13800138009", name="其他房东", user=landlord)
        building = self.make_building(suffix="public")
        listed = House.objects.create(building=building, landlord=contact, room_number="801", status=HouseStatus.LISTED, asking_rent=Decimal("4200"))
        House.objects.create(building=building, landlord=contact, room_number="802", status=HouseStatus.VACANT)
        other = House.objects.create(building=building, landlord=other_contact, room_number="803", status=HouseStatus.LISTED)

        profile = api_data(self.client.get(f"/api/public/landlords/{contact.public_key}/"))
        items = api_data(self.client.get(f"/api/public/landlords/{contact.public_key}/houses/"))["items"]
        detail = self.client.get(f"/api/public/landlords/{contact.public_key}/houses/{listed.pk}/")

        self.assertEqual(profile["phone"], "+8613800138001")
        self.assertEqual(profile["house_count"], 1)
        self.assertEqual([item["id"] for item in items], [listed.pk])
        self.assertEqual(api_data(detail)["id"], listed.pk)
        self.assertEqual(self.client.get(f"/api/public/landlords/{contact.public_key}/houses/{other.pk}/").status_code, 404)
        self.assertEqual(self.client.get(f"/api/public/landlords/{uuid4()}/").status_code, 404)

    @patch("apps.house.api.create_landlord_invitation")
    def test_invitation_cache_failure_returns_service_unavailable(self, create_invitation):
        from apps.house.landlord_invitations import LandlordInvitationCacheError

        create_invitation.side_effect = LandlordInvitationCacheError("房东邀请服务暂不可用。")
        contact = self.make_contact()
        response = self.client.post(f"/api/house/contacts/{contact.pk}/landlord-invite/")

        self.assertEqual(response.status_code, 503)
        self.assertEqual(api_error(response)["message"], "房东邀请服务暂不可用。")
