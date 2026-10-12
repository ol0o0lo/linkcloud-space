from __future__ import annotations

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
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
from apps.notifications.services import notify
from apps.organizations.models import Organization, OrganizationMember
from apps.settings.service import get_user_setting, set_user_setting


@transaction.atomic
@transaction.atomic
def create_contact(*, organization, data: dict):
    return Contact.objects.create(organization=organization, **data)


@transaction.atomic
def update_contact(*, organization, contact_id: int, changes: dict):
    contact = get_object_or_404(Contact.objects.select_for_update(), pk=contact_id, organization=organization)
    for field, value in changes.items():
        setattr(contact, field, value)
    contact.save()
    return contact


def resolve_deal_signing_tenant(*, organization: Organization, name: str, phone: str):
    """按姓名和手机号精确复用租客，不命中时创建联系人。"""
    from apps.house.models import Contact

    normalized_name = name.strip()
    normalized_phone = phone.strip()
    if not normalized_name:
        raise ValidationError({"tenant_identity": {"name": "请输入租客姓名。"}})
    if not normalized_phone:
        raise ValidationError({"tenant_identity": {"phone": "请输入租客手机号。"}})

    try:
        contact, _created = Contact.objects.get_or_create(
            organization=organization,
            name=normalized_name,
            phone=normalized_phone,
            defaults={"roles": [ContactRole.TENANT], "is_active": True},
        )
    except ValidationError as error:
        contact = Contact.objects.filter(organization=organization, name=normalized_name, phone=normalized_phone).first()
        if contact is None:
            raise error
    if not contact.is_active:
        raise ValidationError({"tenant_identity": "该租客已停用，请先启用后再签约。"})
    if not contact.has_role(ContactRole.TENANT):
        contact.roles = [*(contact.roles or []), ContactRole.TENANT]
        contact.save(update_fields=["roles", "updated_at"])
    return contact


def get_contact_for_new_business(contact_id: int, org, role: str):
    contact = get_contact_in_org(contact_id, org)
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


@transaction.atomic
def send_tenant_contact_request(*, house, user, channels: list[str], phone: str = "", wechat: str = ""):
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

    recipient = resolve_contact_recipient(house)
    if recipient is None:
        raise TenantContactRecipientUnavailable("暂无可联系中介，请稍后再试。")

    contact_data = {
        "channels": selected,
        "phone": normalized_phone,
        "wechat": normalized_wechat,
    }
    previous_setting = get_user_setting(user, TENANT_CONTACT_SETTING_KEY, {})
    if not isinstance(previous_setting, dict):
        previous_setting = {}
    setting_value = {
        "channels": selected,
        "phone": normalized_phone or (previous_setting.get("phone") if isinstance(previous_setting.get("phone"), str) else ""),
        "wechat": normalized_wechat or (previous_setting.get("wechat") if isinstance(previous_setting.get("wechat"), str) else ""),
    }
    notifications = notify(
        [recipient],
        organization=house.organization,
        actor=user,
        target=house,
        category="house.contact",
        title="租客预约联系",
        body="租客希望就该房源与你联系，请查看联系方式并主动联系。",
        data={"house_id": house.pk, **contact_data},
    )
    if not notifications:
        raise TenantContactRecipientUnavailable("暂无可联系中介，请稍后再试。")
    set_user_setting(user, TENANT_CONTACT_SETTING_KEY, setting_value)
    return notifications[0]


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
