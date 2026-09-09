"""accounts 业务服务层。"""

from dataclasses import dataclass

from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from allauth.account.internal.flows.login import Login, perform_login
from allauth.socialaccount.models import SocialAccount
from allauth.usersessions.models import UserSession
from ninja.errors import HttpError

from apps.accounts.constants import RealNameLogAction, RealNameProvider, RealNameSource, RealNameStatus
from apps.accounts.exceptions import AccountMergeReviewRequired
from apps.accounts.models import AccountMerge, RealNameVerification, RealNameVerificationLog, normalize_phone, split_phone
from apps.accounts.utils import (
    decrypt_identity_value,
    encrypt_identity_value,
    hash_id_number,
    is_valid_cn_id_number,
    mask_id_number,
    mask_real_name,
    normalize_id_number,
)
from apps.media.services import delete_media_file, extract_media_id, extract_media_ids, resolve_media_refs, to_plain_media_ref
from apps.referrals.services import mark_referral_as_qualified


@dataclass
class RealNameEvaluation:
    failure_reason: str = ""
    provider: str = RealNameProvider.MOCK_AUTO
    provider_result: dict | None = None
    status: str = RealNameStatus.PENDING


def _delete_media_file(media_id: int) -> None:
    delete_media_file(media_id)


def validate_avatar_media_owner(*, instance, refs, media_by_id, field):
    for ref in refs:
        media = media_by_id[extract_media_id(ref)]
        if media.uploader_id != instance.pk:
            raise ValueError("头像只能引用当前用户上传的媒体。")


def set_user_avatar(user, avatar_refs: list[dict], *, update_fields=None) -> None:
    """统一写入用户头像媒体引用，并回收被替换的旧头像媒体。"""
    old_media_ids = {extract_media_id(item) for item in user.avatar or []}
    user.avatar = [to_plain_media_ref(item) for item in avatar_refs]
    user.full_clean()
    save_fields = set(update_fields or [])
    save_fields.add("avatar")
    user.save(update_fields=save_fields)

    next_media_ids = {extract_media_id(item) for item in user.avatar or []}
    for media_id in old_media_ids - next_media_ids:
        _delete_media_file(media_id)


def _merge_safe_personal_data(*, source_user, target_user) -> dict[str, int]:
    """把轻量账号的可合并个人数据归入主账号。"""
    from apps.favorites.models import Favorite
    from apps.media.models import MediaFile
    from apps.notifications.models import Notification, NotificationPreference
    from apps.referrals.models import ReferralLink, ReferralRecord
    from apps.settings.models import UserSetting

    summary: dict[str, int] = {}
    profile_fields = []
    for field in ("first_name", "last_name", "avatar"):
        if not getattr(target_user, field) and getattr(source_user, field):
            setattr(target_user, field, getattr(source_user, field))
            profile_fields.append(field)
    if profile_fields:
        target_user.save(update_fields=profile_fields)
    summary["profile_fields"] = len(profile_fields)

    moved_favorites = 0
    for favorite in Favorite.objects.select_for_update().filter(user=source_user).order_by("pk"):
        existing = Favorite.objects.filter(
            user=target_user,
            target_type=favorite.target_type,
            target_id=favorite.target_id,
        ).first()
        if existing:
            if favorite.created_at < existing.created_at:
                Favorite.objects.filter(pk=existing.pk).update(created_at=favorite.created_at)
            favorite.delete()
        else:
            favorite.user = target_user
            favorite.save(update_fields=["user"])
            moved_favorites += 1
    summary["favorites"] = moved_favorites

    moved_settings = 0
    for preference in UserSetting.objects.select_for_update().filter(user=source_user).order_by("pk"):
        if UserSetting.objects.filter(user=target_user, key=preference.key).exists():
            preference.delete()
        else:
            preference.user = target_user
            preference.save(update_fields=["user"])
            moved_settings += 1
    summary["settings"] = moved_settings

    moved_notification_preferences = 0
    for preference in NotificationPreference.objects.select_for_update().filter(user=source_user).order_by("pk"):
        if NotificationPreference.objects.filter(user=target_user, category=preference.category).exists():
            preference.delete()
        else:
            preference.user = target_user
            preference.save(update_fields=["user"])
            moved_notification_preferences += 1
    summary["notification_preferences"] = moved_notification_preferences
    summary["notifications"] = Notification.objects.filter(recipient=source_user, organization__isnull=True).update(recipient=target_user)
    summary["media_files"] = MediaFile.objects.filter(uploader=source_user).update(uploader=target_user)
    summary["referral_links"] = ReferralLink.objects.filter(inviter=source_user).update(inviter=target_user)
    summary["sent_referrals"] = ReferralRecord.objects.filter(inviter=source_user).update(inviter=target_user)
    summary["received_referrals"] = ReferralRecord.objects.filter(invitee=source_user).update(invitee=target_user)
    return summary


def _ensure_personal_data_has_no_conflicts(*, source_user, target_user) -> None:
    from apps.referrals.models import ReferralLink, ReferralRecord

    if ReferralLink.objects.filter(inviter=source_user).exists() and ReferralLink.objects.filter(inviter=target_user).exists():
        raise AccountMergeReviewRequired("referral_conflict")
    if ReferralRecord.objects.filter(invitee=source_user).exists() and ReferralRecord.objects.filter(invitee=target_user).exists():
        raise AccountMergeReviewRequired("referral_conflict")


def _ensure_lightweight_merge_source(source_user) -> None:
    from apps.access.models import OrganizationGroupBinding, TeamGroupBinding
    from apps.house.models import Contact, HouseMatchShare, ViewingRecord
    from apps.notifications.models import Notification
    from apps.organizations.models import Organization, OrganizationInvite, OrganizationMember
    from apps.team_operations.models import AnnouncementReceipt, TaskAssignment, TeamAnnouncement, WorkTask

    if not SocialAccount.objects.filter(user=source_user, provider="wechat_miniprogram").exists():
        raise AccountMergeReviewRequired("not_lightweight")
    if source_user.is_staff or source_user.is_superuser or source_user.user_permissions.exists() or source_user.groups.exists():
        raise AccountMergeReviewRequired("business_identity")
    if source_user.real_name_status != RealNameStatus.UNVERIFIED or RealNameVerification.objects.filter(user=source_user).exists():
        raise AccountMergeReviewRequired("real_name")
    if (
        OrganizationMember.objects.filter(user=source_user).exists()
        or Organization.objects.filter(created_by=source_user).exists()
        or OrganizationInvite.objects.filter(sender=source_user).exists()
        or OrganizationInvite.objects.filter(invitee=source_user).exists()
        or source_user.teams.exists()
        or OrganizationGroupBinding.objects.filter(user=source_user).exists()
        or TeamGroupBinding.objects.filter(user=source_user).exists()
        or Contact.objects.filter(user=source_user).exists()
        or Notification.objects.filter(recipient=source_user, organization__isnull=False).exists()
        or HouseMatchShare.objects.filter(consultant=source_user).exists()
        or ViewingRecord.objects.filter(assigned_to=source_user).exists()
        or TeamAnnouncement.objects.filter(published_by=source_user).exists()
        or AnnouncementReceipt.objects.filter(recipient=source_user).exists()
        or WorkTask.objects.filter(creator=source_user).exists()
        or TaskAssignment.objects.filter(assignee=source_user).exists()
    ):
        raise AccountMergeReviewRequired("business_identity")


def _has_financial_data(user) -> bool:
    from apps.allocation.models import AccrualEntry, AllocationRequest, AllocationShare
    from apps.subscriptions.models import InvoiceRequest, SaaSOrder
    from apps.wallet.models import WalletAccount, WithdrawalRequest

    wallets = WalletAccount.objects.filter(user=user)
    if wallets.exclude(available_balance=0, frozen_balance=0, total_income=0, total_withdrawn=0).exists():
        return True
    return (
        wallets.filter(ledgers__isnull=False).exists()
        or WithdrawalRequest.objects.filter(user=user).exists()
        or SaaSOrder.objects.filter(Q(created_by=user) | Q(refunded_by=user)).exists()
        or InvoiceRequest.objects.filter(Q(created_by=user) | Q(processed_by=user)).exists()
        or AllocationRequest.objects.filter(Q(submitted_by=user) | Q(reviewed_by=user) | Q(voided_by=user)).exists()
        or AllocationShare.objects.filter(beneficiary_user=user).exists()
        or AccrualEntry.objects.filter(Q(beneficiary_user=user) | Q(created_by=user)).exists()
    )


def _ensure_no_financial_data(*users) -> None:
    if any(_has_financial_data(user) for user in users):
        raise AccountMergeReviewRequired("financial_data")


def bind_phone_to_user(request, user, phone: str):
    """绑定手机号到 user。若已有其他账号使用此手机号，执行合并。"""
    # 统一处理手机号绑定、账号合并和登录态切换。
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
            raise AccountMergeReviewRequired("inactive_target")

        with transaction.atomic():
            source_user = User.objects.select_for_update().get(pk=user.pk)
            target_user = User.objects.select_for_update().get(pk=existing.pk)
            if request.user.pk != source_user.pk:
                raise AccountMergeReviewRequired("identity_changed")
            if not source_user.is_active or AccountMerge.objects.filter(source_user=source_user).exists():
                raise AccountMergeReviewRequired("identity_changed")
            if not target_user.is_active or target_user.phone != phone:
                raise AccountMergeReviewRequired("identity_changed")
            _ensure_lightweight_merge_source(source_user)
            _ensure_no_financial_data(source_user, target_user)

            source_social_accounts = list(SocialAccount.objects.select_for_update().filter(user=source_user))
            source_providers = {account.provider for account in source_social_accounts}
            if SocialAccount.objects.filter(user=target_user, provider__in=source_providers).exists():
                raise AccountMergeReviewRequired("login_identity_conflict")
            _ensure_personal_data_has_no_conflicts(source_user=source_user, target_user=target_user)

            summary = _merge_safe_personal_data(source_user=source_user, target_user=target_user)
            summary["social_accounts"] = SocialAccount.objects.filter(user=source_user).update(user=target_user)
            source_user.is_active = False
            source_user.save(update_fields=["is_active"])
            AccountMerge.objects.create(
                source_user=source_user,
                target_user=target_user,
                identity_provider="wechat_miniprogram",
                migration_summary=summary,
            )

        for user_session in list(UserSession.objects.filter(user=source_user)):
            user_session.end()
        perform_login(request, Login(user=target_user))
        return target_user, True
    else:
        user.set_phone_number(phone)
        user.phone_verified = True
        user.save(update_fields=["phone_country_code", "phone_national_number", "phone_verified"])
        return user, False


def build_real_name_timeline_row(log: RealNameVerificationLog) -> dict:
    # 把实名日志整理成前端时间线需要的展示结构。
    return {
        "action": log.action,
        "action_label": RealNameLogAction.get_choice_label(log.action),
        "action__mapping": RealNameLogAction.get_choice_label(log.action),
        "created_at": log.created_at.isoformat(),
        "from_status": log.from_status or None,
        "from_status_label": RealNameStatus.get_choice_label(log.from_status) if log.from_status else "",
        "from_status__mapping": RealNameStatus.get_choice_label(log.from_status) if log.from_status else "",
        "to_status": log.to_status or None,
        "to_status_label": RealNameStatus.get_choice_label(log.to_status) if log.to_status else "",
        "to_status__mapping": RealNameStatus.get_choice_label(log.to_status) if log.to_status else "",
        "note": log.note,
        "operator": log.operator.username if log.operator else "",
    }


def evaluate_real_name_submission(*, user, real_name: str, id_number: str) -> RealNameEvaluation:
    # 先做实名提交的静态规则判断，再看是否存在重复实名。
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

    duplicate = RealNameVerification.objects.filter(id_number_hash=hash_id_number(normalized_id), status=RealNameStatus.VERIFIED, is_current=True).exclude(user=user).exists()
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


def validate_id_card_media_owner(*, instance, refs, media_by_id, field):
    for ref in refs:
        media = media_by_id[ref["media_id"]]
        if media.uploader_id != instance.user_id:
            raise ValueError("身份证图片只能引用当前用户上传的媒体。")


def normalize_id_card_media(*, user, id_card_media: list[dict]) -> list[dict]:
    """校验并规范化身份证正反面媒体引用。"""
    plain_id_card_media = [to_plain_media_ref(item) for item in id_card_media]
    verification = RealNameVerification(user=user, id_card_media=plain_id_card_media)
    try:
        return RealNameVerification._meta.get_field("id_card_media").clean_media_refs(plain_id_card_media, model_instance=verification)
    except (TypeError, ValueError) as exc:
        raise HttpError(400, str(exc)) from exc


def serialize_real_name_verification(verification: RealNameVerification, *, include_sensitive: bool = False, media_by_id=None) -> dict:
    # 统一把实名模型转成 API 返回结构。
    data = {
        "created_at": verification.created_at.isoformat(),
        "failure_reason": verification.failure_reason,
        "id": verification.pk,
        "id_number_masked": verification.id_number_masked,
        "is_current": verification.is_current,
        "provider": verification.provider,
        "provider_label": RealNameProvider.get_choice_label(verification.provider),
        "provider__mapping": RealNameProvider.get_choice_label(verification.provider),
        "provider_request_id": verification.provider_request_id,
        "provider_result": verification.provider_result,
        "id_card_media": resolve_media_refs(verification.id_card_media, media_by_id=media_by_id) if media_by_id is not None else verification.id_card_media_resolved,
        "real_name_masked": verification.real_name_masked,
        "review_note": verification.review_note,
        "reviewed_at": verification.reviewed_at.isoformat() if verification.reviewed_at else None,
        "reviewed_by": verification.reviewed_by.username if verification.reviewed_by else None,
        "source": verification.source,
        "source_label": RealNameSource.get_choice_label(verification.source),
        "source__mapping": RealNameSource.get_choice_label(verification.source),
        "status": verification.status,
        "status_label": RealNameStatus.get_choice_label(verification.status),
        "status__mapping": RealNameStatus.get_choice_label(verification.status),
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
    # 提交时先锁当前记录，再落库新的 current 记录。
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
    # 把实名状态同步回 User，供全站统一展示。
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
    # 追加实名状态流转日志。
    RealNameVerificationLog.objects.create(
        verification=verification,
        action=action,
        from_status=from_status,
        to_status=to_status,
        operator=operator,
        note=note,
    )


def get_current_real_name_verification(user):
    # 只取当前生效的实名记录。
    return RealNameVerification.objects.filter(user=user, is_current=True).first()


def collect_real_name_media_ids():
    # 收集所有仍被实名记录引用的媒体 ID，供清理任务使用。
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
    # 后台审核时统一更新状态、备注和日志。
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
