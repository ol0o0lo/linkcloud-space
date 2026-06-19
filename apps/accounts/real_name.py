import base64
import hashlib
import re
from dataclasses import dataclass

from cryptography.fernet import Fernet, InvalidToken
from django.conf import settings
from django.db import transaction
from django.utils import timezone
from ninja.errors import HttpError

from apps.accounts.constants import RealNameLogAction, RealNameProvider, RealNameSource, RealNameStatus
from apps.accounts.models import RealNameVerification, RealNameVerificationLog
from apps.media.constants import ResourceType
from apps.media.models import MediaFile
from apps.media.services import extract_media_ids, get_media_refs_info, validate_media_refs
from apps.referrals.services import mark_referral_as_qualified

CN_ID_RE = re.compile(r"^\d{17}[\dXx]$")
CN_ID_WEIGHTS = (7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2)
CN_ID_CHECKSUM = ("1", "0", "X", "9", "8", "7", "6", "5", "4", "3", "2")


@dataclass
class RealNameEvaluation:
    failure_reason: str = ""
    provider: str = RealNameProvider.MOCK_AUTO
    provider_result: dict | None = None
    status: str = RealNameStatus.PENDING


def _fernet() -> Fernet:
    key_material = hashlib.sha256(f"{settings.SECRET_KEY}:real-name:v1".encode("utf-8")).digest()
    return Fernet(base64.urlsafe_b64encode(key_material))


def encrypt_identity_value(value: str) -> str:
    return _fernet().encrypt(value.encode("utf-8")).decode("utf-8")


def decrypt_identity_value(value: str) -> str:
    try:
        return _fernet().decrypt(value.encode("utf-8")).decode("utf-8")
    except InvalidToken as exc:
        raise ValueError("Unable to decrypt identity value.") from exc


def mask_real_name(value: str) -> str:
    value = value.strip()
    if len(value) <= 1:
        return value
    if len(value) == 2:
        return f"{value[0]}*"
    return f"{value[0]}{'*' * (len(value) - 2)}{value[-1]}"


def mask_id_number(value: str) -> str:
    value = normalize_id_number(value)
    if len(value) <= 8:
        return "*" * len(value)
    return f"{value[:3]}{'*' * (len(value) - 7)}{value[-4:]}"


def normalize_id_number(value: str) -> str:
    return value.strip().upper()


def hash_id_number(value: str) -> str:
    return hashlib.sha256(normalize_id_number(value).encode("utf-8")).hexdigest()


def is_valid_cn_id_number(value: str) -> bool:
    value = normalize_id_number(value)
    if not CN_ID_RE.match(value):
        return False
    total = sum(int(char) * weight for char, weight in zip(value[:17], CN_ID_WEIGHTS, strict=False))
    checksum = CN_ID_CHECKSUM[total % 11]
    return value[-1] == checksum


def evaluate_real_name_submission(*, user, real_name: str, id_number: str) -> RealNameEvaluation:
    normalized_id = normalize_id_number(id_number)
    if len(real_name.strip()) < 2:
        return RealNameEvaluation(
            failure_reason="真实姓名至少需要 2 个字符。",
            provider_result={"reason": "name_too_short"},
            status=RealNameStatus.REJECTED,
        )
    if not is_valid_cn_id_number(normalized_id):
        return RealNameEvaluation(
            failure_reason="身份证号格式或校验位无效。",
            provider_result={"reason": "invalid_cn_id_number"},
            status=RealNameStatus.REJECTED,
        )

    duplicate = (
        RealNameVerification.objects.filter(id_number_hash=hash_id_number(normalized_id), status=RealNameStatus.VERIFIED, is_current=True)
        .exclude(user=user)
        .exists()
    )
    if duplicate:
        return RealNameEvaluation(
            failure_reason="",
            provider_result={"reason": "duplicate_verified_identity"},
            status=RealNameStatus.PENDING,
        )

    return RealNameEvaluation(
        provider_result={"reason": "valid_cn_id_number"},
        status=RealNameStatus.PENDING,
    )


def normalize_id_card_media(*, user, id_card_media: list[dict]) -> list[dict]:
    """校验并规范化身份证正反面媒体引用。"""
    try:
        media_refs = validate_media_refs(id_card_media)
    except (TypeError, ValueError) as exc:
        raise HttpError(400, str(exc)) from exc

    normalized = [dict(item) for item in media_refs if isinstance(item, dict)]
    if len(normalized) != 2:
        raise HttpError(400, "请上传身份证人像面和国徽面。")

    sides = [item.get("side") for item in normalized]
    if sorted(sides) != ["back", "front"]:
        raise HttpError(400, "身份证图片必须包含 side=front 和 side=back。")

    for item in normalized:
        if item.get("media_type") != "image":
            raise HttpError(400, "身份证材料必须是图片。")

    media_ids = extract_media_ids(normalized)
    media_by_id = MediaFile.objects.in_bulk(media_ids)
    for media_id in media_ids:
        media = media_by_id[media_id]
        if media.uploader_id != user.pk:
            raise HttpError(400, "身份证图片只能引用当前用户上传的媒体。")
        if media.resource_type != ResourceType.REAL_NAME_ID_CARD:
            raise HttpError(400, "身份证图片资源类型不正确。")

    return normalized


def sync_user_real_name_summary(user, verification: RealNameVerification) -> None:
    user.real_name_status = verification.status
    user.real_name_masked = verification.real_name_masked
    user.id_number_masked = verification.id_number_masked
    user.real_name_verified_at = verification.reviewed_at if verification.status == RealNameStatus.VERIFIED else None
    user.save(update_fields=["real_name_status", "real_name_masked", "id_number_masked", "real_name_verified_at"])
    if verification.status == RealNameStatus.VERIFIED:
        mark_referral_as_qualified(invitee=user, event_type="real_name_verified")


def append_real_name_log(
    verification: RealNameVerification,
    *,
    action: str,
    from_status: str,
    note: str = "",
    operator=None,
    to_status: str,
) -> None:
    RealNameVerificationLog.objects.create(
        verification=verification,
        action=action,
        from_status=from_status,
        to_status=to_status,
        operator=operator,
        note=note,
    )


def build_real_name_timeline_row(log: RealNameVerificationLog) -> dict:
    return {
        "action": log.action,
        "action_label": RealNameLogAction.get_choice_label(log.action),
        "created_at": log.created_at.isoformat(),
        "from_status": log.from_status or None,
        "from_status_label": RealNameStatus.get_choice_label(log.from_status) if log.from_status else "",
        "to_status": log.to_status or None,
        "to_status_label": RealNameStatus.get_choice_label(log.to_status) if log.to_status else "",
        "note": log.note,
        "operator": log.operator.username if log.operator else "",
    }


def _safe_get_media_refs_info(id_card_media: list[dict]) -> list[dict]:
    """安全获取身份证媒体引用信息，媒体文件不存在时保留原始引用但不报错。"""
    if not id_card_media:
        return []
    try:
        return get_media_refs_info(id_card_media)
    except (ValueError, TypeError):
        return [dict(item) for item in id_card_media if isinstance(item, dict)]


def serialize_real_name_verification(verification: RealNameVerification, *, include_sensitive: bool = False) -> dict:
    data = {
        "created_at": verification.created_at.isoformat(),
        "failure_reason": verification.failure_reason,
        "id": verification.pk,
        "id_number_last4": verification.id_number_last4,
        "id_number_masked": verification.id_number_masked,
        "is_current": verification.is_current,
        "provider": verification.provider,
        "provider_label": RealNameProvider.get_choice_label(verification.provider),
        "provider_request_id": verification.provider_request_id,
        "provider_result": verification.provider_result,
        "id_card_media": _safe_get_media_refs_info(verification.id_card_media),
        "real_name_masked": verification.real_name_masked,
        "review_note": verification.review_note,
        "reviewed_at": verification.reviewed_at.isoformat() if verification.reviewed_at else None,
        "reviewed_by": verification.reviewed_by.username if verification.reviewed_by else None,
        "source": verification.source,
        "source_label": RealNameSource.get_choice_label(verification.source),
        "status": verification.status,
        "status_label": RealNameStatus.get_choice_label(verification.status),
        "updated_at": verification.updated_at.isoformat(),
        "user": {
            "email": verification.user.email,
            "id": verification.user.pk,
            "phone": verification.user.phone,
            "username": verification.user.username,
        },
    }
    if include_sensitive:
        data["real_name"] = decrypt_identity_value(verification.real_name_encrypted)
        data["id_number"] = decrypt_identity_value(verification.id_number_encrypted)
    return data


@transaction.atomic
def submit_real_name_verification(*, user, real_name: str, id_number: str, id_card_media: list[dict], source: str) -> RealNameVerification:
    current = RealNameVerification.objects.select_for_update().filter(user=user, is_current=True).first()
    if current and current.status in {RealNameStatus.PENDING, RealNameStatus.MANUAL_REVIEW, RealNameStatus.VERIFIED}:
        raise HttpError(400, "当前实名状态不允许重复提交。")

    normalized_id_card_media = normalize_id_card_media(user=user, id_card_media=id_card_media)
    evaluation = evaluate_real_name_submission(user=user, real_name=real_name, id_number=id_number)
    if evaluation.status == RealNameStatus.REJECTED:
        raise HttpError(400, evaluation.failure_reason)

    RealNameVerification.objects.filter(user=user, is_current=True).update(is_current=False)
    now = timezone.now()
    verification = RealNameVerification.objects.create(
        user=user,
        status=RealNameStatus.PENDING,
        source=source,
        provider=evaluation.provider,
        real_name_encrypted=encrypt_identity_value(real_name.strip()),
        id_number_encrypted=encrypt_identity_value(normalize_id_number(id_number)),
        real_name_masked=mask_real_name(real_name),
        id_number_masked=mask_id_number(id_number),
        id_number_last4=normalize_id_number(id_number)[-4:],
        id_number_hash=hash_id_number(id_number),
        failure_reason=evaluation.failure_reason,
        provider_result=evaluation.provider_result or {},
        id_card_media=normalized_id_card_media,
        reviewed_at=None,
        is_current=True,
    )
    append_real_name_log(
        verification,
        action=RealNameLogAction.SUBMITTED,
        from_status=current.status if current else RealNameStatus.UNVERIFIED,
        to_status=RealNameStatus.PENDING,
        operator=user,
        note=f"来源：{RealNameSource.get_choice_label(source)}",
    )

    sync_user_real_name_summary(user, verification)
    return verification


def get_current_real_name_verification(user):
    return RealNameVerification.objects.filter(user=user, is_current=True).first()


@transaction.atomic
def admin_transition_real_name(
    verification: RealNameVerification,
    *,
    operator,
    to_status: str,
    action: str,
    note: str = "",
    provider: str = RealNameProvider.MANUAL_ADMIN,
) -> RealNameVerification:
    from_status = verification.status
    verification.status = to_status
    verification.provider = provider
    verification.failure_reason = note if to_status != RealNameStatus.VERIFIED else ""
    verification.review_note = note
    verification.reviewed_by = operator
    verification.reviewed_at = timezone.now()
    verification.save(update_fields=["status", "provider", "failure_reason", "review_note", "reviewed_by", "reviewed_at", "updated_at"])
    append_real_name_log(verification, action=action, from_status=from_status, to_status=to_status, operator=operator, note=note)
    sync_user_real_name_summary(verification.user, verification)
    return verification
