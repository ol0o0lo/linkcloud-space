from __future__ import annotations

from django.core.exceptions import PermissionDenied
from django.db import transaction
from django.shortcuts import get_object_or_404

from apps.base.exceptions import ConflictException
from apps.house.constants import ContactRole, HouseInquiryStatus, ViewingRecordStatus
from apps.house.exceptions import HouseInvalidException
from apps.house.models import Contact, CustomerProfile, HouseInquiry
from apps.house.queries.customers import can_manage_customers, require_customer_member
from apps.house.services.customers import _phone
from apps.organizations.models import Organization, OrganizationMember

OPEN_STATUSES = (HouseInquiryStatus.NEW, HouseInquiryStatus.PROCESSING)


def prepare_inquiry_contact(contact, *, wechat):
    return {"id": contact.pk, "name": contact.name, "phone": contact.phone, "wechat": wechat}


def inquiries_for_actor(*, organization, actor):
    require_customer_member(organization=organization, actor=actor)
    qs = HouseInquiry.objects.filter(organization=organization).select_related("house__building__estate", "contact", "assigned_to")
    if not can_manage_customers(organization=organization, actor=actor):
        qs = qs.filter(assigned_to=actor)
    return qs


def get_inquiry(*, organization, actor, inquiry_id, for_update=False):
    qs = inquiries_for_actor(organization=organization, actor=actor)
    if for_update:
        qs = qs.select_for_update(of=("self",))
    return get_object_or_404(qs, pk=inquiry_id)


def assert_inquiry_context(*, inquiry, organization, actor, house_id, contact_id, require_open=True):
    require_customer_member(organization=organization, actor=actor)
    if inquiry.organization_id != organization.pk or inquiry.house_id != house_id or inquiry.contact_id != contact_id:
        raise HouseInvalidException("咨询、客户及房源不匹配。")
    if inquiry.assigned_to_id != actor.pk and not can_manage_customers(organization=organization, actor=actor):
        raise PermissionDenied("你没有处理该咨询的权限。")
    if require_open and inquiry.status not in OPEN_STATUSES:
        raise HouseInvalidException("已关闭或已成交咨询不能创建新业务。")


@transaction.atomic
def record_inquiry(*, house, user, assigned_to, phone="", wechat="", include_contact_details=True):
    # 组织锁也覆盖首次咨询，避免同一客户并发确认出两条联系人。
    Organization.objects.select_for_update().get(pk=house.organization.pk)
    inquiry = HouseInquiry.objects.select_for_update().filter(organization=house.organization, house=house, user=user, status__in=OPEN_STATUSES).first()
    contact = None
    if include_contact_details:
        confirmed = HouseInquiry.objects.filter(organization=house.organization, user=user, contact__isnull=False).select_related("contact").first()
        contact = confirmed.contact if confirmed else Contact.objects.filter(organization=house.organization, user=user, is_active=True).first()
    if inquiry is None:
        inquiry = HouseInquiry(organization=house.organization, house=house, user=user, assigned_to=assigned_to, contact=contact)
    inquiry.customer_name = (inquiry.customer_name or user.get_full_name().strip() or user.username)[:100]
    inquiry.phone = phone or inquiry.phone
    if contact is not None:
        inquiry.contact = contact
        inquiry.customer_name = contact.name
        inquiry.phone = contact.phone
    inquiry.wechat = wechat or inquiry.wechat
    inquiry.save()
    return inquiry


@transaction.atomic
def convert_inquiry(*, organization, actor, inquiry_id, data):
    Organization.objects.select_for_update().get(pk=organization.pk)
    inquiry = get_inquiry(organization=organization, actor=actor, inquiry_id=inquiry_id, for_update=True)
    confirmed = inquiry if inquiry.contact_id else None
    if confirmed is None and inquiry.user_id:
        confirmed = HouseInquiry.objects.filter(organization=organization, user_id=inquiry.user_id, contact__isnull=False).select_related("contact").first()
    if confirmed:
        contact = confirmed.contact
    else:
        phone = data.get("phone") or inquiry.phone
        if not phone:
            raise HouseInvalidException("该咨询仅提供微信号，请补录客户手机号后再转入客户。")
        phone = _phone(phone)
        matches = list(Contact.objects.select_for_update().filter(organization=organization, normalized_phone=phone))
        if len(matches) > 1:
            raise ConflictException("该手机号存在多条联系人记录，请先合并后再处理。")
        contact = (
            matches[0]
            if matches
            else Contact.objects.create(organization=organization, name=(data.get("name") or inquiry.customer_name or "咨询客户").strip(), phone=phone, roles=[ContactRole.TENANT])
        )
    if not contact.is_active:
        raise ConflictException("该手机号对应的联系人已停用，请先启用。")
    if not contact.has_role(ContactRole.TENANT):
        contact.roles = [*(contact.roles or []), ContactRole.TENANT]
        contact.save(update_fields=["roles", "updated_at"])
    profile, _ = CustomerProfile.objects.get_or_create(contact=contact, defaults={"assigned_to": inquiry.assigned_to or actor, "source": "inquiry", "wechat": inquiry.wechat})
    if not profile.wechat and inquiry.wechat:
        profile.wechat = inquiry.wechat
        profile.save(update_fields=["wechat", "updated_at"])
    inquiry.contact = contact
    inquiry.customer_name = contact.name
    inquiry.phone = contact.phone
    inquiry.status = HouseInquiryStatus.PROCESSING if inquiry.status == HouseInquiryStatus.NEW else inquiry.status
    inquiry.save()
    if inquiry.user_id:
        HouseInquiry.objects.filter(organization=organization, user_id=inquiry.user_id, contact__isnull=True).update(
            contact=contact, customer_name=contact.name, phone=contact.phone
        )
    return contact


@transaction.atomic
def update_inquiry(*, organization, actor, inquiry_id, data):
    Organization.objects.select_for_update().get(pk=organization.pk)
    inquiry = get_inquiry(organization=organization, actor=actor, inquiry_id=inquiry_id, for_update=True)
    if inquiry.status == HouseInquiryStatus.SIGNED:
        raise HouseInvalidException("已成交咨询不能修改，请维护关联租约。")
    if "phone" in data and data["phone"]:
        data["phone"] = _phone(data["phone"])
    if inquiry.contact_id:
        name_changed = "customer_name" in data and data["customer_name"] != inquiry.contact.name
        phone_changed = "phone" in data and data["phone"] != _phone(inquiry.contact.phone)
        if name_changed or phone_changed:
            raise HouseInvalidException("已确认的客户姓名及手机号请在客户档案中维护。")
    for key, value in data.items():
        setattr(inquiry, key, value)
    inquiry.save()
    return inquiry


@transaction.atomic
def assign_inquiry(*, organization, actor, inquiry_id, assigned_to_id):
    if not can_manage_customers(organization=organization, actor=actor):
        raise PermissionDenied("仅组织管理员可转派咨询。")
    Organization.objects.select_for_update().get(pk=organization.pk)
    inquiry = get_inquiry(organization=organization, actor=actor, inquiry_id=inquiry_id, for_update=True)
    if not OrganizationMember.objects.filter(organization=organization, user_id=assigned_to_id, user__is_active=True).exists():
        raise HouseInvalidException("负责人必须是当前组织的有效成员。")
    inquiry.assigned_to_id = assigned_to_id
    inquiry.save(update_fields=["assigned_to", "updated_at"])
    inquiry.viewings.filter(status=ViewingRecordStatus.SCHEDULED).update(assigned_to_id=assigned_to_id)
    return inquiry


def refresh_inquiry_after_viewing(inquiry_id):
    if inquiry_id:
        HouseInquiry.objects.filter(pk=inquiry_id, status__in=OPEN_STATUSES).update(status=HouseInquiryStatus.PROCESSING)


def prepare_inquiry(inquiry, *, actor, detail=False):
    manager = can_manage_customers(organization=inquiry.organization, actor=actor)
    result = {
        key: getattr(inquiry, key) for key in ("id", "house_id", "house", "contact_id", "customer_name", "phone", "wechat", "assigned_to_id", "status", "notes", "created_at")
    }
    if inquiry.contact_id:
        result.update(customer_name=inquiry.contact.name, phone=inquiry.contact.phone)
    result.update(
        assigned_to_name=(inquiry.assigned_to.get_full_name() or inquiry.assigned_to.username) if inquiry.assigned_to_id else "",
        status_label=HouseInquiryStatus.get_choice_label(inquiry.status),
        viewing_count=inquiry.viewings.count(),
        signed_lease_id=inquiry.leases.exclude(status="pending").order_by("pk").values_list("pk", flat=True).first(),
        can_manage=manager,
        can_process=(manager or inquiry.assigned_to_id == actor.pk) and inquiry.status in OPEN_STATUSES,
        viewings=list(inquiry.viewings.select_related("house__building__estate", "contact", "assigned_to")) if detail else [],
        leases=list(inquiry.leases.select_related("house__building__estate", "tenant", "source_viewing_record")) if detail else [],
    )
    return result
