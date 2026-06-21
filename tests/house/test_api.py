import json
from datetime import date, timedelta
from decimal import Decimal

from django.contrib.auth import user_logged_in
from django.test import TestCase

from model_bakery import baker

from apps.accounts.models import User
from apps.house.models import Building, Contact, Estate, House, Lease, ViewingRecord
from apps.house.schemas import ContactIn, ContactPatchIn, HouseIn, LeaseIn, ViewingRecordIn
from apps.media.constants import MediaType, ResourceType
from apps.media.services import register_media_file
from apps.organizations.signals import user_logged_in_receiver
from apps.settings.models import OrganizationSetting
from tests.api_helpers import api_data, api_error


class HouseApiTestCase(TestCase):
    @classmethod
    def setUpClass(cls):
        user_logged_in.disconnect(user_logged_in_receiver)
        super().setUpClass()

    def setUp(self):
        self.user = User.objects.create_user(username="house-api", password="secret")  # noqa: S106
        self.org = baker.make("organizations.Organization", name="房源 API 组织", slug="house-api-org")
        baker.make("organizations.OrganizationMember", organization=self.org, user=self.user, is_owner=True)
        self.client.force_login(self.user)
        session = self.client.session
        session["organization_data"] = json.dumps({"pk": self.org.pk, "id": self.org.pk, "name": self.org.name, "slug": self.org.slug, "is_owner": True})
        session.save()
        self.estate = Estate.objects.create(
            organization=self.org, name="云岸", display_name="云岸", property_type=Estate.PropertyType.RESIDENTIAL, province="广东", city="深圳", district="南山", address="科技园"
        )
        self.building = Building.objects.create(organization=self.org, estate=self.estate, name="1栋", floors=20)

    def make_other_org_house(self):
        other_org = baker.make("organizations.Organization", name="其他房源 API 组织", slug="other-house-api-org")
        other_estate = Estate.objects.create(
            organization=other_org,
            name="异租户项目",
            display_name="异租户项目",
            property_type=Estate.PropertyType.RESIDENTIAL,
            province="广东",
            city="深圳",
            district="福田",
            address="车公庙",
        )
        other_building = Building.objects.create(organization=other_org, estate=other_estate, name="2栋", floors=10)
        other_landlord = Contact.objects.create(organization=other_org, name="异租户房东", phone="13800138222", roles=[Contact.Role.LANDLORD])
        other_tenant = Contact.objects.create(organization=other_org, name="异租户租客", phone="13900139222", roles=[Contact.Role.TENANT])
        other_house = House.objects.create(building=other_building, landlord=other_landlord, room_number="201")
        return other_org, other_house, other_landlord, other_tenant

    def test_invalid_house_media_refs_return_validation_error_not_500(self):
        avatar = register_media_file(
            uploader=self.user,
            oss_path="uploads/users/1/avatar.png",
            original_filename="avatar.png",
            resource_type=ResourceType.AVATAR,
            file_size=100,
        )
        self.client.raise_request_exception = False

        response = self.client.post(
            "/api/house/houses/",
            data=json.dumps(
                {
                    "building_id": self.building.pk,
                    "room_number": "1501",
                    "images": [{"media_id": avatar.pk, "media_type": MediaType.IMAGE}],
                }
            ),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(api_error(response)["error"], "VALIDATION_ERROR")

    def test_create_house_rejects_landlord_outside_current_org_at_api_boundary(self):
        _other_org, _other_house, other_landlord, _other_tenant = self.make_other_org_house()
        self.client.raise_request_exception = False

        response = self.client.post(
            "/api/house/houses/",
            data=json.dumps(
                {
                    "building_id": self.building.pk,
                    "landlord_id": other_landlord.pk,
                    "room_number": "1502",
                }
            ),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 404)
        self.assertFalse(House.objects.filter(building=self.building, room_number="1502").exists())

    def test_house_input_schema_does_not_expose_lifecycle_or_internal_fields_on_create(self):
        self.assertNotIn("status", HouseIn.model_fields)
        self.assertNotIn("is_active", HouseIn.model_fields)
        self.assertNotIn("extra", HouseIn.model_fields)
        self.assertNotIn("internal_notes", HouseIn.model_fields)

    def test_create_house_rejects_lifecycle_payload_and_starts_vacant(self):
        self.client.raise_request_exception = False

        rejected = self.client.post(
            "/api/house/houses/",
            data=json.dumps(
                {
                    "building_id": self.building.pk,
                    "room_number": "1502A",
                    "status": House.Status.LOCKED,
                    "is_active": False,
                    "extra": {"source": "api"},
                    "internal_notes": "only staff later",
                }
            ),
            content_type="application/json",
        )
        self.assertEqual(rejected.status_code, 400)
        self.assertFalse(House.objects.filter(building=self.building, room_number="1502A").exists())

        response = self.client.post(
            "/api/house/houses/",
            data=json.dumps({"building_id": self.building.pk, "room_number": "1502A"}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 201)
        house = House.objects.get(pk=api_data(response)["id"])
        self.assertEqual(house.status, House.Status.VACANT)
        self.assertTrue(house.is_active)
        self.assertEqual(house.extra, {})
        self.assertEqual(house.internal_notes, "")

    def test_create_and_patch_house_listing_fields(self):
        response = self.client.post(
            "/api/house/houses/",
            data=json.dumps(
                {
                    "building_id": self.building.pk,
                    "room_number": "1601",
                    "asking_rent": "4200.00",
                    "deposit_amount": "4200.00",
                    "available_from": "2026-07-01",
                }
            ),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 201)
        payload = api_data(response)
        self.assertEqual(payload["publish_status"], "draft")
        self.assertEqual(payload["asking_rent"], "4200.00")
        self.assertEqual(payload["deposit_amount"], "4200.00")
        self.assertEqual(payload["available_from"], "2026-07-01")

        patched = self.client.patch(
            f"/api/house/houses/{payload['id']}/",
            data=json.dumps({"publish_status": "published", "asking_rent": "4300.00"}),
            content_type="application/json",
        )

        self.assertEqual(patched.status_code, 200)
        patched_payload = api_data(patched)
        self.assertEqual(patched_payload["publish_status"], "published")
        self.assertEqual(patched_payload["asking_rent"], "4300.00")

    def test_list_houses_filters_by_publish_status(self):
        draft_house = House.objects.create(building=self.building, room_number="1701")
        published_house = House.objects.create(building=self.building, room_number="1702", publish_status=House.PublishStatus.PUBLISHED)

        response = self.client.get("/api/house/houses/?publish_status=published")

        self.assertEqual(response.status_code, 200)
        ids = {item["id"] for item in api_data(response)["items"]}
        self.assertIn(published_house.pk, ids)
        self.assertNotIn(draft_house.pk, ids)

    def test_default_building_creates_fallback_building_and_setting(self):
        empty_org = baker.make("organizations.Organization", name="空房源组织", slug="empty-house-org")
        baker.make("organizations.OrganizationMember", organization=empty_org, user=self.user, is_owner=True)
        session = self.client.session
        session["organization_data"] = json.dumps({"pk": empty_org.pk, "id": empty_org.pk, "name": empty_org.name, "slug": empty_org.slug, "is_owner": True})
        session.save()

        response = self.client.get("/api/house/default-building/")

        self.assertEqual(response.status_code, 200)
        payload = api_data(response)
        self.assertEqual(payload["name"], "默认楼栋")
        self.assertEqual(payload["estate_name"], "默认项目")
        self.assertEqual(Building.objects.get(pk=payload["id"]).organization, empty_org)
        self.assertTrue(OrganizationSetting.objects.filter(organization=empty_org, value=payload["id"]).exists())

    def test_org_creation_initializes_default_building_setting(self):
        org = baker.make("organizations.Organization", name="新租户默认楼栋", slug="new-org-default-building")

        building = Building.objects.get(organization=org, name="默认楼栋")
        self.assertTrue(OrganizationSetting.objects.filter(organization=org, value=building.pk).exists())

    def test_default_building_can_be_changed_to_org_building_only(self):
        other_building = Building.objects.create(organization=self.org, estate=self.estate, name="2栋", floors=18)

        response = self.client.put(
            "/api/house/default-building/",
            data=json.dumps({"building_id": other_building.pk}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(api_data(response)["id"], other_building.pk)

        _other_org, other_house, _other_landlord, _other_tenant = self.make_other_org_house()
        self.client.raise_request_exception = False
        rejected = self.client.put(
            "/api/house/default-building/",
            data=json.dumps({"building_id": other_house.building_id}),
            content_type="application/json",
        )
        self.assertEqual(rejected.status_code, 404)

    def test_contact_input_schema_does_not_expose_user_binding(self):
        self.assertNotIn("user_id", ContactIn.model_fields)
        self.assertNotIn("user_id", ContactPatchIn.model_fields)

    def test_contact_api_rejects_direct_user_binding(self):
        outsider = User.objects.create_user(username="outsider", password="secret")  # noqa: S106
        self.client.raise_request_exception = False

        response = self.client.post(
            "/api/house/contacts/",
            data=json.dumps(
                {
                    "name": "待认领房东",
                    "phone": "13800138555",
                    "roles": [Contact.Role.LANDLORD],
                    "user_id": outsider.pk,
                }
            ),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertFalse(Contact.objects.filter(organization=self.org, phone="13800138555").exists())

    def test_create_viewing_record_rejects_cross_org_house_and_contact_at_api_boundary(self):
        _other_org, other_house, _other_landlord, other_tenant = self.make_other_org_house()
        self.client.raise_request_exception = False

        cross_house_response = self.client.post(
            "/api/house/viewing-records/",
            data=json.dumps(
                {
                    "house_id": other_house.pk,
                    "customer_name": "王五",
                    "customer_phone": "13600136000",
                    "scheduled_at": "2026-07-01T10:00:00+08:00",
                }
            ),
            content_type="application/json",
        )
        self.assertEqual(cross_house_response.status_code, 404)

        house = House.objects.create(building=self.building, room_number="1503")
        cross_contact_response = self.client.post(
            "/api/house/viewing-records/",
            data=json.dumps(
                {
                    "house_id": house.pk,
                    "contact_id": other_tenant.pk,
                    "customer_name": "赵六",
                    "customer_phone": "13700137000",
                    "scheduled_at": "2026-07-01T11:00:00+08:00",
                }
            ),
            content_type="application/json",
        )

        self.assertEqual(cross_contact_response.status_code, 404)
        self.assertFalse(ViewingRecord.objects.filter(organization=self.org).exists())

    def test_create_viewing_record_rejects_assignee_outside_current_org(self):
        outsider = User.objects.create_user(username="viewing-outsider", password="secret")  # noqa: S106
        house = House.objects.create(building=self.building, room_number="1506")
        self.client.raise_request_exception = False

        response = self.client.post(
            "/api/house/viewing-records/",
            data=json.dumps(
                {
                    "house_id": house.pk,
                    "customer_name": "钱七",
                    "customer_phone": "13500135000",
                    "scheduled_at": "2026-07-01T12:00:00+08:00",
                    "assigned_to_id": outsider.pk,
                }
            ),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 404)
        self.assertFalse(ViewingRecord.objects.filter(organization=self.org).exists())

    def test_viewing_record_input_schema_does_not_expose_lifecycle_fields_on_create(self):
        self.assertNotIn("status", ViewingRecordIn.model_fields)
        self.assertNotIn("viewed_at", ViewingRecordIn.model_fields)
        self.assertNotIn("is_active", ViewingRecordIn.model_fields)
        self.assertNotIn("extra", ViewingRecordIn.model_fields)

    def test_create_viewing_record_rejects_lifecycle_payload_and_starts_scheduled(self):
        house = House.objects.create(building=self.building, room_number="1506A")
        self.client.raise_request_exception = False

        rejected = self.client.post(
            "/api/house/viewing-records/",
            data=json.dumps(
                {
                    "house_id": house.pk,
                    "customer_name": "钱七",
                    "customer_phone": "13500135000",
                    "scheduled_at": "2026-07-01T12:00:00+08:00",
                    "status": ViewingRecord.Status.VIEWED,
                    "viewed_at": "2026-07-01T13:00:00+08:00",
                    "is_active": False,
                    "extra": {"source": "api"},
                }
            ),
            content_type="application/json",
        )
        self.assertEqual(rejected.status_code, 400)
        self.assertFalse(ViewingRecord.objects.filter(organization=self.org, house=house).exists())

        response = self.client.post(
            "/api/house/viewing-records/",
            data=json.dumps(
                {
                    "house_id": house.pk,
                    "customer_name": "钱七",
                    "customer_phone": "13500135000",
                    "scheduled_at": "2026-07-01T12:00:00+08:00",
                }
            ),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 201)
        record = ViewingRecord.objects.get(pk=api_data(response)["id"])
        self.assertEqual(record.status, ViewingRecord.Status.SCHEDULED)
        self.assertIsNone(record.viewed_at)
        self.assertTrue(record.is_active)
        self.assertEqual(record.extra, {})

    def test_create_lease_rejects_cross_org_house_and_tenant_at_api_boundary(self):
        _other_org, other_house, _other_landlord, other_tenant = self.make_other_org_house()
        landlord = Contact.objects.create(organization=self.org, name="房东", phone="13800138333", roles=[Contact.Role.LANDLORD])
        tenant = Contact.objects.create(organization=self.org, name="租客", phone="13900139333", roles=[Contact.Role.TENANT])
        house = House.objects.create(building=self.building, landlord=landlord, room_number="1504")
        self.client.raise_request_exception = False

        cross_house_response = self.client.post(
            "/api/house/leases/",
            data=json.dumps(
                {
                    "house_id": other_house.pk,
                    "tenant_id": tenant.pk,
                    "start_date": str(date.today()),
                    "end_date": str(date.today() + timedelta(days=365)),
                    "monthly_rent": "4200",
                }
            ),
            content_type="application/json",
        )
        self.assertEqual(cross_house_response.status_code, 404)

        cross_tenant_response = self.client.post(
            "/api/house/leases/",
            data=json.dumps(
                {
                    "house_id": house.pk,
                    "tenant_id": other_tenant.pk,
                    "start_date": str(date.today()),
                    "end_date": str(date.today() + timedelta(days=365)),
                    "monthly_rent": "4200",
                }
            ),
            content_type="application/json",
        )

        self.assertEqual(cross_tenant_response.status_code, 404)
        self.assertFalse(Lease.objects.filter(organization=self.org).exists())

    def test_lease_input_schema_does_not_expose_status_on_create(self):
        self.assertNotIn("status", LeaseIn.model_fields)

    def test_create_lease_rejects_status_payload_and_starts_pending_without_status(self):
        landlord = Contact.objects.create(organization=self.org, name="签约房东", phone="13800138666", roles=[Contact.Role.LANDLORD])
        tenant = Contact.objects.create(organization=self.org, name="签约租客", phone="13900139666", roles=[Contact.Role.TENANT])
        house = House.objects.create(building=self.building, landlord=landlord, room_number="1507")

        rejected = self.client.post(
            "/api/house/leases/",
            data=json.dumps(
                {
                    "house_id": house.pk,
                    "tenant_id": tenant.pk,
                    "start_date": str(date.today()),
                    "end_date": str(date.today() + timedelta(days=365)),
                    "monthly_rent": "4200",
                    "status": Lease.Status.ACTIVE,
                }
            ),
            content_type="application/json",
        )
        self.assertEqual(rejected.status_code, 400)

        response = self.client.post(
            "/api/house/leases/",
            data=json.dumps(
                {
                    "house_id": house.pk,
                    "tenant_id": tenant.pk,
                    "start_date": str(date.today()),
                    "end_date": str(date.today() + timedelta(days=365)),
                    "monthly_rent": "4200",
                }
            ),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 201)
        lease_id = api_data(response)["id"]
        lease = Lease.objects.get(pk=lease_id)
        house.refresh_from_db()
        self.assertEqual(lease.status, Lease.Status.PENDING)
        self.assertEqual(house.status, House.Status.VACANT)

    def test_patch_lease_to_active_recalculates_house_status(self):
        landlord = Contact.objects.create(organization=self.org, name="激活房东", phone="13800138667", roles=[Contact.Role.LANDLORD])
        tenant = Contact.objects.create(organization=self.org, name="激活租客", phone="13900139667", roles=[Contact.Role.TENANT])
        house = House.objects.create(building=self.building, landlord=landlord, room_number="1508")
        lease = Lease.objects.create(
            organization=self.org,
            house=house,
            tenant=tenant,
            start_date=date.today(),
            end_date=date.today() + timedelta(days=365),
            monthly_rent=Decimal("4200"),
        )

        response = self.client.patch(
            f"/api/house/leases/{lease.pk}/",
            data=json.dumps({"status": Lease.Status.ACTIVE}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        lease.refresh_from_db()
        house.refresh_from_db()
        self.assertEqual(lease.status, Lease.Status.ACTIVE)
        self.assertEqual(house.status, House.Status.RENTED)

    def test_create_lease_can_link_converted_viewing_record_source(self):
        landlord = Contact.objects.create(organization=self.org, name="来源房东", phone="13800138668", roles=[Contact.Role.LANDLORD])
        tenant = Contact.objects.create(organization=self.org, name="来源租客", phone="13900139668", roles=[Contact.Role.TENANT])
        house = House.objects.create(building=self.building, landlord=landlord, room_number="1509")
        viewing = ViewingRecord.objects.create(
            organization=self.org,
            house=house,
            contact=tenant,
            customer_name="来源客户",
            customer_phone="13900139668",
            scheduled_at="2026-07-01T10:00:00+08:00",
            status=ViewingRecord.Status.CONVERTED,
        )

        response = self.client.post(
            "/api/house/leases/",
            data=json.dumps(
                {
                    "house_id": house.pk,
                    "tenant_id": tenant.pk,
                    "source_viewing_record_id": viewing.pk,
                    "start_date": str(date.today()),
                    "end_date": str(date.today() + timedelta(days=365)),
                    "monthly_rent": "4200",
                }
            ),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 201)
        lease = Lease.objects.get(pk=api_data(response)["id"])
        self.assertEqual(lease.source_viewing_record_id, viewing.pk)
        self.assertEqual(api_data(response)["source_viewing_record_id"], viewing.pk)

    def test_create_lease_rejects_cross_org_viewing_record_source(self):
        _other_org, other_house, _other_landlord, other_tenant = self.make_other_org_house()
        other_viewing = ViewingRecord.objects.create(
            organization=_other_org,
            house=other_house,
            contact=other_tenant,
            customer_name="异租户来源",
            customer_phone="13900139222",
            scheduled_at="2026-07-01T10:00:00+08:00",
            status=ViewingRecord.Status.CONVERTED,
        )
        landlord = Contact.objects.create(organization=self.org, name="当前来源房东", phone="13800138669", roles=[Contact.Role.LANDLORD])
        tenant = Contact.objects.create(organization=self.org, name="当前来源租客", phone="13900139669", roles=[Contact.Role.TENANT])
        house = House.objects.create(building=self.building, landlord=landlord, room_number="1510")
        self.client.raise_request_exception = False

        response = self.client.post(
            "/api/house/leases/",
            data=json.dumps(
                {
                    "house_id": house.pk,
                    "tenant_id": tenant.pk,
                    "source_viewing_record_id": other_viewing.pk,
                    "start_date": str(date.today()),
                    "end_date": str(date.today() + timedelta(days=365)),
                    "monthly_rent": "4200",
                }
            ),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 404)
        self.assertFalse(Lease.objects.filter(organization=self.org, source_viewing_record_id=other_viewing.pk).exists())

    def test_landlord_my_leases_returns_only_current_org_claimed_house_leases(self):
        landlord = Contact.objects.create(organization=self.org, name="当前房东", phone="13800138444", roles=[Contact.Role.LANDLORD], user=self.user)
        tenant = Contact.objects.create(organization=self.org, name="当前租客", phone="13900139444", roles=[Contact.Role.TENANT])
        house = House.objects.create(building=self.building, landlord=landlord, room_number="1505")
        visible = Lease.objects.create(
            organization=self.org,
            house=house,
            tenant=tenant,
            start_date=date.today(),
            end_date=date.today() + timedelta(days=365),
            monthly_rent=Decimal("4300"),
            status=Lease.Status.ACTIVE,
        )
        other_org, other_house, _other_landlord, other_tenant = self.make_other_org_house()
        Contact.objects.filter(pk=other_house.landlord_id).update(user=self.user)
        Lease.objects.create(
            organization=other_org,
            house=other_house,
            tenant=other_tenant,
            start_date=date.today(),
            end_date=date.today() + timedelta(days=365),
            monthly_rent=Decimal("5300"),
            status=Lease.Status.ACTIVE,
        )

        response = self.client.get("/api/house/landlord/my-leases/")

        self.assertEqual(response.status_code, 200)
        items = api_data(response)["items"]
        self.assertEqual([item["id"] for item in items], [visible.pk])


class LeaseStatusClosureTestCase(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="lease-closure", password="secret")  # noqa: S106
        self.org = baker.make("organizations.Organization", name="租约组织", slug="lease-closure-org")
        self.estate = Estate.objects.create(
            organization=self.org, name="云岸", display_name="云岸", property_type=Estate.PropertyType.RESIDENTIAL, province="广东", city="深圳", district="南山", address="科技园"
        )
        self.building = Building.objects.create(organization=self.org, estate=self.estate, name="1栋", floors=20)
        self.landlord = Contact.objects.create(organization=self.org, name="房东", phone="13800138111", roles=[Contact.Role.LANDLORD])
        self.tenant = Contact.objects.create(organization=self.org, name="租客", phone="13900139111", roles=[Contact.Role.TENANT])

    def make_house(self, room_number, status=House.Status.VACANT):
        return House.objects.create(building=self.building, landlord=self.landlord, room_number=room_number, status=status)

    def test_moving_active_lease_recalculates_old_and_new_house_status(self):
        old_house = self.make_house("1601")
        new_house = self.make_house("1602")
        lease = Lease.objects.create(
            organization=self.org,
            house=old_house,
            tenant=self.tenant,
            start_date=date.today(),
            end_date=date.today() + timedelta(days=365),
            monthly_rent=Decimal("3800"),
            status=Lease.Status.ACTIVE,
        )
        old_house.refresh_from_db()
        self.assertEqual(old_house.status, House.Status.RENTED)

        lease.house = new_house
        lease.save()

        old_house.refresh_from_db()
        new_house.refresh_from_db()
        self.assertEqual(old_house.status, House.Status.VACANT)
        self.assertEqual(new_house.status, House.Status.RENTED)

    def test_manual_locked_status_is_not_overwritten_by_active_lease_recalculation(self):
        house = self.make_house("1701", status=House.Status.LOCKED)

        Lease.objects.create(
            organization=self.org,
            house=house,
            tenant=self.tenant,
            start_date=date.today(),
            end_date=date.today() + timedelta(days=365),
            monthly_rent=Decimal("4100"),
            status=Lease.Status.ACTIVE,
        )

        house.refresh_from_db()
        self.assertEqual(house.status, House.Status.LOCKED)
