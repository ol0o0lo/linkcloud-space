from __future__ import annotations

from django.contrib.contenttypes.models import ContentType
from django.core.exceptions import PermissionDenied
from django.db import transaction
from django.shortcuts import get_object_or_404

from apps.base.exceptions import ConflictException
from apps.house.constants import ContactRole
from apps.house.exceptions import HouseInvalidException
from apps.house.models import Contact, CustomerProfile, House
from apps.house.queries.customers import can_manage_customers, get_customer, require_customer_member
from apps.house.services.contacts import TenantContactValidationError, _normalize_contact_phone
from apps.notifications.models import Notification
from apps.organizations.models import Organization, OrganizationMember

CONTACT_FIELDS = {"name", "phone", "email", "notes", "is_active"}
NULLABLE_FIELDS = {"assigned_to_id", "min_rent", "max_rent", "bedrooms", "move_in_date", "next_follow_up_at"}


def _validate_customer_changes(changes):
    for field, value in changes.items():
        if value is None and field not in NULLABLE_FIELDS:
            raise HouseInvalidException(f"{field} 不能为空。")
    if "name" in changes and not changes["name"].strip():
        raise HouseInvalidException("请输入客户姓名。")


def assert_customer_contact_access(contact, *, actor, organization, inquiry=None, viewing=None, house_id=None):
    require_customer_member(organization=organization, actor=actor)
    if contact.organization_id != organization.pk:
        raise PermissionDenied("客户不属于当前组织。")
    if inquiry is not None:
        from apps.house.services.inquiries import assert_inquiry_context

        assert_inquiry_context(inquiry=inquiry, organization=organization, actor=actor, house_id=house_id, contact_id=contact.pk)
        return
    if viewing is not None:
        if viewing.source_inquiry_id is not None or viewing.organization_id != organization.pk or viewing.house_id != house_id:
            raise HouseInvalidException("旧带看上下文与当前组织、房源不匹配。")
        if viewing.contact_id is not None:
            if viewing.contact_id != contact.pk:
                raise HouseInvalidException("旧带看上下文与当前客户不匹配。")
            if viewing.assigned_to_id == actor.pk or can_manage_customers(organization=organization, actor=actor):
                return
    profile = getattr(contact, "customer_profile", None)
    if profile and profile.assigned_to_id != actor.pk and not can_manage_customers(organization=organization, actor=actor):
        raise PermissionDenied("你没有处理该客户的权限。")


def _phone(phone):
    if not isinstance(phone, str):
        raise HouseInvalidException("请输入有效的手机号。")
    try:
        return _normalize_contact_phone(phone)
    except TenantContactValidationError as error:
        raise HouseInvalidException(str(error)) from error


def _contact_with_phone(*, organization, actor, phone, exclude_id=None):
    matches = list(Contact.objects.select_for_update().filter(organization=organization, normalized_phone=phone).exclude(pk=exclude_id))
    if len(matches) > 1:
        raise ConflictException("该手机号存在多条联系人记录，请先合并后再处理。")
    if not matches:
        return None
    contact = matches[0]
    if not contact.is_active:
        raise ConflictException("该手机号对应的联系人已停用，请先启用。")
    profile = getattr(contact, "customer_profile", None)
    if profile and profile.assigned_to_id != actor.pk and not can_manage_customers(organization=organization, actor=actor):
        raise ConflictException("该手机号的客户已由其他成员负责，请联系组织管理员处理。")
    return contact


def _apply_customer_changes(*, contact, profile, actor, organization, changes):
    if "next_follow_up_at" in changes or "last_follow_up_at" in changes:
        raise HouseInvalidException("客户跟进功能已停用。")
    _validate_customer_changes(changes)
    if "assigned_to_id" in changes:
        assignee = changes["assigned_to_id"]
        if not can_manage_customers(organization=organization, actor=actor) and assignee != actor.pk:
            raise PermissionDenied("仅组织管理员可分派客户负责人。")
        if assignee is not None and not OrganizationMember.objects.filter(organization=organization, user_id=assignee, user__is_active=True).exists():
            raise HouseInvalidException("负责人必须是当前组织的有效成员。")
    if "phone" in changes:
        phone = _phone(changes["phone"])
        if phone != contact.normalized_phone and _contact_with_phone(organization=organization, actor=actor, phone=phone, exclude_id=contact.pk):
            raise ConflictException("该手机号已存在联系人，请复用已有客户。")
        changes["phone"] = changes["phone"].strip()
    for field, value in changes.items():
        setattr(contact if field in CONTACT_FIELDS else profile, field, value)
    contact.save()
    profile.save()
    contact.customer_profile = profile
    return contact


@transaction.atomic
def create_customer(*, organization, actor, data):
    require_customer_member(organization=organization, actor=actor)
    _validate_customer_changes(data)
    # Serialize normalized-phone matching and first contact creation within this organization.
    Organization.objects.select_for_update().get(pk=organization.pk)
    phone = _phone(data["phone"])
    contact = _contact_with_phone(organization=organization, actor=actor, phone=phone)
    if contact is None:
        contact = Contact.objects.create(organization=organization, roles=[ContactRole.TENANT], **{key: value for key, value in data.items() if key in CONTACT_FIELDS})
    elif not contact.has_role(ContactRole.TENANT):
        contact.roles = [*(contact.roles or []), ContactRole.TENANT]
        contact.save(update_fields=["roles", "updated_at"])
    profile, _ = CustomerProfile.objects.get_or_create(contact=contact, defaults={"assigned_to": actor})
    return _apply_customer_changes(contact=contact, profile=profile, actor=actor, organization=organization, changes=data)


@transaction.atomic
def update_customer(*, organization, actor, contact_id, changes):
    Organization.objects.select_for_update().get(pk=organization.pk)
    contact = get_customer(organization=organization, actor=actor, contact_id=contact_id, for_update=True)
    profile, _ = CustomerProfile.objects.get_or_create(contact=contact, defaults={"assigned_to": actor})
    return _apply_customer_changes(contact=contact, profile=profile, actor=actor, organization=organization, changes=changes)


def add_customer_follow_up(**kwargs):
    raise HouseInvalidException("客户跟进功能已停用，历史记录保留。")


@transaction.atomic
def convert_customer_inquiry(*, organization, actor, notification_id, data):
    from apps.house.models import HouseInquiry
    from apps.house.services.inquiries import convert_inquiry, prepare_inquiry_contact

    require_customer_member(organization=organization, actor=actor)
    Organization.objects.select_for_update().get(pk=organization.pk)
    notification = get_object_or_404(Notification.objects.select_for_update(of=("self",)).select_related("actor"), pk=notification_id, organization=organization)
    if notification.recipient_id != actor.pk and not can_manage_customers(organization=organization, actor=actor):
        raise PermissionDenied("仅咨询接收人或组织管理员可转入客户。")
    if not OrganizationMember.objects.filter(organization=organization, user_id=notification.recipient_id).exists():
        raise HouseInvalidException("咨询接收人不属于当前组织。")
    data_snapshot = notification.data if isinstance(notification.data, dict) else {}
    house_type = ContentType.objects.get_for_model(House)
    if (
        notification.category != "house.contact"
        or type(data_snapshot.get("house_id")) is not int
        or notification.target_content_type_id != house_type.pk
        or notification.target_object_id != data_snapshot["house_id"]
    ):
        raise HouseInvalidException("该通知不是有效房源咨询。")
    house = House.objects.filter(pk=notification.target_object_id, building__organization=organization).first()
    if house is None:
        raise HouseInvalidException("咨询房源不存在或不属于当前组织。")
    if inquiry_id := data_snapshot.get("inquiry_id"):
        inquiry = get_object_or_404(HouseInquiry, pk=inquiry_id, organization=organization, house=house)
    else:
        inquiry = (
            HouseInquiry.objects.filter(organization=organization, user_id=notification.actor_id, house=house, status__in=["new", "processing"]).first()
            if notification.actor_id
            else None
        )
        if inquiry is None:
            existing_contact = Contact.objects.filter(pk=data_snapshot.get("customer_contact_id"), organization=organization).first()
            inquiry = HouseInquiry.objects.create(
                organization=organization,
                house=house,
                user=notification.actor,
                assigned_to_id=notification.recipient_id,
                customer_name=(notification.actor.get_full_name() or notification.actor.username)[:100] if notification.actor_id else "咨询客户",
                phone=data_snapshot.get("phone") or "",
                wechat=data_snapshot.get("wechat") or "",
                contact=existing_contact,
            )
    contact = convert_inquiry(organization=organization, actor=actor, inquiry_id=inquiry.pk, data=data)
    notification.data = {**data_snapshot, "inquiry_id": inquiry.pk, "customer_contact_id": contact.pk}
    notification.save(update_fields=["data", "updated_at"])
    return prepare_inquiry_contact(contact, wechat=inquiry.wechat)
