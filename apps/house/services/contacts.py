from __future__ import annotations

from uuid import uuid4

from django.contrib.auth import get_user_model
from django.core.exceptions import PermissionDenied, ValidationError
from django.db import transaction
from django.http import Http404
from django.shortcuts import get_object_or_404

import phonenumbers
from phonenumbers.phonenumberutil import NumberParseException

from apps.accounts.models import normalize_phone
from apps.base.exceptions import ConflictException
from apps.base.invitation_exceptions import (
    InvitationBindingConflictException,
    InvitationPhoneVerificationRequiredException,
    InvitationRecipientMismatchException,
    InvitationUnavailableException,
)
from apps.base.invitation_receipts import get_invitation_receipt, save_invitation_receipt
from apps.base.sms import send_invitation_sms
from apps.house.constants import ContactRole
from apps.house.exceptions import HouseInvalidException, HouseUnavailableException
from apps.house.models import Contact
from apps.house.queries.contacts import get_contact_in_org
from apps.house.queries.responsibilities import resolve_contact_recipient
from apps.house.services.invitations import (
    LANDLORD_INVITATION_VALID_DAYS,
    LandlordInvitationCacheError,
    consume_landlord_invitation,
    create_landlord_invitation,
    get_landlord_invitation,
    invitation_action_url,
    invitation_expires_at,
    mask_phone,
    normalize_invitation_phone,
)
from apps.house.services.messaging import (
    contact_message_content,
    contact_message_payload,
    get_inquiry_conversation,
    get_personal_inquiry_conversation,
    replay_contact_message,
    send_contact_message,
)
from apps.organizations.models import Organization, OrganizationMember
from apps.settings.service import get_user_setting, set_user_setting


@transaction.atomic
def create_contact(*, organization, data: dict, actor=None):
    if actor is not None:
        from apps.house.queries.customers import require_customer_member

        require_customer_member(organization=organization, actor=actor)
        if ContactRole.TENANT in (data.get("roles") or []):
            from apps.house.services.customers import create_customer

            contact = create_customer(organization=organization, actor=actor, data={key: value for key, value in data.items() if key != "roles"})
            contact.roles = list(dict.fromkeys([*(contact.roles or []), *(data.get("roles") or [])]))
            contact.save(update_fields=["roles", "updated_at"])
            return contact
    contact = Contact.objects.create(organization=organization, **data)
    if actor is not None and contact.has_role(ContactRole.TENANT):
        from apps.house.models import CustomerProfile

        CustomerProfile.objects.create(contact=contact, assigned_to=actor)
    return contact


@transaction.atomic
def update_contact(*, organization, contact_id: int, changes: dict, actor=None):
    Organization.objects.select_for_update().get(pk=organization.pk)
    contact = get_object_or_404(Contact.objects.select_for_update(), pk=contact_id, organization=organization)
    if actor is not None:
        from apps.house.queries.customers import can_manage_customers, visible_contacts
        from apps.house.services.customers import assert_customer_contact_access

        get_object_or_404(visible_contacts(organization=organization, actor=actor), pk=contact.pk)
        assert_customer_contact_access(contact, actor=actor, organization=organization)
        if contact.has_role(ContactRole.TENANT) and not getattr(contact, "customer_profile", None) and not can_manage_customers(organization=organization, actor=actor):
            raise PermissionDenied("历史租客请先由组织管理员补充客户档案。")
    if getattr(contact, "customer_profile", None) and "roles" in changes and ContactRole.TENANT not in (changes["roles"] or []):
        raise HouseInvalidException("已有客户档案的联系人必须保留租客角色。")
    if actor is not None and ("phone" in changes or "roles" in changes) and (contact.has_role(ContactRole.TENANT) or ContactRole.TENANT in (changes.get("roles") or [])):
        from apps.house.services.customers import _contact_with_phone, _phone

        if _contact_with_phone(organization=organization, actor=actor, phone=_phone(changes.get("phone", contact.phone)), exclude_id=contact.pk):
            raise ConflictException("该手机号已存在联系人，请复用已有客户。")
    for field, value in changes.items():
        setattr(contact, field, value)
    contact.save()
    if actor is not None and contact.has_role(ContactRole.TENANT):
        from apps.house.models import CustomerProfile

        CustomerProfile.objects.get_or_create(contact=contact, defaults={"assigned_to": actor})
    return contact


def resolve_deal_signing_tenant(*, organization: Organization, name: str, phone: str):
    """按标准化手机号复用租客，避免通过改名重复建客。"""
    from apps.house.models import Contact

    normalized_name = name.strip()
    normalized_phone = phone.strip()
    if not normalized_name:
        raise ValidationError({"tenant_identity": {"name": "请输入租客姓名。"}})
    if not normalized_phone:
        raise ValidationError({"tenant_identity": {"phone": "请输入租客手机号。"}})

    Organization.objects.select_for_update().get(pk=organization.pk)
    matches = list(Contact.objects.filter(organization=organization, normalized_phone=_normalize_contact_phone(normalized_phone)))
    if len(matches) > 1:
        raise ConflictException("该手机号存在多条联系人记录，请先合并后再处理。")
    contact = matches[0] if matches else Contact.objects.create(organization=organization, name=normalized_name, phone=normalized_phone, roles=[ContactRole.TENANT])
    if not contact.is_active:
        raise ValidationError({"tenant_identity": "该租客已停用，请先启用后再签约。"})
    if not contact.has_role(ContactRole.TENANT):
        contact.roles = [*(contact.roles or []), ContactRole.TENANT]
        contact.save(update_fields=["roles", "updated_at"])
    return contact


def get_contact_for_new_business(contact_id: int, org, role: str, actor=None, inquiry=None, house_id=None):
    contact = get_contact_in_org(contact_id, org)
    if actor is not None and role == ContactRole.TENANT:
        from apps.house.services.customers import assert_customer_contact_access

        assert_customer_contact_access(contact, actor=actor, organization=org, inquiry=inquiry, house_id=house_id)
    if not contact.is_active:
        raise HouseInvalidException("已停用联系人不能用于新业务")
    if not contact.has_role(role):
        role_label = "房东" if role == ContactRole.LANDLORD else "租客"
        raise HouseInvalidException(f"联系人必须具备{role_label}角色")
    return contact


def validate_assignee_in_org(user_id: int | None, org) -> None:
    if user_id is None:
        return
    get_object_or_404(OrganizationMember, organization=org, user_id=user_id)


TENANT_CONTACT_SETTING_KEY = "internal.house.contact.v1"


class TenantContactConflict(Exception):
    pass


class TenantContactValidationError(Exception):
    pass


class TenantContactRecipientUnavailable(Exception):
    pass


@transaction.atomic
def get_or_bind_tenant_contact(*, organization, user) -> Contact:
    normalized_phone = normalize_phone(user.phone)
    # Serialize binding attempts for the same user, including the first contact creation.
    get_user_model().objects.select_for_update().get(pk=user.pk)
    matches = list(Contact.objects.select_for_update().filter(organization=organization, normalized_phone=normalized_phone))
    if len(matches) > 1:
        raise TenantContactConflict("该手机号在当前组织存在多条联系人记录，请联系工作人员处理。")

    if matches:
        contact = matches[0]
        if not contact.is_active:
            raise TenantContactConflict("该手机号对应的联系人已停用，请联系工作人员处理。")
        if contact.user_id not in (None, user.pk):
            raise TenantContactConflict("该手机号已绑定其他账号，请联系工作人员处理。")
        contact.user = user
        contact.roles = list(dict.fromkeys([*(contact.roles or []), ContactRole.TENANT]))
        contact.save(update_fields=["user", "roles", "updated_at"])
        return contact

    return Contact.objects.create(
        organization=organization,
        name=user.get_full_name().strip() or user.username,
        phone=normalized_phone,
        roles=[ContactRole.TENANT],
        user=user,
    )


def _normalize_contact_phone(phone: str) -> str:
    normalized = normalize_phone(phone)
    if not normalized:
        raise TenantContactValidationError("请输入有效的手机号。")
    try:
        parsed = phonenumbers.parse(normalized, None)
    except NumberParseException as exc:
        raise TenantContactValidationError("请输入有效的手机号。") from exc
    if not phonenumbers.is_valid_number(parsed):
        raise TenantContactValidationError("请输入有效的手机号。")
    return phonenumbers.format_number(parsed, phonenumbers.PhoneNumberFormat.E164)


def normalize_tenant_contact_preference(value):
    if not isinstance(value, dict):
        raise TenantContactValidationError("联系方式格式不正确。")
    phone, wechat = value.get("phone", ""), value.get("wechat", "")
    if not isinstance(phone, str) or not isinstance(wechat, str) or len(phone) > 32 or len(wechat) > 64:
        raise TenantContactValidationError("联系方式格式不正确。")
    return {"phone": _normalize_contact_phone(phone) if phone.strip() else "", "wechat": wechat.strip(), "channels": []}


@transaction.atomic
def start_tenant_conversation(*, house, user):
    from apps.house.services.inquiries import record_inquiry

    Organization.objects.select_for_update().get(pk=house.organization.pk)
    recipient = resolve_contact_recipient(house)
    inquiry = record_inquiry(house=house, user=user, assigned_to=recipient, include_contact_details=False)
    original = inquiry.assigned_to
    if original is not None and OrganizationMember.objects.filter(organization=house.organization, user=original, user__is_active=True).exists():
        recipient = original
    if recipient is None or not recipient.is_active:
        raise TenantContactRecipientUnavailable("暂无接待人员，请稍后再试。")
    if recipient.pk == user.pk:
        raise TenantContactRecipientUnavailable("当前账号就是该房源接待人，不能与自己发起聊天。")
    if inquiry.assigned_to_id != recipient.pk:
        inquiry.assigned_to = recipient
        inquiry.save(update_fields=["assigned_to", "updated_at"])
    return get_inquiry_conversation(house=house, user=user, inquiry=inquiry, recipient=recipient)


@transaction.atomic
def share_tenant_contact(*, user, conversation_id, channels, phone="", wechat="", client_message_id):
    from apps.messaging.constants import ParticipantAccessKind
    from apps.messaging.services import send_message

    inquiry, conversation = get_personal_inquiry_conversation(user=user, conversation_id=conversation_id)
    Organization.objects.select_for_update().get(pk=inquiry.organization_id)
    if not channels:
        raise TenantContactValidationError("请至少选择一种联系方式。")
    selected_phone = _normalize_contact_phone(phone) if "phone" in channels else ""
    selected_wechat = wechat.strip() if "wechat" in channels else ""
    if "wechat" in channels and not selected_wechat:
        raise TenantContactValidationError("请输入微信号。")
    message, created = send_message(
        actor=user,
        organization=inquiry.organization,
        access_kind=ParticipantAccessKind.BUSINESS_PARTY,
        conversation_id=conversation.pk,
        client_message_id=client_message_id,
        content=contact_message_content(house=inquiry.house, phone=selected_phone, wechat=selected_wechat),
        message_type="house.contact",
        payload=contact_message_payload(house=inquiry.house, phone=selected_phone, wechat=selected_wechat),
    )
    if created:
        changes = {}
        if "phone" in channels:
            changes["phone"] = selected_phone
        if "wechat" in channels:
            changes["wechat"] = selected_wechat
        type(inquiry).objects.filter(pk=inquiry.pk).update(**changes)
    return message


@transaction.atomic
def send_tenant_contact_request(*, house, user, channels: list[str], phone: str = "", wechat: str = "", client_message_id=None):
    selected = [channel for channel in ("phone", "wechat") if channel in channels]
    if not selected:
        raise TenantContactValidationError("请至少选择一种联系方式。")

    normalized_phone = ""
    normalized_wechat = ""
    if "phone" in selected:
        fallback_phone = user.phone if user.phone_verified else ""
        normalized_phone = _normalize_contact_phone(phone.strip() or fallback_phone or "")
    if "wechat" in selected:
        normalized_wechat = wechat.strip()
        if not normalized_wechat:
            raise TenantContactValidationError("请输入微信号。")

    # 组织锁覆盖首次咨询和消息重放，避免同一次业务发送在接待人变化时重复入不同会话。
    Organization.objects.select_for_update().get(pk=house.organization.pk)
    request_id = client_message_id or uuid4()
    content = contact_message_content(house=house, phone=normalized_phone, wechat=normalized_wechat)
    previous = replay_contact_message(house=house, user=user, client_message_id=request_id, content=content, phone=normalized_phone, wechat=normalized_wechat)
    if previous is not None:
        return previous
    recipient = resolve_contact_recipient(house)
    from apps.house.services.inquiries import record_inquiry

    inquiry = record_inquiry(house=house, user=user, assigned_to=recipient, phone=normalized_phone, wechat=normalized_wechat)

    previous_setting = get_user_setting(user, TENANT_CONTACT_SETTING_KEY, {})
    if not isinstance(previous_setting, dict):
        previous_setting = {}
    setting_value = {
        "channels": selected,
        "phone": normalized_phone or (previous_setting.get("phone") if isinstance(previous_setting.get("phone"), str) else ""),
        "wechat": normalized_wechat or (previous_setting.get("wechat") if isinstance(previous_setting.get("wechat"), str) else ""),
    }
    # 继续联系仍归原有效接待人；原接待已失效或未分派时，才采用当前房源接待规则。
    original = inquiry.assigned_to
    if original is not None and OrganizationMember.objects.filter(organization=house.organization, user=original, user__is_active=True).exists():
        recipient = original
    elif recipient is not None and not OrganizationMember.objects.filter(organization=house.organization, user=recipient, user__is_active=True).exists():
        recipient = None
    if recipient is not None and recipient.pk == user.pk:
        raise TenantContactRecipientUnavailable("当前账号就是该房源接待人，不能与自己发起聊天。")
    if inquiry.assigned_to_id != getattr(recipient, "pk", None):
        inquiry.assigned_to = recipient
        inquiry.save(update_fields=["assigned_to", "updated_at"])
    set_user_setting(user, TENANT_CONTACT_SETTING_KEY, setting_value)
    if recipient is None:
        inquiry.notification_id = None
        inquiry.conversation = None
        inquiry.message = None
        return inquiry
    return send_contact_message(
        house=house,
        user=user,
        inquiry=inquiry,
        recipient=recipient,
        client_message_id=request_id,
        content=content,
        phone=normalized_phone,
        wechat=normalized_wechat,
    )


@transaction.atomic
def accept_landlord_invitation(*, user, token: str):
    receipt = get_invitation_receipt("landlord", token, user.pk)
    if receipt:
        return receipt
    try:
        invitation = get_landlord_invitation(token)
    except LandlordInvitationCacheError as err:
        raise HouseUnavailableException(str(err)) from err
    if invitation is None:
        raise InvitationUnavailableException()

    with transaction.atomic():
        contact = get_object_or_404(
            Contact.objects.select_for_update().select_related("organization"),
            pk=invitation["contact_id"],
            organization_id=invitation["organization_id"],
            is_active=True,
        )
        if ContactRole.LANDLORD not in (contact.roles or []):
            raise Http404
        if contact.user_id and contact.user_id != user.pk:
            raise InvitationBindingConflictException("该房东联系人已绑定其他账号。")
        if not contact.user_id:
            if not user.phone_verified or not user.phone:
                raise InvitationPhoneVerificationRequiredException()
            try:
                user_phone = normalize_invitation_phone(user.phone)
                contact_phone = normalize_invitation_phone(contact.phone)
            except ValueError as err:
                raise InvitationRecipientMismatchException("当前账号手机号与房东联系人手机号不一致。") from err
            if user_phone != contact_phone or user_phone != invitation["phone"]:
                raise InvitationRecipientMismatchException("当前账号手机号与房东联系人手机号不一致。")
            contact.user = user
        contact.ensure_public_key()
        contact.save(update_fields=["user", "public_key", "updated_at"])
        result = {
            "contact_id": contact.pk,
            "organization_id": contact.organization_id,
            "organization_name": contact.organization.name,
            "public_key": str(contact.public_key),
        }
        save_invitation_receipt("landlord", token, user.pk, result)
        transaction.on_commit(lambda: consume_landlord_invitation(invitation))
    return result


@transaction.atomic
def invite_landlord(*, organization, actor, contact_id: int, delivery_method: str = "sms"):
    org = organization
    contact = get_contact_in_org(contact_id, org)
    if not contact.is_active:
        raise HouseInvalidException("已停用联系人不能邀请房东。")
    if ContactRole.LANDLORD not in (contact.roles or []):
        raise HouseInvalidException("联系人必须具备房东角色。")
    if contact.user_id:
        raise ConflictException("该房东联系人已绑定账号。")
    try:
        normalize_invitation_phone(contact.phone)
        invitation = create_landlord_invitation(contact=contact, inviter=actor)
    except ValueError as err:
        raise HouseInvalidException(str(err)) from err
    except LandlordInvitationCacheError as err:
        raise HouseUnavailableException(str(err)) from err

    expires_at = invitation_expires_at(invitation)
    if expires_at is None:
        raise HouseUnavailableException("房东邀请失效时间无效。")
    action_url = invitation_action_url(invitation["token"], expires_at)
    if delivery_method == "sms":
        send_invitation_sms(invitation["phone"], action_url, LANDLORD_INVITATION_VALID_DAYS)
    return {
        "organization_name": org.name,
        "contact_name": contact.name,
        "invitee_phone_masked": mask_phone(invitation["phone"]),
        "expires_at": expires_at,
        "action_url": action_url,
    }
