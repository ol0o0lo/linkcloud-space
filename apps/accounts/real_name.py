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
            failure_reason="该身份证号已被其他账号实名，已转人工复核。",
            provider_result={"reason": "duplicate_verified_identity"},
            status=RealNameStatus.MANUAL_REVIEW,
        )

    return RealNameEvaluation(
        provider_result={"reason": "valid_cn_id_number"},
        status=RealNameStatus.VERIFIED,
    )


def sync_user_real_name_summary(user, verification: RealNameVerification) -> None:
    user.real_name_status = verification.status
    user.real_name_masked = verification.real_name_masked
    user.id_number_masked = verification.id_number_masked
    user.real_name_verified_at = verification.reviewed_at if verification.status == RealNameStatus.VERIFIED else None
    user.save(update_fields=["real_name_status", "real_name_masked", "id_number_masked", "real_name_verified_at"])


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
def submit_real_name_verification(*, user, real_name: str, id_number: str, source: str) -> RealNameVerification:
    current = RealNameVerification.objects.select_for_update().filter(user=user, is_current=True).first()
    if current and current.status in {RealNameStatus.PENDING, RealNameStatus.MANUAL_REVIEW, RealNameStatus.VERIFIED}:
        raise HttpError(400, "当前实名状态不允许重复提交。")

    RealNameVerification.objects.filter(user=user, is_current=True).update(is_current=False)
    evaluation = evaluate_real_name_submission(user=user, real_name=real_name, id_number=id_number)
    now = timezone.now()
    verification = RealNameVerification.objects.create(
        user=user,
        status=evaluation.status,
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
        reviewed_at=now if evaluation.status in {RealNameStatus.VERIFIED, RealNameStatus.REJECTED, RealNameStatus.MANUAL_REVIEW} else None,
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

    if evaluation.status == RealNameStatus.VERIFIED:
        append_real_name_log(
            verification,
            action=RealNameLogAction.AUTO_VERIFIED,
            from_status=RealNameStatus.PENDING,
            to_status=RealNameStatus.VERIFIED,
            note="模拟自动校验通过。",
        )
    elif evaluation.status == RealNameStatus.REJECTED:
        append_real_name_log(
            verification,
            action=RealNameLogAction.AUTO_REJECTED,
            from_status=RealNameStatus.PENDING,
            to_status=RealNameStatus.REJECTED,
            note=evaluation.failure_reason,
        )
    elif evaluation.status == RealNameStatus.MANUAL_REVIEW:
        append_real_name_log(
            verification,
            action=RealNameLogAction.MOVED_TO_MANUAL_REVIEW,
            from_status=RealNameStatus.PENDING,
            to_status=RealNameStatus.MANUAL_REVIEW,
            note=evaluation.failure_reason,
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
