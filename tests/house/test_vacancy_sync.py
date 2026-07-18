import json
from datetime import date, timedelta
from decimal import Decimal

from django.contrib.auth import user_logged_in
from django.test import TestCase

from model_bakery import baker

from apps.accounts.models import User
from apps.house.constants import ContactRole, HouseStatus, LeaseStatus
from apps.house.models import Building, Contact, House, Lease
from apps.house.vacancy_sync import VACANCY_SYNC_SETTING_KEY, parse_vacancy_text
from apps.organizations.signals import user_logged_in_receiver
from apps.settings.models import DefaultSetting, OrganizationSetting
from tests.api_helpers import api_data, api_error

SAMPLE_TEXT = """下元岗东街三巷1号
102复式大单间1380
202一房1750光线好
401一房1800无遮挡
501一房1800无遮挡
 一房1750无遮挡
602超级大单间1700无遮挡

上元岗西街50号
103一房 1450
104 单间 1250
203 一房 1700
204大 一房 1750
303 一房  1700
402大 单间 1400
403 一房 1750
502大单间1450
604 一房1800
"""


class VacancySyncApiTestCase(TestCase):
    @classmethod
    def setUpClass(cls):
        user_logged_in.disconnect(user_logged_in_receiver)
        super().setUpClass()

    def setUp(self):
        self.user = User.objects.create_user(username="vacancy-sync", password="secret")  # noqa: S106
        self.org = baker.make("organizations.Organization", name="房表同步组织", slug="vacancy-sync-org")
        baker.make("organizations.OrganizationMember", organization=self.org, user=self.user, is_owner=True)
        self.client.force_login(self.user)
        session = self.client.session
        session["organization_data"] = json.dumps({"pk": self.org.pk, "id": self.org.pk, "name": self.org.name, "slug": self.org.slug, "is_owner": True})
        session.save()

    def post_sync(self, payload):
        return self.client.post("/api/house/vacancy-sync/", data=json.dumps(payload), content_type="application/json")

    def preview(self, raw_text, **overrides):
        payload = {"mode": "preview", "raw_text": raw_text, "building_overrides": [], "ignored_lines": []}
        payload.update(overrides)
        return self.post_sync(payload)

    def apply_preview(self, raw_text, preview, **overrides):
        payload = {
            "mode": "apply",
            "raw_text": raw_text,
            "building_overrides": [],
            "ignored_lines": [],
            "plan_hash": preview["plan_hash"],
        }
        payload.update(overrides)
        return self.post_sync(payload)

    def test_parser_reports_missing_room_and_normalizes_types_and_tags(self):
        parsed = parse_vacancy_text(SAMPLE_TEXT)

        self.assertEqual(len(parsed["blocks"]), 2)
        missing = parsed["blocks"][0]["lines"][4]
        self.assertEqual(missing["line_number"], 6)
        self.assertEqual(missing["error_code"], "ROOM_NUMBER_MISSING")
        room_102 = parsed["blocks"][0]["lines"][0]
        room_202 = parsed["blocks"][0]["lines"][1]
        self.assertEqual((room_102["bedrooms"], room_102["living_rooms"]), (1, 0))
        self.assertEqual(room_102["tags"], ["复式", "大单间"])
        self.assertEqual((room_202["bedrooms"], room_202["living_rooms"]), (1, 1))
        self.assertEqual(room_202["tags"], ["采光好"])

        arabic_type = parse_vacancy_text("测试路1号\r\n2021房1厅1750")["blocks"][0]["lines"][0]
        self.assertEqual(arabic_type["room_number"], "202")
        self.assertEqual((arabic_type["bedrooms"], arabic_type["living_rooms"]), (1, 1))

    def test_preview_then_apply_creates_buildings_and_houses_with_one_endpoint(self):
        preview_response = self.preview(SAMPLE_TEXT, ignored_lines=[6])

        self.assertEqual(preview_response.status_code, 200)
        preview = api_data(preview_response)
        self.assertTrue(preview["can_apply"])
        self.assertEqual(preview["summary"]["buildings"], 2)
        self.assertEqual(preview["summary"]["valid_lines"], 14)
        self.assertEqual(preview["summary"]["ignored_lines"], 1)
        self.assertEqual(preview["summary"]["create_buildings"], 2)
        self.assertEqual(preview["summary"]["create_houses"], 14)

        apply_response = self.apply_preview(SAMPLE_TEXT, preview, ignored_lines=[6])

        self.assertEqual(apply_response.status_code, 200)
        applied = api_data(apply_response)
        self.assertTrue(applied["applied"])
        self.assertEqual(applied["mode"], "apply")
        first = Building.objects.get(organization=self.org, address="下元岗东街三巷1号")
        second = Building.objects.get(organization=self.org, address="上元岗西街50号")
        self.assertEqual(House.objects.filter(building__in=[first, second]).count(), 14)
        self.assertEqual(first.floors, 6)
        self.assertEqual(second.floors, 6)
        room_102 = House.objects.get(building=first, room_number="102")
        self.assertEqual(room_102.asking_rent, Decimal("1380"))
        self.assertEqual((room_102.bedrooms, room_102.living_rooms), (1, 0))
        self.assertEqual(room_102.tags, ["复式", "大单间"])
        self.assertEqual(room_102.status, HouseStatus.VACANT)

    def test_existing_building_sync_updates_full_vacancy_schedule_and_keeps_lease(self):
        building = Building.objects.create(organization=self.org, name="城中村楼栋", address="下元岗东街3巷一号", floors=8)
        landlord = Contact.objects.create(organization=self.org, name="房东", phone="13800138001", roles=[ContactRole.LANDLORD])
        tenant = Contact.objects.create(organization=self.org, name="租客", phone="13900139001", roles=[ContactRole.TENANT])
        listed = House.objects.create(building=building, landlord=landlord, room_number="102", status=HouseStatus.RENTED, tags=["近地铁"])
        absent = House.objects.create(building=building, room_number="101", status=HouseStatus.VACANT)
        inactive = House.objects.create(building=building, room_number="202", status=HouseStatus.INACTIVE)
        renovating = House.objects.create(building=building, room_number="203", status=HouseStatus.RENOVATING)
        second_inactive = House.objects.create(building=building, room_number="204", status=HouseStatus.INACTIVE)
        lease = Lease.objects.create(
            organization=self.org,
            house=listed,
            tenant=tenant,
            start_date=date.today(),
            end_date=date.today() + timedelta(days=365),
            monthly_rent=Decimal("1380"),
            status=LeaseStatus.ACTIVE,
        )
        raw_text = "下元岗东街三巷1号\n102复式大单间1500无遮挡"

        preview_response = self.preview(raw_text)
        preview = api_data(preview_response)

        self.assertEqual(preview_response.status_code, 200)
        self.assertTrue(preview["can_apply"])
        self.assertEqual(preview["blocks"][0]["building_match"]["building_id"], building.pk)
        self.assertEqual(preview["summary"]["update_houses"], 1)
        self.assertEqual(preview["summary"]["mark_vacant"], 1)
        self.assertEqual(preview["summary"]["mark_rented"], 1)
        self.assertEqual(preview["summary"]["preserve_special_status"], 1)

        response = self.apply_preview(raw_text, preview)

        self.assertEqual(response.status_code, 200)
        listed.refresh_from_db()
        absent.refresh_from_db()
        inactive.refresh_from_db()
        renovating.refresh_from_db()
        second_inactive.refresh_from_db()
        lease.refresh_from_db()
        self.assertEqual(listed.status, HouseStatus.VACANT)
        self.assertEqual(listed.asking_rent, Decimal("1500"))
        self.assertEqual(listed.tags, ["近地铁", "复式", "大单间", "无遮挡"])
        self.assertEqual(absent.status, HouseStatus.RENTED)
        self.assertEqual(inactive.status, HouseStatus.INACTIVE)
        self.assertEqual(renovating.status, HouseStatus.RENOVATING)
        self.assertEqual(second_inactive.status, HouseStatus.INACTIVE)
        self.assertEqual(lease.status, LeaseStatus.ACTIVE)

    def test_building_match_accepts_chinese_arabic_and_swapped_lane_number_variants(self):
        building = Building.objects.create(
            organization=self.org,
            name="下元岗东街三巷1号",
            address="下元岗东街三巷1号",
            floors=8,
        )

        for address in [
            "下元岗东街三巷1号",
            "下元岗东街3巷一号",
            "下元岗东街3巷1号",
            "下元岗东街1巷三号",
        ]:
            with self.subTest(address=address):
                response = self.preview(f"{address}\n101单间1200")

                self.assertEqual(response.status_code, 200)
                preview = api_data(response)
                self.assertEqual(
                    preview["blocks"][0]["building_match"]["building_id"],
                    building.pk,
                )

    def test_force_rented_org_setting_overwrites_renovating_but_preserves_inactive(self):
        setting = DefaultSetting.objects.create(
            key=VACANCY_SYNC_SETTING_KEY,
            value=False,
            value_type="boolean",
            widget="switch",
            ui={"scopes": ["organization"]},
        )
        OrganizationSetting.objects.create(organization=self.org, setting=setting, value=True)
        building = Building.objects.create(organization=self.org, name="强制同步楼栋", address="强制同步路1号", floors=5)
        House.objects.create(building=building, room_number="101", status=HouseStatus.VACANT)
        inactive = House.objects.create(building=building, room_number="102", status=HouseStatus.INACTIVE)
        renovating = House.objects.create(building=building, room_number="103", status=HouseStatus.RENOVATING)
        raw_text = "强制同步路1号\n101单间1200"

        preview = api_data(self.preview(raw_text))
        response = self.apply_preview(raw_text, preview)

        self.assertEqual(response.status_code, 200)
        inactive.refresh_from_db()
        renovating.refresh_from_db()
        self.assertEqual(inactive.status, HouseStatus.INACTIVE)
        self.assertEqual(renovating.status, HouseStatus.RENTED)

    def test_ambiguous_building_requires_override_and_cross_org_override_is_hidden(self):
        first = Building.objects.create(organization=self.org, name="1栋", address="同址路1号", floors=5)
        second = Building.objects.create(organization=self.org, name="2栋", address="同址路1号", floors=5)
        other_org = baker.make("organizations.Organization", name="其他组织", slug="vacancy-sync-other")
        other = Building.objects.create(organization=other_org, name="其他楼栋", address="其他路1号", floors=5)
        raw_text = "同址路1号\n101单间1200"

        ambiguous_response = self.preview(raw_text)
        ambiguous = api_data(ambiguous_response)

        self.assertEqual(ambiguous_response.status_code, 200)
        self.assertFalse(ambiguous["can_apply"])
        self.assertEqual({item["id"] for item in ambiguous["blocks"][0]["building_match"]["candidates"]}, {first.pk, second.pk})

        selected_response = self.preview(raw_text, building_overrides=[{"block_index": 0, "building_id": second.pk}])
        self.assertEqual(selected_response.status_code, 200)
        self.assertTrue(api_data(selected_response)["can_apply"])

        hidden_response = self.preview(raw_text, building_overrides=[{"block_index": 0, "building_id": other.pk}])
        self.assertEqual(hidden_response.status_code, 404)

    def test_listed_inactive_house_blocks_sync(self):
        building = Building.objects.create(organization=self.org, name="停用房源楼栋", address="停用房源路1号", floors=5)
        House.objects.create(building=building, room_number="101", status=HouseStatus.INACTIVE)

        response = self.preview("停用房源路1号\n101单间1200")
        payload = api_data(response)

        self.assertEqual(response.status_code, 200)
        self.assertFalse(payload["can_apply"])
        self.assertEqual(payload["errors"][0]["code"], "INACTIVE_HOUSE_CONFLICT")

    def test_apply_rejects_stale_plan_hash(self):
        building = Building.objects.create(organization=self.org, name="并发楼栋", address="并发路1号", floors=5)
        house = House.objects.create(building=building, room_number="101", status=HouseStatus.VACANT)
        raw_text = "并发路1号\n101单间1200"
        preview = api_data(self.preview(raw_text))
        house.internal_notes = "预览后被其他操作修改"
        house.save()

        response = self.apply_preview(raw_text, preview)

        self.assertEqual(response.status_code, 409)
        self.assertEqual(api_error(response)["error"], "VACANCY_SYNC_CONFLICT")

    def test_apply_requires_successful_preview_hash(self):
        response = self.post_sync({"mode": "apply", "raw_text": "新楼栋路1号\n101单间1200"})

        self.assertEqual(response.status_code, 409)
        self.assertEqual(api_error(response)["error"], "VACANCY_SYNC_CONFLICT")
