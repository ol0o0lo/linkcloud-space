import secrets

from django.db import transaction

from apps.referrals.constants import ReferralDisplayLevel, ReferralRecordStatus, ReferralTriggerEvent
from apps.referrals.models import ReferralLink, ReferralRecord, ReferralRuleConfig
from apps.wallet.constants import WalletEntryType
from apps.wallet.services import apply_wallet_credit

REFERRAL_SESSION_KEY = "referral_invite_code"


def _generate_referral_code() -> str:
    return secrets.token_urlsafe(8).replace("-", "").replace("_", "")[:10].upper()


def ensure_referral_link(user):
    link = ReferralLink.objects.filter(inviter=user).first()
    if link is not None:
        return link

    for _attempt in range(5):
        code = _generate_referral_code()
        if not ReferralLink.objects.filter(code=code).exists():
            return ReferralLink.objects.create(inviter=user, code=code)
    raise ValueError("Unable to generate a unique referral code.")


def capture_referral_code(request):
    invite_code = (request.GET.get("invite_code") or "").strip().upper()
    if invite_code:
        request.session[REFERRAL_SESSION_KEY] = invite_code


@transaction.atomic
def create_record_for_registered_user(*, invitee, invite_code: str):
    invite_code = invite_code.strip().upper()
    if not invite_code:
        return None

    existing = ReferralRecord.objects.filter(invitee=invitee).first()
    if existing is not None:
        return existing

    link = ReferralLink.objects.select_related("inviter").filter(code=invite_code, is_active=True).first()
    if link is None or link.inviter_id == invitee.id:
        return None

    return ReferralRecord.objects.create(
        inviter=link.inviter,
        invitee=invitee,
        referral_link=link,
        status=ReferralRecordStatus.REGISTERED,
    )


def create_record_from_request(*, request, invitee):
    invite_code = (request.session.get(REFERRAL_SESSION_KEY) or "").strip()
    record = create_record_for_registered_user(invitee=invitee, invite_code=invite_code)
    if invite_code:
        request.session.pop(REFERRAL_SESSION_KEY, None)
    return record


def get_referral_rule_config():
    rule = ReferralRuleConfig.objects.order_by("created_at", "pk").first()
    if rule is not None:
        return rule
    return ReferralRuleConfig.objects.create(
        name="default",
        trigger_event=ReferralTriggerEvent.REAL_NAME_VERIFIED,
        requires_manual_review=True,
        display_level=ReferralDisplayLevel.MASKED_PROGRESS,
    )


@transaction.atomic
def mark_referral_as_qualified(*, invitee, event_type: str):
    record = ReferralRecord.objects.select_for_update().filter(invitee=invitee).first()
    if record is None:
        return None
    if event_type != ReferralTriggerEvent.REAL_NAME_VERIFIED:
        return None
    if record.status != ReferralRecordStatus.REGISTERED:
        return record

    record.status = ReferralRecordStatus.PENDING_REVIEW
    record.save(update_fields=["status", "updated_at"])
    return record


@transaction.atomic
def approve_referral_reward(*, record, reviewer, remark: str):
    record = ReferralRecord.objects.select_for_update().select_related("inviter").get(pk=record.pk)
    if record.status == ReferralRecordStatus.REWARD_ISSUED:
        return record.reviews.order_by("-created_at", "-pk").first()
    if record.status != ReferralRecordStatus.PENDING_REVIEW:
        raise ValueError("Only pending review referral records can issue rewards.")

    rule = get_referral_rule_config()
    review = record.reviews.create(reviewer=reviewer, action="approve", remark=remark)
    apply_wallet_credit(
        user=record.inviter,
        amount=rule.inviter_reward_amount,
        entry_type=WalletEntryType.PROMOTION_REWARD,
        biz_type="referral.reward",
        biz_id=str(record.pk),
        idempotency_key=f"referral-reward:{record.pk}",
        operator=reviewer,
        remark=remark,
    )
    record.status = ReferralRecordStatus.REWARD_ISSUED
    record.save(update_fields=["status", "updated_at"])
    return review
