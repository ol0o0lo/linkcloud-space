import secrets

from django.db import transaction

from apps.referrals.constants import ReferralRecordStatus
from apps.referrals.models import ReferralLink, ReferralRecord

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
