from datetime import date, timedelta
from decimal import Decimal

from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import ProtectedError
from django.test import TestCase

from model_bakery import baker

from apps.accounts.models import User
from apps.accounts.services import bind_phone_to_user
from apps.house.constants import ContactRole, EstatePropertyType, HousePublishStatus, HouseStatus, LeaseStatus, ViewingRecordStatus
from apps.house.models import Building, Contact, Estate, House, Lease, ViewingRecord
from apps.house.services import claim_landlord_contact_for_bound_phone, get_landlord_houses, recalculate_house_status
from apps.media.constants import MediaType, ResourceType
from apps.media.services import collect_media_ref_field_ids, register_media_file


class RequestWithOrg:
    def __init__(self, org):
        self.org = type("OrgContext", (), {"instance": org})()


class HouseDomainTestCase(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="agent", password="secret")  # noqa: S106
        self.org = baker.make("organizations.Organization", name="租赁公司", slug="rental-org")
        self.other_org = baker.make("organizations.Organization", name="其他公司", slug="other-rental-org")

    def make_media(self, resource_type, filename="asset.png", path="uploads/orgs/1/asset.png", size=100):
        return register_media_file(
            uploader=self.user,
            oss_path=path,
            original_filename=filename,
            resource_type=resource_type,
            file_size=size,
        )

    def make_estate(self, **kwargs):
        data = {
            "organization": self.org,
            "name": "云岸花园",
            "display_name": "云岸花园一期",
            "property_type": EstatePropertyType.RESIDENTIAL,
            "province": "广东省",
            "city": "深圳市",
            "district": "南山区",
            "address": "科技园路 1 号",
            "lat": Decimal("22.533000"),
            "lng": Decimal("113.930000"),
        }
        data.update(kwargs)
        return Estate.objects.create(**data)

    def make_building(self, estate=None, **kwargs):
        estate = estate or self.make_estate()
        data = {
            "organization": estate.organization,
            "estate": estate,
            "name": "1 栋",
            "floors": 32,
            "under_floors": 2,
            "lat": Decimal("22.533100"),
            "lng": Decimal("113.930100"),
            "address": "云岸花园 1 栋",
        }
        data.update(kwargs)
        return Building.objects.create(**data)

    def make_contact(self, **kwargs):
        data = {
            "organization": self.org,
            "name": "张三",
            "phone": "13800138000",
            "roles": [ContactRole.LANDLORD],
        }
        data.update(kwargs)
        return Contact.objects.create(**data)

    def make_house(self, building=None, **kwargs):
        building = building or self.make_building()
        data = {
            "building": building,
            "room_number": "1201",
            "floor": 12,
            "area": Decimal("88.50"),
            "bedrooms": 3,
            "living_rooms": 2,
        }
        data.update(kwargs)
        return House.objects.create(**data)

    def make_tenant(self, **kwargs):
        data = {
            "organization": self.org,
            "name": "李四",
            "phone": "13900139000",
            "roles": [ContactRole.TENANT],
        }
        data.update(kwargs)
        return Contact.objects.create(**data)


class TestSpaceHierarchyAndContacts(HouseDomainTestCase):
    def test_space_hierarchy_derives_house_organization_and_protects_parent_deletes(self):
        estate = self.make_estate()
        building = self.make_building(estate=estate)
        house = self.make_house(building=building)

        self.assertEqual(house.organization, self.org)
        self.assertEqual(building.lat, Decimal("22.533100"))
        self.assertEqual(estate.lat, Decimal("22.533000"))
        with self.assertRaises(ProtectedError):
            estate.delete()
        with self.assertRaises(ProtectedError):
            building.delete()

    def test_building_requires_same_organization_as_estate(self):
        estate = self.make_estate()
        building = Building(organization=self.other_org, estate=estate, name="错租户楼", floors=8)

        with self.assertRaises(ValidationError):
            building.full_clean()

    def test_estate_address_can_be_left_blank_for_governance_follow_up(self):
        estate = self.make_estate(name="待补地址项目", display_name="待补地址项目", address="")

        estate.refresh_from_db()
        self.assertEqual(estate.address, "")

    def test_contact_phone_unique_inside_org_but_reusable_across_orgs(self):
        contact = self.make_contact(phone="13800138001")
        Contact.objects.create(organization=self.other_org, name="异租户", phone="13800138001", roles=[ContactRole.LANDLORD])

        contact.refresh_from_db()
        self.assertEqual(contact.phone, "+8613800138001")
        with self.assertRaises(ValidationError):
            Contact.objects.create(organization=self.org, name="重复", phone="13800138001", roles=[ContactRole.TENANT])
        with self.assertRaises(ValidationError):
            Contact.objects.create(organization=self.org, name="格式重复", phone="+8613800138001", roles=[ContactRole.TENANT])

    def test_claim_landlord_contact_is_idempotent_org_scoped_and_does_not_steal_bound_contact(self):
        landlord = self.make_contact(phone="13800138002")
        other = Contact.objects.create(organization=self.other_org, name="跨组织", phone="13800138002", roles=[ContactRole.LANDLORD])
        bound_user = User.objects.create_user(username="bound", password="secret")  # noqa: S106
        bound = Contact.objects.create(organization=self.org, name="已绑定", phone="13800138003", roles=[ContactRole.LANDLORD], user=bound_user)

        claimed = claim_landlord_contact_for_bound_phone(self.user, self.org, "13800138002")
        second = claim_landlord_contact_for_bound_phone(self.user, self.org, "13800138002")
        skipped_without_org = claim_landlord_contact_for_bound_phone(self.user, None, "13800138002")
        stolen = claim_landlord_contact_for_bound_phone(self.user, self.org, "13800138003")

        landlord.refresh_from_db()
        other.refresh_from_db()
        bound.refresh_from_db()
        self.assertEqual(claimed, landlord)
        self.assertEqual(second, landlord)
        self.assertIsNone(skipped_without_org)
        self.assertIsNone(stolen)
        self.assertEqual(landlord.user, self.user)
        self.assertIsNone(other.user)
        self.assertEqual(bound.user, bound_user)

    def test_bind_phone_to_user_delegates_to_landlord_contact_claim_service(self):
        landlord = self.make_contact(phone="+8613800138010")
        user = User.objects.create_user(username="phone-bound", password="secret")  # noqa: S106

        bound_user, merged = bind_phone_to_user(RequestWithOrg(self.org), user, "+8613800138010")

        landlord.refresh_from_db()
        self.assertFalse(merged)
        self.assertEqual(bound_user, user)
        self.assertEqual(landlord.user, user)

    def test_bind_phone_claims_landlord_contact_with_national_number(self):
        landlord = self.make_contact(phone="13800138011")
        user = User.objects.create_user(username="national-phone-bound", password="secret")  # noqa: S106

        bound_user, merged = bind_phone_to_user(RequestWithOrg(self.org), user, "+8613800138011")

        landlord.refresh_from_db()
        self.assertFalse(merged)
        self.assertEqual(bound_user, user)
        self.assertEqual(landlord.user, user)


class TestHouseMediaAndOwnership(HouseDomainTestCase):
    def test_house_landlord_must_be_landlord_role_and_same_org(self):
        tenant = self.make_contact(name="租客", phone="13900139001", roles=[ContactRole.TENANT])
        house = self.make_house(landlord=None)
        house.landlord = tenant
        with self.assertRaises(ValidationError):
            house.full_clean()

        other_landlord = Contact.objects.create(organization=self.other_org, name="异租户房东", phone="13800138004", roles=[ContactRole.LANDLORD])
        house.landlord = other_landlord
        with self.assertRaises(ValidationError):
            house.full_clean()

    def test_landlord_query_is_user_and_org_scoped(self):
        landlord = self.make_contact(user=self.user, phone="13800138005")
        visible = self.make_house(room_number="1202", landlord=landlord)
        other_estate = self.make_estate(organization=self.other_org, name="异租户", display_name="异租户", city="广州")
        other_building = self.make_building(estate=other_estate, organization=self.other_org, name="异租户楼")
        other_landlord = Contact.objects.create(organization=self.other_org, name="同用户异租户", phone="13800138006", roles=[ContactRole.LANDLORD], user=self.user)
        self.make_house(building=other_building, room_number="2201", landlord=other_landlord)

        self.assertEqual(list(get_landlord_houses(self.user, self.org)), [visible])

    def test_media_refs_are_cleaned_resolved_ordered_and_collected_without_provider(self):
        estate_media = self.make_media(ResourceType.ESTATE_IMAGE, filename="estate.png", path=f"uploads/orgs/{self.org.pk}/estate.png")
        house_media = self.make_media(ResourceType.HOUSE_IMAGE, filename="house.png", path=f"uploads/orgs/{self.org.pk}/house.png")
        video_media = self.make_media(ResourceType.HOUSE_VIDEO, filename="tour.mp4", path=f"uploads/orgs/{self.org.pk}/tour.mp4")
        estate = self.make_estate(images=[{"media_id": estate_media.pk, "media_type": MediaType.IMAGE, "label": "项目封面", "url": "stale"}])
        house = self.make_house(
            building=self.make_building(estate=estate),
            images=[{"media_id": house_media.pk, "media_type": MediaType.IMAGE, "label": "房源封面", "url": "stale"}],
            videos=[{"media_id": video_media.pk, "media_type": MediaType.VIDEO, "label": "视频"}],
        )

        self.assertEqual(estate.images, [{"media_id": estate_media.pk, "media_type": MediaType.IMAGE, "label": "项目封面"}])
        self.assertEqual(house.images_resolved[0]["url"], house_media.file.url)
        self.assertEqual(house.images_resolved[0]["label"], "房源封面")
        ids, has_fields = collect_media_ref_field_ids()
        self.assertTrue(has_fields)
        self.assertTrue({estate_media.pk, house_media.pk, video_media.pk}.issubset(ids))

    def test_house_media_rejects_too_many_duplicates_and_wrong_resource_type(self):
        media = self.make_media(ResourceType.HOUSE_IMAGE)
        avatar = self.make_media(ResourceType.AVATAR, filename="avatar.png", path="uploads/users/1/avatar.png")
        house = self.make_house()
        house.images = [{"media_id": media.pk, "media_type": MediaType.IMAGE}, {"media_id": media.pk, "media_type": MediaType.IMAGE}]
        with transaction.atomic(), self.assertRaises(ValidationError):
            house.save()

        house.images = [{"media_id": avatar.pk, "media_type": MediaType.IMAGE}]
        with transaction.atomic(), self.assertRaises(ValidationError):
            house.save()

        house.images = [{"media_id": media.pk, "media_type": MediaType.IMAGE} for _ in range(10)]
        with transaction.atomic(), self.assertRaises(ValidationError):
            house.save()


class TestHousePublishAndListingFields(HouseDomainTestCase):
    def test_house_defaults_to_draft_publish_status_and_empty_listing_fields(self):
        house = self.make_house()

        self.assertEqual(house.publish_status, HousePublishStatus.DRAFT)
        self.assertIsNone(house.asking_rent)
        self.assertIsNone(house.deposit_amount)

    def test_house_rejects_negative_listing_amounts(self):
        house = self.make_house()
        house.asking_rent = Decimal("-1")

        with self.assertRaises(ValidationError):
            house.full_clean()

        house.asking_rent = Decimal("1000")
        house.deposit_amount = Decimal("-1")

        with self.assertRaises(ValidationError):
            house.full_clean()


class TestViewingAndLease(HouseDomainTestCase):
    def test_viewing_record_allows_temp_customer_and_does_not_create_lease_when_converted(self):
        house = self.make_house()
        record = ViewingRecord.objects.create(
            organization=self.org,
            house=house,
            customer_name="王五",
            customer_phone="13700137000",
            scheduled_at="2026-07-01T10:00:00+08:00",
            status=ViewingRecordStatus.CONVERTED,
        )

        self.assertEqual(record.status, ViewingRecordStatus.CONVERTED)
        self.assertFalse(Lease.objects.exists())

    def test_viewing_record_requires_same_org_for_house_and_contact(self):
        house = self.make_house()
        other_contact = Contact.objects.create(organization=self.other_org, name="异租户租客", phone="13700137001", roles=[ContactRole.TENANT])
        record = ViewingRecord(
            organization=self.other_org, house=house, contact=other_contact, customer_name="赵六", customer_phone="13700137001", scheduled_at="2026-07-01T10:00:00+08:00"
        )

        with self.assertRaises(ValidationError):
            record.full_clean()

    def test_lease_active_status_recalculates_house_status_and_respects_manual_locks(self):
        landlord = self.make_contact(phone="13800138007")
        tenant = self.make_tenant()
        house = self.make_house(landlord=landlord)
        lease = Lease.objects.create(
            organization=self.org,
            house=house,
            tenant=tenant,
            start_date=date.today(),
            end_date=date.today() + timedelta(days=365),
            monthly_rent=Decimal("4200.00"),
            status=LeaseStatus.ACTIVE,
        )

        house.refresh_from_db()
        self.assertEqual(house.status, HouseStatus.RENTED)
        lease.status = LeaseStatus.TERMINATED
        lease.save()
        house.refresh_from_db()
        self.assertEqual(house.status, HouseStatus.VACANT)
        house.status = HouseStatus.LOCKED
        house.save(update_fields=["status"])
        lease.delete()
        recalculate_house_status(house.pk)
        house.refresh_from_db()
        self.assertEqual(house.status, HouseStatus.LOCKED)

    def test_lease_status_rejects_reverse_or_terminal_transitions(self):
        landlord = self.make_contact(phone="13800138012")
        tenant = self.make_tenant(phone="13900139012")
        house = self.make_house(room_number="1302", landlord=landlord)
        lease = Lease.objects.create(
            organization=self.org,
            house=house,
            tenant=tenant,
            start_date=date.today(),
            end_date=date.today() + timedelta(days=30),
            monthly_rent=Decimal("3000"),
            status=LeaseStatus.PENDING,
        )

        lease.status = LeaseStatus.EXPIRED
        with self.assertRaises(ValidationError):
            lease.full_clean()

        lease.status = LeaseStatus.ACTIVE
        lease.save()
        lease.status = LeaseStatus.PENDING
        with self.assertRaises(ValidationError):
            lease.full_clean()

        lease.status = LeaseStatus.TERMINATED
        lease.save()
        lease.status = LeaseStatus.ACTIVE
        with self.assertRaises(ValidationError):
            lease.full_clean()

    def test_lease_validates_tenant_org_money_dates_payment_day_landlord_and_active_uniqueness(self):
        house = self.make_house(landlord=self.make_contact(phone="13800138008"))
        tenant = self.make_tenant(phone="13900139002")
        Lease.objects.create(
            organization=self.org,
            house=house,
            tenant=tenant,
            start_date=date.today(),
            end_date=date.today() + timedelta(days=30),
            monthly_rent=Decimal("3000"),
            status=LeaseStatus.ACTIVE,
        )

        duplicate = Lease(
            organization=self.org,
            house=house,
            tenant=tenant,
            start_date=date.today(),
            end_date=date.today() + timedelta(days=60),
            monthly_rent=Decimal("3100"),
            status=LeaseStatus.ACTIVE,
        )
        with self.assertRaises(ValidationError):
            duplicate.full_clean()

        empty_landlord_house = self.make_house(building=house.building, room_number="1301")
        invalid = Lease(
            organization=self.org,
            house=empty_landlord_house,
            tenant=tenant,
            start_date=date.today(),
            end_date=date.today() - timedelta(days=1),
            monthly_rent=Decimal("-1"),
            deposit=Decimal("-1"),
            payment_day=32,
        )
        with self.assertRaises(ValidationError):
            invalid.full_clean()

    def test_contract_files_are_optional_limited_and_resolved(self):
        landlord = self.make_contact(phone="13800138009")
        tenant = self.make_tenant(phone="13900139003")
        house = self.make_house(room_number="1401", landlord=landlord)
        contract = self.make_media(ResourceType.LEASE_CONTRACT, filename="lease.pdf", path=f"uploads/orgs/{self.org.pk}/lease.pdf")
        lease = Lease.objects.create(
            organization=self.org,
            house=house,
            tenant=tenant,
            start_date=date.today(),
            end_date=date.today() + timedelta(days=365),
            monthly_rent=Decimal("5000"),
            contract_files=[{"media_id": contract.pk, "media_type": MediaType.FILE, "label": "合同"}],
        )

        self.assertEqual(lease.contract_files_resolved[0]["url"], contract.file.url)
        lease.contract_files = [{"media_id": contract.pk, "media_type": MediaType.FILE}, {"media_id": contract.pk, "media_type": MediaType.FILE}]
        with self.assertRaises(ValidationError):
            lease.save()

    def test_lease_can_trace_converted_viewing_record_source(self):
        landlord = self.make_contact(phone="13800138013")
        tenant = self.make_tenant(phone="13900139013")
        house = self.make_house(room_number="1402", landlord=landlord)
        viewing = ViewingRecord.objects.create(
            organization=self.org,
            house=house,
            contact=tenant,
            customer_name="成交客户",
            customer_phone="13900139013",
            scheduled_at="2026-07-01T10:00:00+08:00",
            status=ViewingRecordStatus.CONVERTED,
        )

        lease = Lease.objects.create(
            organization=self.org,
            house=house,
            tenant=tenant,
            source_viewing_record=viewing,
            start_date=date.today(),
            end_date=date.today() + timedelta(days=365),
            monthly_rent=Decimal("5000"),
        )

        self.assertEqual(lease.source_viewing_record, viewing)

    def test_lease_source_viewing_record_cannot_be_reused_for_another_lease(self):
        landlord = self.make_contact(phone="13800138016")
        tenant = self.make_tenant(phone="13900139016")
        house = self.make_house(room_number="1405", landlord=landlord)
        viewing = ViewingRecord.objects.create(
            organization=self.org,
            house=house,
            contact=tenant,
            customer_name="重复成交客户",
            customer_phone="13900139016",
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
            monthly_rent=Decimal("5000"),
        )

        duplicate = Lease(
            organization=self.org,
            house=house,
            tenant=tenant,
            source_viewing_record=viewing,
            start_date=date.today(),
            end_date=date.today() + timedelta(days=180),
            monthly_rent=Decimal("5100"),
        )

        with self.assertRaises(ValidationError):
            duplicate.full_clean()

    def test_lease_source_viewing_record_must_match_closed_loop_context(self):
        landlord = self.make_contact(phone="13800138014")
        tenant = self.make_tenant(phone="13900139014")
        other_tenant = self.make_tenant(name="其他租客", phone="13900139015")
        house = self.make_house(room_number="1403", landlord=landlord)
        other_house = self.make_house(building=house.building, room_number="1404", landlord=landlord)
        scheduled_viewing = ViewingRecord.objects.create(
            organization=self.org,
            house=house,
            contact=tenant,
            customer_name="未成交客户",
            customer_phone="13900139014",
            scheduled_at="2026-07-01T10:00:00+08:00",
        )
        wrong_house_viewing = ViewingRecord.objects.create(
            organization=self.org,
            house=other_house,
            contact=tenant,
            customer_name="错房源客户",
            customer_phone="13900139014",
            scheduled_at="2026-07-01T10:00:00+08:00",
            status=ViewingRecordStatus.CONVERTED,
        )
        wrong_tenant_viewing = ViewingRecord.objects.create(
            organization=self.org,
            house=house,
            contact=other_tenant,
            customer_name="错租客客户",
            customer_phone="13900139015",
            scheduled_at="2026-07-01T10:00:00+08:00",
            status=ViewingRecordStatus.CONVERTED,
        )

        for source in [scheduled_viewing, wrong_house_viewing, wrong_tenant_viewing]:
            lease = Lease(
                organization=self.org,
                house=house,
                tenant=tenant,
                source_viewing_record=source,
                start_date=date.today(),
                end_date=date.today() + timedelta(days=365),
                monthly_rent=Decimal("5000"),
            )
            with self.assertRaises(ValidationError):
                lease.full_clean()
