import json
from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth import user_logged_in
from django.test import TestCase, override_settings
from django.utils import timezone

from model_bakery import baker

from apps.accounts.models import User
from apps.analytics.models import AnalyticsEvent
from apps.house.constants import ContactRole, HouseStatus
from apps.house.models import Building, Contact, Estate, House, Lease, ViewingRecord
from apps.organizations.signals import user_logged_in_receiver
from tests.api_helpers import api_data


class AnalyticsApiTestCase(TestCase):
    @classmethod
    def setUpClass(cls):
        user_logged_in.disconnect(user_logged_in_receiver)
        super().setUpClass()

    def setUp(self):
        self.user = User.objects.create_user(username="analytics-owner", password="secret")  # noqa: S106
        self.org = baker.make("organizations.Organization", name="分析组织", slug="analytics-org")
        baker.make("organizations.OrganizationMember", organization=self.org, user=self.user, is_owner=True)
        self.client.force_login(self.user)
        session = self.client.session
        session["organization_data"] = json.dumps({"pk": self.org.pk, "id": self.org.pk, "name": self.org.name, "slug": self.org.slug, "is_owner": True})
        session.save()
        estate = Estate.objects.create(organization=self.org, name="云岸", display_name="云岸", province="广东", city="深圳", district="南山")
        self.building = Building.objects.create(organization=self.org, estate=estate, name="1栋", address="科技园 1 栋", floors=20)
        self.house = House.objects.create(building=self.building, room_number="101", status=HouseStatus.LISTED)

    def event_payload(self, **overrides):
        event = {
            "event_name": "house.view",
            "target_type": "house",
            "target_id": self.house.pk,
            "source": "h5",
            "anonymous_id": "visitor-a",
            "session_id": "session-a",
            "properties": {"page": "house_detail"},
        }
        event.update(overrides)
        return {"events": [event]}

    def test_collector_accepts_multiple_events_without_batch_suffix(self):
        self.client.logout()
        payload = self.event_payload()
        payload["events"].append(
            {
                **payload["events"][0],
                "event_name": "house.phone_click",
                "anonymous_id": "visitor-b",
                "session_id": "session-b",
            }
        )

        response = self.client.post("/api/analytics/events/", data=payload, content_type="application/json")
        legacy_response = self.client.post("/api/analytics/events/batch/", data=payload, content_type="application/json")
        legacy_public_response = self.client.post("/api/public/analytics/events/", data=payload, content_type="application/json")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(api_data(response)["accepted"], 2)
        self.assertEqual(legacy_response.status_code, 404)
        self.assertEqual(legacy_public_response.status_code, 404)

    def test_collector_resolves_org_without_selected_organization(self):
        session = self.client.session
        session.pop("organization_data", None)
        session.save()
        response = self.client.post("/api/analytics/events/", data=self.event_payload(), content_type="application/json")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(api_data(response)["accepted"], 1)
        event = AnalyticsEvent.objects.get()
        self.assertEqual(event.organization, self.org)
        self.assertEqual(event.actor, self.user)
        self.assertNotEqual(event.anonymous_id_hash, "visitor-a")
        self.assertEqual(event.visitor_key, f"user:{self.user.pk}")

    def test_collector_deduplicates_same_visitor_in_configured_window(self):
        first = self.client.post("/api/analytics/events/", data=self.event_payload(), content_type="application/json")
        second = self.client.post("/api/analytics/events/", data=self.event_payload(), content_type="application/json")

        self.assertEqual(api_data(first)["accepted"], 1)
        self.assertEqual(api_data(second)["duplicates"], 1)
        self.assertEqual(AnalyticsEvent.objects.count(), 1)

    def test_collector_only_accepts_public_events_for_listed_house(self):
        self.client.logout()
        response = self.client.post("/api/analytics/events/", data=self.event_payload(), content_type="application/json")
        self.house.status = HouseStatus.VACANT
        self.house.save(update_fields=["status", "updated_at"])
        hidden_response = self.client.post(
            "/api/analytics/events/",
            data=self.event_payload(anonymous_id="visitor-b", session_id="session-b"),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(api_data(response)["accepted"], 1)
        self.assertEqual(api_data(hidden_response)["accepted"], 0)
        self.assertEqual(len(api_data(hidden_response)["errors"]), 1)

    @override_settings(
        ANALYTICS_PUBLIC_RATE_LIMIT_PER_MINUTE=1,
        CACHES={"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache", "LOCATION": "analytics-rate-limit-test"}},
    )
    def test_collector_is_rate_limited(self):
        self.client.logout()
        first = self.client.post(
            "/api/analytics/events/",
            data=self.event_payload(),
            content_type="application/json",
            REMOTE_ADDR="198.51.100.10",
        )
        second = self.client.post(
            "/api/analytics/events/",
            data=self.event_payload(anonymous_id="visitor-rate-2"),
            content_type="application/json",
            REMOTE_ADDR="198.51.100.10",
        )

        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 429)

    def test_collector_rejects_unknown_properties_without_saving(self):
        response = self.client.post(
            "/api/analytics/events/",
            data=self.event_payload(properties={"phone": "13800138000"}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(api_data(response)["accepted"], 0)
        self.assertIn("不支持属性", api_data(response)["errors"][0]["message"])
        self.assertFalse(AnalyticsEvent.objects.exists())

    def test_collector_rejects_server_only_business_event(self):
        response = self.client.post(
            "/api/analytics/events/",
            data=self.event_payload(
                event_name="lease.created",
                properties={"source_viewing_record_id": None},
            ),
            content_type="application/json",
        )

        self.assertEqual(api_data(response)["accepted"], 0)
        self.assertIn("只能由服务端业务产生", api_data(response)["errors"][0]["message"])

    def test_overview_trends_and_target_ranking_aggregate_current_org(self):
        now = timezone.now()
        AnalyticsEvent.objects.create(
            organization=self.org,
            actor=self.user,
            event_name="house.view",
            target_type="house",
            target_id=str(self.house.pk),
            source="h5",
            visitor_key=f"user:{self.user.pk}",
            occurred_at=now,
        )
        AnalyticsEvent.objects.create(
            organization=self.org,
            event_name="house.phone_click",
            target_type="house",
            target_id=str(self.house.pk),
            source="h5",
            visitor_key="anonymous:another",
            occurred_at=now - timedelta(hours=1),
        )

        query = f"start_date={timezone.localdate()}&end_date={timezone.localdate()}&source=h5"
        overview = self.client.get(f"/api/analytics/overview/?{query}")
        trends = self.client.get(f"/api/analytics/trends/?{query}&event_names=house.view,house.phone_click")
        targets = self.client.get(f"/api/analytics/targets/?{query}&target_type=house&page=1&page_size=10")

        self.assertEqual(api_data(overview)["total_events"], 2)
        self.assertEqual(api_data(overview)["unique_visitors"], 2)
        self.assertEqual(sum(point["count"] for point in api_data(trends)), 2)
        self.assertEqual(api_data(targets)["total"], 1)
        self.assertEqual(api_data(targets)["items"][0]["metrics"], {"house.phone_click": 1, "house.view": 1})
        self.assertEqual(
            api_data(targets)["items"][0]["display_items"],
            [
                {"target_type": "building", "target_id": str(self.building.pk), "label": "1栋"},
                {"target_type": "house", "target_id": str(self.house.pk), "label": "101"},
            ],
        )

    def test_collector_uses_target_organization_instead_of_current_organization(self):
        other_org = baker.make("organizations.Organization", name="其他组织", slug="analytics-other")
        other_estate = Estate.objects.create(organization=other_org, name="异地", display_name="异地", province="广东", city="深圳", district="福田")
        other_building = Building.objects.create(organization=other_org, estate=other_estate, name="2栋", address="异地 2 栋", floors=10)
        other_house = House.objects.create(building=other_building, room_number="201", status=HouseStatus.LISTED)

        response = self.client.post(
            "/api/analytics/events/",
            data=self.event_payload(target_id=other_house.pk),
            content_type="application/json",
        )

        self.assertEqual(api_data(response)["accepted"], 1)
        self.assertEqual(AnalyticsEvent.objects.get().organization, other_org)

    def test_post_save_tracks_viewing_and_lease_creations_only(self):
        landlord = Contact.objects.create(organization=self.org, name="房东", phone="13800138001", roles=[ContactRole.LANDLORD])
        tenant = Contact.objects.create(organization=self.org, name="租客", phone="13800138002", roles=[ContactRole.TENANT])
        self.house.landlord = landlord
        self.house.save(update_fields=["landlord", "updated_at"])

        with self.captureOnCommitCallbacks(execute=True):
            viewing = ViewingRecord.objects.create(
                organization=self.org,
                house=self.house,
                contact=tenant,
                customer_name=tenant.name,
                customer_phone=tenant.phone,
                scheduled_at=timezone.now(),
            )
            lease = Lease.objects.create(
                organization=self.org,
                house=self.house,
                tenant=tenant,
                start_date=timezone.localdate(),
                end_date=timezone.localdate() + timedelta(days=365),
                monthly_rent=5000,
            )

        viewing_event = AnalyticsEvent.objects.get(event_name="viewing.requested")
        lease_event = AnalyticsEvent.objects.get(event_name="lease.created")
        for event in (viewing_event, lease_event):
            self.assertEqual(event.organization, self.org)
            self.assertEqual(event.target_type, "house")
            self.assertEqual(event.target_id, str(self.house.pk))
            self.assertEqual(event.source, "server")
            self.assertIsNone(event.actor)
        self.assertEqual(lease_event.properties, {"source_viewing_record_id": None})

        with self.captureOnCommitCallbacks(execute=True):
            viewing.notes = "仅更新备注"
            viewing.save(update_fields=["notes", "updated_at"])
            lease.notes = "仅更新备注"
            lease.save(update_fields=["notes", "updated_at"])

        self.assertEqual(AnalyticsEvent.objects.filter(event_name="viewing.requested").count(), 1)
        self.assertEqual(AnalyticsEvent.objects.filter(event_name="lease.created").count(), 1)

    def test_favorite_post_save_tracks_only_creations(self):
        favorite_url = f"/api/users/me/favorite/?target_type=house&target_id={self.house.pk}"

        with patch("apps.analytics.receivers.record_event_safely") as record_event_safely:
            with self.captureOnCommitCallbacks(execute=True):
                create_response = self.client.put(favorite_url)
            self.assertEqual(record_event_safely.call_count, 1)

            repeated_response = self.client.put(favorite_url)
            self.assertEqual(record_event_safely.call_count, 1)

            with self.captureOnCommitCallbacks(execute=True):
                remove_response = self.client.delete(favorite_url)
            self.assertEqual(record_event_safely.call_count, 1)

            with self.captureOnCommitCallbacks(execute=True):
                recreated_response = self.client.put(favorite_url)

        self.assertEqual(create_response.status_code, 201)
        self.assertEqual(repeated_response.status_code, 200)
        self.assertEqual(remove_response.status_code, 200)
        self.assertEqual(recreated_response.status_code, 201)
        self.assertEqual(record_event_safely.call_count, 2)
        for event_call in record_event_safely.call_args_list:
            args, kwargs = event_call
            self.assertEqual(args, ("house.favorite",))
            self.assertEqual(kwargs["target_type"], "house")
            self.assertEqual(kwargs["target_id"], str(self.house.pk))
            self.assertEqual(kwargs["actor"], self.user)
            self.assertEqual(kwargs["source"], "server")
            self.assertIsNone(kwargs["properties"])
            self.assertTrue(kwargs["idempotency_key"].startswith("house-favorite:"))
        self.assertNotEqual(record_event_safely.call_args_list[0].kwargs["idempotency_key"], record_event_safely.call_args_list[1].kwargs["idempotency_key"])
