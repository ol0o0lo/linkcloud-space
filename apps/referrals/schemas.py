from datetime import datetime

from ninja import Schema
from pydantic import Field


class ReferralSummaryOut(Schema):
    invite_code: str
    share_link: str
    registered_count: int
    pending_review_count: int
    rewarded_count: int


class ReferralRecordOut(Schema):
    id: int
    inviter_id: int
    invitee_id: int
    invitee_display: str
    status: str
    created_at: datetime
    updated_at: datetime

    @staticmethod
    def resolve_inviter_id(obj) -> int:
        return obj.inviter_id

    @staticmethod
    def resolve_invitee_id(obj) -> int:
        return obj.invitee_id

    @staticmethod
    def resolve_invitee_display(obj) -> str:
        invitee = obj.invitee
        if invitee.email:
            name, _, domain = invitee.email.partition("@")
            masked = f"{name[:2]}***" if name else "***"
            return f"{masked}@{domain}" if domain else masked
        return invitee.username or f"用户{invitee.pk}"


class ReferralRuleConfigOut(Schema):
    id: int
    name: str
    trigger_event: str
    inviter_reward_amount: int
    invitee_reward_amount: int
    requires_manual_review: bool
    allow_link: bool
    allow_code: bool
    display_level: str


class ReferralRuleConfigPatchIn(Schema):
    inviter_reward_amount: int | None = Field(None, description="邀请人奖励金额，单位分。")
    invitee_reward_amount: int | None = Field(None, description="被邀请人奖励金额，单位分。")
    requires_manual_review: bool | None = None
    allow_link: bool | None = None
    allow_code: bool | None = None
    display_level: str | None = None


class ReferralReviewIn(Schema):
    approved: bool
    remark: str = ""


class InternalRegisterIn(Schema):
    invitee_id: int
    invite_code: str


class InternalQualifyIn(Schema):
    invitee_id: int
    event_type: str
