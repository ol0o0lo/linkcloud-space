import json
from datetime import date, timedelta
from decimal import Decimal

from django.test import TestCase
from django.utils import timezone

from model_bakery import baker

from apps.accounts.models import User
from apps.house.constants import ContactRole, EstatePropertyType, HouseStatus, LeaseStatus, ViewingRecordStatus
from apps.house.models import Building, Contact, Estate, House, HouseInquiry, Lease, PropertyResponsibility, ViewingRecord
from apps.messaging.models import Conversation, Message
from apps.notifications.models import Notification
from apps.organizations.models import OrganizationMember
from apps.settings.models import UserSetting
from tests.api_helpers import api_data


class TenantPortalApiTestCase(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="tenant-user", first_name="小云", last_name="租客", password="secret")  # noqa: S106
        self.user.set_phone_number("+8613800138001", verified=True)
        self.user.save(update_fields=["phone_country_code", "phone_national_number", "phone_verified"])
        self.organization = baker.make("organizations.Organization", name="甲中介", slug="tenant-org-a")
        self.house = self.make_house(self.organization, room_number="101")
        self.client.force_login(self.user)

    def make_house(self, organization, *, room_number: str, status: str = HouseStatus.LISTED) -> House:
        estate = Estate.objects.create(
            organization=organization,
            name=f"{organization.name}小区-{room_number}",
            display_name=f"{organization.name}小区-{room_number}",
            property_type=EstatePropertyType.RESIDENTIAL,
            province="广东",
            city="广州",
            district="海珠",
            address="新港中路",
        )
        building = Building.objects.create(
            organization=organization,
            estate=estate,
            name=f"{room_number}栋",
            address="新港中路 1 号",
            floors=20,
        )
        landlord = Contact.objects.create(
            organization=organization,
            name=f"{room_number}房东",
            phone="13900139001",
            roles=[ContactRole.LANDLORD],
        )
        return House.objects.create(
            building=building,
            landlord=landlord,
            room_number=room_number,
            status=status,
            bedrooms=1,
            living_rooms=0,
        )

    def test_verified_user_can_create_personal_viewing_without_org_context(self):
        scheduled_at = timezone.now() + timedelta(days=2)

        response = self.client.post(
            "/api/house/tenant/viewing-records/",
            data=json.dumps(
                {
                    "house_id": self.house.pk,
                    "scheduled_at": scheduled_at.isoformat(),
                    "notes": "周末下午方便",
                }
            ),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 201)
        payload = api_data(response)
        contact = Contact.objects.get(organization=self.organization, user=self.user)
        record = ViewingRecord.objects.get(pk=payload["id"])
        self.assertEqual(contact.phone, "+8613800138001")
        self.assertEqual(contact.roles, [ContactRole.TENANT])
        self.assertEqual(record.organization, self.organization)
        self.assertEqual(record.house, self.house)
        self.assertEqual(record.contact, contact)
        self.assertEqual(record.customer_name, "小云 租客")
        self.assertEqual(record.customer_phone, "+8613800138001")
        self.assertEqual(record.status, ViewingRecordStatus.SCHEDULED)
        self.assertEqual(record.notes, "周末下午方便")
        self.assertNotIn("notes", payload)
        self.assertNotIn("extra", payload)

    def test_tenant_can_send_contact_details_to_responsible_agent(self):
        agent = User.objects.create_user(username="responsible-agent", password="secret")  # noqa: S106
        member = OrganizationMember.objects.create(organization=self.organization, user=agent)
        PropertyResponsibility.objects.create(organization=self.organization, member=member, landlord=self.house.landlord)
        OrganizationMember.objects.create(organization=self.organization, user=baker.make(User), is_owner=True)

        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.post(
                "/api/house/tenant/contact/",
                data=json.dumps(
                    {
                        "house_id": self.house.pk,
                        "channels": ["phone", "wechat"],
                        "phone": "138 0013 8001",
                        "wechat": " lan-home ",
                    }
                ),
                content_type="application/json",
            )

        self.assertEqual(response.status_code, 201)
        payload = api_data(response)
        self.assertIsNone(payload["notification_id"])
        message = Message.objects.get(pk=payload["message"]["id"])
        conversation = message.conversation
        self.assertEqual(payload["conversation"]["id"], conversation.pk)
        self.assertEqual(conversation.namespace, "real_estate.inquiry")
        self.assertEqual(conversation.context_key, f"listing:{self.house.pk}")
        self.assertEqual(message.sender_member.user_id, self.user.pk)
        self.assertIn("+8613800138001", message.content)
        self.assertIn("lan-home", message.content)
        notification = Notification.objects.get(category="messaging.message")
        self.assertEqual(notification.recipient, agent)
        self.assertEqual(notification.organization, self.organization)
        self.assertEqual(notification.actor, self.user)
        self.assertEqual(notification.target, conversation)
        self.assertEqual(
            notification.data,
            {
                "conversation_id": conversation.pk,
                "message_seq": message.seq,
                "organization_slug": self.organization.slug,
            },
        )
        self.assertEqual(
            UserSetting.objects.get(user=self.user, key="internal.house.contact.v1").value,
            {
                "channels": ["phone", "wechat"],
                "phone": "+8613800138001",
                "wechat": "lan-home",
            },
        )

        with self.captureOnCommitCallbacks(execute=True):
            repeated = self.client.post(
                "/api/house/tenant/contact/",
                data=json.dumps({"house_id": self.house.pk, "channels": ["wechat"], "wechat": "lan-home"}),
                content_type="application/json",
            )
        self.assertEqual(repeated.status_code, 201)
        self.assertEqual(api_data(repeated)["inquiry_id"], payload["inquiry_id"])
        self.assertEqual(api_data(repeated)["conversation"]["id"], conversation.pk)
        self.assertEqual(Message.objects.filter(conversation=conversation).count(), 2)
        self.assertEqual(Notification.objects.filter(category="messaging.message").count(), 2)
        self.assertFalse(Notification.objects.filter(category="house.contact").exists())
        self.assertFalse(OrganizationMember.objects.filter(organization=self.organization, user=self.user).exists())
        self.assertEqual(
            UserSetting.objects.get(user=self.user, key="internal.house.contact.v1").value,
            {
                "channels": ["wechat"],
                "phone": "+8613800138001",
                "wechat": "lan-home",
            },
        )

    def test_contact_request_uses_bound_phone_and_falls_back_to_owner(self):
        owner = User.objects.create_user(username="organization-owner", password="secret")  # noqa: S106
        OrganizationMember.objects.create(organization=self.organization, user=owner, is_owner=True)

        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.post(
                "/api/house/tenant/contact/",
                data=json.dumps({"house_id": self.house.pk, "channels": ["phone"]}),
                content_type="application/json",
            )

        self.assertEqual(response.status_code, 201)
        payload = api_data(response)
        message = Message.objects.get(pk=payload["message"]["id"])
        notification = Notification.objects.get(category="messaging.message")
        self.assertIsNone(payload["notification_id"])
        self.assertEqual(notification.recipient, owner)
        self.assertIn("+8613800138001", message.content)
        self.assertEqual(notification.target, message.conversation)

    def test_contact_request_requires_complete_contact_and_persists_without_available_agent(self):
        invalid = self.client.post(
            "/api/house/tenant/contact/",
            data=json.dumps({"house_id": self.house.pk, "channels": ["wechat"]}),
            content_type="application/json",
        )

        self.assertEqual(invalid.status_code, 422)
        unavailable = self.client.post(
            "/api/house/tenant/contact/",
            data=json.dumps({"house_id": self.house.pk, "channels": ["phone"]}),
            content_type="application/json",
        )
        self.assertEqual(unavailable.status_code, 201)
        inquiry = HouseInquiry.objects.get(pk=api_data(unavailable)["inquiry_id"])
        self.assertIsNone(inquiry.assigned_to_id)
        self.assertIsNone(api_data(unavailable)["notification_id"])
        self.assertIsNone(api_data(unavailable)["conversation"])
        self.assertIsNone(api_data(unavailable)["message"])
        self.assertFalse(Conversation.objects.exists())
        self.assertFalse(Message.objects.exists())
        self.assertFalse(Notification.objects.exists())
        self.assertTrue(UserSetting.objects.filter(user=self.user, key="internal.house.contact.v1").exists())

    def test_personal_viewing_list_crosses_orgs_and_excludes_other_users(self):
        second_organization = baker.make("organizations.Organization", name="乙中介", slug="tenant-org-b")
        second_house = self.make_house(second_organization, room_number="202")
        first_contact = Contact.objects.create(
            organization=self.organization,
            name="甲组织租客",
            phone=self.user.phone,
            roles=[ContactRole.TENANT],
            user=self.user,
        )
        second_contact = Contact.objects.create(
            organization=second_organization,
            name="乙组织租客",
            phone=self.user.phone,
            roles=[ContactRole.TENANT],
            user=self.user,
        )
        other_user = User.objects.create_user(username="other-tenant", password="secret")  # noqa: S106
        other_contact = Contact.objects.create(
            organization=self.organization,
            name="其他租客",
            phone="13700137001",
            roles=[ContactRole.TENANT],
            user=other_user,
        )
        first_record = ViewingRecord.objects.create(
            organization=self.organization,
            house=self.house,
            contact=first_contact,
            customer_name=first_contact.name,
            customer_phone=first_contact.phone,
            scheduled_at=timezone.now() + timedelta(days=1),
            notes="内部备注不可见",
            extra={"internal": True},
        )
        second_record = ViewingRecord.objects.create(
            organization=second_organization,
            house=second_house,
            contact=second_contact,
            customer_name=second_contact.name,
            customer_phone=second_contact.phone,
            scheduled_at=timezone.now() + timedelta(days=2),
        )
        ViewingRecord.objects.create(
            organization=self.organization,
            house=self.house,
            contact=other_contact,
            customer_name=other_contact.name,
            customer_phone=other_contact.phone,
            scheduled_at=timezone.now() + timedelta(days=3),
        )

        response = self.client.get("/api/house/tenant/viewing-records/", {"page": 1, "page_size": 20})

        self.assertEqual(response.status_code, 200)
        items = api_data(response)["items"]
        self.assertEqual([item["id"] for item in items], [second_record.pk, first_record.pk])
        self.assertEqual(items[0]["organization"], {"id": second_organization.pk, "name": "乙中介", "slug": "tenant-org-b"})
        self.assertEqual(items[0]["house"]["id"], second_house.pk)
        self.assertNotIn("notes", items[1])
        self.assertNotIn("extra", items[1])
        self.assertNotIn("assigned_to_id", items[1])

    def test_personal_viewing_list_filters_current_and_history_scopes(self):
        contact = Contact.objects.create(
            organization=self.organization,
            name="当前租客",
            phone=self.user.phone,
            roles=[ContactRole.TENANT],
            user=self.user,
        )
        current = ViewingRecord.objects.create(
            organization=self.organization,
            house=self.house,
            contact=contact,
            customer_name=contact.name,
            customer_phone=contact.phone,
            scheduled_at=timezone.now() + timedelta(days=1),
        )
        history = ViewingRecord.objects.create(
            organization=self.organization,
            house=self.house,
            contact=contact,
            customer_name=contact.name,
            customer_phone=contact.phone,
            scheduled_at=timezone.now() - timedelta(days=1),
            status=ViewingRecordStatus.CANCELED,
        )

        current_response = self.client.get("/api/house/tenant/viewing-records/", {"scope": "current", "page": 1, "page_size": 20})
        history_response = self.client.get("/api/house/tenant/viewing-records/", {"scope": "history", "page": 1, "page_size": 20})

        self.assertEqual(current_response.status_code, 200)
        self.assertEqual(history_response.status_code, 200)
        self.assertEqual([item["id"] for item in api_data(current_response)["items"]], [current.pk])
        self.assertEqual([item["id"] for item in api_data(history_response)["items"]], [history.pk])

    def test_inquiry_viewing_and_lease_are_visible_without_binding_contact_account(self):
        from apps.house.services.inquiries import convert_inquiry
        from apps.house.services.viewings import create_viewing_record

        agent = baker.make(User, username="viewing-receptionist")
        agent.set_phone_number("+8613900139002", verified=True)
        agent.save(update_fields=["phone_country_code", "phone_national_number", "phone_verified"])
        OrganizationMember.objects.create(organization=self.organization, user=agent, is_owner=True, employee_name="小林")
        response = self.client.post(
            "/api/house/tenant/contact/", data=json.dumps({"house_id": self.house.pk, "channels": ["phone"], "phone": self.user.phone}), content_type="application/json"
        )
        self.assertEqual(response.status_code, 201)
        inquiry = HouseInquiry.objects.get(pk=api_data(response)["inquiry_id"])
        contact = convert_inquiry(organization=self.organization, actor=agent, inquiry_id=inquiry.pk, data={})
        self.assertIsNone(contact.user_id)
        record = create_viewing_record(
            organization=self.organization,
            actor=agent,
            data={
                "house_id": self.house.pk,
                "source_inquiry_id": inquiry.pk,
                "customer_name": contact.name,
                "customer_phone": contact.phone,
                "scheduled_at": timezone.now() + timedelta(days=1),
            },
        )
        current = api_data(self.client.get("/api/house/tenant/viewing-records/", {"scope": "current"}))["items"]
        self.assertEqual([item["id"] for item in current], [record.pk])
        self.assertEqual(current[0]["receptionist"], {"name": "小林", "phone": "+8613900139002"})
        self.assertEqual(current[0]["house"]["building"]["address"], "新港中路 1 号")
        self.assertEqual(self.client.get(f"/api/house/tenant/viewing-records/{record.pk}/").status_code, 200)

        record.status = ViewingRecordStatus.VIEWED
        record.save()
        self.assertEqual(api_data(self.client.get("/api/house/tenant/viewing-records/", {"scope": "current"}))["total"], 0)
        history = api_data(self.client.get("/api/house/tenant/viewing-records/", {"scope": "history"}))["items"]
        self.assertEqual([item["id"] for item in history], [record.pk])
        inquiry.refresh_from_db()
        record.status = ViewingRecordStatus.CONVERTED
        record.save()
        lease = Lease.objects.create(
            organization=self.organization,
            house=self.house,
            tenant=contact,
            source_inquiry=inquiry,
            source_viewing_record=record,
            start_date=date(2026, 10, 25),
            end_date=date(2027, 10, 24),
            monthly_rent=Decimal("3200.00"),
            status=LeaseStatus.ACTIVE,
        )
        self.assertEqual([item["id"] for item in api_data(self.client.get("/api/house/tenant/leases/"))["items"]], [lease.pk])
        self.assertEqual(self.client.get(f"/api/house/tenant/leases/{lease.pk}/").status_code, 200)
        lease.source_inquiry = None
        lease.save()
        self.assertEqual(self.client.get(f"/api/house/tenant/leases/{lease.pk}/").status_code, 200)

        self.client.force_login(baker.make(User))
        self.assertEqual(api_data(self.client.get("/api/house/tenant/viewing-records/"))["total"], 0)
        self.assertEqual(api_data(self.client.get("/api/house/tenant/leases/"))["total"], 0)
        self.assertEqual(self.client.get(f"/api/house/tenant/viewing-records/{record.pk}/").status_code, 404)
        self.assertEqual(self.client.post(f"/api/house/tenant/viewing-records/{record.pk}/cancel/").status_code, 404)
        self.assertEqual(self.client.get(f"/api/house/tenant/leases/{lease.pk}/").status_code, 404)

    def test_inquiry_owner_can_cancel_viewing_and_receptionist_must_still_be_available(self):
        agent = baker.make(User)
        member = OrganizationMember.objects.create(organization=self.organization, user=agent, employee_name="小陈")
        contact = baker.make(Contact, organization=self.organization, roles=[ContactRole.TENANT], user=None)
        inquiry = HouseInquiry.objects.create(organization=self.organization, house=self.house, user=self.user, contact=contact, assigned_to=agent)
        record = ViewingRecord.objects.create(
            organization=self.organization,
            house=self.house,
            contact=contact,
            source_inquiry=inquiry,
            assigned_to=agent,
            customer_name=contact.name,
            customer_phone=contact.phone,
            scheduled_at=timezone.now() + timedelta(days=1),
        )
        response = self.client.get(f"/api/house/tenant/viewing-records/{record.pk}/")
        self.assertEqual(api_data(response)["receptionist"], {"name": "小陈", "phone": ""})
        member.organization = baker.make("organizations.Organization")
        member.save(update_fields=["organization"])
        self.assertIsNone(api_data(self.client.get(f"/api/house/tenant/viewing-records/{record.pk}/"))["receptionist"])
        canceled = self.client.post(f"/api/house/tenant/viewing-records/{record.pk}/cancel/")
        self.assertEqual(canceled.status_code, 200)
        record.refresh_from_db()
        self.assertEqual(record.status, ViewingRecordStatus.CANCELED)

    def test_personal_viewing_detail_returns_safe_projection(self):
        contact = Contact.objects.create(
            organization=self.organization,
            name="当前租客",
            phone=self.user.phone,
            roles=[ContactRole.TENANT],
            user=self.user,
        )
        record = ViewingRecord.objects.create(
            organization=self.organization,
            house=self.house,
            contact=contact,
            customer_name=contact.name,
            customer_phone=contact.phone,
            scheduled_at=timezone.now() + timedelta(days=1),
            notes="内部备注不可见",
            extra={"internal": True},
        )

        response = self.client.get(f"/api/house/tenant/viewing-records/{record.pk}/")

        self.assertEqual(response.status_code, 200)
        payload = api_data(response)
        self.assertEqual(payload["id"], record.pk)
        self.assertEqual(payload["organization"]["id"], self.organization.pk)
        self.assertEqual(payload["house"]["id"], self.house.pk)
        self.assertNotIn("notes", payload)
        self.assertNotIn("extra", payload)
        self.assertNotIn("assigned_to_id", payload)

    def test_tenant_can_cancel_own_scheduled_viewing(self):
        contact = Contact.objects.create(
            organization=self.organization,
            name="当前租客",
            phone=self.user.phone,
            roles=[ContactRole.TENANT],
            user=self.user,
        )
        record = ViewingRecord.objects.create(
            organization=self.organization,
            house=self.house,
            contact=contact,
            customer_name=contact.name,
            customer_phone=contact.phone,
            scheduled_at=timezone.now() + timedelta(days=1),
        )

        response = self.client.post(f"/api/house/tenant/viewing-records/{record.pk}/cancel/")

        self.assertEqual(response.status_code, 200)
        record.refresh_from_db()
        self.assertEqual(record.status, ViewingRecordStatus.CANCELED)
        self.assertEqual(api_data(response)["status"], ViewingRecordStatus.CANCELED)

    def test_personal_lease_list_crosses_orgs_and_excludes_other_users(self):
        second_organization = baker.make("organizations.Organization", name="乙中介", slug="tenant-org-b")
        second_house = self.make_house(second_organization, room_number="202")
        first_contact = Contact.objects.create(
            organization=self.organization,
            name="甲组织租客",
            phone=self.user.phone,
            roles=[ContactRole.TENANT],
            user=self.user,
        )
        second_contact = Contact.objects.create(
            organization=second_organization,
            name="乙组织租客",
            phone=self.user.phone,
            roles=[ContactRole.TENANT],
            user=self.user,
        )
        other_user = User.objects.create_user(username="other-lease-tenant", password="secret")  # noqa: S106
        other_contact = Contact.objects.create(
            organization=self.organization,
            name="其他租客",
            phone="13700137001",
            roles=[ContactRole.TENANT],
            user=other_user,
        )
        first_lease = Lease.objects.create(
            organization=self.organization,
            house=self.house,
            tenant=first_contact,
            start_date=date(2026, 9, 1),
            end_date=date(2027, 8, 31),
            monthly_rent=Decimal("3200.00"),
            status=LeaseStatus.ACTIVE,
            notes="内部备注不可见",
            extra={"internal": True},
        )
        second_lease = Lease.objects.create(
            organization=second_organization,
            house=second_house,
            tenant=second_contact,
            start_date=date(2026, 10, 1),
            end_date=date(2027, 9, 30),
            monthly_rent=Decimal("4200.00"),
        )
        Lease.objects.create(
            organization=self.organization,
            house=self.make_house(self.organization, room_number="303"),
            tenant=other_contact,
            start_date=date(2026, 11, 1),
            end_date=date(2027, 10, 31),
            monthly_rent=Decimal("5200.00"),
        )

        response = self.client.get("/api/house/tenant/leases/", {"page": 1, "page_size": 20})

        self.assertEqual(response.status_code, 200)
        items = api_data(response)["items"]
        self.assertEqual([item["id"] for item in items], [second_lease.pk, first_lease.pk])
        self.assertEqual(items[0]["organization"], {"id": second_organization.pk, "name": "乙中介", "slug": "tenant-org-b"})
        self.assertEqual(items[0]["house"]["id"], second_house.pk)
        self.assertNotIn("notes", items[1])
        self.assertNotIn("extra", items[1])

    def test_personal_lease_detail_returns_safe_projection(self):
        contact = Contact.objects.create(
            organization=self.organization,
            name="当前租客",
            phone=self.user.phone,
            roles=[ContactRole.TENANT],
            user=self.user,
        )
        lease = Lease.objects.create(
            organization=self.organization,
            house=self.house,
            tenant=contact,
            start_date=date(2026, 9, 1),
            end_date=date(2027, 8, 31),
            monthly_rent=Decimal("3200.00"),
            deposit=Decimal("6400.00"),
            status=LeaseStatus.ACTIVE,
            notes="内部备注不可见",
            extra={"internal": True},
        )

        response = self.client.get(f"/api/house/tenant/leases/{lease.pk}/")

        self.assertEqual(response.status_code, 200)
        payload = api_data(response)
        self.assertEqual(payload["id"], lease.pk)
        self.assertEqual(payload["organization"]["id"], self.organization.pk)
        self.assertEqual(payload["house"]["id"], self.house.pk)
        self.assertEqual(payload["monthly_rent"], "3200.00")
        self.assertNotIn("notes", payload)
        self.assertNotIn("extra", payload)

    def test_tenant_portal_requires_login(self):
        self.client.logout()

        viewing_response = self.client.get("/api/house/tenant/viewing-records/")
        lease_response = self.client.get("/api/house/tenant/leases/")

        self.assertEqual(viewing_response.status_code, 401)
        self.assertEqual(lease_response.status_code, 401)

    def test_unverified_phone_cannot_create_personal_viewing(self):
        self.user.phone_verified = False
        self.user.save(update_fields=["phone_verified"])

        response = self.client.post(
            "/api/house/tenant/viewing-records/",
            data=json.dumps({"house_id": self.house.pk, "scheduled_at": (timezone.now() + timedelta(days=2)).isoformat()}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 403)
        self.assertFalse(ViewingRecord.objects.exists())

    def test_personal_viewing_rejects_internal_fields(self):
        response = self.client.post(
            "/api/house/tenant/viewing-records/",
            data=json.dumps(
                {
                    "house_id": self.house.pk,
                    "scheduled_at": (timezone.now() + timedelta(days=2)).isoformat(),
                    "assigned_to_id": self.user.pk,
                }
            ),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertFalse(ViewingRecord.objects.exists())

    def test_personal_viewing_reuses_unbound_contact(self):
        contact = Contact.objects.create(
            organization=self.organization,
            name="已有客户",
            phone="13800138001",
            roles=[],
        )

        response = self.client.post(
            "/api/house/tenant/viewing-records/",
            data=json.dumps({"house_id": self.house.pk, "scheduled_at": (timezone.now() + timedelta(days=2)).isoformat()}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 201)
        contact.refresh_from_db()
        self.assertEqual(contact.user, self.user)
        self.assertEqual(contact.roles, [ContactRole.TENANT])
        self.assertEqual(Contact.objects.filter(organization=self.organization, phone="13800138001").count(), 1)

    def test_personal_viewing_returns_conflict_for_duplicate_contacts(self):
        Contact.objects.create(organization=self.organization, name="重复客户甲", phone="13800138001", roles=[ContactRole.TENANT])
        Contact.objects.create(organization=self.organization, name="重复客户乙", phone="+8613800138001", roles=[ContactRole.TENANT])

        response = self.client.post(
            "/api/house/tenant/viewing-records/",
            data=json.dumps({"house_id": self.house.pk, "scheduled_at": (timezone.now() + timedelta(days=2)).isoformat()}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 409)
        self.assertFalse(ViewingRecord.objects.exists())

    def test_tenant_cannot_cancel_viewing_after_it_is_processed(self):
        contact = Contact.objects.create(
            organization=self.organization,
            name="当前租客",
            phone=self.user.phone,
            roles=[ContactRole.TENANT],
            user=self.user,
        )
        record = ViewingRecord.objects.create(
            organization=self.organization,
            house=self.house,
            contact=contact,
            customer_name=contact.name,
            customer_phone=contact.phone,
            scheduled_at=timezone.now() + timedelta(days=1),
            status=ViewingRecordStatus.VIEWED,
        )

        response = self.client.post(f"/api/house/tenant/viewing-records/{record.pk}/cancel/")

        self.assertEqual(response.status_code, 409)
        record.refresh_from_db()
        self.assertEqual(record.status, ViewingRecordStatus.VIEWED)

    def test_personal_details_hide_other_users_records(self):
        other_user = User.objects.create_user(username="other-detail-tenant", password="secret")  # noqa: S106
        other_contact = Contact.objects.create(
            organization=self.organization,
            name="其他租客",
            phone="13700137001",
            roles=[ContactRole.TENANT],
            user=other_user,
        )
        viewing = ViewingRecord.objects.create(
            organization=self.organization,
            house=self.house,
            contact=other_contact,
            customer_name=other_contact.name,
            customer_phone=other_contact.phone,
            scheduled_at=timezone.now() + timedelta(days=1),
        )
        lease = Lease.objects.create(
            organization=self.organization,
            house=self.house,
            tenant=other_contact,
            start_date=date(2026, 9, 1),
            end_date=date(2027, 8, 31),
            monthly_rent=Decimal("3200.00"),
        )

        viewing_response = self.client.get(f"/api/house/tenant/viewing-records/{viewing.pk}/")
        lease_response = self.client.get(f"/api/house/tenant/leases/{lease.pk}/")

        self.assertEqual(viewing_response.status_code, 404)
        self.assertEqual(lease_response.status_code, 404)
