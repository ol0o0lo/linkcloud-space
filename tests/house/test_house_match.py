import json
from datetime import timedelta
from decimal import Decimal

from django.core.exceptions import ValidationError
from django.test import TestCase
from django.utils import timezone

from model_bakery import baker

from apps.accounts.models import User
from apps.house.constants import EstatePropertyType, HouseMatchMode, HouseStatus
from apps.house.models import Building, Estate, House, HouseMatchShare
from tests.api_helpers import api_data, api_error


class HouseMatchTestCase(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="match-agent", password="secret", first_name="小云", last_name="顾问")  # noqa: S106
        self.user.set_phone_number("+8613800138000", verified=True)
        self.user.save()
        self.organization = baker.make("organizations.Organization", name="配房组织", slug="match-org", is_active=True)
        baker.make("organizations.OrganizationMember", organization=self.organization, user=self.user, is_owner=True)
        self.client.force_login(self.user)
        session = self.client.session
        session["organization_data"] = json.dumps(
            {
                "pk": self.organization.pk,
                "id": self.organization.pk,
                "name": self.organization.name,
                "slug": self.organization.slug,
                "is_owner": True,
            }
        )
        session.save()
        self.estate = Estate.objects.create(
            organization=self.organization,
            name="云岸花园",
            display_name="云岸花园",
            property_type=EstatePropertyType.RESIDENTIAL,
            province="广东",
            city="深圳",
            district="南山",
            address="科技园路",
        )
        self.building = Building.objects.create(
            organization=self.organization,
            estate=self.estate,
            name="1栋",
            address="科技园路 1 号",
            floors=20,
        )

    def make_house(
        self,
        room_number: str,
        *,
        status: str = HouseStatus.LISTED,
        asking_rent: Decimal = Decimal("3000.00"),
        area: Decimal = Decimal("40.00"),
        building: Building | None = None,
    ) -> House:
        return House.objects.create(
            building=building or self.building,
            room_number=room_number,
            status=status,
            asking_rent=asking_rent,
            area=area,
            bedrooms=1,
            living_rooms=0,
        )

    def post_share(self, payload: dict):
        return self.client.post("/api/house-match-shares/", data=json.dumps(payload), content_type="application/json")


class HouseMatchModelTests(HouseMatchTestCase):
    def test_manual_share_normalizes_ids_and_keeps_a_separate_consultant(self):
        share = HouseMatchShare.objects.create(
            organization=self.organization,
            consultant=self.user,
            share_key="manual-normalized",
            title="  南山一房推荐  ",
            remark="  统一备注  ",
            mode=HouseMatchMode.MANUAL,
            house_ids=[3, "2", 3, 1],
            expires_at=timezone.now() + timedelta(days=30),
            created_by="audit-user",
        )

        self.assertEqual(share.house_ids, [3, 2, 1])
        self.assertEqual(share.title, "南山一房推荐")
        self.assertEqual(share.remark, "统一备注")
        self.assertEqual(share.consultant, self.user)
        self.assertEqual(share.created_by, "audit-user")
        self.assertEqual(share.updated_by, "")

    def test_share_rejects_mixed_or_empty_modes_and_manual_limit(self):
        invalid_values = [
            {
                "share_key": "manual-with-criteria",
                "mode": HouseMatchMode.MANUAL,
                "house_ids": [1],
                "criteria": {"district": "南山"},
            },
            {
                "share_key": "dynamic-with-houses",
                "mode": HouseMatchMode.DYNAMIC,
                "house_ids": [1],
                "criteria": {"district": "南山"},
            },
            {
                "share_key": "dynamic-sort-only",
                "mode": HouseMatchMode.DYNAMIC,
                "criteria": {"sort": "latest"},
            },
            {
                "share_key": "manual-too-many",
                "mode": HouseMatchMode.MANUAL,
                "house_ids": list(range(1, 102)),
            },
        ]

        for values in invalid_values:
            with self.subTest(values["share_key"]), self.assertRaises(ValidationError):
                HouseMatchShare.objects.create(
                    organization=self.organization,
                    consultant=self.user,
                    title="配房",
                    expires_at=timezone.now() + timedelta(days=1),
                    **values,
                )


class HouseMatchApiTests(HouseMatchTestCase):
    def test_create_manual_share_validates_scope_and_returns_one_time_link(self):
        first = self.make_house("101")
        second = self.make_house("102")

        response = self.post_share(
            {
                "title": "南山精选",
                "remark": "这批房源都可以预约",
                "mode": "manual",
                "house_ids": [second.pk, first.pk, second.pk],
            }
        )

        self.assertEqual(response.status_code, 201)
        payload = api_data(response)
        share = HouseMatchShare.objects.get(share_key=payload["share_key"])
        self.assertEqual(share.house_ids, [second.pk, first.pk])
        self.assertEqual(share.organization, self.organization)
        self.assertEqual(share.consultant, self.user)
        self.assertEqual(share.created_by, self.user.username)
        self.assertIn(f"/h5/#/pages/house-match/index?key={share.share_key}", payload["share_url"])
        self.assertIsNotNone(payload["expires_at"])

        other_org = baker.make("organizations.Organization", slug="match-other")
        other_estate = baker.make(
            Estate,
            organization=other_org,
            name="其他小区",
            display_name="其他小区",
            province="广东",
            city="深圳",
            district="福田",
        )
        other_building = baker.make(Building, organization=other_org, estate=other_estate, name="2栋", address="福田路", floors=10)
        foreign_house = self.make_house("201", building=other_building)
        invalid_response = self.post_share({"title": "越权配房", "mode": "manual", "house_ids": [foreign_house.pk]})
        self.assertEqual(invalid_response.status_code, 400)
        self.assertIn("当前组织", api_error(invalid_response)["message"])

    def test_manual_share_is_anonymous_ordered_and_skips_unlisted_houses(self):
        first = self.make_house("101")
        second = self.make_house("102")
        response = self.post_share({"title": "手工配房", "mode": "manual", "house_ids": [second.pk, first.pk]})
        share_key = api_data(response)["share_key"]
        second.status = HouseStatus.VACANT
        second.save()
        HouseMatchShare.objects.filter(share_key=share_key).update(house_ids=[str(first.pk), "bad-id", 999999])
        self.client.logout()

        info_response = self.client.get(f"/api/public/house-match-shares/{share_key}/")
        houses_response = self.client.get(f"/api/public/house-match-shares/{share_key}/houses/", {"page": 1, "page_size": 1})

        self.assertEqual(info_response.status_code, 200)
        info = api_data(info_response)
        self.assertEqual(info["title"], "手工配房")
        self.assertEqual(info["consultant"]["name"], "小云 顾问")
        self.assertEqual(info["consultant"]["phone"], "+8613800138000")
        self.assertEqual(info_response["Cache-Control"], "no-store")
        self.assertEqual(houses_response.status_code, 200)
        houses = api_data(houses_response)
        self.assertEqual([item["id"] for item in houses["items"]], [first.pk])
        self.assertEqual(set(houses), {"items", "total", "page", "page_size"})
        self.assertEqual((houses["total"], houses["page"], houses["page_size"]), (1, 1, 1))
        self.assertNotIn("internal_notes", houses["items"][0])

    def test_dynamic_share_uses_live_filters_and_scopes_detail(self):
        matching = self.make_house("101", asking_rent=Decimal("3200.00"))
        too_cheap = self.make_house("102", asking_rent=Decimal("2200.00"))
        response = self.post_share(
            {
                "title": "动态配房",
                "mode": "dynamic",
                "criteria": {"district": "南山", "min_rent": "3000", "sort": "rent_asc"},
                "expires_at": None,
            }
        )
        share_key = api_data(response)["share_key"]

        first_result = api_data(self.client.get(f"/api/public/house-match-shares/{share_key}/houses/"))
        added_later = self.make_house("103", asking_rent=Decimal("3500.00"))
        second_result = api_data(self.client.get(f"/api/public/house-match-shares/{share_key}/houses/"))

        self.assertEqual([item["id"] for item in first_result["items"]], [matching.pk])
        self.assertEqual([item["id"] for item in second_result["items"]], [matching.pk, added_later.pk])
        self.assertNotIn(too_cheap.pk, [item["id"] for item in second_result["items"]])
        self.assertEqual(self.client.get(f"/api/public/house-match-shares/{share_key}/houses/{matching.pk}/").status_code, 200)
        self.assertEqual(self.client.get(f"/api/public/house-match-shares/{share_key}/houses/{too_cheap.pk}/").status_code, 404)

    def test_expired_unknown_version_disabled_org_and_unavailable_consultant(self):
        house = self.make_house("101")
        manual_response = self.post_share({"title": "会过期", "mode": "manual", "house_ids": [house.pk]})
        manual_share = HouseMatchShare.objects.get(share_key=api_data(manual_response)["share_key"])
        HouseMatchShare.objects.filter(pk=manual_share.pk).update(expires_at=timezone.now() - timedelta(seconds=1))
        self.assertEqual(self.client.get(f"/api/public/house-match-shares/{manual_share.share_key}/").status_code, 410)

        dynamic_response = self.post_share({"title": "旧规则", "mode": "dynamic", "criteria": {"district": "南山"}})
        dynamic_share = HouseMatchShare.objects.get(share_key=api_data(dynamic_response)["share_key"])
        HouseMatchShare.objects.filter(pk=dynamic_share.pk).update(criteria_version=2)
        self.assertEqual(self.client.get(f"/api/public/house-match-shares/{dynamic_share.share_key}/houses/").status_code, 422)

        HouseMatchShare.objects.filter(pk=dynamic_share.pk).update(criteria_version=1)
        self.user.is_active = False
        self.user.save(update_fields=["is_active"])
        consultant_payload = api_data(self.client.get(f"/api/public/house-match-shares/{dynamic_share.share_key}/"))
        self.assertIsNone(consultant_payload["consultant"])

        self.organization.is_active = False
        self.organization.save(update_fields=["is_active"])
        self.assertEqual(self.client.get(f"/api/public/house-match-shares/{dynamic_share.share_key}/").status_code, 404)

    def test_anonymous_user_cannot_create_share(self):
        house = self.make_house("101")
        self.client.logout()

        response = self.post_share({"title": "匿名创建", "mode": "manual", "house_ids": [house.pk]})

        self.assertIn(response.status_code, {401, 403})

    def test_user_can_list_only_own_shares_in_current_organization(self):
        house = self.make_house("101")
        own_response = self.post_share({"title": "我的历史配房", "mode": "manual", "house_ids": [house.pk]})
        own_share = HouseMatchShare.objects.get(share_key=api_data(own_response)["share_key"])
        other_user = baker.make(User)
        baker.make("organizations.OrganizationMember", organization=self.organization, user=other_user)
        baker.make(
            HouseMatchShare,
            organization=self.organization,
            consultant=other_user,
            title="同组织其他顾问",
            mode=HouseMatchMode.MANUAL,
            house_ids=[house.pk],
            expires_at=timezone.now() + timedelta(days=10),
        )

        response = self.client.get("/api/house-match-shares/?page=1&page_size=10")

        self.assertEqual(response.status_code, 200)
        data = api_data(response)
        self.assertEqual(data["total"], 1)
        self.assertEqual([item["id"] for item in data["items"]], [own_share.pk])
        item = data["items"][0]
        self.assertEqual(item["title"], "我的历史配房")
        self.assertEqual(item["share_url"], api_data(own_response)["share_url"])
        self.assertEqual(item["status"], "active")
        self.assertEqual(item["view_count"], 0)
        self.assertIsNone(item["last_accessed_at"])
        self.assertIsNone(item["revoked_at"])

    def test_user_can_extend_and_revoke_own_share(self):
        house = self.make_house("101")
        create_response = self.post_share({"title": "待延期配房", "mode": "manual", "house_ids": [house.pk]})
        share = HouseMatchShare.objects.get(share_key=api_data(create_response)["share_key"])
        extended_until = share.expires_at + timedelta(days=30)

        extend_response = self.client.post(
            f"/api/house-match-shares/{share.pk}/extend/",
            data=json.dumps({"expires_at": extended_until.isoformat()}),
            content_type="application/json",
        )

        self.assertEqual(extend_response.status_code, 200)
        share.refresh_from_db()
        self.assertEqual(share.expires_at, extended_until)
        self.assertEqual(api_data(extend_response)["expires_at"], extended_until.isoformat(timespec="milliseconds").replace("+00:00", "Z"))

        revoke_response = self.client.post(f"/api/house-match-shares/{share.pk}/revoke/")

        self.assertEqual(revoke_response.status_code, 200)
        share.refresh_from_db()
        self.assertIsNotNone(share.revoked_at)
        self.assertEqual(api_data(revoke_response)["status"], "revoked")
        self.client.logout()
        self.assertEqual(self.client.get(f"/api/public/house-match-shares/{share.share_key}/").status_code, 410)

    def test_public_overview_counts_one_access_but_house_reads_do_not(self):
        house = self.make_house("101")
        create_response = self.post_share({"title": "访问统计配房", "mode": "manual", "house_ids": [house.pk]})
        share = HouseMatchShare.objects.get(share_key=api_data(create_response)["share_key"])
        self.client.logout()

        info_response = self.client.get(f"/api/public/house-match-shares/{share.share_key}/")
        houses_response = self.client.get(f"/api/public/house-match-shares/{share.share_key}/houses/")
        detail_response = self.client.get(f"/api/public/house-match-shares/{share.share_key}/houses/{house.pk}/")

        self.assertEqual(info_response.status_code, 200)
        self.assertEqual(houses_response.status_code, 200)
        self.assertEqual(detail_response.status_code, 200)
        share.refresh_from_db()
        self.assertEqual(share.view_count, 1)
        self.assertIsNotNone(share.last_accessed_at)
