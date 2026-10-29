import json
from datetime import datetime, timedelta
from unittest.mock import patch

from django.db import connection
from django.test import TestCase, override_settings
from django.utils import timezone

from model_bakery import baker

from apps.access.constants import AccessScope
from apps.accounts.models import User
from apps.house.constants import ContactRole, HouseStatus
from apps.house.models import Building, Contact, CustomerProfile, House, HouseInquiry, Lease, LeaseAllocation, ViewingRecord
from apps.messaging.models import Message
from apps.notifications.models import Notification
from apps.organizations.models import Organization
from apps.settings.models import DefaultSetting
from apps.teams.models import Team
from tests.access.helpers import bind_org_role, make_access_group
from tests.api_helpers import api_data


class RentalClosureTests(TestCase):
    def setUp(self):
        self.owner = baker.make("accounts.User", username="closure-owner")
        self.staff = baker.make("accounts.User", username="closure-staff")
        self.other = baker.make("accounts.User", username="closure-other")
        self.tenant_user = baker.make("accounts.User", username="closure-tenant")
        self.org = baker.make("organizations.Organization", slug="closure-org")
        for user in (self.owner, self.staff, self.other):
            baker.make("organizations.OrganizationMember", organization=self.org, user=user, is_owner=user == self.owner)
        building = Building.objects.create(organization=self.org, name="闭环公寓", address="测试路一号", floors=5)
        landlord = Contact.objects.create(organization=self.org, name="房东", phone="13900139000", roles=[ContactRole.LANDLORD])
        self.tenant = Contact.objects.create(organization=self.org, name="租客", phone="13800138000", roles=[ContactRole.TENANT])
        self.house = House.objects.create(building=building, landlord=landlord, room_number="101")
        self.login(self.owner)

    def login(self, user):
        self.client.force_login(user)
        self.client.defaults["HTTP_X_ORG_SLUG"] = self.org.slug

    def post(self, path, data):
        return self.client.post(path, data=json.dumps(data), content_type="application/json")

    def patch(self, path, data):
        return self.client.patch(path, data=json.dumps(data), content_type="application/json")

    def register(self):
        response = self.post("/api/house/leases/register-signing/", self.signing_payload())
        self.assertEqual(response.status_code, 201, response.content)
        return api_data(response)

    def signing_payload(self):
        return {
            "client_request_id": "sign-1",
            "lease": {
                "house_id": self.house.pk,
                "tenant_id": self.tenant.pk,
                "sign_at": "2026-01-31T17:00:00Z",
                "start_date": "2026-02-01",
                "end_date": "2027-01-31",
                "monthly_rent": "3000.00",
            },
        }

    def configure_rule(self):
        DefaultSetting.objects.update_or_create(
            key="property_rental.lease_allocation_rule",
            defaults={
                "value": {"method": "percentage", "rate_bp": 5000, "fixed_amount": None},
                "value_type": "json",
                "widget": "json_editor",
                "label": "收益规则",
                "category": "property_rental",
                "ui": {"scopes": ["organization", "team"], "inherit_org": True},
            },
        )

    def confirmed_allocation(self, path, **data):
        payload = {"mode": data.get("mode", "initial")}
        if data.get("previous_request_id") is not None:
            payload["previous_request_id"] = data["previous_request_id"]
        preview = self.post(f"{path}preview/", payload)
        self.assertEqual(preview.status_code, 200, preview.content)
        return self.post(path, {**data, "preview_hash": api_data(preview)["preview_hash"]})

    def test_initial_and_correction_require_preview_confirmation(self):
        self.configure_rule()
        lease = self.register()
        path = f"/api/house/leases/{lease['id']}/allocations/"
        missing = self.post(path, {"client_request_id": "missing-preview"})
        self.assertEqual(missing.status_code, 400, missing.content)
        initial = self.confirmed_allocation(path, client_request_id="confirmed-initial")
        self.assertEqual(initial.status_code, 201, initial.content)
        request_id = api_data(initial)["allocation_request"]["id"]
        self.assertEqual(self.post(f"{path}{request_id}/withdraw/", {}).status_code, 200)
        missing = self.post(path, {"client_request_id": "missing-correction-preview", "mode": "correction", "previous_request_id": request_id, "reason": "纠错"})
        self.assertEqual(missing.status_code, 400, missing.content)
        self.assertEqual(api_data(self.client.get(path))["total"], 1)

    def test_legacy_combined_http_entry_is_retired_without_writing_business_data(self):
        response = self.post("/api/house/leases/deal-signing/", {"lease": self.signing_payload()["lease"], "beneficiary_user_ids": [self.owner.pk]})
        self.assertEqual(response.status_code, 410, response.content)
        self.assertFalse(LeaseAllocation.objects.exists())
        self.assertFalse(self.house.leases.exists())
        self.house.refresh_from_db()
        self.assertEqual(self.house.status, HouseStatus.PAUSED)

    def test_voided_request_cannot_be_restored_by_ordinary_resubmit(self):
        self.configure_rule()
        lease = self.register()
        path = f"/api/house/leases/{lease['id']}/allocations/"
        initial = self.confirmed_allocation(path, client_request_id="initial-before-void")
        self.assertEqual(initial.status_code, 201, initial.content)
        request_id = api_data(initial)["allocation_request"]["id"]
        self.assertEqual(self.post(f"{path}{request_id}/review/", {"decision": "approve"}).status_code, 200)
        self.assertEqual(self.post(f"{path}{request_id}/void/", {"reason": "财务作废"}).status_code, 200)
        ordinary = self.post(path, {"client_request_id": "restore-voided", "mode": "resubmit", "previous_request_id": request_id})
        self.assertEqual(ordinary.status_code, 400, ordinary.content)
        correction = self.confirmed_allocation(path, client_request_id="correct-voided", mode="correction", previous_request_id=request_id, reason="重新确认成交依据")
        self.assertEqual(correction.status_code, 201, correction.content)

    def test_inquiry_conversion_only_returns_current_contact_summary(self):
        self.tenant.notes = "另一需求的私密备注"
        self.tenant.save(update_fields=["notes", "updated_at"])
        CustomerProfile.objects.create(contact=self.tenant, assigned_to=self.other, min_rent="6000", preferred_region="另一需求", wechat="private-global-wechat")
        inquiry = HouseInquiry.objects.create(organization=self.org, house=self.house, assigned_to=self.staff, phone=self.tenant.phone, wechat="current-wechat")
        notification = Notification.objects.create(
            organization=self.org,
            recipient=self.staff,
            target=self.house,
            category="house.contact",
            title="旧咨询",
            data={"house_id": self.house.pk, "phone": self.tenant.phone, "wechat": "legacy-wechat"},
        )
        self.login(self.staff)
        for path, expected_wechat in (
            (f"/api/house/inquiries/{inquiry.pk}/convert/", "current-wechat"),
            (f"/api/house/customer-inquiries/{notification.pk}/convert/", "legacy-wechat"),
        ):
            response = self.post(path, {})
            self.assertEqual(response.status_code, 200, response.content)
            self.assertEqual(api_data(response), {"id": self.tenant.pk, "name": self.tenant.name, "phone": self.tenant.phone, "wechat": expected_wechat})

    def test_legacy_viewing_list_and_detail_are_limited_to_assignee_or_customer_owner(self):
        CustomerProfile.objects.create(contact=self.tenant, assigned_to=self.other)
        private = ViewingRecord.objects.create(
            organization=self.org,
            house=self.house,
            contact=self.tenant,
            assigned_to=self.other,
            customer_name=self.tenant.name,
            customer_phone=self.tenant.phone,
            scheduled_at=timezone.now() + timedelta(days=1),
        )
        mine = ViewingRecord.objects.create(
            organization=self.org, house=self.house, assigned_to=self.staff, customer_name="我的带看", customer_phone="13800138001", scheduled_at=timezone.now() + timedelta(days=1)
        )
        self.login(self.staff)
        response = self.client.get("/api/house/viewing-records/")
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual([item["id"] for item in api_data(response)["items"]], [mine.pk])
        self.assertEqual(self.client.get(f"/api/house/viewing-records/{private.pk}/").status_code, 404)
        self.login(self.owner)
        self.assertEqual(self.client.get(f"/api/house/viewing-records/{private.pk}/").status_code, 200)

    def test_legacy_executor_can_process_and_sign_only_original_customer_and_house(self):
        profile = CustomerProfile.objects.create(contact=self.tenant, assigned_to=self.other)
        record = ViewingRecord.objects.create(
            organization=self.org,
            house=self.house,
            contact=self.tenant,
            assigned_to=self.staff,
            customer_name=self.tenant.name,
            customer_phone=self.tenant.phone,
            scheduled_at=timezone.now() + timedelta(days=1),
        )
        other_house = House.objects.create(building=self.house.building, landlord=self.house.landlord, room_number="102")
        own_contact = Contact.objects.create(organization=self.org, name="执行人自有客户", phone="13800138009", roles=[ContactRole.TENANT])
        CustomerProfile.objects.create(contact=own_contact, assigned_to=self.staff)
        self.login(self.other)
        path = f"/api/house/viewing-records/{record.pk}/"
        self.assertEqual(self.patch(path, {"notes": "客户原负责人仍可处理"}).status_code, 200)
        self.login(self.staff)
        self.assertEqual(self.client.get(path).status_code, 200)
        self.assertEqual(self.client.get(f"/api/house/customers/{self.tenant.pk}/").status_code, 404)
        for changes in ({"house_id": other_house.pk}, {"contact_id": own_contact.pk}, {"contact_id": None}):
            response = self.patch(path, changes)
            self.assertEqual(response.status_code, 403, response.content)
        for key, value in (("house_id", other_house.pk), ("tenant_id", own_contact.pk)):
            payload = self.signing_payload()
            payload["client_request_id"] = f"wrong-context-{key}"
            payload["lease"].update(source_viewing_record_id=record.pk)
            payload["lease"][key] = value
            response = self.post("/api/house/leases/register-signing/", payload)
            self.assertIn(response.status_code, (400, 403, 422), response.content)
        no_context = self.post("/api/house/leases/register-signing/", self.signing_payload())
        self.assertEqual(no_context.status_code, 403, no_context.content)
        viewed = self.patch(path, {"status": "viewed", "notes": "执行人完成本次带看"})
        self.assertEqual(viewed.status_code, 200, viewed.content)
        payload = self.signing_payload()
        payload["lease"]["source_viewing_record_id"] = record.pk
        signed = self.post("/api/house/leases/register-signing/", payload)
        self.assertEqual(signed.status_code, 201, signed.content)
        self.assertEqual(api_data(signed)["registered_by_id"], self.staff.pk)
        self.assertEqual(api_data(signed)["tenant_id"], self.tenant.pk)
        record.refresh_from_db()
        self.assertEqual(record.status, "converted")
        self.assertEqual((record.house_id, record.contact_id), (self.house.pk, self.tenant.pk))
        profile.refresh_from_db()
        self.assertEqual(profile.assigned_to_id, self.other.pk)

    @override_settings(TIME_ZONE="UTC")
    def test_naive_signing_datetime_uses_beijing_month_on_register_and_patch(self):
        payload = self.signing_payload()
        payload["lease"]["sign_at"] = "2026-10-31T20:00:00"
        registered = self.post("/api/house/leases/register-signing/", payload)
        self.assertEqual(registered.status_code, 201, registered.content)
        lease = api_data(registered)
        self.assertEqual(lease["performance_month"], "2026-10-01")
        same = self.patch(f"/api/house/leases/{lease['id']}/", {"sign_at": "2026-10-31T20:00:00"})
        self.assertEqual(same.status_code, 200, same.content)
        self.assertEqual(api_data(same)["sign_at"], lease["sign_at"])
        corrected = self.patch(f"/api/house/leases/{lease['id']}/", {"sign_at": "2026-09-30T20:00:00"})
        self.assertEqual(corrected.status_code, 200, corrected.content)
        self.assertEqual(api_data(corrected)["performance_month"], "2026-09-01")

    def test_related_writes_lock_organization_before_contact_user_or_inquiry(self):
        inquiry = HouseInquiry.objects.create(organization=self.org, house=self.house, contact=self.tenant, assigned_to=self.owner)
        self.tenant_user.set_phone_number("+8613800138017", verified=True)
        self.tenant_user.save(update_fields=["phone_country_code", "phone_national_number", "phone_verified"])
        self.house.status = HouseStatus.LISTED
        self.house.save(update_fields=["status", "updated_at"])
        tables = {model._meta.db_table: model.__name__ for model in (Organization, Contact, User, HouseInquiry, ViewingRecord)}
        locks = []

        def observe_lock(execute, sql, params, many, context):
            if "FOR UPDATE" in sql:
                for table, name in tables.items():
                    if f'FROM "{table}"' in sql:
                        locks.append(name)
                        break
            return execute(sql, params, many, context)

        def book():
            self.login(self.tenant_user)
            return self.post("/api/house/tenant/viewing-records/", {"house_id": self.house.pk, "scheduled_at": (timezone.now() + timedelta(days=1)).isoformat()})

        actions = (
            ("contact", lambda: self.patch(f"/api/house/contacts/{self.tenant.pk}/", {"phone": "13800138000"})),
            ("inquiry", lambda: self.post(f"/api/house/inquiries/{inquiry.pk}/assign/", {"assigned_to_id": self.staff.pk})),
            ("booking", book),
        )
        for name, action in actions:
            with self.subTest(action=name):
                locks.clear()
                with connection.execute_wrapper(observe_lock):
                    response = action()
                self.assertIn(response.status_code, (200, 201), response.content)
                self.assertEqual(locks[0], "Organization", locks)

    def test_real_notification_database_error_does_not_rollback_saved_inquiry(self):
        from apps.house.services.contacts import send_tenant_contact_request

        def fail_notification(*args, **kwargs):
            Notification.objects.bulk_create([Notification(recipient=self.owner, organization=self.org, title=None)])

        with patch("apps.messaging.notifications.notify", side_effect=fail_notification), self.captureOnCommitCallbacks(execute=True):
            inquiry = send_tenant_contact_request(house=self.house, user=self.tenant_user, channels=["wechat"], wechat="survives-database-error")
        self.assertIsNone(inquiry.notification_id)
        self.assertEqual(HouseInquiry.objects.get(pk=inquiry.pk).wechat, "survives-database-error")
        self.assertTrue(Message.objects.filter(pk=inquiry.message.pk).exists())

    def test_register_cannot_consume_another_members_hidden_legacy_viewing(self):
        private = ViewingRecord.objects.create(
            organization=self.org, house=self.house, assigned_to=self.other, customer_name="他人需求", customer_phone="13800138003", scheduled_at=timezone.now() + timedelta(days=1)
        )
        self.login(self.staff)
        payload = self.signing_payload()
        payload["lease"]["source_viewing_record_id"] = private.pk
        response = self.post("/api/house/leases/register-signing/", payload)
        self.assertEqual(response.status_code, 404, response.content)
        self.assertFalse(self.house.leases.exists())
        private.refresh_from_db()
        self.assertEqual(private.status, "scheduled")

    def test_hidden_legacy_viewing_without_contact_cannot_be_claimed_by_patch(self):
        private = ViewingRecord.objects.create(
            organization=self.org, house=self.house, assigned_to=self.other, customer_name="他人需求", customer_phone="13800138003", scheduled_at=timezone.now() + timedelta(days=1)
        )
        self.login(self.staff)
        path = f"/api/house/viewing-records/{private.pk}/"
        for changes in ({"notes": "猜ID写入"}, {"status": "viewed"}, {"assigned_to_id": self.staff.pk}):
            response = self.patch(path, changes)
            self.assertEqual(response.status_code, 404, response.content)
        self.assertEqual(self.client.get(path).status_code, 404)
        private.refresh_from_db()
        self.assertEqual(private.assigned_to_id, self.other.pk)
        self.assertEqual(private.status, "scheduled")
        self.assertEqual(private.notes, "")

    def test_historical_lease_visibility_and_patch_use_customer_owner_or_admin(self):
        profile = CustomerProfile.objects.create(contact=self.tenant, assigned_to=self.other)
        private = Lease.objects.create(organization=self.org, house=self.house, tenant=self.tenant, start_date="2026-02-01", end_date="2027-01-31", monthly_rent="3000")
        legacy_tenant = Contact.objects.create(organization=self.org, name="无档案历史租客", phone="13800138004", roles=[ContactRole.TENANT])
        missing_profile = Lease.objects.create(organization=self.org, house=self.house, tenant=legacy_tenant, start_date="2026-02-01", end_date="2027-01-31", monthly_rent="3000")
        self.login(self.staff)
        for lease in (private, missing_profile):
            path = f"/api/house/leases/{lease.pk}/"
            self.assertEqual(self.client.get(path).status_code, 404)
            self.assertEqual(self.patch(path, {"notes": "猜ID修改"}).status_code, 404)
        self.assertEqual(api_data(self.client.get("/api/house/leases/"))["total"], 0)
        group = make_access_group("legacy-lease-submitter", AccessScope.ORG, [("allocation", "submit")])
        bind_org_role(self.org, self.staff, group)
        preview = self.post(f"/api/house/leases/{missing_profile.pk}/allocations/preview/", {})
        self.assertEqual(preview.status_code, 403, preview.content)
        profile.assigned_to = self.staff
        profile.save(update_fields=["assigned_to", "updated_at"])
        self.assertEqual(self.client.get(f"/api/house/leases/{private.pk}/").status_code, 200)
        self.assertEqual(self.patch(f"/api/house/leases/{private.pk}/", {"notes": "客户原负责人维护"}).status_code, 200)
        self.login(self.owner)
        self.assertEqual(api_data(self.client.get("/api/house/leases/"))["total"], 2)
        self.assertEqual(self.patch(f"/api/house/leases/{missing_profile.pk}/", {"notes": "管理员补历史"}).status_code, 200)

    def test_consultation_reader_only_gets_lease_summary_without_mutating_storage(self):
        inquiry = HouseInquiry.objects.create(organization=self.org, house=self.house, contact=self.tenant, assigned_to=self.owner, phone=self.tenant.phone)
        payload = self.signing_payload()
        payload["lease"].update(source_inquiry_id=inquiry.pk, notes="合同内部备注", extra={"private": "私有合同字段"})
        signed = self.post("/api/house/leases/register-signing/", payload)
        self.assertEqual(signed.status_code, 201, signed.content)
        lease_id = api_data(signed)["id"]
        # 文件解析结果代表合同字段，测试不创建真实媒体资源。
        with patch.object(Lease, "contract_files_resolved", new_callable=property, fget=lambda _lease: [{"url": "https://example.com/private-contract.pdf"}]):
            self.assertEqual(self.post(f"/api/house/inquiries/{inquiry.pk}/assign/", {"assigned_to_id": self.staff.pk}).status_code, 200)
            self.login(self.staff)
            responses = [
                api_data(self.client.get(f"/api/house/leases/{lease_id}/")),
                api_data(self.client.get("/api/house/leases/"))["items"][0],
                api_data(self.client.get(f"/api/house/inquiries/{inquiry.pk}/"))["leases"][0],
            ]
            for lease in responses:
                self.assertFalse(lease["can_maintain"])
                self.assertEqual((lease["contract_files"], lease["notes"], lease["extra"]), ([], "", {}))
                self.assertEqual(lease["monthly_rent"], "3000.00")
            self.login(self.owner)
            full = api_data(self.client.get(f"/api/house/leases/{lease_id}/"))
            self.assertTrue(full["can_maintain"])
            self.assertEqual(full["notes"], "合同内部备注")
            self.assertEqual(full["extra"], {"private": "私有合同字段"})
            self.assertEqual(len(full["contract_files"]), 1)
        original = Lease.objects.get(pk=lease_id)
        self.assertEqual(original.notes, "合同内部备注")
        self.assertEqual(original.extra, {"private": "私有合同字段"})

    def test_confirming_existing_bound_contact_also_creates_customer_profile(self):
        self.tenant.user = self.tenant_user
        self.tenant.save(update_fields=["user", "updated_at"])
        inquiry = HouseInquiry.objects.create(organization=self.org, house=self.house, user=self.tenant_user, contact=self.tenant, assigned_to=self.staff, phone=self.tenant.phone)
        self.login(self.staff)
        response = self.post(f"/api/house/inquiries/{inquiry.pk}/convert/", {})
        self.assertEqual(response.status_code, 200, response.content)
        profile = CustomerProfile.objects.filter(contact=self.tenant).first()
        self.assertIsNotNone(profile)
        self.assertEqual(profile.assigned_to_id, self.staff.pk)

    def test_shared_confirmed_contact_fills_wechat_inquiries_and_legacy_blank_identity(self):
        from apps.house.services.inquiries import record_inquiry

        houses = [self.house]
        for room in ("102", "103", "104"):
            houses.append(House.objects.create(building=self.house.building, landlord=self.house.landlord, room_number=room))
        first = record_inquiry(house=houses[0], user=self.tenant_user, assigned_to=self.owner, wechat="first-wechat")
        shared = record_inquiry(house=houses[1], user=self.tenant_user, assigned_to=self.owner, wechat="second-wechat")
        confirmed = self.post(f"/api/house/inquiries/{first.pk}/convert/", {"name": "共同客户", "phone": "13800138005"})
        self.assertEqual(confirmed.status_code, 200, confirmed.content)
        contact_id = api_data(confirmed)["id"]
        shared.refresh_from_db()
        self.assertEqual((shared.customer_name, shared.phone), ("共同客户", "+8613800138005"))
        later = record_inquiry(house=houses[2], user=self.tenant_user, assigned_to=self.owner, wechat="later-wechat")
        self.assertEqual((later.customer_name, later.phone), ("共同客户", "+8613800138005"))
        blank = HouseInquiry.objects.create(organization=self.org, house=houses[3], contact_id=contact_id, assigned_to=self.owner, wechat="legacy-wechat")
        for inquiry in (shared, later, blank):
            detail = api_data(self.client.get(f"/api/house/inquiries/{inquiry.pk}/"))
            self.assertEqual((detail["customer_name"], detail["phone"]), ("共同客户", "+8613800138005"))
            updated = self.patch(f"/api/house/inquiries/{inquiry.pk}/", {"customer_name": detail["customer_name"], "phone": detail["phone"], "notes": "继续办理"})
            self.assertEqual(updated.status_code, 200, updated.content)
            viewing = self.post(
                "/api/house/viewing-records/",
                {
                    "house_id": inquiry.house_id,
                    "source_inquiry_id": inquiry.pk,
                    "contact_id": detail["contact_id"],
                    "customer_name": detail["customer_name"],
                    "customer_phone": detail["phone"],
                    "scheduled_at": (timezone.now() + timedelta(days=1)).isoformat(),
                },
            )
            self.assertEqual(viewing.status_code, 201, viewing.content)
        self.assertEqual(CustomerProfile.objects.get(contact_id=contact_id).assigned_to_id, self.owner.pk)

    def test_public_withdraw_requires_submitter_and_termination_has_internal_cancellation(self):
        self.configure_rule()
        group = make_access_group("original-registrar-submit", AccessScope.ORG, [("allocation", "submit")])
        bind_org_role(self.org, self.staff, group)
        self.login(self.staff)
        lease = self.register()
        path = f"/api/house/leases/{lease['id']}/"
        first = self.confirmed_allocation(f"{path}allocations/", client_request_id="staff-original")
        self.assertEqual(first.status_code, 201, first.content)
        first_id = api_data(first)["allocation_request"]["id"]
        self.login(self.owner)
        self.assertEqual(self.post(f"{path}allocations/{first_id}/withdraw/", {}).status_code, 403)
        self.assertEqual(self.post(f"{path}allocations/{first_id}/review/", {"decision": "reject", "reason": "财务退回核对"}).status_code, 200)
        submitted = self.post(f"{path}allocations/", {"client_request_id": "admin-on-behalf", "mode": "resubmit", "previous_request_id": first_id})
        self.assertEqual(submitted.status_code, 201, submitted.content)
        request_id = api_data(submitted)["allocation_request"]["id"]
        self.login(self.staff)
        denied = self.post(f"{path}allocations/{request_id}/withdraw/", {"reason": "租约提前终止，取消待审核收益申请。"})
        self.assertEqual(denied.status_code, 403, denied.content)
        terminated = self.patch(path, {"status": "terminated"})
        self.assertEqual(terminated.status_code, 200, terminated.content)
        self.login(self.owner)
        history = api_data(self.client.get(f"{path}allocations/"))["items"]
        self.assertEqual(history[0]["allocation_request"]["status"], "withdrawn")
        self.assertEqual(history[0]["allocation_request"]["withdrawn_by_id"], self.staff.pk)

    def test_register_signing_does_not_resolve_allocation_and_is_idempotent(self):
        with patch("apps.house.services.allocations.resolve_lease_allocation_rule", side_effect=RuntimeError("无收益规则")):
            response = self.post("/api/house/leases/register-signing/", self.signing_payload())
            self.assertEqual(response.status_code, 201, response.content)
            repeated = self.post("/api/house/leases/register-signing/", self.signing_payload())
        lease = api_data(response)
        self.assertEqual(api_data(repeated)["id"], lease["id"])
        self.assertEqual(lease["registered_by_id"], self.owner.pk)
        self.assertEqual(lease["performance_month"], "2026-02-01")
        self.assertEqual(LeaseAllocation.objects.count(), 0)
        self.house.refresh_from_db()
        self.assertEqual(self.house.status, HouseStatus.RENTED)

    def test_snapshot_resubmit_correction_and_reversal_keep_original_month(self):
        setting, _ = DefaultSetting.objects.update_or_create(
            key="property_rental.lease_allocation_rule",
            defaults={
                "value": {"method": "percentage", "rate_bp": 5000, "fixed_amount": None},
                "value_type": "json",
                "widget": "json_editor",
                "label": "收益规则",
                "category": "property_rental",
                "ui": {"scopes": ["organization", "team"], "inherit_org": True},
            },
        )
        lease = self.register()
        path = f"/api/house/leases/{lease['id']}/allocations/"
        first = self.confirmed_allocation(path, client_request_id="request-1", mode="initial")
        self.assertEqual(first.status_code, 201, first.content)
        request_id = api_data(first)["allocation_request"]["id"]
        self.assertEqual(api_data(first)["allocation_request"]["distributable_amount"], "1500.00")
        blocked = self.patch(f"/api/house/leases/{lease['id']}/", {"monthly_rent": "4000.00"})
        self.assertEqual(blocked.status_code, 400)
        rejected = self.post(f"{path}{request_id}/review/", {"decision": "reject", "reason": "补充说明"})
        self.assertEqual(rejected.status_code, 200, rejected.content)
        setting.value = {"method": "percentage", "rate_bp": 1000, "fixed_amount": None}
        setting.save()
        second = self.post(path, {"client_request_id": "request-2", "mode": "resubmit", "previous_request_id": request_id})
        self.assertEqual(second.status_code, 201, second.content)
        second_request = api_data(second)["allocation_request"]
        self.assertEqual(second_request["distributable_amount"], "1500.00")
        self.assertEqual(second_request["source_snapshot"], api_data(first)["allocation_request"]["source_snapshot"])
        stale = self.post(f"{path}{request_id}/review/", {"decision": "approve"})
        self.assertEqual(stale.status_code, 409)
        approved = self.post(f"{path}{second_request['id']}/review/", {"decision": "approve"})
        self.assertEqual(approved.status_code, 200, approved.content)
        voided = self.post(f"{path}{second_request['id']}/void/", {"reason": "成交租金录入错误"})
        self.assertEqual(voided.status_code, 200, voided.content)
        changed = self.patch(f"/api/house/leases/{lease['id']}/", {"monthly_rent": "4000.00"})
        self.assertEqual(changed.status_code, 200, changed.content)
        wrong_mode = self.post(path, {"client_request_id": "request-3", "mode": "resubmit", "previous_request_id": second_request["id"]})
        self.assertEqual(wrong_mode.status_code, 400)
        correction = self.confirmed_allocation(path, client_request_id="request-4", mode="correction", previous_request_id=second_request["id"], reason="纠正租金")
        self.assertEqual(correction.status_code, 201, correction.content)
        self.assertEqual(api_data(correction)["allocation_request"]["distributable_amount"], "400.00")
        self.assertEqual(api_data(correction)["allocation_request"]["performance_month"], "2026-02-01")
        history = api_data(self.client.get(path))
        self.assertEqual(history["total"], 3)
        entries = api_data(self.client.get("/api/allocation/entries/"))["items"]
        self.assertEqual({entry["effective_month"] for entry in entries}, {"2026-02-01"})
        self.assertEqual(sum(float(entry["amount"]) for entry in entries), 0)

    def test_inquiry_persists_without_notification_and_assignment_is_scoped(self):
        from apps.house.services.contacts import send_tenant_contact_request

        with patch("apps.messaging.notifications.notify", return_value=[]), self.captureOnCommitCallbacks(execute=True):
            first = send_tenant_contact_request(house=self.house, user=self.tenant_user, channels=["wechat"], wechat="tenant-wechat")
            repeated = send_tenant_contact_request(house=self.house, user=self.tenant_user, channels=["wechat"], wechat="tenant-wechat")
        self.assertEqual(first.pk, repeated.pk)
        self.assertIsNone(first.notification_id)
        self.assertIsNone(first.contact_id)
        path = f"/api/house/inquiries/{first.pk}/"
        converted = self.post(f"{path}convert/", {"name": "咨询租客", "phone": "13800138001"})
        self.assertEqual(converted.status_code, 200, converted.content)
        contact_id = api_data(converted)["id"]
        scheduled = (timezone.now() + timedelta(days=1)).isoformat()
        viewing = self.post(
            "/api/house/viewing-records/",
            {
                "house_id": self.house.pk,
                "source_inquiry_id": first.pk,
                "contact_id": contact_id,
                "customer_name": "咨询租客",
                "customer_phone": "13800138001",
                "scheduled_at": scheduled,
            },
        )
        self.assertEqual(viewing.status_code, 201, viewing.content)
        other_house = House.objects.create(building=self.house.building, landlord=self.house.landlord, room_number="102")
        from apps.house.services.inquiries import record_inquiry

        other = record_inquiry(house=other_house, user=self.tenant_user, assigned_to=self.owner, wechat="tenant-wechat")
        self.assertEqual(other.contact_id, contact_id)
        self.assertEqual(self.post(f"{path}assign/", {"assigned_to_id": self.staff.pk}).status_code, 200)
        self.assertEqual(CustomerProfile.objects.get(contact_id=contact_id).assigned_to_id, self.owner.pk)
        self.login(self.staff)
        details = self.client.get(path)
        self.assertEqual(details.status_code, 200)
        self.assertEqual(api_data(details)["viewings"][0]["assigned_to_id"], self.staff.pk)
        self.assertEqual([item["id"] for item in api_data(self.client.get("/api/house/inquiries/"))["items"]], [first.pk])
        self.assertEqual(self.client.get(f"/api/house/inquiries/{other.pk}/").status_code, 404)
        self.assertEqual(self.client.get(f"/api/house/customers/{contact_id}/").status_code, 404)
        payload = self.signing_payload()
        payload["lease"]["tenant_id"] = contact_id
        payload["lease"]["source_inquiry_id"] = first.pk
        signed = self.post("/api/house/leases/register-signing/", payload)
        self.assertEqual(signed.status_code, 201, signed.content)
        final = api_data(self.client.get(path))
        self.assertEqual(final["status"], "signed")
        self.assertEqual(final["viewings"][0]["status"], "canceled")
        other.refresh_from_db()
        self.assertEqual(other.status, "new")
        self.assertEqual(self.post(f"/api/house/leases/{api_data(signed)['id']}/allocations/", {"client_request_id": "no-submit"}).status_code, 403)
        lease_path = f"/api/house/leases/{api_data(signed)['id']}/"
        self.assertEqual(self.client.get(lease_path).status_code, 200)
        self.assertEqual(self.patch(lease_path, {"notes": "原登记人维护"}).status_code, 200)
        self.login(self.owner)
        self.assertEqual(self.post(f"{path}assign/", {"assigned_to_id": self.other.pk}).status_code, 200)
        self.login(self.other)
        self.assertEqual(self.client.get(lease_path).status_code, 200)
        self.assertEqual(self.patch(lease_path, {"notes": "接手人越权维护"}).status_code, 403)
        self.login(self.staff)
        self.assertEqual(self.patch(lease_path, {"notes": "转派后登记人仍可维护"}).status_code, 200)

    def test_preview_detects_rule_change_and_pending_termination_withdraws_without_revenue(self):
        setting, _ = DefaultSetting.objects.update_or_create(
            key="property_rental.lease_allocation_rule",
            defaults={
                "value": {"method": "percentage", "rate_bp": 5000, "fixed_amount": None},
                "value_type": "json",
                "widget": "json_editor",
                "label": "收益规则",
                "category": "property_rental",
                "ui": {"scopes": ["organization", "team"], "inherit_org": True},
            },
        )
        lease = self.register()
        path = f"/api/house/leases/{lease['id']}/allocations/"
        preview = self.post(f"{path}preview/", {"mode": "initial"})
        self.assertEqual(preview.status_code, 200, preview.content)
        preview_hash = api_data(preview)["preview_hash"]
        self.assertEqual(preview_hash, api_data(self.post(f"{path}preview/", {}))["preview_hash"])
        setting.value = {"method": "percentage", "rate_bp": 1000, "fixed_amount": None}
        setting.save()
        stale = self.post(path, {"client_request_id": "stale-preview", "preview_hash": preview_hash})
        self.assertEqual(stale.status_code, 409, stale.content)
        self.assertEqual(api_data(self.client.get(path))["total"], 0)
        pending = self.confirmed_allocation(path, client_request_id="pending")
        self.assertEqual(pending.status_code, 201, pending.content)
        terminated = self.patch(f"/api/house/leases/{lease['id']}/", {"status": "terminated"})
        self.assertEqual(terminated.status_code, 200, terminated.content)
        history = api_data(self.client.get(path))["items"]
        self.assertEqual(history[0]["allocation_request"]["status"], "withdrawn")
        self.assertIn("提前终止", history[0]["allocation_request"]["withdraw_reason"])
        self.assertEqual(self.post(path, {"client_request_id": "terminated", "mode": "resubmit", "previous_request_id": history[0]["allocation_request"]["id"]}).status_code, 400)

    def test_private_contact_identity_and_raw_contact_cannot_bypass_owner(self):
        CustomerProfile.objects.create(contact=self.tenant, assigned_to=self.other)
        self.login(self.staff)
        payload = self.signing_payload()
        payload["lease"].pop("tenant_id")
        payload["lease"]["tenant_identity"] = {"name": "另一个姓名", "phone": "+86 13800138000"}
        self.assertEqual(self.post("/api/house/leases/register-signing/", payload).status_code, 403)
        duplicate = self.post("/api/house/contacts/", {"name": "重复客户", "phone": "13800138000", "roles": ["tenant"]})
        self.assertEqual(duplicate.status_code, 409)
        self.assertEqual(Contact.objects.filter(organization=self.org, normalized_phone="+8613800138000").count(), 1)

    def test_legacy_snapshot_uses_money_and_datetime_values_when_resubmitting(self):
        DefaultSetting.objects.update_or_create(
            key="property_rental.lease_allocation_rule",
            defaults={
                "value": {"method": "percentage", "rate_bp": 5000, "fixed_amount": None},
                "value_type": "json",
                "widget": "json_editor",
                "label": "收益规则",
                "category": "property_rental",
                "ui": {"scopes": ["organization", "team"], "inherit_org": True},
            },
        )
        lease_data = self.signing_payload()["lease"]
        lease_data.update(monthly_rent="3000", sign_at=datetime.fromisoformat("2026-02-01T01:00:00+08:00"))
        lease_data.pop("house_id")
        lease_data.pop("tenant_id")
        lease_data.update(house=self.house, tenant=self.tenant)
        from apps.house.services.allocations import create_lease_with_allocation

        historical = create_lease_with_allocation(organization=self.org, submitted_by=self.owner, lease_data=lease_data, beneficiary_user_ids=[self.owner.pk])
        path = f"/api/house/leases/{historical.lease_id}/allocations/"
        request_id = historical.allocation_request_id
        self.assertEqual(self.post(f"{path}{request_id}/withdraw/", {"reason": "补充合同"}).status_code, 200)
        resubmitted = self.post(path, {"mode": "resubmit", "previous_request_id": request_id, "client_request_id": "legacy-resubmit"})
        self.assertEqual(resubmitted.status_code, 201, resubmitted.content)
        self.assertEqual(api_data(resubmitted)["allocation_request"]["source_snapshot"], historical.allocation_request.source_snapshot)

    def test_only_admin_can_change_signing_date_or_team_after_withdrawal(self):
        DefaultSetting.objects.update_or_create(
            key="property_rental.lease_allocation_rule",
            defaults={
                "value": {"method": "percentage", "rate_bp": 5000, "fixed_amount": None},
                "value_type": "json",
                "widget": "json_editor",
                "label": "收益规则",
                "category": "property_rental",
                "ui": {"scopes": ["organization", "team"], "inherit_org": True},
            },
        )
        group = make_access_group("closure-submitter", AccessScope.ORG, [("allocation", "submit")])
        bind_org_role(self.org, self.staff, group)
        self.login(self.staff)
        lease = self.register()
        path = f"/api/house/leases/{lease['id']}/"
        submitted = self.confirmed_allocation(f"{path}allocations/", client_request_id="employee-request")
        self.assertEqual(submitted.status_code, 201, submitted.content)
        request_id = api_data(submitted)["allocation_request"]["id"]
        self.assertEqual(self.post(f"{path}allocations/{request_id}/withdraw/", {}).status_code, 200)
        team = Team.objects.create(organization=self.org, name="纠错团队")
        team.members.add(self.staff)
        self.assertEqual(self.patch(path, {"sign_at": "2026-03-01T00:00:00Z"}).status_code, 403)
        self.assertEqual(self.patch(path, {"deal_team_id": team.pk}).status_code, 403)
        self.assertEqual(self.patch(path, {"monthly_rent": "3500.00"}).status_code, 200)
        self.login(self.owner)
        corrected = self.patch(path, {"deal_team_id": team.pk, "sign_at": "2026-03-01T00:00:00Z"})
        self.assertEqual(corrected.status_code, 200, corrected.content)
        self.assertEqual(api_data(corrected)["performance_month"], "2026-03-01")
