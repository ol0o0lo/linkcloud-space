import json
from datetime import timedelta

from django.contrib.auth import user_logged_in
from django.core.exceptions import ValidationError
from django.test import TestCase
from django.utils import timezone

from model_bakery import baker

from apps.accounts.models import User
from apps.house.constants import ContactRole
from apps.house.models import Building, Contact, Estate, House, PropertyResponsibility
from apps.house.services import INSPECTION_MAX_AGE_DAYS_SETTING_KEY
from apps.media.constants import MediaType, ResourceType
from apps.media.services import register_media_file
from apps.organizations.signals import user_logged_in_receiver
from apps.settings.models import DefaultSetting, OrganizationSetting
from tests.api_helpers import api_data


class PropertyResponsibilityApiTestCase(TestCase):
    @classmethod
    def setUpClass(cls):
        user_logged_in.disconnect(user_logged_in_receiver)
        super().setUpClass()

    def setUp(self):
        self.owner = User.objects.create_user(username="responsibility-owner", password="secret")  # noqa: S106
        self.employee = User.objects.create_user(username="maintenance-staff", first_name="维修", last_name="员工", password="secret")  # noqa: S106
        self.building_employee = User.objects.create_user(username="building-staff", first_name="楼栋", last_name="员工", password="secret")  # noqa: S106
        self.org = baker.make("organizations.Organization", name="职责测试组织", slug="responsibility-org")
        baker.make("organizations.OrganizationMember", organization=self.org, user=self.owner, is_owner=True)
        self.member = baker.make("organizations.OrganizationMember", organization=self.org, user=self.employee)
        self.building_member = baker.make("organizations.OrganizationMember", organization=self.org, user=self.building_employee)
        self.client.force_login(self.owner)
        session = self.client.session
        session["organization_data"] = json.dumps({"pk": self.org.pk, "id": self.org.pk, "name": self.org.name, "slug": self.org.slug, "is_owner": True})
        session.save()

        self.estate = Estate.objects.create(
            organization=self.org,
            name="云岸",
            display_name="云岸花园",
            province="广东",
            city="深圳",
            district="南山",
        )
        self.other_estate = Estate.objects.create(
            organization=self.org,
            name="海景",
            display_name="海景公寓",
            province="广东",
            city="深圳",
            district="南山",
        )
        self.building = Building.objects.create(organization=self.org, estate=self.estate, name="1栋", address="云岸 1 栋", floors=20)
        self.estate_only_building = Building.objects.create(organization=self.org, estate=self.estate, name="3栋", address="云岸 3 栋", floors=20)
        self.other_building = Building.objects.create(organization=self.org, estate=self.other_estate, name="2栋", address="海景 2 栋", floors=20)
        self.landlord = Contact.objects.create(organization=self.org, name="张房东", phone="13800138001", roles=[ContactRole.LANDLORD])
        self.overlap_house = House.objects.create(building=self.building, landlord=self.landlord, room_number="101")
        self.estate_house = House.objects.create(building=self.building, room_number="102")
        self.estate_only_house = House.objects.create(building=self.estate_only_building, room_number="301")
        self.landlord_house = House.objects.create(building=self.other_building, landlord=self.landlord, room_number="201")
        self.unassigned_house = House.objects.create(building=self.other_building, room_number="202")

    def login_as(self, user, *, is_owner=False):
        self.client.force_login(user)
        session = self.client.session
        session["organization_data"] = json.dumps({"pk": self.org.pk, "id": self.org.pk, "name": self.org.name, "slug": self.org.slug, "is_owner": is_owner})
        session.save()

    def make_inspection_media_refs(self):
        image = register_media_file(
            uploader=self.employee,
            oss_path=f"uploads/orgs/{self.org.pk}/inspection.jpg",
            original_filename="inspection.jpg",
            resource_type=ResourceType.HOUSE_IMAGE,
            file_size=100,
        )
        video = register_media_file(
            uploader=self.employee,
            oss_path=f"uploads/orgs/{self.org.pk}/inspection.mp4",
            original_filename="inspection.mp4",
            resource_type=ResourceType.HOUSE_VIDEO,
            file_size=100,
        )
        return (
            [{"media_id": image.pk, "media_type": MediaType.IMAGE}],
            [{"media_id": video.pk, "media_type": MediaType.VIDEO}],
        )

    def test_house_scope_defaults_to_all_and_accepts_explicit_all(self):
        expected_ids = {
            self.overlap_house.pk,
            self.estate_house.pk,
            self.estate_only_house.pk,
            self.landlord_house.pk,
            self.unassigned_house.pk,
        }

        default_response = self.client.get("/api/house/houses/", {"page": 1, "page_size": 20})
        explicit_response = self.client.get("/api/house/houses/", {"page": 1, "page_size": 20, "scope": "all"})

        self.assertEqual(default_response.status_code, 200)
        self.assertEqual(explicit_response.status_code, 200)
        self.assertEqual({item["id"] for item in api_data(default_response)["items"]}, expected_ids)
        self.assertEqual({item["id"] for item in api_data(explicit_response)["items"]}, expected_ids)

    def test_house_scope_mine_and_legacy_responsibility_are_compatible(self):
        PropertyResponsibility.objects.create(organization=self.org, member=self.member, estate=self.estate)
        self.login_as(self.employee)
        expected_ids = {self.overlap_house.pk, self.estate_house.pk, self.estate_only_house.pk}

        scope_response = self.client.get("/api/house/houses/", {"page": 1, "page_size": 20, "scope": "mine"})
        legacy_response = self.client.get("/api/house/houses/", {"page": 1, "page_size": 20, "responsibility": "mine"})
        matching_response = self.client.get(
            "/api/house/houses/",
            {"page": 1, "page_size": 20, "scope": "mine", "responsibility": "mine"},
        )

        self.assertEqual(scope_response.status_code, 200)
        self.assertEqual(legacy_response.status_code, 200)
        self.assertEqual(matching_response.status_code, 200)
        self.assertEqual({item["id"] for item in api_data(scope_response)["items"]}, expected_ids)
        self.assertEqual({item["id"] for item in api_data(legacy_response)["items"]}, expected_ids)
        self.assertEqual({item["id"] for item in api_data(matching_response)["items"]}, expected_ids)

    def test_asset_tree_scope_mine_filters_estates_buildings_and_counts(self):
        PropertyResponsibility.objects.create(organization=self.org, member=self.member, estate=self.estate)
        self.login_as(self.employee)

        estates_response = self.client.get("/api/house/estates/", {"page": 1, "page_size": 20, "scope": "mine"})
        buildings_response = self.client.get("/api/house/buildings/", {"page": 1, "page_size": 20, "scope": "mine"})

        self.assertEqual(estates_response.status_code, 200)
        self.assertEqual(buildings_response.status_code, 200)
        estates = api_data(estates_response)["items"]
        buildings = api_data(buildings_response)["items"]
        self.assertEqual([item["id"] for item in estates], [self.estate.pk])
        self.assertEqual(estates[0]["building_count"], 2)
        self.assertEqual(estates[0]["counts"]["total"], 3)
        self.assertEqual({item["id"] for item in buildings}, {self.building.pk, self.estate_only_building.pk})
        self.assertEqual(sum(item["counts"]["total"] for item in buildings), 3)

    def test_house_scope_rejects_conflicting_responsibility_filters(self):
        conflicting_legacy_response = self.client.get(
            "/api/house/houses/",
            {"page": 1, "page_size": 20, "scope": "all", "responsibility": "mine"},
        )
        conflicting_member_response = self.client.get(
            "/api/house/houses/",
            {"page": 1, "page_size": 20, "scope": "mine", "responsible_member_id": self.member.pk},
        )
        self.assertEqual(conflicting_legacy_response.status_code, 422)
        self.assertEqual(conflicting_member_response.status_code, 422)

    def test_inspection_due_lists_only_current_employee_responsibilities_and_reports_reasons(self):
        setting = DefaultSetting.objects.create(
            key=INSPECTION_MAX_AGE_DAYS_SETTING_KEY,
            value=180,
            value_type="integer",
            ui={"scopes": ["organization"]},
        )
        inspection_building = Building.objects.create(
            organization=self.org,
            estate=self.other_estate,
            name="待勘察楼栋",
            address="海景待勘察楼栋",
            floors=12,
        )
        PropertyResponsibility.objects.create(organization=self.org, member=self.member, building=inspection_building)
        images, videos = self.make_inspection_media_refs()
        missing_images = House.objects.create(building=inspection_building, room_number="901", videos=videos)
        missing_videos = House.objects.create(building=inspection_building, room_number="902", images=images)
        expired = House.objects.create(building=inspection_building, room_number="903", images=images, videos=videos)
        fresh = House.objects.create(building=inspection_building, room_number="904", images=images, videos=videos)
        unassigned = House.objects.create(building=self.other_building, room_number="905")
        now = timezone.now()
        House.objects.filter(pk=expired.pk).update(updated_at=now - timedelta(days=181))
        House.objects.filter(pk=fresh.pk).update(updated_at=now - timedelta(days=179))
        self.login_as(self.employee)

        response = self.client.get(
            "/api/house/houses/",
            {"page": 1, "page_size": 20, "scope": "mine", "inspection_due": True},
        )

        self.assertEqual(response.status_code, 200)
        payload = api_data(response)
        items = {item["id"]: item for item in payload["items"]}
        self.assertEqual(set(items), {missing_images.pk, missing_videos.pk, expired.pk})
        self.assertNotIn(fresh.pk, items)
        self.assertNotIn(unassigned.pk, items)
        self.assertEqual(items[missing_images.pk]["inspection_reasons"], ["missing_images"])
        self.assertEqual(items[missing_videos.pk]["inspection_reasons"], ["missing_videos"])
        self.assertEqual(items[expired.pk]["inspection_reasons"], ["expired"])
        self.assertEqual(items[expired.pk]["inspection_max_age_days"], setting.value)
        self.assertIsNotNone(items[expired.pk]["inspection_due_at"])
        self.assertIsNotNone(items[expired.pk]["updated_at"])

        all_due_response = self.client.get(
            "/api/house/houses/",
            {"page": 1, "page_size": 20, "scope": "all", "inspection_due": True},
        )
        self.assertEqual(all_due_response.status_code, 200)
        self.assertIn(unassigned.pk, {item["id"] for item in api_data(all_due_response)["items"]})

    def test_inspection_due_uses_organization_max_age_override(self):
        setting = DefaultSetting.objects.create(
            key=INSPECTION_MAX_AGE_DAYS_SETTING_KEY,
            value=180,
            value_type="integer",
            ui={"scopes": ["organization"]},
        )
        OrganizationSetting.objects.create(organization=self.org, setting=setting, value=30)
        inspection_building = Building.objects.create(
            organization=self.org,
            estate=self.other_estate,
            name="租户周期楼栋",
            address="海景租户周期楼栋",
            floors=12,
        )
        PropertyResponsibility.objects.create(organization=self.org, member=self.member, building=inspection_building)
        images, videos = self.make_inspection_media_refs()
        house = House.objects.create(building=inspection_building, room_number="906", images=images, videos=videos)
        House.objects.filter(pk=house.pk).update(updated_at=timezone.now() - timedelta(days=31))
        self.login_as(self.employee)

        response = self.client.get(
            "/api/house/houses/",
            {"page": 1, "page_size": 20, "scope": "mine", "inspection_due": True},
        )

        self.assertEqual(response.status_code, 200)
        item = api_data(response)["items"][0]
        self.assertEqual(item["id"], house.pk)
        self.assertEqual(item["inspection_reasons"], ["expired"])
        self.assertEqual(item["inspection_max_age_days"], 30)

    def test_inspection_due_filters_by_reason(self):
        DefaultSetting.objects.create(
            key=INSPECTION_MAX_AGE_DAYS_SETTING_KEY,
            value=180,
            value_type="integer",
            ui={"scopes": ["organization"]},
        )
        inspection_building = Building.objects.create(
            organization=self.org,
            estate=self.other_estate,
            name="原因筛选楼栋",
            address="海景原因筛选楼栋",
            floors=12,
        )
        PropertyResponsibility.objects.create(organization=self.org, member=self.member, building=inspection_building)
        images, videos = self.make_inspection_media_refs()
        missing_images = House.objects.create(building=inspection_building, room_number="911", videos=videos)
        missing_videos = House.objects.create(building=inspection_building, room_number="912", images=images)
        expired = House.objects.create(building=inspection_building, room_number="913", images=images, videos=videos)
        House.objects.filter(pk=expired.pk).update(updated_at=timezone.now() - timedelta(days=181))
        self.login_as(self.employee)

        expected_by_reason = {
            "missing_images": missing_images.pk,
            "missing_videos": missing_videos.pk,
            "expired": expired.pk,
        }
        for reason, expected_id in expected_by_reason.items():
            with self.subTest(reason=reason):
                response = self.client.get(
                    "/api/house/houses/",
                    {
                        "page": 1,
                        "page_size": 20,
                        "scope": "mine",
                        "inspection_due": True,
                        "inspection_reason": reason,
                    },
                )
                self.assertEqual(response.status_code, 200)
                self.assertEqual([item["id"] for item in api_data(response)["items"]], [expected_id])

    def test_confirm_current_refreshes_house_updated_at_and_clears_expired_reason(self):
        DefaultSetting.objects.create(
            key=INSPECTION_MAX_AGE_DAYS_SETTING_KEY,
            value=180,
            value_type="integer",
            ui={"scopes": ["organization"]},
        )
        inspection_building = Building.objects.create(
            organization=self.org,
            estate=self.other_estate,
            name="资料确认楼栋",
            address="海景资料确认楼栋",
            floors=12,
        )
        PropertyResponsibility.objects.create(organization=self.org, member=self.member, building=inspection_building)
        images, videos = self.make_inspection_media_refs()
        house = House.objects.create(building=inspection_building, room_number="914", images=images, videos=videos)
        expired_at = timezone.now() - timedelta(days=181)
        House.objects.filter(pk=house.pk).update(updated_at=expired_at)
        self.login_as(self.employee)

        response = self.client.patch(
            f"/api/house/houses/{house.pk}/",
            data=json.dumps({"confirm_current": True}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        house.refresh_from_db()
        self.assertGreater(house.updated_at, expired_at)
        due_response = self.client.get(
            "/api/house/houses/",
            {"page": 1, "page_size": 20, "scope": "mine", "inspection_due": True},
        )
        self.assertEqual(due_response.status_code, 200)
        self.assertEqual(api_data(due_response)["items"], [])

    def test_replace_list_and_filter_responsible_houses(self):
        building_update_response = self.client.put(
            f"/api/house/staff-responsibilities/{self.building_member.pk}/",
            data=json.dumps({"landlord_ids": [], "building_ids": [self.building.pk], "estate_ids": []}),
            content_type="application/json",
        )
        self.assertEqual(building_update_response.status_code, 200)
        self.assertEqual([item["id"] for item in api_data(building_update_response)["buildings"]], [self.building.pk])

        update_response = self.client.put(
            f"/api/house/staff-responsibilities/{self.member.pk}/",
            data=json.dumps({"landlord_ids": [self.landlord.pk], "building_ids": [], "estate_ids": [self.estate.pk]}),
            content_type="application/json",
        )

        self.assertEqual(update_response.status_code, 200)
        updated = api_data(update_response)
        self.assertEqual(updated["member_id"], self.member.pk)
        self.assertEqual([item["id"] for item in updated["landlords"]], [self.landlord.pk])
        self.assertEqual(updated["buildings"], [])
        self.assertEqual([item["id"] for item in updated["estates"]], [self.estate.pk])
        self.assertEqual(updated["responsible_house_count"], 3)
        responsibility = PropertyResponsibility.objects.get(member=self.member, landlord=self.landlord)
        self.assertEqual(responsibility.created_by, self.owner.username)
        self.assertEqual(responsibility.updated_by, self.owner.username)

        list_response = self.client.get("/api/house/staff-responsibilities/", {"page": 1, "page_size": 20, "keyword": "维修"})
        listed = api_data(list_response)
        self.assertEqual(listed["total"], 1)
        self.assertEqual(listed["items"][0]["member_id"], self.member.pk)

        houses_response = self.client.get(
            "/api/house/houses/",
            {"page": 1, "page_size": 20, "scope": "all", "responsible_member_id": self.member.pk},
        )
        house_ids = {item["id"] for item in api_data(houses_response)["items"]}
        self.assertEqual(house_ids, {self.overlap_house.pk, self.estate_only_house.pk, self.landlord_house.pk})
        self.assertNotIn(self.estate_house.pk, house_ids)
        self.assertNotIn(self.unassigned_house.pk, house_ids)

        building_houses_response = self.client.get("/api/house/houses/", {"page": 1, "page_size": 20, "responsible_member_id": self.building_member.pk})
        building_house_ids = {item["id"] for item in api_data(building_houses_response)["items"]}
        self.assertEqual(building_house_ids, {self.estate_house.pk})
        self.assertNotIn(self.overlap_house.pk, building_house_ids)

    def test_invalid_cross_org_target_does_not_clear_existing_assignments(self):
        PropertyResponsibility.objects.create(organization=self.org, member=self.member, estate=self.estate)
        other_org = baker.make("organizations.Organization", name="其他组织", slug="responsibility-other-org")
        other_landlord = Contact.objects.create(organization=other_org, name="其他房东", phone="13800138002", roles=[ContactRole.LANDLORD])

        response = self.client.put(
            f"/api/house/staff-responsibilities/{self.member.pk}/",
            data=json.dumps({"landlord_ids": [other_landlord.pk], "building_ids": [], "estate_ids": []}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 422)
        self.assertTrue(PropertyResponsibility.objects.filter(member=self.member, estate=self.estate).exists())

    def test_get_single_member_responsibility(self):
        PropertyResponsibility.objects.create(organization=self.org, member=self.member, estate=self.estate)

        response = self.client.get(f"/api/house/staff-responsibilities/{self.member.pk}/")

        self.assertEqual(response.status_code, 200)
        payload = api_data(response)
        self.assertEqual(payload["member_id"], self.member.pk)
        self.assertEqual([item["id"] for item in payload["estates"]], [self.estate.pk])

    def test_list_responsibilities_filters_by_team(self):
        team = baker.make("teams.Team", organization=self.org)
        team.members.add(self.employee)

        response = self.client.get(
            "/api/house/staff-responsibilities/",
            {"page": 1, "page_size": 20, "team_id": team.pk},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual([item["member_id"] for item in api_data(response)["items"]], [self.member.pk])

    def test_team_responsibility_summary_aggregates_all_members(self):
        team = baker.make("teams.Team", organization=self.org)
        team.members.add(self.employee, self.building_employee)
        PropertyResponsibility.objects.create(organization=self.org, member=self.member, estate=self.estate)

        response = self.client.get(
            "/api/house/staff-responsibilities/summary/",
            {"team_id": team.pk},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            api_data(response),
            {
                "member_count": 2,
                "configured_member_count": 1,
                "unconfigured_member_count": 1,
                "responsible_house_count_sum": 3,
            },
        )

    def test_model_rejects_non_landlord_contact_as_target(self):
        tenant = Contact.objects.create(organization=self.org, name="租客", phone="13800138003", roles=[ContactRole.TENANT])

        with self.assertRaises(ValidationError):
            PropertyResponsibility.objects.create(organization=self.org, member=self.member, landlord=tenant)

    def test_model_requires_exactly_one_of_landlord_building_or_estate(self):
        with self.assertRaises(ValidationError):
            PropertyResponsibility.objects.create(
                organization=self.org,
                member=self.member,
                landlord=self.landlord,
                building=self.building,
            )
