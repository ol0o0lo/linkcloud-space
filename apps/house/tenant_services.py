from django.db import transaction

import phonenumbers
from phonenumbers.phonenumberutil import NumberParseException

from apps.accounts.models import normalize_phone
from apps.house.constants import ContactRole
from apps.house.models import Contact, PropertyResponsibility
from apps.notifications.services import notify
from apps.organizations.models import OrganizationMember
from apps.settings.service import get_user_setting, set_user_setting

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
    matches = [contact for contact in Contact.objects.select_for_update().filter(organization=organization) if normalize_phone(contact.phone) == normalized_phone]
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


def _resolve_contact_recipient(house):
    responsibilities = PropertyResponsibility.objects.filter(
        organization=house.organization,
        member__user__is_active=True,
    ).select_related("member__user")
    targets = []
    if house.landlord_id:
        targets.append({"landlord_id": house.landlord_id})
    targets.extend(({"building_id": house.building_id}, {"estate_id": house.building.estate_id}))
    for target in targets:
        responsibility = responsibilities.filter(**target).order_by("member_id").first()
        if responsibility:
            return responsibility.member.user

    owner = (
        OrganizationMember.objects.filter(organization=house.organization, is_owner=True, user__is_active=True)
        .select_related("user")
        .order_by("id")
        .first()
    )
    return owner.user if owner else None


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

    recipient = _resolve_contact_recipient(house)
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
