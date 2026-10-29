from django.core.exceptions import ValidationError
from django.http import Http404
from django.test import TestCase

from model_bakery import baker

from apps.accounts.models import User
from apps.house.constants import ContactRole, HouseStatus
from apps.house.exceptions import HouseInvalidException
from apps.house.models import Building, Contact, House, PropertyResponsibility, ViewingRecord
from apps.house.queries.responsibilities import resolve_contact_recipient
from apps.house.services.contacts import TenantContactConflict, get_or_bind_tenant_contact
from apps.house.services.properties import publish_house
from apps.house.services.viewings import book_viewing
from apps.organizations.models import OrganizationMember


class HouseBusinessServiceTestCase(TestCase):
    def setUp(self):
        self.org = baker.make("organizations.Organization")
        self.building = Building.objects.create(organization=self.org, name="独立公寓", address="公寓路 1 号", floors=8)
        self.house = House.objects.create(building=self.building, room_number="101")
        self.user = baker.make(User, username="service-tenant")
        self.user.set_phone_number("+8613800138001", verified=True)
        self.user.save(update_fields=["phone_country_code", "phone_national_number", "phone_verified"])

    def test_phone_update_fields_keeps_original_and_normalized_values_in_sync(self):
        contact = Contact.objects.create(organization=self.org, name="租客", phone="138 0013 8001")
        self.assertEqual(contact.phone, "138 0013 8001")
        self.assertEqual(contact.normalized_phone, "+8613800138001")
        contact.phone = "139-0013-9001"
        contact.save(update_fields=["phone"])
        contact.refresh_from_db()
        self.assertEqual(contact.phone, "139-0013-9001")
        self.assertEqual(contact.normalized_phone, "+8613900139001")

    def test_binding_detects_same_phone_in_different_display_formats(self):
        Contact.objects.create(organization=self.org, name="联系人一", phone="13800138001")
        Contact.objects.create(organization=self.org, name="联系人二", phone="+86 13800138001")
        with self.assertRaises(TenantContactConflict):
            get_or_bind_tenant_contact(organization=self.org, user=self.user)
        self.assertFalse(Contact.objects.filter(organization=self.org, user=self.user).exists())

    def test_failed_booking_rolls_back_new_tenant_contact(self):
        self.house.status = HouseStatus.LISTED
        self.house.save(update_fields=["status"])
        with self.assertRaises(ValidationError):
            book_viewing(user=self.user, house_id=self.house.pk, scheduled_at=None)
        self.assertFalse(Contact.objects.filter(organization=self.org, user=self.user).exists())
        self.assertFalse(ViewingRecord.objects.filter(house=self.house).exists())

    def test_failed_publish_rolls_back_house_changes(self):
        with self.assertRaises(HouseInvalidException):
            publish_house(organization=self.org, house_id=self.house.pk, changes={"room_number": "102"})
        self.house.refresh_from_db()
        self.assertEqual(self.house.room_number, "101")
        self.assertEqual(self.house.status, HouseStatus.PAUSED)

    def test_publish_rejects_house_outside_organization(self):
        other_org = baker.make("organizations.Organization")
        with self.assertRaises(Http404):
            publish_house(organization=other_org, house_id=self.house.pk)
        self.house.refresh_from_db()
        self.assertEqual(self.house.status, HouseStatus.PAUSED)

    def test_publish_rejects_inactive_house_until_restored(self):
        landlord = Contact.objects.create(organization=self.org, name="可发布房东", phone="13800138002", roles=[ContactRole.LANDLORD])
        self.house.landlord = landlord
        self.house.asking_rent = 2500
        self.house.is_active = False
        self.house.save()
        with self.assertRaises(HouseInvalidException):
            publish_house(organization=self.org, house_id=self.house.pk)
        self.house.refresh_from_db()
        self.assertEqual(self.house.status, HouseStatus.PAUSED)
        self.assertFalse(self.house.is_active)

        self.house.is_active = True
        self.house.save(update_fields=["is_active"])
        publish_house(organization=self.org, house_id=self.house.pk)
        self.house.refresh_from_db()
        self.assertEqual(self.house.status, HouseStatus.LISTED)

    def test_standalone_house_does_not_match_unrelated_null_estate_assignment(self):
        owner = baker.make(User, username="service-owner")
        OrganizationMember.objects.create(organization=self.org, user=owner, is_owner=True)
        unrelated_member = OrganizationMember.objects.create(organization=self.org, user=self.user)
        unrelated_landlord = Contact.objects.create(organization=self.org, name="其他房东", phone="13900139001", roles=[ContactRole.LANDLORD])
        PropertyResponsibility.objects.create(organization=self.org, member=unrelated_member, landlord=unrelated_landlord)
        self.assertEqual(resolve_contact_recipient(self.house), owner)
