from __future__ import annotations

import secrets
from datetime import datetime, timedelta
from typing import Any

from django.conf import settings
from django.core.cache import cache
from django.utils import timezone

import phonenumbers
from phonenumbers.phonenumberutil import NumberParseException
from redis.exceptions import RedisError

from apps.accounts.models import normalize_phone

LANDLORD_INVITATION_TTL_SECONDS = 7 * 24 * 60 * 60
LANDLORD_INVITATION_VALID_DAYS = LANDLORD_INVITATION_TTL_SECONDS // (24 * 60 * 60)


class LandlordInvitationCacheError(RuntimeError):
    pass


def _token_key(token: str) -> str:
    return f"landlord-invite:token:{token}"


def _contact_key(contact_id: int) -> str:
    return f"landlord-invite:contact:{contact_id}"


def normalize_invitation_phone(phone: str | None) -> str:
    normalized = normalize_phone(phone)
    if not normalized:
        raise ValueError("房东联系人手机号无效。")
    try:
        parsed = phonenumbers.parse(normalized, None)
    except NumberParseException as err:
        raise ValueError("房东联系人手机号无效。") from err
    if not phonenumbers.is_valid_number(parsed):
        raise ValueError("房东联系人手机号无效。")
    return phonenumbers.format_number(parsed, phonenumbers.PhoneNumberFormat.E164)


def mask_phone(phone: str) -> str:
    if len(phone) <= 7:
        return phone[:2] + "***" + phone[-2:]
    return f"{phone[:3]}****{phone[-4:]}"


def create_landlord_invitation(*, contact, inviter) -> dict[str, Any]:
    phone = normalize_invitation_phone(contact.phone)
    token = secrets.token_urlsafe(32)
    expires_at = timezone.now() + timedelta(seconds=LANDLORD_INVITATION_TTL_SECONDS)
    payload = {
        "token": token,
        "contact_id": contact.pk,
        "organization_id": contact.organization_id,
        "inviter_user_id": inviter.pk,
        "phone": phone,
        "created_at": timezone.now().isoformat(),
        "expires_at": expires_at.isoformat(),
    }
    try:
        previous_token = cache.get(_contact_key(contact.pk))
        if previous_token:
            cache.delete(_token_key(previous_token))
        cache.set_many(
            {
                _token_key(token): payload,
                _contact_key(contact.pk): token,
            },
            timeout=LANDLORD_INVITATION_TTL_SECONDS,
        )
    except RedisError as err:
        raise LandlordInvitationCacheError("房东邀请服务暂不可用。") from err
    return payload


def get_landlord_invitation(token: str) -> dict[str, Any] | None:
    try:
        payload = cache.get(_token_key(token))
        if not isinstance(payload, dict):
            return None
        if cache.get(_contact_key(payload.get("contact_id"))) != token:
            return None
    except RedisError as err:
        raise LandlordInvitationCacheError("房东邀请服务暂不可用。") from err
    return payload


def get_contact_invitation(contact_id: int) -> dict[str, Any] | None:
    try:
        token = cache.get(_contact_key(contact_id))
        if not token:
            return None
        payload = cache.get(_token_key(token))
        if isinstance(payload, dict):
            return payload
        cache.delete(_contact_key(contact_id))
    except RedisError:
        return None
    return None


def consume_landlord_invitation(payload: dict[str, Any]) -> None:
    token = payload.get("token")
    contact_id = payload.get("contact_id")
    if not token or not contact_id:
        return
    try:
        cache.delete_many([_token_key(token), _contact_key(contact_id)])
    except RedisError:
        # 数据库绑定已经生效时，Redis 清理失败不应回滚；残留键会由 TTL 回收。
        return


def invitation_action_url(token: str) -> str:
    return f"{settings.SITE_URL}/dashboard/landlord-invitations/{token}"


def invitation_expires_at(payload: dict[str, Any]) -> datetime | None:
    value = payload.get("expires_at")
    if not isinstance(value, str):
        return None
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        return None
