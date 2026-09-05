from django.shortcuts import get_object_or_404

from ninja import Router
from ninja.errors import HttpError
from ninja.pagination import paginate

from apps.base.ninja_pagination import LegacyPagination
from apps.base.permissions import require_authenticated, require_superuser
from apps.referrals.constants import ReferralRecordStatus
from apps.referrals.models import ReferralRecord
from apps.referrals.schemas import ReferralRecordOut, ReferralReviewIn, ReferralRuleConfigOut, ReferralRuleConfigPatchIn, ReferralSummaryOut
from apps.referrals.services import approve_referral_reward, ensure_referral_link, get_referral_rule_config

router = Router(tags=["裂变/用户"])
admin_router = Router(tags=["裂变/管理"])


def _summary_for_user(user):
    link = ensure_referral_link(user)
    rule = get_referral_rule_config()
    qs = ReferralRecord.objects.filter(inviter=user)
    return {
        "invite_code": link.code if rule.allow_code else None,
        "share_link": f"/dashboard/user/register?invite_code={link.code}&referral_source=link" if rule.allow_link else None,
        "allow_link": rule.allow_link,
        "allow_code": rule.allow_code,
        "registered_count": qs.filter(status=ReferralRecordStatus.REGISTERED).count(),
        "pending_review_count": qs.filter(status=ReferralRecordStatus.PENDING_REVIEW).count(),
        "rewarded_count": qs.filter(status=ReferralRecordStatus.REWARD_ISSUED).count(),
    }


@router.get("/me/summary/", response=ReferralSummaryOut, summary="获取我的裂变推广总览")
def my_referral_summary(request):
    require_authenticated(request)
    return _summary_for_user(request.user)


@router.get("/me/records/", response=list[ReferralRecordOut], summary="获取我的邀请记录")
@paginate(LegacyPagination)
def my_referral_records(request):
    require_authenticated(request)
    return ReferralRecord.objects.select_related("invitee").filter(inviter=request.user).order_by("-created_at", "-pk")


@admin_router.get("/config/", response=ReferralRuleConfigOut, summary="获取当前裂变规则配置")
def get_referral_config(request):
    require_superuser(request)
    return get_referral_rule_config()


@admin_router.patch("/config/", response=ReferralRuleConfigOut, summary="更新当前裂变规则配置")
def patch_referral_config(request, payload: ReferralRuleConfigPatchIn):
    require_superuser(request)
    rule = get_referral_rule_config()
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(rule, field, value)
    rule.save()
    return rule


@admin_router.get("/records/", response=list[ReferralRecordOut], summary="获取裂变邀请记录列表")
@paginate(LegacyPagination)
def admin_referral_records(request):
    require_superuser(request)
    return ReferralRecord.objects.select_related("invitee").order_by("-created_at", "-pk")


@admin_router.post("/records/{record_id}/review/", response=ReferralRecordOut, summary="审核裂变奖励")
def review_referral_record(request, record_id: int, payload: ReferralReviewIn):
    require_superuser(request)
    record = get_object_or_404(ReferralRecord.objects.select_related("invitee", "inviter"), pk=record_id)
    if payload.approved:
        try:
            approve_referral_reward(record=record, reviewer=request.user, remark=payload.remark)
        except ValueError as exc:
            raise HttpError(400, str(exc)) from exc
    else:
        if record.status != ReferralRecordStatus.PENDING_REVIEW:
            raise HttpError(400, "只有待审核的邀请记录可以驳回。")
        record.reviews.create(reviewer=request.user, action="reject", remark=payload.remark)
        record.status = ReferralRecordStatus.REVIEW_REJECTED
        record.save(update_fields=["status", "updated_at"])
    record.refresh_from_db()
    return record
