from datetime import datetime
from unittest.mock import patch
from zoneinfo import ZoneInfo

from django.test import TestCase
from django.utils import timezone

from model_bakery import baker

from apps.house.constants import ViewingRecordStatus
from apps.house.models import Building, House, ViewingRecord
from apps.house.queries.viewings import list_viewing_records


class ViewingWorkbenchFilterTests(TestCase):
    def setUp(self):
        self.org = baker.make("organizations.Organization")
        self.actor = baker.make("accounts.User", timezone="Asia/Shanghai")
        self.other = baker.make("accounts.User")
        baker.make("organizations.OrganizationMember", organization=self.org, user=self.actor)
        building = Building.objects.create(organization=self.org, name="工作台公寓", address="测试路1号", floors=5)
        self.house = House.objects.create(building=building, room_number="101")

    def viewing(self, hour, assigned_to=None, **changes):
        return ViewingRecord.objects.create(
            organization=self.org,
            house=self.house,
            customer_name="测试租客",
            customer_phone="13800138001",
            scheduled_at=datetime(2026, 10, 24, hour, 45, tzinfo=ZoneInfo("UTC")),
            assigned_to=assigned_to,
            **changes,
        )

    def query(self, **filters):
        return list_viewing_records(org=self.org, actor=self.actor, house_id=None, status=None, pending_lease=None, contact_missing=None, keyword=None, **filters)

    def test_today_uses_actor_timezone_even_before_token_auth_activates_timezone(self):
        previous_day = self.viewing(14, self.actor)
        mine = self.viewing(16, self.actor)
        self.viewing(17, self.other)
        self.viewing(18, self.actor, is_active=False)
        now = datetime(2026, 10, 24, 16, 30, tzinfo=ZoneInfo("UTC"))
        with timezone.override("UTC"), patch("django.utils.timezone.now", return_value=now):
            result = list(self.query(today=True, scope="mine"))
        self.assertEqual([record.pk for record in result], [mine.pk])
        self.assertNotIn(previous_day, result)

    def test_unassigned_filter_excludes_assigned_and_inactive_records(self):
        membership = self.org.organizationmember_set.get(user=self.actor)
        membership.is_owner = True
        membership.save(update_fields=["is_owner"])
        self.viewing(14, self.actor)
        pending = self.viewing(16, status=ViewingRecordStatus.SCHEDULED)
        self.viewing(17, is_active=False)
        self.assertEqual(list(self.query(unassigned=True)), [pending])
