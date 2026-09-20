import json
from datetime import timedelta
from types import SimpleNamespace
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.contrib.auth.signals import user_logged_in
from django.test import TestCase, override_settings
from django.utils import timezone

from model_bakery import baker

from apps.ai.runtime.contracts import AIErrorCode, AIExecutionError
from apps.house.ai_insights import build_house_public_snapshot
from apps.house.constants import EstatePropertyType
from apps.house.models import Building, Estate, House, HouseAIInsight
from apps.organizations.signals import user_logged_in_receiver
from apps.settings.models import DefaultSetting
from tests.api_helpers import api_data

User = get_user_model()


def generated_payload(*, fact_id: str = "rent"):
    return {
        "conclusion": {"text": "付款条件清晰，租客可以快速判断是否符合预算。", "fact_ids": [fact_id]},
        "signals": [
            {"label": "付款信息", "value": "租金条件明确", "tone": "neutral", "fact_ids": [fact_id]},
            {"label": "户型体验", "value": "两居空间", "tone": "positive", "fact_ids": ["layout"]},
        ],
        "appeal_points": [{"text": "户型和租金信息清晰，便于租客初步筛选。", "fact_ids": [fact_id, "layout"]}],
        "viewing_questions": [
            {"text": "具体什么时候可以入住？", "fact_ids": [fact_id], "missing_field_keys": []},
            {"text": "是否可以补充房源视频？", "fact_ids": [], "missing_field_keys": ["videos"]},
        ],
    }


class HousePublicSnapshotTests(TestCase):
    def test_snapshot_uses_public_fields_and_shared_single_room_formatter(self):
        organization = baker.make("organizations.Organization")
        estate = Estate.objects.create(
            organization=organization,
            name="云岸",
            display_name="云岸公寓",
            property_type=EstatePropertyType.RESIDENTIAL,
            province="广东",
            city="深圳",
            district="南山",
        )
        building = Building.objects.create(organization=organization, estate=estate, name="1栋", address="科技园 1 号", floors=20)
        landlord = baker.make("house.Contact", organization=organization, name="敏感房东", phone="13800138000", roles=["landlord"])
        house = House.objects.create(
            building=building,
            landlord=landlord,
            room_number="101",
            bedrooms=1,
            living_rooms=0,
            asking_rent="3500",
            area="32",
            internal_notes="底价 3000，禁止公开",
        )

        snapshot = build_house_public_snapshot(house)
        serialized = json.dumps(snapshot.facts, ensure_ascii=False)

        self.assertIn("单间", serialized)
        self.assertNotIn("敏感房东", serialized)
        self.assertNotIn("13800138000", serialized)
        self.assertNotIn("底价 3000", serialized)


@override_settings(AI_ENABLED=True, HOUSE_AI_INSIGHT_CACHE_HOURS=24)
class HouseAIInsightApiTests(TestCase):
    @classmethod
    def setUpClass(cls):
        user_logged_in.disconnect(user_logged_in_receiver)
        super().setUpClass()

    @classmethod
    def tearDownClass(cls):
        user_logged_in.connect(user_logged_in_receiver)
        super().tearDownClass()

    def setUp(self):
        self.user = User.objects.create_user(username="house-ai-owner", password="secret")  # noqa: S106
        self.org = baker.make("organizations.Organization", name="AI 试点组织", slug="house-ai-org")
        baker.make("organizations.OrganizationMember", organization=self.org, user=self.user, is_owner=True)
        DefaultSetting.objects.update_or_create(
            key="ai.allowed_capabilities",
            defaults={
                "value": ["structured_extract"],
                "value_type": "json",
                "widget": "json_editor",
                "ui": {"scopes": ["organization"]},
            },
        )
        self.client.force_login(self.user)
        self._select_org()
        estate = Estate.objects.create(
            organization=self.org,
            name="星河湾",
            display_name="星河湾",
            property_type=EstatePropertyType.RESIDENTIAL,
            province="广东",
            city="深圳",
            district="南山",
        )
        building = Building.objects.create(organization=self.org, estate=estate, name="1栋", address="科技园 1 号", floors=20)
        self.landlord = baker.make("house.Contact", organization=self.org, name="张房东", phone="13800138000", roles=["landlord"])
        self.house = House.objects.create(
            building=building,
            landlord=self.landlord,
            room_number="1801",
            asking_rent="4200",
            deposit_amount="4200",
            bedrooms=2,
            living_rooms=1,
            area="80",
            orientation="south",
            decoration="fine",
            public_description="近地铁，采光通透。",
            internal_notes="内部底价 3900，不得公开。",
        )

    def _select_org(self):
        session = self.client.session
        session["organization_data"] = json.dumps({"pk": self.org.pk, "id": self.org.pk, "name": self.org.name, "slug": self.org.slug, "is_owner": True})
        session.save()

    def test_generate_creates_structured_shared_insight_without_private_input(self):
        response = self.client.get(f"/api/house/houses/{self.house.pk}/ai-insight/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(api_data(response)["state"], "not_generated")

        with patch("apps.house.ai_insights.generate", return_value=SimpleNamespace(invocation_id=None, data=generated_payload())) as generate_mock:
            response = self.client.post(f"/api/house/houses/{self.house.pk}/ai-insight/generate/")

        self.assertEqual(response.status_code, 200)
        payload = api_data(response)
        self.assertEqual(payload["state"], "fresh")
        self.assertEqual(payload["insight"]["conclusion"]["fact_ids"], ["rent"])
        self.assertEqual(payload["insight"]["signals"][0]["label"], "付款信息")
        self.assertTrue(HouseAIInsight.objects.filter(house=self.house).exists())
        variables = generate_mock.call_args.kwargs["variables"]
        model_input = f"{variables['facts_json']} {variables['missing_fields_json']}"
        self.assertNotIn("张房东", model_input)
        self.assertNotIn("13800138000", model_input)
        self.assertNotIn("内部底价", model_input)

    def test_fresh_result_is_shared_between_users_without_second_model_call(self):
        second_user = User.objects.create_user(username="second-house-ai-owner", password="secret")  # noqa: S106
        baker.make("organizations.OrganizationMember", organization=self.org, user=second_user, is_owner=True)

        with patch("apps.house.ai_insights.generate", return_value=SimpleNamespace(invocation_id=None, data=generated_payload())) as generate_mock:
            first = self.client.post(f"/api/house/houses/{self.house.pk}/ai-insight/generate/")
            self.client.force_login(second_user)
            self._select_org()
            second = self.client.post(f"/api/house/houses/{self.house.pk}/ai-insight/generate/")

        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 200)
        self.assertEqual(generate_mock.call_count, 1)
        self.assertEqual(api_data(second)["insight"], api_data(first)["insight"])

    def test_expired_result_survives_source_changes_until_regeneration(self):
        with patch("apps.house.ai_insights.generate", return_value=SimpleNamespace(invocation_id=None, data=generated_payload())):
            self.client.post(f"/api/house/houses/{self.house.pk}/ai-insight/generate/")
        insight = HouseAIInsight.objects.get(house=self.house)
        insight.expires_at = timezone.now() - timedelta(minutes=1)
        insight.save(update_fields=["expires_at", "updated_at"])
        original_summary = insight.content["conclusion"]["text"]
        self.house.asking_rent = "4600"
        self.house.save()

        response = self.client.get(f"/api/house/houses/{self.house.pk}/ai-insight/")

        payload = api_data(response)
        self.assertEqual(payload["state"], "expired")
        self.assertTrue(payload["source_changed"])
        self.assertEqual(payload["insight"]["conclusion"]["text"], original_summary)
        self.assertIn("¥4,200/月", {fact["value"] for fact in payload["insight"]["facts"]})

    def test_insufficient_public_data_and_unknown_fact_references_are_rejected(self):
        sparse = House.objects.create(building=self.house.building, room_number="1802")
        insufficient = self.client.post(f"/api/house/houses/{sparse.pk}/ai-insight/generate/")
        self.assertEqual(insufficient.status_code, 422)

        with patch(
            "apps.house.ai_insights.generate",
            return_value=SimpleNamespace(invocation_id=None, data=generated_payload(fact_id="internal_notes")),
        ):
            invalid = self.client.post(f"/api/house/houses/{self.house.pk}/ai-insight/generate/")

        self.assertEqual(invalid.status_code, 422)
        self.assertFalse(HouseAIInsight.objects.filter(house=self.house).exists())

    def test_failed_regeneration_keeps_expired_insight(self):
        with patch("apps.house.ai_insights.generate", return_value=SimpleNamespace(invocation_id=None, data=generated_payload())):
            self.client.post(f"/api/house/houses/{self.house.pk}/ai-insight/generate/")
        insight = HouseAIInsight.objects.get(house=self.house)
        insight.expires_at = timezone.now() - timedelta(minutes=1)
        insight.save(update_fields=["expires_at", "updated_at"])

        with patch(
            "apps.house.ai_insights.generate",
            side_effect=AIExecutionError(AIErrorCode.PROVIDER_UNAVAILABLE, "AI 服务暂时不可用。", retryable=True),
        ):
            response = self.client.post(f"/api/house/houses/{self.house.pk}/ai-insight/generate/")

        self.assertEqual(response.status_code, 503)
        insight.refresh_from_db()
        self.assertEqual(insight.content["conclusion"]["text"], "付款条件清晰，租客可以快速判断是否符合预算。")

    def test_legacy_cached_content_is_normalized_for_the_new_ui(self):
        now = timezone.now()
        snapshot = build_house_public_snapshot(self.house)
        HouseAIInsight.objects.create(
            house=self.house,
            schema_version=1,
            content={
                "summary": {"text": "旧版摘要", "fact_ids": ["rent"]},
                "highlights": [{"text": "旧版判断", "fact_ids": ["rent"]}],
                "verification_items": ["旧版核实事项"],
            },
            source_facts=snapshot.facts,
            missing_fields=snapshot.missing_fields,
            source_snapshot_hash=snapshot.snapshot_hash,
            generated_at=now,
            expires_at=now + timedelta(hours=1),
        )

        response = self.client.get(f"/api/house/houses/{self.house.pk}/ai-insight/")

        self.assertEqual(response.status_code, 200)
        payload = api_data(response)
        self.assertEqual(payload["state"], "expired")
        insight = payload["insight"]
        self.assertEqual(insight["conclusion"]["text"], "旧版摘要")
        self.assertEqual(insight["signals"][0]["label"], "重点信息")
        self.assertEqual(insight["viewing_questions"][0], {"text": "旧版核实事项", "fact_ids": [], "missing_field_keys": []})

        with patch("apps.house.ai_insights.generate", return_value=SimpleNamespace(invocation_id=None, data=generated_payload())) as generate_mock:
            regenerated = self.client.post(f"/api/house/houses/{self.house.pk}/ai-insight/generate/")

        self.assertEqual(regenerated.status_code, 200)
        self.assertEqual(api_data(regenerated)["state"], "fresh")
        self.assertEqual(HouseAIInsight.objects.get(house=self.house).schema_version, 3)
        generate_mock.assert_called_once()
