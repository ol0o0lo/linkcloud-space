import json
from datetime import date, timedelta
from decimal import Decimal

from django.contrib.auth import user_logged_in
from django.test import TestCase
from django.utils import timezone

from model_bakery import baker

from apps.accounts.models import User
from apps.house.models import Building, Contact, Estate, House, Lease, ViewingRecord
from apps.house.schemas import ContactIn, ContactPatchIn, HouseIn, LeaseIn, ViewingRecordIn
from apps.media.constants import MediaType, ResourceType
from apps.media.services import register_media_file
from apps.organizations.signals import user_logged_in_receiver
from apps.settings.models import DefaultSetting, OrganizationSetting
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

    def test_create_and_patch_estate_allow_blank_address_for_governance_queue(self):
        create_response = self.client.post(
            "/api/house/estates/",
            data=json.dumps(
                {
                    "name": "待补地址项目",
                    "display_name": "待补地址项目",
                    "property_type": Estate.PropertyType.RESIDENTIAL,
                    "province": "广东",
                    "city": "深圳",
                    "district": "南山",
                    "address": "",
                }
            ),
            content_type="application/json",
        )

        self.assertEqual(create_response.status_code, 201)
        estate_id = api_data(create_response)["id"]
        self.assertEqual(Estate.objects.get(pk=estate_id).address, "")

        patch_response = self.client.patch(
            f"/api/house/estates/{self.estate.pk}/",
            data=json.dumps({"address": ""}),
            content_type="application/json",
        )

        self.assertEqual(patch_response.status_code, 200)
        self.estate.refresh_from_db()
        self.assertEqual(self.estate.address, "")

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

    def test_list_houses_filters_by_estate_before_pagination(self):
        House.objects.create(building=self.building, room_number="1701")
        other_estate = Estate.objects.create(
            organization=self.org,
            name="海风里",
            display_name="海风里花园",
            property_type=Estate.PropertyType.RESIDENTIAL,
            province="广东",
            city="深圳",
            district="南山",
            address="后海",
        )
        other_building = Building.objects.create(organization=self.org, estate=other_estate, name="3栋", floors=16)
        other_house = House.objects.create(building=other_building, room_number="1801")
        self.make_other_org_house()

        response = self.client.get(f"/api/house/houses/?estate_id={other_estate.pk}&page=1&page_size=1")
        payload = api_data(response)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(payload["total"], 1)
        self.assertEqual([item["id"] for item in payload["items"]], [other_house.pk])

    def test_list_houses_filters_by_publish_issue_before_pagination(self):
        landlord = Contact.objects.create(organization=self.org, name="发布房东", phone="13800138666", roles=[Contact.Role.LANDLORD])
        media_index = 0

        def image_ref(role):
            nonlocal media_index
            media_index += 1
            media = register_media_file(
                uploader=self.user,
                oss_path=f"uploads/orgs/{self.org.pk}/house-{media_index}.jpg",
                original_filename=f"house-{media_index}.jpg",
                resource_type=ResourceType.HOUSE_IMAGE,
                file_size=100,
            )
            return {"media_id": media.pk, "media_type": MediaType.IMAGE, "image_role": role}

        def images(*roles):
            return [image_ref(role) for role in roles]

        House.objects.create(
            building=self.building,
            landlord=landlord,
            room_number="1800",
            asking_rent=Decimal("4200.00"),
            images=images("cover", "floor_plan", "bedroom"),
        )
        missing_landlord = House.objects.create(building=self.building, room_number="1801", asking_rent=Decimal("4200.00"), images=images("cover", "floor_plan", "bedroom"))
        missing_rent = House.objects.create(building=self.building, landlord=landlord, room_number="1802", images=images("cover", "floor_plan", "bedroom"))
        missing_cover = House.objects.create(
            building=self.building,
            landlord=landlord,
            room_number="1803",
            asking_rent=Decimal("4200.00"),
            images=images("floor_plan", "bedroom", "kitchen"),
        )
        few_images = House.objects.create(building=self.building, landlord=landlord, room_number="1804", asking_rent=Decimal("4200.00"), images=images("cover", "floor_plan"))
        missing_floor_plan = House.objects.create(
            building=self.building,
            landlord=landlord,
            room_number="1805",
            asking_rent=Decimal("4200.00"),
            images=images("cover", "bedroom", "kitchen"),
        )

        expected = {
            "landlord": missing_landlord.pk,
            "rent": missing_rent.pk,
            "cover": missing_cover.pk,
            "images": few_images.pk,
            "floor_plan": missing_floor_plan.pk,
        }
        for issue, house_id in expected.items():
            with self.subTest(issue=issue):
                response = self.client.get(f"/api/house/houses/?publish_issue={issue}&page=1&page_size=1")
                payload = api_data(response)
                self.assertEqual(response.status_code, 200)
                self.assertEqual(payload["total"], 1)
                self.assertEqual([item["id"] for item in payload["items"]], [house_id])

    def test_list_houses_filters_publish_blocked_and_ready_before_pagination(self):
        landlord = Contact.objects.create(organization=self.org, name="发布房东", phone="13800138666", roles=[Contact.Role.LANDLORD])
        media_index = 0

        def image_ref(role):
            nonlocal media_index
            media_index += 1
            media = register_media_file(
                uploader=self.user,
                oss_path=f"uploads/orgs/{self.org.pk}/ready-house-{media_index}.jpg",
                original_filename=f"ready-house-{media_index}.jpg",
                resource_type=ResourceType.HOUSE_IMAGE,
                file_size=100,
            )
            return {"media_id": media.pk, "media_type": MediaType.IMAGE, "image_role": role}

        blocked_house = House.objects.create(
            building=self.building,
            landlord=None,
            room_number="1810",
            asking_rent=Decimal("4200.00"),
            images=[image_ref("bedroom")],
        )
        ready_house = House.objects.create(
            building=self.building,
            landlord=landlord,
            room_number="1811",
            asking_rent=Decimal("4300.00"),
            images=[image_ref("cover"), image_ref("floor_plan"), image_ref("living_room")],
        )
        House.objects.create(
            building=self.building,
            landlord=landlord,
            room_number="1812",
            asking_rent=Decimal("4400.00"),
            publish_status=House.PublishStatus.PUBLISHED,
            images=[image_ref("cover"), image_ref("floor_plan"), image_ref("bedroom")],
        )

        blocked_response = self.client.get("/api/house/houses/?publish_blocked=true&page=1&page_size=1")
        blocked_payload = api_data(blocked_response)
        self.assertEqual(blocked_response.status_code, 200)
        self.assertEqual(blocked_payload["total"], 1)
        self.assertEqual([item["id"] for item in blocked_payload["items"]], [blocked_house.pk])

        ready_response = self.client.get("/api/house/houses/?publish_ready=true&page=1&page_size=1")
        ready_payload = api_data(ready_response)
        self.assertEqual(ready_response.status_code, 200)
        self.assertEqual(ready_payload["total"], 1)
        self.assertEqual([item["id"] for item in ready_payload["items"]], [ready_house.pk])
        self.assertFalse(blocked_payload["items"][0]["publish_can_publish"])
        self.assertEqual(blocked_payload["items"][0]["publish_blocking_issues"], ["缺房东"])
        self.assertEqual(blocked_payload["items"][0]["publish_warning_issues"], ["缺封面", "图片不足", "缺户型图"])
        self.assertTrue(ready_payload["items"][0]["publish_can_publish"])
        self.assertEqual(ready_payload["items"][0]["publish_blocking_issues"], [])

    def test_list_houses_respects_org_publish_rules_for_blocking_vs_warning(self):
        landlord = Contact.objects.create(organization=self.org, name="发布房东", phone="13800138666", roles=[Contact.Role.LANDLORD])
        setting = DefaultSetting.objects.create(
            key="property_rental.publish_rules",
            value={
                "landlord": {"mode": "required", "label": "房东主体"},
                "rent": {"mode": "required", "label": "租金"},
                "cover": {"mode": "warn", "label": "封面图"},
                "images": {"mode": "warn", "label": "房源图片", "min_count": 3},
                "floor_plan": {"mode": "warn", "label": "户型图"},
                "video": {"mode": "off", "label": "视频", "min_count": 1},
            },
            value_type="json",
            category="property_rental",
        )
        OrganizationSetting.objects.create(
            organization=self.org,
            setting=setting,
            value={
                "landlord": {"mode": "required"},
                "rent": {"mode": "required"},
                "cover": {"mode": "warn"},
                "images": {"mode": "warn", "min_count": 3},
                "floor_plan": {"mode": "warn"},
                "video": {"mode": "off", "min_count": 1},
            },
        )
        media_index = 0

        def image_ref(role):
            nonlocal media_index
            media_index += 1
            media = register_media_file(
                uploader=self.user,
                oss_path=f"uploads/orgs/{self.org.pk}/publish-rules-{media_index}.jpg",
                original_filename=f"publish-rules-{media_index}.jpg",
                resource_type=ResourceType.HOUSE_IMAGE,
                file_size=100,
            )
            return {"media_id": media.pk, "media_type": MediaType.IMAGE, "image_role": role}

        warning_only_house = House.objects.create(
            building=self.building,
            landlord=landlord,
            room_number="1901",
            asking_rent=Decimal("6200.00"),
            images=[image_ref("bedroom")],
        )
        blocked_house = House.objects.create(
            building=self.building,
            landlord=landlord,
            room_number="1902",
            asking_rent=None,
            images=[image_ref("cover"), image_ref("floor_plan"), image_ref("bedroom")],
        )

        blocked_response = self.client.get("/api/house/houses/?publish_blocked=true")
        blocked_payload = api_data(blocked_response)
        ready_response = self.client.get("/api/house/houses/?publish_ready=true")
        ready_payload = api_data(ready_response)

        self.assertEqual([item["id"] for item in blocked_payload["items"]], [blocked_house.pk])
        self.assertEqual(blocked_payload["items"][0]["publish_blocking_issues"], ["缺租金"])
        self.assertEqual([item["id"] for item in ready_payload["items"]], [warning_only_house.pk])
        self.assertTrue(ready_payload["items"][0]["publish_can_publish"])
        self.assertEqual(ready_payload["items"][0]["publish_warning_issues"], ["缺封面", "图片不足", "缺户型图"])

    def test_admin_list_responses_include_display_labels(self):
        landlord = Contact.objects.create(organization=self.org, name="展示房东", phone="13800138001", roles=[Contact.Role.LANDLORD])
        tenant = Contact.objects.create(organization=self.org, name="展示租客", phone="13900139001", roles=[Contact.Role.TENANT])
        house = House.objects.create(building=self.building, landlord=landlord, room_number="1801")
        viewing = ViewingRecord.objects.create(
            organization=self.org,
            house=house,
            contact=tenant,
            customer_name="展示客户",
            customer_phone="13900139001",
            scheduled_at=timezone.now(),
            status=ViewingRecord.Status.CONVERTED,
        )
        Lease.objects.create(
            organization=self.org,
            house=house,
            tenant=tenant,
            source_viewing_record=viewing,
            start_date=date.today(),
            end_date=date.today() + timedelta(days=365),
            monthly_rent=Decimal("4200.00"),
        )

        building_payload = api_data(self.client.get("/api/house/buildings/"))["items"][0]
        house_payload = api_data(self.client.get("/api/house/houses/?keyword=1801"))["items"][0]
        viewing_payload = api_data(self.client.get("/api/house/viewing-records/?status=converted"))["items"][0]
        lease_payload = api_data(self.client.get("/api/house/leases/"))["items"][0]

        self.assertEqual(building_payload["estate_name"], "云岸")
        self.assertEqual(house_payload["estate_name"], "云岸")
        self.assertEqual(house_payload["building_name"], "1栋")
        self.assertEqual(house_payload["house_label"], "云岸 / 1栋 / 1801")
        self.assertEqual(house_payload["landlord_name"], "展示房东")
        self.assertEqual(house_payload["landlord_phone"], "+8613800138001")
        self.assertEqual(viewing_payload["house_label"], "云岸 / 1栋 / 1801")
        self.assertEqual(viewing_payload["contact_name"], "展示租客")
        self.assertEqual(viewing_payload["contact_phone"], "+8613900139001")
        self.assertEqual(viewing_payload["signed_lease_id"], lease_payload["id"])
        self.assertEqual(lease_payload["house_label"], "云岸 / 1栋 / 1801")
        self.assertEqual(lease_payload["tenant_name"], "展示租客")
        self.assertEqual(lease_payload["tenant_phone"], "+8613900139001")
        self.assertEqual(lease_payload["source_viewing_record_label"], "展示客户 / 13900139001")

    def test_list_buildings_searches_estate_names(self):
        Building.objects.create(organization=self.org, estate=self.estate, name="2栋", floors=18)
        other_estate = Estate.objects.create(
            organization=self.org,
            name="海风里",
            display_name="海风里花园",
            property_type=Estate.PropertyType.RESIDENTIAL,
            province="广东",
            city="深圳",
            district="南山",
            address="后海",
        )
        other_building = Building.objects.create(organization=self.org, estate=other_estate, name="3栋", floors=16)
        self.make_other_org_house()

        response = self.client.get("/api/house/buildings/?keyword=海风里花园")
        payload = api_data(response)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(payload["total"], 1)
        self.assertEqual([item["id"] for item in payload["items"]], [other_building.pk])

    def test_list_leases_filters_contract_missing_before_pagination(self):
        landlord = Contact.objects.create(organization=self.org, name="合同房东", phone="13800138667", roles=[Contact.Role.LANDLORD])
        tenant = Contact.objects.create(organization=self.org, name="合同租客", phone="13900139667", roles=[Contact.Role.TENANT])
        missing_contract_house = House.objects.create(building=self.building, landlord=landlord, room_number="1901")
        with_contract_house = House.objects.create(building=self.building, landlord=landlord, room_number="1902")
        contract = register_media_file(
            uploader=self.user,
            oss_path=f"uploads/orgs/{self.org.pk}/lease-contract.pdf",
            original_filename="lease-contract.pdf",
            resource_type=ResourceType.LEASE_CONTRACT,
            file_size=100,
        )
        missing_contract = Lease.objects.create(
            organization=self.org,
            house=missing_contract_house,
            tenant=tenant,
            start_date=date.today(),
            end_date=date.today() + timedelta(days=365),
            monthly_rent=Decimal("4200.00"),
        )
        Lease.objects.create(
            organization=self.org,
            house=with_contract_house,
            tenant=tenant,
            start_date=date.today() + timedelta(days=1),
            end_date=date.today() + timedelta(days=366),
            monthly_rent=Decimal("4300.00"),
            contract_files=[{"media_id": contract.pk, "media_type": MediaType.FILE}],
        )

        response = self.client.get("/api/house/leases/?contract_missing=true&page=1&page_size=1")
        payload = api_data(response)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(payload["total"], 1)
        self.assertEqual([item["id"] for item in payload["items"]], [missing_contract.pk])

    def test_list_viewing_records_filters_pending_lease_before_pagination(self):
        landlord = Contact.objects.create(organization=self.org, name="待签房东", phone="13800138670", roles=[Contact.Role.LANDLORD])
        tenant = Contact.objects.create(organization=self.org, name="待签租客", phone="13900139670", roles=[Contact.Role.TENANT])
        house = House.objects.create(building=self.building, landlord=landlord, room_number="1903")
        pending_viewing = ViewingRecord.objects.create(
            organization=self.org,
            house=house,
            contact=tenant,
            customer_name="待签客户",
            customer_phone="13900139670",
            scheduled_at=timezone.now(),
            status=ViewingRecord.Status.CONVERTED,
        )
        signed_viewing = ViewingRecord.objects.create(
            organization=self.org,
            house=house,
            contact=tenant,
            customer_name="已签客户",
            customer_phone="13900139671",
            scheduled_at=timezone.now() + timedelta(hours=1),
            status=ViewingRecord.Status.CONVERTED,
        )
        ViewingRecord.objects.create(
            organization=self.org,
            house=house,
            contact=tenant,
            customer_name="已看客户",
            customer_phone="13900139672",
            scheduled_at=timezone.now() + timedelta(hours=2),
            status=ViewingRecord.Status.VIEWED,
        )
        Lease.objects.create(
            organization=self.org,
            house=house,
            tenant=tenant,
            source_viewing_record=signed_viewing,
            start_date=date.today(),
            end_date=date.today() + timedelta(days=365),
            monthly_rent=Decimal("4200.00"),
        )

        response = self.client.get("/api/house/viewing-records/?pending_lease=true&page=1&page_size=1")
        payload = api_data(response)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(payload["total"], 1)
        self.assertEqual([item["id"] for item in payload["items"]], [pending_viewing.pk])

    def test_list_viewing_records_filters_contact_missing_before_pagination(self):
        landlord = Contact.objects.create(organization=self.org, name="补主体房东", phone="13800138671", roles=[Contact.Role.LANDLORD])
        tenant = Contact.objects.create(organization=self.org, name="已绑租客", phone="13900139671", roles=[Contact.Role.TENANT])
        house = House.objects.create(building=self.building, landlord=landlord, room_number="1904")
        missing_contact_viewing = ViewingRecord.objects.create(
            organization=self.org,
            house=house,
            customer_name="未绑客户",
            customer_phone="13900139680",
            scheduled_at=timezone.now(),
            status=ViewingRecord.Status.CONVERTED,
        )
        ready_viewing = ViewingRecord.objects.create(
            organization=self.org,
            house=house,
            contact=tenant,
            customer_name="已绑客户",
            customer_phone="13900139681",
            scheduled_at=timezone.now() + timedelta(hours=1),
            status=ViewingRecord.Status.CONVERTED,
        )
        ViewingRecord.objects.create(
            organization=self.org,
            house=house,
            customer_name="普通预约客户",
            customer_phone="13900139682",
            scheduled_at=timezone.now() + timedelta(hours=2),
            status=ViewingRecord.Status.SCHEDULED,
        )

        missing_response = self.client.get("/api/house/viewing-records/?pending_lease=true&contact_missing=true&page=1&page_size=1")
        missing_payload = api_data(missing_response)

        self.assertEqual(missing_response.status_code, 200)
        self.assertEqual(missing_payload["total"], 1)
        self.assertEqual([item["id"] for item in missing_payload["items"]], [missing_contact_viewing.pk])

        ready_response = self.client.get("/api/house/viewing-records/?pending_lease=true&contact_missing=false&page=1&page_size=1")
        ready_payload = api_data(ready_response)

        self.assertEqual(ready_response.status_code, 200)
        self.assertEqual(ready_payload["total"], 1)
        self.assertEqual([item["id"] for item in ready_payload["items"]], [ready_viewing.pk])

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

    def test_list_contacts_filters_by_task_before_pagination(self):
        active_landlord = Contact.objects.create(organization=self.org, name="正常房东", phone="13800138556", roles=[Contact.Role.LANDLORD], is_active=True)
        inactive_contact = Contact.objects.create(organization=self.org, name="停用联系人", phone="13800138557", roles=[Contact.Role.LANDLORD], is_active=False)
        dual_role_contact = Contact.objects.create(
            organization=self.org,
            name="双角色联系人",
            phone="13800138558",
            roles=[Contact.Role.LANDLORD, Contact.Role.TENANT],
            is_active=True,
        )
        role_missing_contact = Contact.objects.create(organization=self.org, name="缺角色联系人", phone="13800138559", roles=[], is_active=True)
        self.make_other_org_house()

        expected = {
            "inactive": inactive_contact.pk,
            "dual_role": dual_role_contact.pk,
            "role_missing": role_missing_contact.pk,
        }
        for task, contact_id in expected.items():
            with self.subTest(task=task):
                response = self.client.get(f"/api/house/contacts/?task={task}&page=1&page_size=1")
                payload = api_data(response)

                self.assertEqual(response.status_code, 200)
                self.assertEqual(payload["total"], 1)
                self.assertEqual([item["id"] for item in payload["items"]], [contact_id])

        active_response = self.client.get("/api/house/contacts/?role=landlord&page=1&page_size=10")
        active_payload = api_data(active_response)
        landlord_ids = {item["id"] for item in active_payload["items"]}
        self.assertIn(active_landlord.pk, landlord_ids)
        self.assertIn(inactive_contact.pk, landlord_ids)
        self.assertIn(dual_role_contact.pk, landlord_ids)
        self.assertNotIn(role_missing_contact.pk, landlord_ids)

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

    def test_create_lease_rejects_duplicate_source_viewing_record(self):
        landlord = Contact.objects.create(organization=self.org, name="重复来源房东", phone="13800138671", roles=[Contact.Role.LANDLORD])
        tenant = Contact.objects.create(organization=self.org, name="重复来源租客", phone="13900139671", roles=[Contact.Role.TENANT])
        house = House.objects.create(building=self.building, landlord=landlord, room_number="1511")
        viewing = ViewingRecord.objects.create(
            organization=self.org,
            house=house,
            contact=tenant,
            customer_name="重复来源客户",
            customer_phone="13900139671",
            scheduled_at="2026-07-01T10:00:00+08:00",
            status=ViewingRecord.Status.CONVERTED,
        )
        Lease.objects.create(
            organization=self.org,
            house=house,
            tenant=tenant,
            source_viewing_record=viewing,
            start_date=date.today(),
            end_date=date.today() + timedelta(days=365),
            monthly_rent=Decimal("4200"),
        )

        response = self.client.post(
            "/api/house/leases/",
            data=json.dumps(
                {
                    "house_id": house.pk,
                    "tenant_id": tenant.pk,
                    "source_viewing_record_id": viewing.pk,
                    "start_date": str(date.today()),
                    "end_date": str(date.today() + timedelta(days=180)),
                    "monthly_rent": "4300",
                }
            ),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(api_error(response)["error"], "VALIDATION_ERROR")
        self.assertIn("source_viewing_record", api_error(response)["data"]["fields"])

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
