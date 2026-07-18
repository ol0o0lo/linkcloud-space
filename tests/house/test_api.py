import json
from datetime import date, timedelta
from decimal import Decimal
from unittest.mock import patch

from django.contrib.auth import user_logged_in
from django.db import IntegrityError
from django.db.models import Q
from django.test import TestCase
from django.utils import timezone

from model_bakery import baker

from apps.accounts.models import User
from apps.house import services as house_services
from apps.house.constants import ContactRole, EstatePropertyType, HouseDecoration, HouseOrientation, HouseStatus, LeaseStatus, ViewingRecordStatus
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
            organization=self.org, name="云岸", display_name="云岸", property_type=EstatePropertyType.RESIDENTIAL, province="广东", city="深圳", district="南山", address="科技园"
        )
        self.building = Building.objects.create(organization=self.org, estate=self.estate, name="1栋", address="科技园 1 栋", floors=20)

    def make_other_org_house(self):
        other_org = baker.make("organizations.Organization", name="其他房源 API 组织", slug="other-house-api-org")
        other_estate = Estate.objects.create(
            organization=other_org,
            name="异租户项目",
            display_name="异租户项目",
            property_type=EstatePropertyType.RESIDENTIAL,
            province="广东",
            city="深圳",
            district="福田",
            address="车公庙",
        )
        other_building = Building.objects.create(organization=other_org, estate=other_estate, name="2栋", address="车公庙 2 栋", floors=10)
        other_landlord = Contact.objects.create(organization=other_org, name="异租户房东", phone="13800138222", roles=[ContactRole.LANDLORD])
        other_tenant = Contact.objects.create(organization=other_org, name="异租户租客", phone="13900139222", roles=[ContactRole.TENANT])
        other_house = House.objects.create(building=other_building, landlord=other_landlord, room_number="201")
        return other_org, other_house, other_landlord, other_tenant

    def make_standalone_house(self, **house_kwargs):
        building = Building.objects.create(organization=self.org, estate=None, name="海滨公寓", address="海滨路 20 号", floors=8)
        return House.objects.create(building=building, room_number="801", **house_kwargs)

    def test_tag_suggestions_use_system_default_only_and_normalize_values(self):
        setting = DefaultSetting.objects.create(
            key=house_services.TAG_SUGGESTIONS_SETTING_KEY,
            value=[" 近地铁 ", "近地铁", "南北   通透", 1, ""],
            value_type="json",
            widget="tags",
            ui={"scopes": ["system"]},
        )
        OrganizationSetting.objects.create(organization=self.org, setting=setting, value=["组织覆盖标签"])

        response = self.client.get("/api/house/tag-suggestions/")
        org_settings_response = self.client.get("/api/settings/org/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(api_data(response), {"tags": ["近地铁", "南北 通透"]})
        self.assertNotIn(house_services.TAG_SUGGESTIONS_SETTING_KEY, {item["key"] for item in api_data(org_settings_response)})

    def test_estate_delete_check_reports_building_preview(self):
        empty_estate = Estate.objects.create(
            organization=self.org,
            name="空项目",
            display_name="空项目",
            province="广东",
            city="深圳",
            district="南山",
        )
        empty_response = self.client.get(f"/api/house/estates/{empty_estate.pk}/delete-check/")

        self.assertEqual(empty_response.status_code, 200)
        self.assertEqual(api_data(empty_response), {"can_delete": True, "resources": []})

        buildings = [
            Building.objects.create(
                organization=self.org,
                estate=self.estate,
                name=f"{index}栋",
                address=f"科技南路 {index} 栋",
                floors=20,
            )
            for index in range(2, 8)
        ]
        response = self.client.get(f"/api/house/estates/{self.estate.pk}/delete-check/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            api_data(response),
            {
                "can_delete": False,
                "resources": [
                    {
                        "type": "building",
                        "label": "关联楼栋",
                        "count": 7,
                        "items": [
                            {"id": self.building.pk, "label": "1栋 · 科技园 1 栋"},
                            {"id": buildings[0].pk, "label": "2栋 · 科技南路 2 栋"},
                            {"id": buildings[1].pk, "label": "3栋 · 科技南路 3 栋"},
                            {"id": buildings[2].pk, "label": "4栋 · 科技南路 4 栋"},
                            {"id": buildings[3].pk, "label": "5栋 · 科技南路 5 栋"},
                        ],
                        "truncated": True,
                        "target": {
                            "path": "/property-rental/estates",
                            "query": {"view": "buildings", "estate_id": self.estate.pk},
                        },
                    }
                ],
            },
        )

    def test_building_delete_check_reports_house_preview(self):
        empty_building = Building.objects.create(organization=self.org, estate=self.estate, name="空楼栋", address="科技园空楼栋", floors=8)
        empty_response = self.client.get(f"/api/house/buildings/{empty_building.pk}/delete-check/")

        self.assertEqual(empty_response.status_code, 200)
        self.assertEqual(api_data(empty_response), {"can_delete": True, "resources": []})

        houses = [House.objects.create(building=self.building, room_number=f"{index:02d}") for index in range(1, 7)]
        response = self.client.get(f"/api/house/buildings/{self.building.pk}/delete-check/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            api_data(response),
            {
                "can_delete": False,
                "resources": [
                    {
                        "type": "house",
                        "label": "关联房源",
                        "count": 6,
                        "items": [{"id": house.pk, "label": f"1栋 / {house.room_number}"} for house in houses[:5]],
                        "truncated": True,
                        "target": {"path": "/property-rental/houses", "query": {"building_id": self.building.pk}},
                    }
                ],
            },
        )

    def test_delete_checks_hide_resources_outside_current_org(self):
        _other_org, other_house, _other_landlord, _other_tenant = self.make_other_org_house()

        estate_response = self.client.get(f"/api/house/estates/{other_house.building.estate_id}/delete-check/")
        building_response = self.client.get(f"/api/house/buildings/{other_house.building_id}/delete-check/")

        self.assertEqual(estate_response.status_code, 404)
        self.assertEqual(building_response.status_code, 404)

    def test_delete_empty_estate_returns_deleted_id(self):
        estate = Estate.objects.create(
            organization=self.org,
            name="待删除项目",
            display_name="待删除项目",
            province="广东",
            city="深圳",
            district="南山",
        )

        response = self.client.delete(f"/api/house/estates/{estate.pk}/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(api_data(response), {"deleted": estate.pk})
        self.assertFalse(Estate.objects.filter(pk=estate.pk).exists())

    def test_delete_empty_standalone_building_returns_deleted_id(self):
        building = Building.objects.create(organization=self.org, estate=None, name="待删除独立楼栋", address="海滨路 30 号", floors=8)

        response = self.client.delete(f"/api/house/buildings/{building.pk}/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(api_data(response), {"deleted": building.pk})
        self.assertFalse(Building.objects.filter(pk=building.pk).exists())

    def test_delete_estate_with_buildings_returns_resource_in_use_check(self):
        response = self.client.delete(f"/api/house/estates/{self.estate.pk}/")

        self.assertEqual(response.status_code, 409)
        error = api_error(response)
        self.assertEqual(error["error"], "RESOURCE_IN_USE")
        self.assertFalse(error["data"]["can_delete"])
        self.assertEqual(error["data"]["resources"][0]["type"], "building")
        self.assertEqual(error["data"]["resources"][0]["items"][0]["id"], self.building.pk)
        self.assertTrue(Estate.objects.filter(pk=self.estate.pk).exists())
        self.assertTrue(Building.objects.filter(pk=self.building.pk).exists())

    def test_delete_estate_translates_integrity_error_to_resource_in_use_check(self):
        fresh_check = house_services.get_estate_delete_check(self.estate)

        with (
            patch.object(house_services, "get_estate_delete_check", side_effect=[{"can_delete": True, "resources": []}, fresh_check]),
            patch.object(Estate, "delete", side_effect=IntegrityError),
        ):
            response = self.client.delete(f"/api/house/estates/{self.estate.pk}/")

        self.assertEqual(response.status_code, 409)
        error = api_error(response)
        self.assertEqual(error["error"], "RESOURCE_IN_USE")
        self.assertEqual(error["data"]["resources"][0]["type"], "building")
        self.assertEqual(error["data"]["resources"][0]["items"][0]["id"], self.building.pk)

    def test_delete_building_with_houses_returns_resource_in_use_check(self):
        house = House.objects.create(building=self.building, room_number="1001")

        response = self.client.delete(f"/api/house/buildings/{self.building.pk}/")

        self.assertEqual(response.status_code, 409)
        error = api_error(response)
        self.assertEqual(error["error"], "RESOURCE_IN_USE")
        self.assertFalse(error["data"]["can_delete"])
        self.assertEqual(error["data"]["resources"][0]["type"], "house")
        self.assertEqual(error["data"]["resources"][0]["items"][0]["id"], house.pk)
        self.assertTrue(Building.objects.filter(pk=self.building.pk).exists())
        self.assertTrue(House.objects.filter(pk=house.pk).exists())

    def test_delete_estate_rechecks_resources_created_after_delete_check(self):
        estate = Estate.objects.create(
            organization=self.org,
            name="竞态项目",
            display_name="竞态项目",
            province="广东",
            city="深圳",
            district="南山",
        )
        self.assertEqual(api_data(self.client.get(f"/api/house/estates/{estate.pk}/delete-check/")), {"can_delete": True, "resources": []})
        building = Building.objects.create(organization=self.org, estate=estate, name="竞态楼栋", address="科技园竞态楼栋", floors=8)

        response = self.client.delete(f"/api/house/estates/{estate.pk}/")

        self.assertEqual(response.status_code, 409)
        self.assertEqual(api_error(response)["data"]["resources"][0]["items"][0]["id"], building.pk)
        self.assertTrue(Estate.objects.filter(pk=estate.pk).exists())
        self.assertTrue(Building.objects.filter(pk=building.pk).exists())

    def test_delete_building_rechecks_resources_created_after_delete_check(self):
        building = Building.objects.create(organization=self.org, estate=None, name="竞态独立楼栋", address="海滨路 40 号", floors=8)
        self.assertEqual(api_data(self.client.get(f"/api/house/buildings/{building.pk}/delete-check/")), {"can_delete": True, "resources": []})
        house = House.objects.create(building=building, room_number="901")

        response = self.client.delete(f"/api/house/buildings/{building.pk}/")

        self.assertEqual(response.status_code, 409)
        self.assertEqual(api_error(response)["data"]["resources"][0]["items"][0]["id"], house.pk)
        self.assertTrue(Building.objects.filter(pk=building.pk).exists())
        self.assertTrue(House.objects.filter(pk=house.pk).exists())

    def test_delete_resources_outside_current_org_returns_404(self):
        _other_org, other_house, _other_landlord, _other_tenant = self.make_other_org_house()

        estate_response = self.client.delete(f"/api/house/estates/{other_house.building.estate_id}/")
        building_response = self.client.delete(f"/api/house/buildings/{other_house.building_id}/")

        self.assertEqual(estate_response.status_code, 404)
        self.assertEqual(building_response.status_code, 404)

    def test_standalone_house_list_detail_and_tenant_boundary(self):
        house = self.make_standalone_house()

        list_response = self.client.get("/api/house/houses/")
        detail_response = self.client.get(f"/api/house/houses/{house.pk}/")

        self.assertEqual(list_response.status_code, 200)
        item = next(item for item in api_data(list_response)["items"] if item["id"] == house.pk)
        self.assertEqual(item["building"]["estate_id"], None)
        self.assertEqual(item["building"]["estate"], None)
        self.assertEqual(item["building"]["address"], "海滨路 20 号")
        self.assertEqual(item["building"]["name"], "海滨公寓")
        self.assertEqual(detail_response.status_code, 200)

        other_org = baker.make("organizations.Organization", name="其他上下文", slug="other-context")
        baker.make("organizations.OrganizationMember", organization=other_org, user=self.user, is_owner=True)
        session = self.client.session
        session["organization_data"] = json.dumps({"pk": other_org.pk, "id": other_org.pk, "name": other_org.name, "slug": other_org.slug, "is_owner": True})
        session.save()

        self.assertNotIn(house.pk, {item["id"] for item in api_data(self.client.get("/api/house/houses/"))["items"]})
        self.assertEqual(self.client.get(f"/api/house/houses/{house.pk}/").status_code, 404)

    def test_house_summary_labels_support_estate_and_standalone_buildings(self):
        estate_house = House.objects.create(building=self.building, room_number="1801")
        standalone_house = self.make_standalone_house()
        ViewingRecord.objects.create(organization=self.org, house=estate_house, customer_name="小区客户", customer_phone="13900139811", scheduled_at=timezone.now())
        ViewingRecord.objects.create(organization=self.org, house=standalone_house, customer_name="独立客户", customer_phone="13900139812", scheduled_at=timezone.now())

        payload = api_data(self.client.get("/api/house/viewing-records/"))["items"]
        labels = {item["house"]["id"]: item["house"]["label"] for item in payload}

        self.assertEqual(labels[estate_house.pk], "云岸 / 1栋 / 1801")
        self.assertEqual(labels[standalone_house.pk], "海滨公寓 · 海滨路 20 号 / 801")

    def test_viewing_and_lease_keyword_search_support_standalone_building(self):
        landlord = Contact.objects.create(organization=self.org, name="独立房东", phone="13800138801", roles=[ContactRole.LANDLORD])
        tenant = Contact.objects.create(organization=self.org, name="独立租客", phone="13900139801", roles=[ContactRole.TENANT])
        house = self.make_standalone_house(landlord=landlord)
        viewing = ViewingRecord.objects.create(
            organization=self.org,
            house=house,
            contact=tenant,
            customer_name="独立客户",
            customer_phone="13900139801",
            scheduled_at=timezone.now(),
        )
        lease = Lease.objects.create(
            organization=self.org,
            house=house,
            tenant=tenant,
            start_date=date.today(),
            end_date=date.today() + timedelta(days=365),
            monthly_rent=Decimal("4200"),
        )

        for keyword in ("海滨公寓", "801"):
            viewing_items = api_data(self.client.get(f"/api/house/viewing-records/?keyword={keyword}"))["items"]
            lease_items = api_data(self.client.get(f"/api/house/leases/?keyword={keyword}"))["items"]
            self.assertEqual([item["id"] for item in viewing_items], [viewing.pk])
            self.assertEqual([item["id"] for item in lease_items], [lease.pk])

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
                    "property_type": EstatePropertyType.RESIDENTIAL,
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
        self.assertNotIn("publish_status", HouseIn.model_fields)
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
                    "status": HouseStatus.INACTIVE,
                    "publish_status": "published",
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
        payload = api_data(response)
        self.assertIsNone(payload["landlord_id"])
        self.assertIsNone(payload["landlord"])
        house = House.objects.get(pk=payload["id"])
        self.assertEqual(house.status, HouseStatus.VACANT)
        self.assertNotIn("publish_status", payload)
        self.assertNotIn("is_active", payload)
        self.assertEqual(house.extra, {})
        self.assertEqual(house.internal_notes, "")

    def test_create_and_patch_house_listing_status(self):
        landlord = Contact.objects.create(organization=self.org, name="挂牌房东", phone="13800138601", roles=[ContactRole.LANDLORD])
        response = self.client.post(
            "/api/house/houses/",
            data=json.dumps(
                {
                    "building_id": self.building.pk,
                    "landlord_id": landlord.pk,
                    "room_number": "1601",
                    "asking_rent": "4200.00",
                    "deposit_amount": "4200.00",
                }
            ),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 201)
        payload = api_data(response)
        self.assertEqual(payload["status"], HouseStatus.VACANT)
        self.assertEqual(payload["asking_rent"], "4200.00")
        self.assertEqual(payload["deposit_amount"], "4200.00")

        patched = self.client.patch(
            f"/api/house/houses/{payload['id']}/",
            data=json.dumps({"status": HouseStatus.LISTED, "asking_rent": "4300.00"}),
            content_type="application/json",
        )

        self.assertEqual(patched.status_code, 200)
        patched_payload = api_data(patched)
        self.assertEqual(patched_payload["status"], HouseStatus.LISTED)
        self.assertEqual(patched_payload["asking_rent"], "4300.00")

    def test_listing_status_requires_publishable_house(self):
        house = House.objects.create(building=self.building, room_number="1601A")

        response = self.client.patch(
            f"/api/house/houses/{house.pk}/",
            data=json.dumps({"status": HouseStatus.LISTED}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 422)
        house.refresh_from_db()
        self.assertEqual(house.status, HouseStatus.VACANT)

    def test_listed_house_can_update_regular_fields_without_revalidating_publish_rules(self):
        house = House.objects.create(building=self.building, room_number="1601B", status=HouseStatus.LISTED)

        response = self.client.patch(
            f"/api/house/houses/{house.pk}/",
            data=json.dumps({"internal_notes": "补充内部备注"}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        house.refresh_from_db()
        self.assertEqual(house.status, HouseStatus.LISTED)
        self.assertEqual(house.internal_notes, "补充内部备注")

    def test_building_tags_are_inherited_after_house_tags_in_api_responses(self):
        house_response = self.client.post(
            "/api/house/houses/",
            data=json.dumps({"building_id": self.building.pk, "room_number": "1602", "tags": ["采光好", "近地铁"]}),
            content_type="application/json",
        )
        building_response = self.client.patch(
            f"/api/house/buildings/{self.building.pk}/",
            data=json.dumps({"tags": ["近地铁", "安静", "成熟配套"]}),
            content_type="application/json",
        )
        detail_response = self.client.get(f"/api/house/houses/{api_data(house_response)['id']}/")
        list_response = self.client.get("/api/house/houses/?page=1&page_size=100")

        self.assertEqual(house_response.status_code, 201)
        house_payload = api_data(house_response)
        self.assertEqual(house_payload["tags"], ["采光好", "近地铁"])
        self.assertEqual(house_payload["effective_tags"], ["采光好", "近地铁"])
        self.assertEqual(building_response.status_code, 200)
        self.assertEqual(api_data(building_response)["tags"], ["近地铁", "安静", "成熟配套"])
        self.assertEqual(detail_response.status_code, 200)
        detail_payload = api_data(detail_response)
        self.assertEqual(detail_payload["tags"], ["采光好", "近地铁"])
        self.assertEqual(detail_payload["effective_tags"], ["采光好", "近地铁", "安静", "成熟配套"])
        list_item = next(item for item in api_data(list_response)["items"] if item["id"] == house_payload["id"])
        self.assertEqual(list_item["effective_tags"], ["采光好", "近地铁", "安静", "成熟配套"])

    def test_list_houses_filters_by_unified_status(self):
        vacant_house = House.objects.create(building=self.building, room_number="1701")
        listed_house = House.objects.create(building=self.building, room_number="1702", status=HouseStatus.LISTED)

        response = self.client.get(f"/api/house/houses/?status={HouseStatus.LISTED}")

        self.assertEqual(response.status_code, 200)
        ids = {item["id"] for item in api_data(response)["items"]}
        self.assertIn(listed_house.pk, ids)
        self.assertNotIn(vacant_house.pk, ids)

    def test_list_houses_filters_by_estate_before_pagination(self):
        House.objects.create(building=self.building, room_number="1701")
        other_estate = Estate.objects.create(
            organization=self.org,
            name="海风里",
            display_name="海风里花园",
            property_type=EstatePropertyType.RESIDENTIAL,
            province="广东",
            city="深圳",
            district="南山",
            address="后海",
        )
        other_building = Building.objects.create(organization=self.org, estate=other_estate, name="3栋", address="后海 3 栋", floors=16)
        other_house = House.objects.create(building=other_building, room_number="1801")
        self.make_other_org_house()

        response = self.client.get(f"/api/house/houses/?estate_id={other_estate.pk}&page=1&page_size=1")
        payload = api_data(response)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(payload["total"], 1)
        self.assertEqual([item["id"] for item in payload["items"]], [other_house.pk])

    def test_admin_list_responses_include_display_labels(self):
        landlord = Contact.objects.create(organization=self.org, name="展示房东", phone="13800138001", roles=[ContactRole.LANDLORD])
        tenant = Contact.objects.create(organization=self.org, name="展示租客", phone="13900139001", roles=[ContactRole.TENANT])
        house = House.objects.create(
            building=self.building,
            landlord=landlord,
            room_number="1801",
            orientation=HouseOrientation.SOUTH_NORTH,
            decoration=HouseDecoration.FINE,
        )
        viewing = ViewingRecord.objects.create(
            organization=self.org,
            house=house,
            contact=tenant,
            customer_name="展示客户",
            customer_phone="13900139001",
            scheduled_at=timezone.now(),
            status=ViewingRecordStatus.CONVERTED,
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

        estate_payload = api_data(self.client.get("/api/house/estates/"))["items"][0]
        contact_payload = api_data(self.client.get("/api/house/contacts/?keyword=展示房东"))["items"][0]
        building_payload = api_data(self.client.get("/api/house/buildings/"))["items"][0]
        house_payload = api_data(self.client.get("/api/house/houses/?keyword=1801"))["items"][0]
        landlord_house_payload = api_data(self.client.get("/api/house/houses/?keyword=展示房东"))["items"][0]
        building_house_payload = api_data(self.client.get("/api/house/houses/?keyword=1栋"))["items"][0]
        viewing_payload = api_data(self.client.get("/api/house/viewing-records/?status=converted"))["items"][0]
        lease_payload = api_data(self.client.get("/api/house/leases/"))["items"][0]
        expected_house_label = f"{self.estate.display_name or self.estate.name} / {self.building.name} / {house.room_number}"

        self.assertEqual(estate_payload["property_type__mapping"], EstatePropertyType.get_choice_label(estate_payload["property_type"]))
        self.assertEqual(contact_payload["roles__mapping"], [ContactRole.get_choice_label(ContactRole.LANDLORD)])
        self.assertEqual(building_payload["estate_id"], self.estate.pk)
        self.assertEqual(building_payload["estate"]["id"], self.estate.pk)
        self.assertEqual(building_payload["estate"]["display_name"], "云岸")
        self.assertNotIn("estate_name", building_payload)
        self.assertEqual(house_payload["building_id"], self.building.pk)
        self.assertEqual(house_payload["building"]["id"], self.building.pk)
        self.assertEqual(house_payload["building"]["name"], "1栋")
        self.assertEqual(house_payload["building"]["estate"]["id"], self.estate.pk)
        self.assertEqual(house_payload["building"]["estate"]["display_name"], "云岸")
        self.assertEqual(house_payload["landlord_id"], landlord.pk)
        self.assertEqual(house_payload["landlord"]["id"], landlord.pk)
        self.assertEqual(house_payload["landlord"]["name"], "展示房东")
        self.assertEqual(house_payload["landlord"]["phone"], "+8613800138001")
        self.assertNotIn("building_name", house_payload)
        self.assertNotIn("estate_name", house_payload)
        self.assertNotIn("landlord_name", house_payload)
        self.assertNotIn("landlord_phone", house_payload)
        self.assertNotIn("house_label", house_payload)
        self.assertEqual(landlord_house_payload["id"], house.pk)
        self.assertEqual(building_house_payload["id"], house.pk)
        self.assertNotIn("publish_rule_snapshot", house_payload)
        self.assertNotIn("publish_can_publish", house_payload)
        self.assertNotIn("publish_blocking_issues", house_payload)
        self.assertNotIn("publish_warning_issues", house_payload)
        self.assertEqual(house_payload["orientation__mapping"], HouseOrientation.get_choice_label(house_payload["orientation"]))
        self.assertEqual(house_payload["decoration__mapping"], HouseDecoration.get_choice_label(house_payload["decoration"]))
        self.assertEqual(house_payload["status__mapping"], HouseStatus.get_choice_label(house_payload["status"]))
        self.assertNotIn("publish_status", house_payload)
        self.assertNotIn("is_active", house_payload)
        self.assertEqual(viewing_payload["house_id"], house.pk)
        self.assertEqual(viewing_payload["house"]["id"], house.pk)
        self.assertEqual(viewing_payload["house"]["label"], expected_house_label)
        self.assertEqual(viewing_payload["house"]["building"]["estate"]["id"], self.estate.pk)
        self.assertEqual(viewing_payload["contact_id"], tenant.pk)
        self.assertEqual(viewing_payload["contact"]["id"], tenant.pk)
        self.assertEqual(viewing_payload["contact"]["name"], "展示租客")
        self.assertEqual(viewing_payload["contact"]["phone"], "+8613900139001")
        self.assertNotIn("house_label", viewing_payload)
        self.assertNotIn("contact_name", viewing_payload)
        self.assertNotIn("contact_phone", viewing_payload)
        self.assertEqual(viewing_payload["status__mapping"], ViewingRecordStatus.get_choice_label(viewing_payload["status"]))
        self.assertEqual(viewing_payload["signed_lease_id"], lease_payload["id"])
        self.assertEqual(lease_payload["house_id"], house.pk)
        self.assertEqual(lease_payload["house"]["id"], house.pk)
        self.assertEqual(lease_payload["house"]["label"], expected_house_label)
        self.assertEqual(lease_payload["tenant_id"], tenant.pk)
        self.assertEqual(lease_payload["tenant"]["id"], tenant.pk)
        self.assertEqual(lease_payload["tenant"]["name"], "展示租客")
        self.assertEqual(lease_payload["tenant"]["phone"], "+8613900139001")
        self.assertEqual(lease_payload["source_viewing_record_id"], viewing.pk)
        self.assertEqual(lease_payload["source_viewing_record"]["id"], viewing.pk)
        self.assertEqual(lease_payload["source_viewing_record"]["label"], "展示客户 / 13900139001")
        self.assertNotIn("house_label", lease_payload)
        self.assertNotIn("tenant_name", lease_payload)
        self.assertNotIn("tenant_phone", lease_payload)
        self.assertNotIn("source_viewing_record_label", lease_payload)
        self.assertEqual(lease_payload["status__mapping"], LeaseStatus.get_choice_label(lease_payload["status"]))

    def test_get_viewing_record_returns_org_scoped_detail(self):
        landlord = Contact.objects.create(organization=self.org, name="详情房东", phone="13800138002", roles=[ContactRole.LANDLORD])
        tenant = Contact.objects.create(organization=self.org, name="详情租客", phone="13900139002", roles=[ContactRole.TENANT])
        house = House.objects.create(building=self.building, landlord=landlord, room_number="1802")
        viewing = ViewingRecord.objects.create(
            organization=self.org,
            house=house,
            contact=tenant,
            customer_name="详情客户",
            customer_phone="13900139002",
            scheduled_at=timezone.now(),
        )
        other_org, other_house, _other_landlord, other_tenant = self.make_other_org_house()
        other_viewing = ViewingRecord.objects.create(
            organization=other_org,
            house=other_house,
            contact=other_tenant,
            customer_name="异租户客户",
            customer_phone="13900139222",
            scheduled_at=timezone.now(),
        )

        response = self.client.get(f"/api/house/viewing-records/{viewing.pk}/")
        payload = api_data(response)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(payload["id"], viewing.pk)
        self.assertEqual(payload["house"]["id"], house.pk)
        self.assertEqual(payload["contact"]["id"], tenant.pk)
        self.assertEqual(self.client.get(f"/api/house/viewing-records/{other_viewing.pk}/").status_code, 404)

    def test_list_buildings_searches_estate_names(self):
        Building.objects.create(organization=self.org, estate=self.estate, name="2栋", address="科技园 2 栋", floors=18)
        other_estate = Estate.objects.create(
            organization=self.org,
            name="海风里",
            display_name="海风里花园",
            property_type=EstatePropertyType.RESIDENTIAL,
            province="广东",
            city="深圳",
            district="南山",
            address="后海",
        )
        other_building = Building.objects.create(organization=self.org, estate=other_estate, name="3栋", address="后海 3 栋", floors=16)
        self.make_other_org_house()

        response = self.client.get("/api/house/buildings/?keyword=海风里花园")
        payload = api_data(response)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(payload["total"], 1)
        self.assertEqual([item["id"] for item in payload["items"]], [other_building.pk])

    def test_estate_and_building_details_include_active_house_inventory(self):
        second_building = Building.objects.create(organization=self.org, estate=self.estate, name="2栋", address="科技园 2 栋", floors=18)
        House.objects.create(building=self.building, room_number="101", status=HouseStatus.VACANT)
        House.objects.create(building=self.building, room_number="102", status=HouseStatus.LISTED)
        House.objects.create(building=self.building, room_number="103", status=HouseStatus.RENTED)
        House.objects.create(building=second_building, room_number="201", status=HouseStatus.RENOVATING)
        House.objects.create(building=second_building, room_number="202", status=HouseStatus.INACTIVE)

        estate_response = self.client.get(f"/api/house/estates/{self.estate.pk}/")
        building_response = self.client.get(f"/api/house/buildings/{self.building.pk}/")
        buildings_response = self.client.get(f"/api/house/buildings/?estate_id={self.estate.pk}")

        expected_counts = {"total": 4, "vacant": 1, "listed": 1, "rented": 1, "renovating": 1}
        self.assertEqual(estate_response.status_code, 200)
        self.assertEqual(api_data(estate_response)["building_count"], 2)
        self.assertEqual(api_data(estate_response)["counts"], expected_counts)
        self.assertEqual(building_response.status_code, 200)
        self.assertEqual(api_data(building_response)["counts"], {"total": 3, "vacant": 1, "listed": 1, "rented": 1, "renovating": 0})
        self.assertEqual(buildings_response.status_code, 200)
        building_counts = {item["id"]: item["counts"] for item in api_data(buildings_response)["items"]}
        self.assertEqual(building_counts[self.building.pk], {"total": 3, "vacant": 1, "listed": 1, "rented": 1, "renovating": 0})
        self.assertEqual(building_counts[second_building.pk], {"total": 1, "vacant": 0, "listed": 0, "rented": 0, "renovating": 1})

    def test_building_map_detail_orders_active_houses_by_floor_and_natural_room_number(self):
        self.building.lat, self.building.lng = Decimal("22.533100"), Decimal("113.930400")
        self.building.tags = ["近地铁", "成熟配套"]
        self.building.save()
        House.objects.create(building=self.building, room_number="10", floor=1)
        House.objects.create(building=self.building, room_number="2", floor=1)
        House.objects.create(building=self.building, room_number="A10", floor=2)
        House.objects.create(building=self.building, room_number="A2", floor=2)
        inactive = House.objects.create(building=self.building, room_number="999", floor=9, status=HouseStatus.INACTIVE)

        response = self.client.get(f"/api/house/building-map/{self.building.pk}/")

        self.assertEqual(response.status_code, 200)
        payload = api_data(response)
        self.assertEqual(payload["tags"], ["近地铁", "成熟配套"])
        self.assertEqual([item["room_number"] for item in payload["houses"]], ["2", "10", "A2", "A10"])
        self.assertNotIn(inactive.pk, [item["id"] for item in payload["houses"]])
        self.assertEqual(payload["counts"], {"total": 4, "vacant": 4, "listed": 0, "rented": 0, "renovating": 0})

    def test_building_map_filters_markers_by_house_status_but_keeps_full_active_counts(self):
        self.building.lat, self.building.lng = Decimal("22.533100"), Decimal("113.930400")
        self.building.save()
        House.objects.create(building=self.building, room_number="101", status=HouseStatus.VACANT)
        House.objects.create(building=self.building, room_number="102", status=HouseStatus.LISTED)
        House.objects.create(building=self.building, room_number="103", status=HouseStatus.RENTED)

        response = self.client.get("/api/house/building-map/?house_status=vacant&page=1&page_size=50")

        self.assertEqual(response.status_code, 200)
        item = api_data(response)["items"][0]
        self.assertEqual(item["id"], self.building.pk)
        self.assertEqual(item["counts"], {"total": 3, "vacant": 1, "listed": 1, "rented": 1, "renovating": 0})

    def test_building_map_returns_all_located_buildings(self):
        initial_unlocated_count = Building.objects.filter(organization=self.org).filter(Q(lat__isnull=True) | Q(lng__isnull=True)).count()
        self.building.lat, self.building.lng = Decimal("22.533100"), Decimal("113.930400")
        self.building.save()
        second = Building.objects.create(
            organization=self.org,
            estate=self.estate,
            name="2栋",
            address="科技园 2 栋",
            floors=8,
            lat=Decimal("22.534000"),
            lng=Decimal("113.931000"),
        )
        Building.objects.create(organization=self.org, estate=self.estate, name="待定位楼栋", address="科技园待定位楼栋", floors=8)

        response = self.client.get("/api/house/building-map/?page=1&page_size=50")
        unlocated_response = self.client.get("/api/house/building-map-unlocated-count/")

        self.assertEqual({item["id"] for item in api_data(response)["items"]}, {self.building.pk, second.pk})
        self.assertEqual(api_data(unlocated_response), {"count": initial_unlocated_count})

    def test_building_map_includes_estate_and_standalone_buildings(self):
        self.building.lat, self.building.lng = Decimal("22.533100"), Decimal("113.930400")
        self.building.save()
        standalone = Building.objects.create(
            organization=self.org,
            estate=None,
            name="独立公寓",
            address="滨海路 20 号",
            floors=8,
            lat=Decimal("22.540000"),
            lng=Decimal("113.940000"),
        )

        response = self.client.get("/api/house/building-map/?page=1&page_size=50")

        self.assertEqual({item["id"] for item in api_data(response)["items"]}, {self.building.pk, standalone.pk})

    def test_building_map_unlocated_list_uses_business_filters_and_counts(self):
        pending = Building.objects.create(organization=self.org, estate=self.estate, name="待定位楼栋", address="科技园待定位楼栋", floors=8)
        House.objects.create(building=pending, room_number="101", status=HouseStatus.VACANT)
        House.objects.create(building=pending, room_number="102", status=HouseStatus.RENTED)
        other_estate = Estate.objects.create(
            organization=self.org,
            name="其他项目",
            display_name="其他项目",
            property_type=EstatePropertyType.RESIDENTIAL,
            province="广东",
            city="深圳",
            district="南山",
            address="其他地址",
        )
        Building.objects.create(organization=self.org, estate=other_estate, name="其他待定位楼栋", address="其他地址 1 栋", floors=6)

        response = self.client.get(f"/api/house/building-map-unlocated/?estate_id={self.estate.pk}&house_status=vacant&page=1&page_size=50")

        self.assertEqual(response.status_code, 200)
        payload = api_data(response)
        self.assertEqual([item["id"] for item in payload["items"]], [pending.pk])
        self.assertEqual(payload["items"][0]["counts"], {"total": 2, "vacant": 1, "listed": 0, "rented": 1, "renovating": 0})

    def test_building_map_applies_keyword_bounds_and_organization_isolation(self):
        self.building.lat, self.building.lng = Decimal("22.533100"), Decimal("113.930400")
        self.building.address = "园区内部道路 1 号"
        self.building.save()
        self.estate.address = "滨海大道 88 号"
        self.estate.save()
        _other_org, other_house, _other_landlord, _other_tenant = self.make_other_org_house()
        other_house.building.lat, other_house.building.lng = Decimal("22.533500"), Decimal("113.930500")
        other_house.building.save()

        keyword_response = self.client.get("/api/house/building-map/?keyword=滨海大道&page=1&page_size=50")
        bounds_response = self.client.get("/api/house/building-map/?west=113.9300&south=22.5330&east=113.9305&north=22.5332&page=1&page_size=50")
        invalid_bounds_response = self.client.get("/api/house/building-map/?west=114&south=22&east=113&north=23")
        other_detail_response = self.client.get(f"/api/house/building-map/{other_house.building_id}/")

        self.assertEqual([item["id"] for item in api_data(keyword_response)["items"]], [self.building.pk])
        self.assertEqual([item["id"] for item in api_data(bounds_response)["items"]], [self.building.pk])
        self.assertEqual(invalid_bounds_response.status_code, 422)
        self.assertEqual(other_detail_response.status_code, 404)

    def test_estate_map_prefers_estate_location_and_aggregates_all_eligible_buildings(self):
        self.estate.lat, self.estate.lng = Decimal("22.533000"), Decimal("113.930000")
        self.estate.save()
        self.building.lat, self.building.lng = Decimal("22.533100"), Decimal("113.930100")
        self.building.save()
        unlocated = Building.objects.create(organization=self.org, estate=self.estate, name="2栋", address="科技园 2 栋", floors=18)
        third = Building.objects.create(
            organization=self.org,
            estate=self.estate,
            name="3栋",
            address="科技园 3 栋",
            floors=16,
            lat=Decimal("22.533300"),
            lng=Decimal("113.930300"),
        )
        House.objects.create(building=self.building, room_number="101", status=HouseStatus.LISTED)
        House.objects.create(building=unlocated, room_number="201", status=HouseStatus.RENTED)
        House.objects.create(building=third, room_number="301", status=HouseStatus.RENOVATING)

        response = self.client.get("/api/house/estate-map/?page=1&page_size=50")

        self.assertEqual(response.status_code, 200)
        item = api_data(response)["items"][0]
        self.assertEqual(item["id"], self.estate.pk)
        self.assertEqual(item["location_source"], "estate")
        self.assertEqual(Decimal(item["lat"]), Decimal("22.533000"))
        self.assertEqual(Decimal(item["lng"]), Decimal("113.930000"))
        self.assertEqual(item["building_count"], 3)
        self.assertEqual(item["located_building_count"], 2)
        self.assertEqual(item["unlocated_building_count"], 1)
        self.assertEqual(item["counts"], {"total": 3, "vacant": 0, "listed": 1, "rented": 1, "renovating": 1})

    def test_estate_map_falls_back_to_unweighted_located_building_centroid(self):
        self.building.lat, self.building.lng = Decimal("22.530000"), Decimal("113.930000")
        self.building.save()
        second = Building.objects.create(
            organization=self.org,
            estate=self.estate,
            name="2栋",
            address="科技园 2 栋",
            floors=18,
            lat=Decimal("22.550000"),
            lng=Decimal("113.950000"),
        )
        House.objects.create(building=self.building, room_number="101")
        for room_number in ("201", "202", "203", "204"):
            House.objects.create(building=second, room_number=room_number)
        unlocated_estate = Estate.objects.create(
            organization=self.org,
            name="待定位项目",
            display_name="待定位项目",
            province="广东",
            city="深圳",
            district="南山",
            address="待定位路",
        )
        Building.objects.create(organization=self.org, estate=unlocated_estate, name="1栋", address="待定位路 1 栋", floors=8)

        response = self.client.get("/api/house/estate-map/?page=1&page_size=50")

        self.assertEqual(response.status_code, 200)
        payload = api_data(response)
        self.assertEqual([item["id"] for item in payload["items"]], [self.estate.pk])
        item = payload["items"][0]
        self.assertEqual(item["location_source"], "building_centroid")
        self.assertEqual(Decimal(item["lat"]), Decimal("22.540000"))
        self.assertEqual(Decimal(item["lng"]), Decimal("113.940000"))
        self.assertEqual(item["counts"]["total"], 5)

    def test_estate_map_applies_child_keyword_status_bounds_and_organization_isolation(self):
        self.estate.lat, self.estate.lng = Decimal("22.533100"), Decimal("113.930400")
        self.estate.save()
        House.objects.create(building=self.building, room_number="101", status=HouseStatus.VACANT)
        House.objects.create(building=self.building, room_number="102", status=HouseStatus.RENTED)
        other_estate = Estate.objects.create(
            organization=self.org,
            name="海风里",
            display_name="海风里花园",
            property_type=EstatePropertyType.RESIDENTIAL,
            province="广东",
            city="深圳",
            district="南山",
            address="后海",
            lat=Decimal("22.600000"),
            lng=Decimal("114.000000"),
        )
        other_building = Building.objects.create(organization=self.org, estate=other_estate, name="2栋", address="后海 2 栋", floors=16)
        House.objects.create(building=other_building, room_number="201", status=HouseStatus.VACANT)
        _other_org, other_house, _other_landlord, _other_tenant = self.make_other_org_house()
        other_house.building.estate.lat, other_house.building.estate.lng = Decimal("22.533100"), Decimal("113.930400")
        other_house.building.estate.save()

        response = self.client.get("/api/house/estate-map/?keyword=1栋&house_status=vacant&west=113.9300&south=22.5330&east=113.9305&north=22.5332&page=1&page_size=50")
        invalid_bounds_response = self.client.get("/api/house/estate-map/?west=114&south=22&east=113&north=23")

        self.assertEqual(response.status_code, 200)
        payload = api_data(response)
        self.assertEqual([item["id"] for item in payload["items"]], [self.estate.pk])
        self.assertEqual(payload["items"][0]["counts"], {"total": 2, "vacant": 1, "listed": 0, "rented": 1, "renovating": 0})
        self.assertEqual(invalid_bounds_response.status_code, 422)

    def test_building_map_standalone_only_excludes_estate_buildings(self):
        self.building.lat, self.building.lng = Decimal("22.533100"), Decimal("113.930400")
        self.building.save()
        standalone = Building.objects.create(
            organization=self.org,
            estate=None,
            name="海滨公寓",
            address="海滨路 20 号",
            floors=8,
            lat=Decimal("22.540000"),
            lng=Decimal("113.940000"),
        )
        other_org = baker.make("organizations.Organization", name="其他独立楼栋组织", slug="other-standalone-org")
        Building.objects.create(
            organization=other_org,
            estate=None,
            name="异租户公寓",
            address="异地路 1 号",
            floors=6,
            lat=Decimal("22.540000"),
            lng=Decimal("113.940000"),
        )

        response = self.client.get("/api/house/building-map/?standalone_only=true&page=1&page_size=50")

        self.assertEqual(response.status_code, 200)
        self.assertEqual([item["id"] for item in api_data(response)["items"]], [standalone.pk])

    def test_create_standalone_building_with_null_or_omitted_estate(self):
        for name, payload in (
            ("海滨公寓", {"estate_id": None, "name": "海滨公寓", "address": "海滨路 20 号", "floors": 8}),
            ("山景公寓", {"name": "山景公寓", "address": "山景路 8 号", "floors": 6}),
        ):
            response = self.client.post("/api/house/buildings/", data=json.dumps(payload), content_type="application/json")

            self.assertEqual(response.status_code, 201)
            response_payload = api_data(response)
            self.assertIsNone(response_payload["estate_id"])
            self.assertIsNone(response_payload["estate"])
            building = Building.objects.get(pk=response_payload["id"])
            self.assertEqual(building.organization, self.org)
            self.assertEqual(building.name, name)
            self.assertIsNone(building.estate_id)

    def test_create_standalone_building_requires_address(self):
        self.client.raise_request_exception = False

        response = self.client.post(
            "/api/house/buildings/",
            data=json.dumps({"name": "无地址公寓", "floors": 8}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("address", api_error(response)["data"]["fields"])

    def test_create_and_patch_building_images(self):
        media = register_media_file(
            uploader=self.user,
            oss_path=f"uploads/orgs/{self.org.pk}/building.png",
            original_filename="building.png",
            resource_type=ResourceType.BUILDING_IMAGE,
            file_size=1024,
        )
        image_ref = {"media_id": media.pk, "media_type": MediaType.IMAGE, "label": "楼栋外观", "url": "stale"}

        created = self.client.post(
            "/api/house/buildings/",
            data=json.dumps({"estate_id": self.estate.pk, "name": "图片楼栋", "address": "科技园图片楼栋", "floors": 8, "images": [image_ref]}),
            content_type="application/json",
        )

        self.assertEqual(created.status_code, 201)
        created_data = api_data(created)
        self.assertEqual(created_data["images"][0]["label"], "楼栋外观")
        self.assertEqual(created_data["images"][0]["url"], media.file.url)
        building = Building.objects.get(pk=created_data["id"])
        self.assertEqual(building.images, [{"media_id": media.pk, "media_type": MediaType.IMAGE, "label": "楼栋外观"}])

        patched = self.client.patch(
            f"/api/house/buildings/{building.pk}/",
            data=json.dumps({"images": []}),
            content_type="application/json",
        )

        self.assertEqual(patched.status_code, 200)
        self.assertEqual(api_data(patched)["images"], [])
        building.refresh_from_db()
        self.assertEqual(building.images, [])

    def test_patch_building_can_bind_and_unbind_estate_but_omission_preserves_it(self):
        building = Building.objects.create(organization=self.org, estate=None, name="海滨公寓", address="海滨路 20 号", floors=8)

        bound = self.client.patch(
            f"/api/house/buildings/{building.pk}/",
            data=json.dumps({"estate_id": self.estate.pk}),
            content_type="application/json",
        )
        self.assertEqual(bound.status_code, 200)
        self.assertEqual(api_data(bound)["estate_id"], self.estate.pk)
        self.assertEqual(api_data(bound)["estate"]["id"], self.estate.pk)

        renamed = self.client.patch(
            f"/api/house/buildings/{building.pk}/",
            data=json.dumps({"name": "海滨公寓 A 座"}),
            content_type="application/json",
        )
        self.assertEqual(renamed.status_code, 200)
        self.assertEqual(api_data(renamed)["estate_id"], self.estate.pk)

        unbound = self.client.patch(
            f"/api/house/buildings/{building.pk}/",
            data=json.dumps({"estate_id": None}),
            content_type="application/json",
        )
        self.assertEqual(unbound.status_code, 200)
        self.assertIsNone(api_data(unbound)["estate_id"])
        self.assertIsNone(api_data(unbound)["estate"])

    def test_patch_building_rejects_clearing_required_address(self):
        building = Building.objects.create(organization=self.org, estate=self.estate, name="地址校验楼栋", address="科技园地址校验楼栋", floors=8)
        self.client.raise_request_exception = False

        response = self.client.patch(
            f"/api/house/buildings/{building.pk}/",
            data=json.dumps({"address": ""}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("address", api_error(response)["data"]["fields"])

    def test_create_and_patch_building_reject_estate_outside_current_org(self):
        other_org, _other_house, _other_landlord, _other_tenant = self.make_other_org_house()
        other_estate = Estate.objects.get(organization=other_org, name="异租户项目")
        self.client.raise_request_exception = False

        created = self.client.post(
            "/api/house/buildings/",
            data=json.dumps({"estate_id": other_estate.pk, "name": "越界楼栋", "floors": 8}),
            content_type="application/json",
        )
        patched = self.client.patch(
            f"/api/house/buildings/{self.building.pk}/",
            data=json.dumps({"estate_id": other_estate.pk}),
            content_type="application/json",
        )

        self.assertEqual(created.status_code, 404)
        self.assertEqual(patched.status_code, 404)
        self.building.refresh_from_db()
        self.assertEqual(self.building.estate_id, self.estate.pk)

    def test_list_leases_filters_contract_missing_before_pagination(self):
        landlord = Contact.objects.create(organization=self.org, name="合同房东", phone="13800138667", roles=[ContactRole.LANDLORD])
        tenant = Contact.objects.create(organization=self.org, name="合同租客", phone="13900139667", roles=[ContactRole.TENANT])
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

    def test_list_leases_filters_keyword_before_pagination(self):
        landlord = Contact.objects.create(organization=self.org, name="搜索房东", phone="13800138668", roles=[ContactRole.LANDLORD])
        matched_tenant = Contact.objects.create(organization=self.org, name="王租客", phone="13900139668", roles=[ContactRole.TENANT])
        other_tenant = Contact.objects.create(organization=self.org, name="李租客", phone="13900139669", roles=[ContactRole.TENANT])
        matched_house = House.objects.create(building=self.building, landlord=landlord, room_number="KW-1901")
        other_house = House.objects.create(building=self.building, landlord=landlord, room_number="KW-1902")
        matched_lease = Lease.objects.create(
            organization=self.org,
            house=matched_house,
            tenant=matched_tenant,
            start_date=date.today(),
            end_date=date.today() + timedelta(days=365),
            monthly_rent=Decimal("4200.00"),
        )
        Lease.objects.create(
            organization=self.org,
            house=other_house,
            tenant=other_tenant,
            start_date=date.today() + timedelta(days=1),
            end_date=date.today() + timedelta(days=366),
            monthly_rent=Decimal("4300.00"),
        )

        response = self.client.get("/api/house/leases/?keyword=王租客&page=1&page_size=1")
        payload = api_data(response)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(payload["total"], 1)
        self.assertEqual([item["id"] for item in payload["items"]], [matched_lease.pk])

    def test_list_viewing_records_filters_pending_lease_before_pagination(self):
        landlord = Contact.objects.create(organization=self.org, name="待签房东", phone="13800138670", roles=[ContactRole.LANDLORD])
        tenant = Contact.objects.create(organization=self.org, name="待签租客", phone="13900139670", roles=[ContactRole.TENANT])
        house = House.objects.create(building=self.building, landlord=landlord, room_number="1903")
        pending_viewing = ViewingRecord.objects.create(
            organization=self.org,
            house=house,
            contact=tenant,
            customer_name="待签客户",
            customer_phone="13900139670",
            scheduled_at=timezone.now(),
            status=ViewingRecordStatus.CONVERTED,
        )
        signed_viewing = ViewingRecord.objects.create(
            organization=self.org,
            house=house,
            contact=tenant,
            customer_name="已签客户",
            customer_phone="13900139671",
            scheduled_at=timezone.now() + timedelta(hours=1),
            status=ViewingRecordStatus.CONVERTED,
        )
        ViewingRecord.objects.create(
            organization=self.org,
            house=house,
            contact=tenant,
            customer_name="已看客户",
            customer_phone="13900139672",
            scheduled_at=timezone.now() + timedelta(hours=2),
            status=ViewingRecordStatus.VIEWED,
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
        landlord = Contact.objects.create(organization=self.org, name="补主体房东", phone="13800138671", roles=[ContactRole.LANDLORD])
        tenant = Contact.objects.create(organization=self.org, name="已绑租客", phone="13900139671", roles=[ContactRole.TENANT])
        house = House.objects.create(building=self.building, landlord=landlord, room_number="1904")
        missing_contact_viewing = ViewingRecord.objects.create(
            organization=self.org,
            house=house,
            customer_name="未绑客户",
            customer_phone="13900139680",
            scheduled_at=timezone.now(),
            status=ViewingRecordStatus.CONVERTED,
        )
        ready_viewing = ViewingRecord.objects.create(
            organization=self.org,
            house=house,
            contact=tenant,
            customer_name="已绑客户",
            customer_phone="13900139681",
            scheduled_at=timezone.now() + timedelta(hours=1),
            status=ViewingRecordStatus.CONVERTED,
        )
        ViewingRecord.objects.create(
            organization=self.org,
            house=house,
            customer_name="普通预约客户",
            customer_phone="13900139682",
            scheduled_at=timezone.now() + timedelta(hours=2),
            status=ViewingRecordStatus.SCHEDULED,
        )

        missing_response = self.client.get("/api/house/viewing-records/?pending_lease=true&contact_missing=true&page=1&page_size=1")
        missing_payload = api_data(missing_response)

        self.assertEqual(missing_response.status_code, 200)
        self.assertEqual(missing_payload["total"], 1)
        self.assertEqual([item["id"] for item in missing_payload["items"]], [missing_contact_viewing.pk])
        self.assertIsNone(missing_payload["items"][0]["contact_id"])
        self.assertIsNone(missing_payload["items"][0]["contact"])

        ready_response = self.client.get("/api/house/viewing-records/?pending_lease=true&contact_missing=false&page=1&page_size=1")
        ready_payload = api_data(ready_response)

        self.assertEqual(ready_response.status_code, 200)
        self.assertEqual(ready_payload["total"], 1)
        self.assertEqual([item["id"] for item in ready_payload["items"]], [ready_viewing.pk])

    def test_list_viewing_records_filters_keyword_before_pagination(self):
        landlord = Contact.objects.create(organization=self.org, name="搜索房东", phone="13800138672", roles=[ContactRole.LANDLORD])
        tenant = Contact.objects.create(organization=self.org, name="搜索租客", phone="13900139672", roles=[ContactRole.TENANT])
        matched_house = House.objects.create(building=self.building, landlord=landlord, room_number="VK-1901")
        other_house = House.objects.create(building=self.building, landlord=landlord, room_number="VK-1902")
        matched_viewing = ViewingRecord.objects.create(
            organization=self.org,
            house=matched_house,
            contact=tenant,
            customer_name="关键客户",
            customer_phone="13900139673",
            scheduled_at=timezone.now(),
        )
        ViewingRecord.objects.create(
            organization=self.org,
            house=other_house,
            customer_name="普通客户",
            customer_phone="13900139674",
            scheduled_at=timezone.now() + timedelta(hours=1),
        )

        response = self.client.get("/api/house/viewing-records/?keyword=关键&page=1&page_size=1")
        payload = api_data(response)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(payload["total"], 1)
        self.assertEqual([item["id"] for item in payload["items"]], [matched_viewing.pk])

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
        self.assertEqual(payload["estate"]["display_name"], "默认项目")
        self.assertNotIn("estate_name", payload)
        self.assertEqual(Building.objects.get(pk=payload["id"]).organization, empty_org)
        self.assertTrue(OrganizationSetting.objects.filter(organization=empty_org, value=payload["id"]).exists())

    def test_org_creation_initializes_default_building_setting(self):
        org = baker.make("organizations.Organization", name="新租户默认楼栋", slug="new-org-default-building")

        building = Building.objects.get(organization=org, name="默认楼栋")
        self.assertTrue(OrganizationSetting.objects.filter(organization=org, value=building.pk).exists())

    def test_default_building_can_be_changed_to_org_building_only(self):
        other_building = Building.objects.create(organization=self.org, estate=self.estate, name="2栋", address="科技园 2 栋", floors=18)

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

    def test_default_building_can_be_changed_to_standalone_building(self):
        standalone = Building.objects.create(organization=self.org, estate=None, name="海滨公寓", address="海滨路 20 号", floors=8)

        response = self.client.put(
            "/api/house/default-building/",
            data=json.dumps({"building_id": standalone.pk}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        payload = api_data(response)
        self.assertEqual(payload["id"], standalone.pk)
        self.assertIsNone(payload["estate_id"])
        self.assertIsNone(payload["estate"])

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
                    "roles": [ContactRole.LANDLORD],
                    "user_id": outsider.pk,
                }
            ),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertFalse(Contact.objects.filter(organization=self.org, phone="13800138555").exists())

    def test_list_contacts_filters_by_task_before_pagination(self):
        active_landlord = Contact.objects.create(organization=self.org, name="正常房东", phone="13800138556", roles=[ContactRole.LANDLORD], is_active=True)
        inactive_contact = Contact.objects.create(organization=self.org, name="停用联系人", phone="13800138557", roles=[ContactRole.LANDLORD], is_active=False)
        dual_role_contact = Contact.objects.create(
            organization=self.org,
            name="双角色联系人",
            phone="13800138558",
            roles=[ContactRole.LANDLORD, ContactRole.TENANT],
            is_active=True,
        )
        role_missing_contact = Contact.objects.create(organization=self.org, name="缺角色联系人", phone="13800138559", roles=[], is_active=True)
        inactive_role_missing_contact = Contact.objects.create(organization=self.org, name="停用缺角色联系人", phone="13800138561", roles=[], is_active=False)
        self.make_other_org_house()

        expected = {
            "inactive": {inactive_contact.pk, inactive_role_missing_contact.pk},
            "dual_role": {dual_role_contact.pk},
            "role_missing_active": {role_missing_contact.pk},
            "role_missing_inactive": {inactive_role_missing_contact.pk},
        }
        for task, contact_ids in expected.items():
            with self.subTest(task=task):
                response = self.client.get(f"/api/house/contacts/?task={task}&page=1&page_size=1")
                payload = api_data(response)

                self.assertEqual(response.status_code, 200)
                self.assertEqual(payload["total"], len(contact_ids))
                self.assertIn(payload["items"][0]["id"], contact_ids)

        role_missing_response = self.client.get("/api/house/contacts/?task=role_missing&page=1&page_size=10")
        role_missing_ids = {item["id"] for item in api_data(role_missing_response)["items"]}
        self.assertEqual(role_missing_response.status_code, 200)
        self.assertEqual(role_missing_ids, {role_missing_contact.pk, inactive_role_missing_contact.pk})

        active_response = self.client.get("/api/house/contacts/?task=active&page=1&page_size=10")
        active_ids = {item["id"] for item in api_data(active_response)["items"]}
        self.assertIn(active_landlord.pk, active_ids)
        self.assertIn(dual_role_contact.pk, active_ids)
        self.assertIn(role_missing_contact.pk, active_ids)
        self.assertNotIn(inactive_contact.pk, active_ids)
        self.assertNotIn(inactive_role_missing_contact.pk, active_ids)

        landlord_response = self.client.get("/api/house/contacts/?role=landlord&page=1&page_size=10")
        landlord_ids = {item["id"] for item in api_data(landlord_response)["items"]}
        self.assertIn(active_landlord.pk, landlord_ids)
        self.assertIn(inactive_contact.pk, landlord_ids)
        self.assertIn(dual_role_contact.pk, landlord_ids)
        self.assertNotIn(role_missing_contact.pk, landlord_ids)

    def test_list_contacts_keyword_matches_email(self):
        matched = Contact.objects.create(
            organization=self.org,
            name="邮箱检索联系人",
            phone="13800138560",
            email="leasing-owner@example.com",
            roles=[ContactRole.LANDLORD],
        )
        Contact.objects.create(
            organization=self.org,
            name="其他联系人",
            phone="13800138561",
            email="other@example.com",
            roles=[ContactRole.TENANT],
        )

        response = self.client.get("/api/house/contacts/?keyword=leasing-owner&page=1&page_size=20")
        payload = api_data(response)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(payload["total"], 1)
        self.assertEqual([item["id"] for item in payload["items"]], [matched.pk])

    def test_inactive_contacts_cannot_be_used_for_new_business(self):
        inactive_landlord = Contact.objects.create(
            organization=self.org,
            name="停用房东",
            phone="13800138562",
            roles=[ContactRole.LANDLORD],
            is_active=False,
        )
        inactive_tenant = Contact.objects.create(
            organization=self.org,
            name="停用租客",
            phone="13900139562",
            roles=[ContactRole.TENANT],
            is_active=False,
        )
        active_landlord = Contact.objects.create(
            organization=self.org,
            name="在用房东",
            phone="13800138563",
            roles=[ContactRole.LANDLORD],
        )
        house = House.objects.create(building=self.building, landlord=active_landlord, room_number="1502A")
        self.client.raise_request_exception = False

        house_response = self.client.post(
            "/api/house/houses/",
            data=json.dumps(
                {
                    "building_id": self.building.pk,
                    "landlord_id": inactive_landlord.pk,
                    "room_number": "1502B",
                }
            ),
            content_type="application/json",
        )
        viewing_response = self.client.post(
            "/api/house/viewing-records/",
            data=json.dumps(
                {
                    "house_id": house.pk,
                    "contact_id": inactive_tenant.pk,
                    "customer_name": inactive_tenant.name,
                    "customer_phone": inactive_tenant.phone,
                    "scheduled_at": "2026-07-01T11:00:00+08:00",
                }
            ),
            content_type="application/json",
        )
        lease_response = self.client.post(
            "/api/house/leases/",
            data=json.dumps(
                {
                    "house_id": house.pk,
                    "tenant_id": inactive_tenant.pk,
                    "start_date": str(date.today()),
                    "end_date": str(date.today() + timedelta(days=365)),
                    "monthly_rent": "4200",
                }
            ),
            content_type="application/json",
        )

        self.assertEqual(house_response.status_code, 422)
        self.assertEqual(viewing_response.status_code, 422)
        self.assertEqual(lease_response.status_code, 422)
        self.assertFalse(House.objects.filter(building=self.building, room_number="1502B").exists())
        self.assertFalse(ViewingRecord.objects.filter(organization=self.org, contact=inactive_tenant).exists())
        self.assertFalse(Lease.objects.filter(organization=self.org, tenant=inactive_tenant).exists())

    def test_create_viewing_record_requires_tenant_role(self):
        landlord = Contact.objects.create(
            organization=self.org,
            name="仅房东角色",
            phone="13800138564",
            roles=[ContactRole.LANDLORD],
        )
        house = House.objects.create(building=self.building, landlord=landlord, room_number="1502C")
        self.client.raise_request_exception = False

        response = self.client.post(
            "/api/house/viewing-records/",
            data=json.dumps(
                {
                    "house_id": house.pk,
                    "contact_id": landlord.pk,
                    "customer_name": landlord.name,
                    "customer_phone": landlord.phone,
                    "scheduled_at": "2026-07-01T11:00:00+08:00",
                }
            ),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 422)
        self.assertFalse(ViewingRecord.objects.filter(organization=self.org, contact=landlord).exists())

    def test_existing_business_can_keep_same_contact_after_contact_is_disabled(self):
        landlord = Contact.objects.create(
            organization=self.org,
            name="历史房东",
            phone="13800138565",
            roles=[ContactRole.LANDLORD],
        )
        tenant = Contact.objects.create(
            organization=self.org,
            name="历史租客",
            phone="13900139565",
            roles=[ContactRole.TENANT],
        )
        house = House.objects.create(building=self.building, landlord=landlord, room_number="1502D")
        viewing = ViewingRecord.objects.create(
            organization=self.org,
            house=house,
            contact=tenant,
            customer_name=tenant.name,
            customer_phone=tenant.phone,
            scheduled_at=timezone.now(),
        )
        lease = Lease.objects.create(
            organization=self.org,
            house=house,
            tenant=tenant,
            start_date=date.today(),
            end_date=date.today() + timedelta(days=365),
            monthly_rent=Decimal("4200"),
        )
        landlord.is_active = False
        landlord.save()
        tenant.is_active = False
        tenant.save()

        house_response = self.client.patch(
            f"/api/house/houses/{house.pk}/",
            data=json.dumps({"landlord_id": landlord.pk, "internal_notes": "保留历史房东"}),
            content_type="application/json",
        )
        viewing_response = self.client.patch(
            f"/api/house/viewing-records/{viewing.pk}/",
            data=json.dumps({"contact_id": tenant.pk, "notes": "保留历史租客"}),
            content_type="application/json",
        )
        lease_response = self.client.patch(
            f"/api/house/leases/{lease.pk}/",
            data=json.dumps({"tenant_id": tenant.pk, "notes": "保留历史租客"}),
            content_type="application/json",
        )

        self.assertEqual(house_response.status_code, 200)
        self.assertEqual(viewing_response.status_code, 200)
        self.assertEqual(lease_response.status_code, 200)

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
                    "status": ViewingRecordStatus.VIEWED,
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
        payload = api_data(response)
        self.assertIsNone(payload["contact_id"])
        self.assertIsNone(payload["contact"])
        record = ViewingRecord.objects.get(pk=payload["id"])
        self.assertEqual(record.status, ViewingRecordStatus.SCHEDULED)
        self.assertIsNone(record.viewed_at)
        self.assertTrue(record.is_active)
        self.assertEqual(record.extra, {})

    def test_create_lease_rejects_cross_org_house_and_tenant_at_api_boundary(self):
        _other_org, other_house, _other_landlord, other_tenant = self.make_other_org_house()
        landlord = Contact.objects.create(organization=self.org, name="房东", phone="13800138333", roles=[ContactRole.LANDLORD])
        tenant = Contact.objects.create(organization=self.org, name="租客", phone="13900139333", roles=[ContactRole.TENANT])
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
        landlord = Contact.objects.create(organization=self.org, name="签约房东", phone="13800138666", roles=[ContactRole.LANDLORD])
        tenant = Contact.objects.create(organization=self.org, name="签约租客", phone="13900139666", roles=[ContactRole.TENANT])
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
                    "status": LeaseStatus.ACTIVE,
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
        self.assertEqual(lease.status, LeaseStatus.PENDING)
        self.assertEqual(house.status, HouseStatus.VACANT)

    def test_patch_lease_to_active_does_not_modify_house_status(self):
        landlord = Contact.objects.create(organization=self.org, name="激活房东", phone="13800138667", roles=[ContactRole.LANDLORD])
        tenant = Contact.objects.create(organization=self.org, name="激活租客", phone="13900139667", roles=[ContactRole.TENANT])
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
            data=json.dumps({"status": LeaseStatus.ACTIVE}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        lease.refresh_from_db()
        house.refresh_from_db()
        self.assertEqual(lease.status, LeaseStatus.ACTIVE)
        self.assertEqual(house.status, HouseStatus.VACANT)

    def test_create_lease_can_link_converted_viewing_record_source(self):
        landlord = Contact.objects.create(organization=self.org, name="来源房东", phone="13800138668", roles=[ContactRole.LANDLORD])
        tenant = Contact.objects.create(organization=self.org, name="来源租客", phone="13900139668", roles=[ContactRole.TENANT])
        house = House.objects.create(building=self.building, landlord=landlord, room_number="1509")
        viewing = ViewingRecord.objects.create(
            organization=self.org,
            house=house,
            contact=tenant,
            customer_name="来源客户",
            customer_phone="13900139668",
            scheduled_at="2026-07-01T10:00:00+08:00",
            status=ViewingRecordStatus.CONVERTED,
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
        landlord = Contact.objects.create(organization=self.org, name="重复来源房东", phone="13800138671", roles=[ContactRole.LANDLORD])
        tenant = Contact.objects.create(organization=self.org, name="重复来源租客", phone="13900139671", roles=[ContactRole.TENANT])
        house = House.objects.create(building=self.building, landlord=landlord, room_number="1511")
        viewing = ViewingRecord.objects.create(
            organization=self.org,
            house=house,
            contact=tenant,
            customer_name="重复来源客户",
            customer_phone="13900139671",
            scheduled_at="2026-07-01T10:00:00+08:00",
            status=ViewingRecordStatus.CONVERTED,
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
            status=ViewingRecordStatus.CONVERTED,
        )
        landlord = Contact.objects.create(organization=self.org, name="当前来源房东", phone="13800138669", roles=[ContactRole.LANDLORD])
        tenant = Contact.objects.create(organization=self.org, name="当前来源租客", phone="13900139669", roles=[ContactRole.TENANT])
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
        landlord = Contact.objects.create(organization=self.org, name="当前房东", phone="13800138444", roles=[ContactRole.LANDLORD], user=self.user)
        tenant = Contact.objects.create(organization=self.org, name="当前租客", phone="13900139444", roles=[ContactRole.TENANT])
        house = House.objects.create(building=self.building, landlord=landlord, room_number="1505")
        viewing = ViewingRecord.objects.create(
            organization=self.org,
            house=house,
            contact=tenant,
            customer_name="当前客户",
            customer_phone="13900139444",
            scheduled_at=timezone.now(),
            status=ViewingRecordStatus.CONVERTED,
        )
        visible = Lease.objects.create(
            organization=self.org,
            house=house,
            tenant=tenant,
            source_viewing_record=viewing,
            start_date=date.today(),
            end_date=date.today() + timedelta(days=365),
            monthly_rent=Decimal("4300"),
            status=LeaseStatus.ACTIVE,
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
            status=LeaseStatus.ACTIVE,
        )

        response = self.client.get("/api/house/landlord/my-leases/")

        self.assertEqual(response.status_code, 200)
        items = api_data(response)["items"]
        self.assertEqual([item["id"] for item in items], [visible.pk])
        self.assertEqual(items[0]["source_viewing_record_id"], viewing.pk)
        self.assertEqual(items[0]["source_viewing_record"]["id"], viewing.pk)
        self.assertEqual(items[0]["source_viewing_record"]["label"], "当前客户 / 13900139444")


class LeaseStatusClosureTestCase(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="lease-closure", password="secret")  # noqa: S106
        self.org = baker.make("organizations.Organization", name="租约组织", slug="lease-closure-org")
        self.estate = Estate.objects.create(
            organization=self.org, name="云岸", display_name="云岸", property_type=EstatePropertyType.RESIDENTIAL, province="广东", city="深圳", district="南山", address="科技园"
        )
        self.building = Building.objects.create(organization=self.org, estate=self.estate, name="1栋", address="科技园 1 栋", floors=20)
        self.landlord = Contact.objects.create(organization=self.org, name="房东", phone="13800138111", roles=[ContactRole.LANDLORD])
        self.tenant = Contact.objects.create(organization=self.org, name="租客", phone="13900139111", roles=[ContactRole.TENANT])

    def make_house(self, room_number, status=HouseStatus.VACANT):
        return House.objects.create(building=self.building, landlord=self.landlord, room_number=room_number, status=status)

    def test_moving_active_lease_does_not_modify_old_or_new_house_status(self):
        old_house = self.make_house("1601", status=HouseStatus.RENTED)
        new_house = self.make_house("1602")
        lease = Lease.objects.create(
            organization=self.org,
            house=old_house,
            tenant=self.tenant,
            start_date=date.today(),
            end_date=date.today() + timedelta(days=365),
            monthly_rent=Decimal("3800"),
            status=LeaseStatus.ACTIVE,
        )
        old_house.refresh_from_db()
        self.assertEqual(old_house.status, HouseStatus.RENTED)

        lease.house = new_house
        lease.save()

        old_house.refresh_from_db()
        new_house.refresh_from_db()
        self.assertEqual(old_house.status, HouseStatus.RENTED)
        self.assertEqual(new_house.status, HouseStatus.VACANT)

    def test_deleting_active_lease_does_not_modify_house_status(self):
        house = self.make_house("1701", status=HouseStatus.RENTED)

        lease = Lease.objects.create(
            organization=self.org,
            house=house,
            tenant=self.tenant,
            start_date=date.today(),
            end_date=date.today() + timedelta(days=365),
            monthly_rent=Decimal("4100"),
            status=LeaseStatus.ACTIVE,
        )
        lease.delete()

        house.refresh_from_db()
        self.assertEqual(house.status, HouseStatus.RENTED)
