"""accounts 业务服务层。"""

import io
from dataclasses import dataclass

from django.core.files.uploadedfile import InMemoryUploadedFile
from django.db import transaction
from django.utils import timezone

from ninja.errors import HttpError

from apps.accounts.constants import RealNameLogAction, RealNameProvider, RealNameSource, RealNameStatus
from apps.accounts.models import RealNameVerification, RealNameVerificationLog
from apps.accounts.utils import (
    decrypt_identity_value,
    encrypt_identity_value,
    hash_id_number,
    is_valid_cn_id_number,
    mask_id_number,
    mask_real_name,
    normalize_id_number,
)
from apps.media.constants import ResourceType
from apps.media.models import MediaFile
from apps.media.services import extract_media_ids, resolve_media_refs, validate_media_refs
from apps.referrals.services import mark_referral_as_qualified

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}
ALLOWED_PIL_FORMATS = {"JPEG", "PNG", "WEBP"}
MAX_UPLOAD_SIZE = 10 * 1024 * 1024
MAX_IMAGE_PIXELS = 32 * 1024 * 1024
THUMBNAIL_SIZE = 256


@dataclass
class RealNameEvaluation:
    failure_reason: str = ""
    provider: str = RealNameProvider.MOCK_AUTO
    provider_result: dict | None = None
    status: str = RealNameStatus.PENDING


def process_and_save_avatar(user, image_file, crop_data: dict) -> str:
    """裁剪、缩放、存储头像，返回 avatar_url。失败抛 ValueError。"""
    from PIL import Image

    if image_file.content_type not in ALLOWED_IMAGE_TYPES:
        raise ValueError("Unsupported image type. Use JPEG, PNG, or WebP.")
    if image_file.size > MAX_UPLOAD_SIZE:
        raise ValueError("Image must be under 10 MB.")

    crop_box = None
    if crop_data.get("width") and crop_data.get("height"):
        try:
            left = int(crop_data["left"])
            top = int(crop_data["top"])
            width = int(crop_data["width"])
            height = int(crop_data["height"])
        except (KeyError, TypeError, ValueError) as exc:
            raise ValueError("Invalid crop_data: left/top/width/height must be numbers.") from exc
        crop_box = (left, top, left + width, top + height)

    image_file.seek(0)
    try:
        probe = Image.open(image_file)
        probe_format = probe.format
        probe.verify()
    except Exception as exc:
        raise ValueError("Could not decode the uploaded image.") from exc
    if probe_format not in ALLOWED_PIL_FORMATS:
        raise ValueError("Unsupported image format. Use JPEG, PNG, or WebP.")

    image_file.seek(0)
    try:
        img = Image.open(image_file)
        if (img.width * img.height) > MAX_IMAGE_PIXELS:
            raise ValueError("Image dimensions are too large.")
        img = img.convert("RGB")
    except ValueError:
        raise
    except Exception as exc:
        raise ValueError("Could not decode the uploaded image.") from exc

    if crop_box is not None:
        img = img.crop(crop_box)
    img = img.resize((THUMBNAIL_SIZE, THUMBNAIL_SIZE), Image.LANCZOS)
    thumb_io = io.BytesIO()
    img.save(thumb_io, format="JPEG", quality=90)
    thumb_file = InMemoryUploadedFile(thumb_io, None, "thumbnail.jpg", "image/jpeg", thumb_io.tell(), None)

    old_original = user.avatar_original.name if user.avatar_original else None
    old_thumb = user.avatar_thumbnail.name if user.avatar_thumbnail else None
    old_original_storage = user.avatar_original.storage if user.avatar_original else None
    old_thumb_storage = user.avatar_thumbnail.storage if user.avatar_thumbnail else None

    image_file.seek(0)
    user.avatar_original.save(image_file.name, image_file, save=False)
    user.avatar_thumbnail.save("thumbnail.jpg", thumb_file, save=False)
    user.avatar_crop_data = crop_data
    user.save(update_fields=["avatar_original", "avatar_thumbnail", "avatar_crop_data"])

    if old_original and old_original != user.avatar_original.name:
        old_original_storage.delete(old_original)
    if old_thumb and old_thumb != user.avatar_thumbnail.name:
        old_thumb_storage.delete(old_thumb)

    return user.avatar_url


def delete_user_avatar(user) -> None:
    """删除用户头像文件及字段。"""
    if user.avatar_original:
        user.avatar_original.delete(save=False)
    if user.avatar_thumbnail:
        user.avatar_thumbnail.delete(save=False)
    user.avatar_crop_data = None
    user.save(update_fields=["avatar_original", "avatar_thumbnail", "avatar_crop_data"])


def bind_phone_to_user(request, user, phone: str):
    """绑定手机号到 user。若已有其他账号使用此手机号，执行合并。"""
    from django.contrib.auth import get_user_model
    from django.db import transaction

    from allauth.account.internal.flows.login import Login, perform_login
    from allauth.socialaccount.models import SocialAccount

    from apps.accounts.models import normalize_phone, split_phone

    User = get_user_model()
    phone = normalize_phone(phone)
    country_code, national_number = split_phone(phone)

    if user.phone == phone:
        if not user.phone_verified:
            user.phone_verified = True
            user.save(update_fields=["phone_verified"])
        return user, False

    existing = User.objects.filter(phone_country_code=country_code, phone_national_number=national_number).exclude(pk=user.pk).first()
    if existing:
        if not existing.phone_verified:
            with transaction.atomic():
                existing.set_phone_number(None)
                existing.phone_verified = False
                existing.save(update_fields=["phone_country_code", "phone_national_number", "phone_verified"])
                user.set_phone_number(phone)
                user.phone_verified = True
                user.save(update_fields=["phone_country_code", "phone_national_number", "phone_verified"])
            return user, False
        if not existing.is_active:
            raise ValueError("This phone number belongs to a disabled account.")

        with transaction.atomic():
            SocialAccount.objects.filter(user=user).update(user=existing)
            user.is_active = False
            user.save(update_fields=["is_active"])
        perform_login(request, Login(user=existing))
        return existing, True
    else:
        user.set_phone_number(phone)
        user.phone_verified = True
        user.save(update_fields=["phone_country_code", "phone_national_number", "phone_verified"])
        return user, False


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


def serialize_real_name_verification(verification: RealNameVerification, *, include_sensitive: bool = False) -> dict:
    data = {
        "created_at": verification.created_at.isoformat(),
        "failure_reason": verification.failure_reason,
        "id": verification.pk,
        "id_number_masked": verification.id_number_masked,
        "is_current": verification.is_current,
        "provider": verification.provider,
        "provider_label": RealNameProvider.get_choice_label(verification.provider),
        "provider_request_id": verification.provider_request_id,
        "provider_result": verification.provider_result,
        "id_card_media": resolve_media_refs(verification.id_card_media),
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
    verification = RealNameVerification.objects.create(
        user=user,
        status=RealNameStatus.PENDING,
        source=source,
        provider=evaluation.provider,
        real_name_encrypted=encrypt_identity_value(real_name.strip()),
        id_number_encrypted=encrypt_identity_value(normalize_id_number(id_number)),
        real_name_masked=mask_real_name(real_name),
        id_number_masked=mask_id_number(id_number),
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


def get_current_real_name_verification(user):
    return RealNameVerification.objects.filter(user=user, is_current=True).first()


def collect_real_name_media_ids():
    media_ids = set()
    for row in RealNameVerification.objects.values_list("id_card_media", flat=True):
        if not row:
            continue
        media_ids.update(extract_media_ids(row))
    return media_ids


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
