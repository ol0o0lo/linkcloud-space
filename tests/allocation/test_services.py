from datetime import date, datetime, timedelta
from decimal import Decimal
from unittest.mock import patch
from zoneinfo import ZoneInfo

from django.core.exceptions import ValidationError
from django.db.models import ProtectedError
from django.test import TestCase
from django.utils import timezone

from model_bakery import baker

from apps.accounts.models import User
from apps.allocation.constants import AccrualEntryType, AllocationRequestStatus
from apps.allocation.exceptions import AllocationExpiredException, AllocationInvalidException
from apps.allocation.models import AccrualEntry
from apps.allocation.queries import monthly_accrual_totals_for_org
from apps.allocation.services import create_manual_entry
from apps.house.allocation_services import create_lease_with_allocation, review_lease_allocation, void_lease_allocation
from apps.house.constants import ContactRole, EstatePropertyType, LeaseStatus
from apps.house.models import Building, Contact, Estate, House
from apps.house.tasks import expire_lease_allocation_requests_task
from apps.settings.models import DefaultSetting


class AllocationServiceTestCase(TestCase):
    def setUp(self):
        self.submitter = User.objects.create_user(username="submitter", password="secret", first_name="提交人")  # noqa: S106
        self.beneficiary_a = User.objects.create_user(username="beneficiary-a", password="secret", first_name="员工甲")  # noqa: S106
        self.beneficiary_b = User.objects.create_user(username="beneficiary-b", password="secret", first_name="员工乙")  # noqa: S106
        self.org = baker.make("organizations.Organization", name="收益分配组织", slug="allocation-org")
        for user in (self.submitter, self.beneficiary_a, self.beneficiary_b):
            baker.make("organizations.OrganizationMember", organization=self.org, user=user)
        DefaultSetting.objects.update_or_create(
            key="property_rental.lease_allocation_rule",
            defaults={
                "value": {"method": "percentage", "rate_bp": 9000, "fixed_amount": None},
                "value_type": "json",
                "widget": "json_editor",
                "label": "签约员工收益规则",
                "description": "登记签约时使用的员工收益规则。",
                "category": "property_rental",
                "ui": {"scopes": ["organization", "team"], "inherit_org": True, "control": "lease_allocation_rule"},
            },
        )
        self.estate = Estate.objects.create(
            organization=self.org,
            name="云岸",
            display_name="云岸一期",
            property_type=EstatePropertyType.RESIDENTIAL,
            province="广东",
            city="深圳",
            district="南山",
            address="科技园",
        )
        self.building = Building.objects.create(organization=self.org, estate=self.estate, name="1 栋", address="科技园 1 栋", floors=20)
        self.landlord = Contact.objects.create(organization=self.org, name="房东", phone="13800138000", roles=[ContactRole.LANDLORD])
        self.tenant = Contact.objects.create(organization=self.org, name="租客", phone="13900139000", roles=[ContactRole.TENANT])
        self.house = House.objects.create(building=self.building, landlord=self.landlord, room_number="1201")

    def create_link(self, *, submitted_at=None):
        return create_lease_with_allocation(
            organization=self.org,
            submitted_by=self.submitter,
            lease_data={
                "house": self.house,
                "tenant": self.tenant,
                "sign_at": submitted_at,
                "start_date": date(2026, 1, 1),
                "end_date": date(2026, 12, 31),
                "monthly_rent": Decimal("5000.00"),
                "deposit": Decimal("5000.00"),
                "payment_day": 1,
                "contract_files": [],
                "notes": "",
                "extra": {},
            },
            beneficiary_user_ids=[self.beneficiary_a.pk, self.beneficiary_b.pk],
            submitted_at=submitted_at,
        )

    def test_create_allocation_request_calculates_amounts_and_freezes_content(self):
        submitted_at = datetime(2026, 1, 31, 23, 30, tzinfo=ZoneInfo("Asia/Shanghai"))
        link = self.create_link(submitted_at=submitted_at)
        allocation_request = link.allocation_request
        lines = list(allocation_request.shares.order_by("sort_order"))

        self.assertEqual(link.lease.status, LeaseStatus.ACTIVE)
        self.assertEqual(allocation_request.status, AllocationRequestStatus.PENDING)
        self.assertEqual(allocation_request.basis_amount, Decimal("5000.00"))
        self.assertEqual(allocation_request.distributable_amount, Decimal("4500.00"))
        self.assertEqual(allocation_request.expires_at, submitted_at + timedelta(hours=168))
        self.assertEqual([line.allocated_amount for line in lines], [Decimal("2250.00"), Decimal("2250.00")])
        self.assertEqual(sum(line.weight_bp for line in lines), 10000)

        allocation_request.basis_amount = Decimal("901.00")
        with self.assertRaises(ValidationError):
            allocation_request.save()
        lines[0].allocated_amount = Decimal("1.00")
        with self.assertRaises(ValidationError):
            lines[0].save()
        with self.assertRaises(ValidationError):
            allocation_request.shares.update(allocated_amount=Decimal("1.00"))

    def test_approve_is_idempotent_and_attributes_entries_to_submission_month(self):
        submitted_at = datetime(2026, 1, 31, 23, 30, tzinfo=ZoneInfo("Asia/Shanghai"))
        link = self.create_link(submitted_at=submitted_at)
        reviewed_at = submitted_at + timedelta(days=3)

        review_lease_allocation(
            organization=self.org,
            lease_id=link.lease_id,
            reviewer=self.submitter,
            approved=True,
            reviewed_at=reviewed_at,
        )
        review_lease_allocation(
            organization=self.org,
            lease_id=link.lease_id,
            reviewer=self.submitter,
            approved=True,
            reviewed_at=reviewed_at,
        )

        link.allocation_request.refresh_from_db()
        entries = list(AccrualEntry.objects.filter(organization=self.org).order_by("allocation_share__sort_order"))
        self.assertEqual(link.allocation_request.status, AllocationRequestStatus.APPROVED)
        self.assertEqual(len(entries), 2)
        self.assertEqual([entry.effective_month for entry in entries], [date(2026, 1, 1), date(2026, 1, 1)])
        self.assertEqual([entry.amount for entry in entries], [Decimal("2250.00"), Decimal("2250.00")])

    def test_approve_revalidates_beneficiaries_are_current_members(self):
        link = self.create_link()
        self.org.organizationmember_set.filter(user=self.beneficiary_a).delete()

        with self.assertRaises(ValidationError):
            review_lease_allocation(organization=self.org, lease_id=link.lease_id, reviewer=self.submitter, approved=True)

        link.allocation_request.refresh_from_db()
        self.assertEqual(link.allocation_request.status, AllocationRequestStatus.PENDING)
        self.assertFalse(AccrualEntry.objects.exists())

    def test_review_at_expiry_boundary_expires_and_terminates_lease(self):
        submitted_at = datetime(2026, 1, 1, 10, 0, tzinfo=ZoneInfo("Asia/Shanghai"))
        link = self.create_link(submitted_at=submitted_at)

        with self.assertRaises(AllocationExpiredException):
            review_lease_allocation(
                organization=self.org,
                lease_id=link.lease_id,
                reviewer=self.submitter,
                approved=True,
                reviewed_at=submitted_at + timedelta(hours=168),
            )

        link.lease.refresh_from_db()
        link.allocation_request.refresh_from_db()
        self.assertEqual(link.lease.status, LeaseStatus.TERMINATED)
        self.assertEqual(link.allocation_request.status, AllocationRequestStatus.EXPIRED)
        self.assertFalse(AccrualEntry.objects.exists())

    def test_expiration_task_expires_due_application(self):
        link = self.create_link(submitted_at=timezone.now() - timedelta(hours=169))

        expired_count = expire_lease_allocation_requests_task()

        link.lease.refresh_from_db()
        link.allocation_request.refresh_from_db()
        self.assertEqual(expired_count, 1)
        self.assertEqual(link.lease.status, LeaseStatus.TERMINATED)
        self.assertEqual(link.allocation_request.status, AllocationRequestStatus.EXPIRED)

    def test_reject_requires_reason_and_notification_failure_does_not_rollback(self):
        link = self.create_link()

        with self.assertRaises(AllocationInvalidException):
            review_lease_allocation(
                organization=self.org,
                lease_id=link.lease_id,
                reviewer=self.submitter,
                approved=False,
                reason="",
            )

        with (
            patch("apps.allocation.tasks.send_allocation_notification_task.delay", side_effect=RuntimeError("broker unavailable")),
            self.captureOnCommitCallbacks(execute=True),
        ):
            review_lease_allocation(
                organization=self.org,
                lease_id=link.lease_id,
                reviewer=self.submitter,
                approved=False,
                reason="资料不完整",
            )

        link.lease.refresh_from_db()
        link.allocation_request.refresh_from_db()
        self.assertEqual(link.lease.status, LeaseStatus.TERMINATED)
        self.assertEqual(link.allocation_request.status, AllocationRequestStatus.REJECTED)
        self.assertEqual(link.allocation_request.rejection_reason, "资料不完整")
        self.assertFalse(AccrualEntry.objects.exists())

    def test_void_appends_one_reversal_per_original_and_is_idempotent(self):
        link = self.create_link()
        review_lease_allocation(organization=self.org, lease_id=link.lease_id, reviewer=self.submitter, approved=True)

        void_lease_allocation(organization=self.org, lease_id=link.lease_id, actor=self.submitter, reason="原申请金额有误")
        void_lease_allocation(organization=self.org, lease_id=link.lease_id, actor=self.submitter, reason="重复请求")

        link.lease.refresh_from_db()
        link.allocation_request.refresh_from_db()
        originals = AccrualEntry.objects.filter(entry_type=AccrualEntryType.ALLOCATION).order_by("pk")
        reversals = AccrualEntry.objects.filter(entry_type=AccrualEntryType.REVERSAL).order_by("reversal_of_id")
        self.assertEqual(link.lease.status, LeaseStatus.TERMINATED)
        self.assertEqual(link.allocation_request.status, AllocationRequestStatus.VOIDED)
        self.assertEqual(reversals.count(), originals.count())
        self.assertEqual([entry.amount for entry in reversals], [-entry.amount for entry in originals])

    def test_terminating_lease_directly_does_not_reverse_approved_entries(self):
        link = self.create_link()
        review_lease_allocation(organization=self.org, lease_id=link.lease_id, reviewer=self.submitter, approved=True)

        link.lease.status = LeaseStatus.TERMINATED
        link.lease.save(update_fields=("status", "updated_at"))

        self.assertEqual(AccrualEntry.objects.filter(entry_type=AccrualEntryType.ALLOCATION).count(), 2)
        self.assertFalse(AccrualEntry.objects.filter(entry_type=AccrualEntryType.REVERSAL).exists())

    def test_manual_entries_use_signed_amounts_and_monthly_totals_group_by_user(self):
        created_at = datetime(2026, 8, 31, 23, 30, tzinfo=ZoneInfo("Asia/Shanghai"))
        increase = create_manual_entry(
            organization=self.org,
            beneficiary_user=self.beneficiary_a,
            entry_type=AccrualEntryType.MANUAL_INCREASE,
            amount=Decimal("100.00"),
            reason="奖金",
            actor=self.submitter,
            effective_at=created_at,
        )
        self.beneficiary_a.first_name = "员工甲新名"
        self.beneficiary_a.save(update_fields=("first_name",))
        decrease = create_manual_entry(
            organization=self.org,
            beneficiary_user=self.beneficiary_a,
            entry_type=AccrualEntryType.MANUAL_DECREASE,
            amount=Decimal("20.00"),
            reason="罚款",
            actor=self.submitter,
            effective_at=created_at,
        )

        totals = list(monthly_accrual_totals_for_org(self.org))
        self.assertEqual(increase.amount, Decimal("100.00"))
        self.assertEqual(decrease.amount, Decimal("-20.00"))
        self.assertEqual(increase.effective_month, date(2026, 8, 1))
        self.assertEqual(len(totals), 1)
        self.assertEqual(totals[0]["total_amount"], Decimal("80.00"))
        self.assertEqual(totals[0]["entry_count"], 2)

    def test_standalone_building_source_snapshot_does_not_require_estate(self):
        standalone_building = Building.objects.create(organization=self.org, estate=None, name="海滨公寓", address="海滨路 20 号", floors=8)
        self.house = House.objects.create(building=standalone_building, landlord=self.landlord, room_number="801")

        link = self.create_link()

        snapshot = link.allocation_request.source_snapshot
        self.assertIsNone(snapshot["house"]["estate_id"])
        self.assertIsNone(snapshot["house"]["estate_name"])

    def test_cross_organization_beneficiary_is_rejected_and_history_is_protected(self):
        outsider = User.objects.create_user(username="outsider", password="secret")  # noqa: S106
        other_org = baker.make("organizations.Organization", name="其他组织", slug="other-allocation-org")
        baker.make("organizations.OrganizationMember", organization=other_org, user=outsider)

        with self.assertRaises(AllocationInvalidException):
            create_lease_with_allocation(
                organization=self.org,
                submitted_by=self.submitter,
                lease_data={
                    "house": self.house,
                    "tenant": self.tenant,
                    "start_date": date(2026, 1, 1),
                    "end_date": date(2026, 12, 31),
                    "monthly_rent": Decimal("5000.00"),
                },
                beneficiary_user_ids=[outsider.pk],
            )

        link = self.create_link()
        review_lease_allocation(organization=self.org, lease_id=link.lease_id, reviewer=self.submitter, approved=True)
        with self.assertRaises(ProtectedError):
            self.beneficiary_a.delete()
        with self.assertRaises(ProtectedError):
            link.lease.delete()
