from django.contrib.auth import get_user_model
from django.shortcuts import get_object_or_404

from ninja import Router
from ninja.errors import HttpError
from ninja.pagination import paginate

from apps.base.ninja_pagination import LegacyPagination
from apps.base.permissions import require_authenticated, require_superuser
from apps.referrals.constants import ReferralRecordStatus
from apps.referrals.models import ReferralRecord
from apps.referrals.schemas import InternalQualifyIn, InternalRegisterIn, ReferralRecordOut, ReferralReviewIn, ReferralRuleConfigOut, ReferralRuleConfigPatchIn, ReferralSummaryOut
from apps.referrals.services import approve_referral_reward, create_record_for_registered_user, ensure_referral_link, get_referral_rule_config, mark_referral_as_qualified

router = Router(tags=["裂变/用户"])
admin_router = Router(tags=["裂变/管理"])
internal_router = Router(tags=["裂变/内部"])


def _summary_for_user(user):
    link = ensure_referral_link(user)
    qs = ReferralRecord.objects.filter(inviter=user)
    return {
        "invite_code": link.code,
        "share_link": f"/accounts/signup/?invite_code={link.code}",
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


@router.get("/me/records/{record_id}/", response=ReferralRecordOut, summary="获取我的单条邀请记录")
def my_referral_record_detail(request, record_id: int):
    require_authenticated(request)
    return get_object_or_404(ReferralRecord.objects.select_related("invitee"), pk=record_id, inviter=request.user)


@admin_router.get("/config/", response=ReferralRuleConfigOut, summary="获取当前裂变规则配置")
def get_referral_config(request):
    require_superuser(request)
    return get_referral_rule_config()


@admin_router.patch("/config/", response=ReferralRuleConfigOut, summary="更新当前裂变规则配置")
def patch_referral_config(request, payload: ReferralRuleConfigPatchIn):
    require_superuser(request)
    rule = get_referral_rule_config()
    for field, value in payload.dict(exclude_unset=True).items():
        setattr(rule, field, value)
    rule.save()
    return rule


@admin_router.get("/records/", response=list[ReferralRecordOut], summary="获取裂变邀请记录列表")
@paginate(LegacyPagination)
def admin_referral_records(request):
    require_superuser(request)
    return ReferralRecord.objects.select_related("invitee").order_by("-created_at", "-pk")


@admin_router.get("/records/{record_id}/", response=ReferralRecordOut, summary="获取裂变邀请记录详情")
def admin_referral_record_detail(request, record_id: int):
    require_superuser(request)
    return get_object_or_404(ReferralRecord.objects.select_related("invitee"), pk=record_id)


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
            raise HttpError(400, "Only pending review referral records can be rejected.")
        record.reviews.create(reviewer=request.user, action="reject", remark=payload.remark)
        record.status = ReferralRecordStatus.REVIEW_REJECTED
        record.save(update_fields=["status", "updated_at"])
    record.refresh_from_db()
    return record


@internal_router.post("/events/register/", response=ReferralRecordOut | None, summary="注册成功归因")
def internal_register_event(request, payload: InternalRegisterIn):
    require_superuser(request)
    user = get_object_or_404(get_user_model(), pk=payload.invitee_id)
    record = create_record_for_registered_user(invitee=user, invite_code=payload.invite_code)
    if record is None:
        return None
    return ReferralRecord.objects.select_related("invitee").get(pk=record.pk)


@internal_router.post("/events/qualify/", response=ReferralRecordOut | None, summary="关键行为达标事件")
def internal_qualify_event(request, payload: InternalQualifyIn):
    require_superuser(request)
    user = get_object_or_404(get_user_model(), pk=payload.invitee_id)
    record = mark_referral_as_qualified(invitee=user, event_type=payload.event_type)
    if record is None:
        return None
    return ReferralRecord.objects.select_related("invitee").get(pk=record.pk)


@internal_router.post("/rewards/{record_id}/issue/", response=ReferralRecordOut, summary="发放裂变奖励")
def internal_issue_reward(request, record_id: int):
    require_superuser(request)
    record = get_object_or_404(ReferralRecord.objects.select_related("invitee", "inviter"), pk=record_id)
    try:
        approve_referral_reward(record=record, reviewer=request.user, remark="内部发奖")
    except ValueError as exc:
        raise HttpError(400, str(exc)) from exc
    record.refresh_from_db()
    return record
