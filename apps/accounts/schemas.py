from typing import Literal

from ninja import Schema
from pydantic import Field, field_validator

from apps.accounts.constants import AdminUserRole, RealNameIdCardSide, RealNameSource, RealNameStatus
from apps.media.constants import MediaType
from apps.media.schemas import MediaRefIn, ResolvedMediaRefOut


def _obj_value(obj, key: str, default=None):
    if isinstance(obj, dict):
        return obj.get(key, default)
    return getattr(obj, key, default)


def resolve_admin_user_role(obj) -> str:
    if _obj_value(obj, "is_superuser", False):
        return AdminUserRole.SUPERUSER
    if _obj_value(obj, "is_staff", False):
        return AdminUserRole.STAFF
    return AdminUserRole.USER


class UserOut(Schema):
    id: int
    username: str
    first_name: str = ""
    last_name: str = ""
    real_name_status: str = "unverified"
    real_name_status__mapping: str = ""
    real_name_masked: str = ""
    id_number_masked: str = ""
    timezone: str
    avatar_url: str | None = None

    @staticmethod
    def resolve_real_name_status__mapping(obj):
        return RealNameStatus.get_choice_label(obj.real_name_status)


class AdminUserOut(UserOut):
    email: str = ""
    phone_country_code: str = ""
    phone_national_number: str = ""
    phone_verified: bool
    is_active: bool
    is_staff: bool
    is_superuser: bool
    role: str = AdminUserRole.USER
    role__mapping: str = ""

    @staticmethod
    def resolve_role(obj):
        return resolve_admin_user_role(obj)

    @staticmethod
    def resolve_role__mapping(obj):
        return AdminUserRole.get_choice_label(resolve_admin_user_role(obj))


class MeOut(Schema):
    id: int
    email: str
    username: str
    first_name: str
    last_name: str
    timezone: str
    avatar: list[ResolvedMediaRefOut] = []
    phone_country_code: str = ""
    phone_national_number: str = ""
    phone_verified: bool
    real_name_status: str
    real_name_status__mapping: str
    real_name_masked: str = ""
    id_number_masked: str = ""
    real_name_verified_at: str | None = None
    is_staff: bool
    is_superuser: bool
    signature: str = ""
    country: str = ""
    tags: list[dict] = []
    notice: list[dict] = []
    notify_count: int = 0
    unread_count: int = 0


class UserPatchIn(Schema):
    first_name: str | None = Field(None, description="用户名字。")
    last_name: str | None = Field(None, description="用户姓氏。")
    timezone: str | None = Field(None, description="用户时区标识。")
    avatar: list[MediaRefIn] | None = Field(None, max_length=1, description="用户头像媒体引用，最多 1 个。")


class ImpersonateUserOut(Schema):
    id: int
    username: str
    email: str = ""
    first_name: str = ""
    last_name: str = ""
    full_name: str
    avatar_url: str | None = None


class SocialBindingItemOut(Schema):
    provider: str
    label: str
    connected: bool


class SocialBindingsOut(Schema):
    items: list[SocialBindingItemOut]


class SplitPhoneIn(Schema):
    phone_country_code: str = Field("", description="手机号国家区号。")
    phone_national_number: str = Field(..., description="手机号本地号码。")

    @field_validator("phone_country_code", "phone_national_number", mode="before")
    @classmethod
    def normalize_phone_parts(cls, value):
        return value.strip() if isinstance(value, str) else value


class SplitPhoneSignupIn(SplitPhoneIn):
    email: str = Field(..., description="邮箱。")
    password: str = Field(..., min_length=8, description="密码。")

    @field_validator("email", mode="before")
    @classmethod
    def normalize_email(cls, value):
        return value.strip() if isinstance(value, str) else value


class PhoneCodeVerifyIn(Schema):
    code: str = Field(..., description="短信验证码。")

    @field_validator("code", mode="before")
    @classmethod
    def normalize_code(cls, value):
        return value.strip() if isinstance(value, str) else value


class WechatPhoneIn(Schema):
    phone_code: str = Field(..., description="微信小程序获取手机号接口返回的 phone code。")


class WechatPhoneOut(Schema):
    phone_country_code: str
    phone_national_number: str
    merged: bool


class TotpSetupOut(Schema):
    secret: str
    totp_url: str


class UserStatusPatchIn(Schema):
    is_active: bool = Field(..., description="是否启用用户。")


class AdminUserCreateIn(Schema):
    username: str = Field(..., description="用户名。")
    email: str = Field(..., description="邮箱。")
    first_name: str = Field("", description="名字。")
    last_name: str = Field("", description="姓氏。")
    timezone: str = Field("Asia/Shanghai", description="时区。")
    phone_country_code: str = Field("", description="手机号国家区号。")
    phone_national_number: str = Field("", description="手机号本地号码。")
    phone_verified: bool = Field(False, description="手机号是否已验证。")
    is_active: bool = Field(True, description="是否启用。")
    is_staff: bool = Field(False, description="是否为管理员。")
    is_superuser: bool = Field(False, description="是否为超级管理员。")
    password: str = Field(..., min_length=8, description="初始密码。")


class AdminUserPatchIn(Schema):
    username: str | None = Field(None, description="用户名。")
    email: str | None = Field(None, description="邮箱。")
    first_name: str | None = Field(None, description="名字。")
    last_name: str | None = Field(None, description="姓氏。")
    timezone: str | None = Field(None, description="时区。")
    phone_country_code: str | None = Field(None, description="手机号国家区号。")
    phone_national_number: str | None = Field(None, description="手机号本地号码。")
    phone_verified: bool | None = Field(None, description="手机号是否已验证。")
    is_active: bool | None = Field(None, description="是否启用。")
    is_staff: bool | None = Field(None, description="是否为管理员。")
    is_superuser: bool | None = Field(None, description="是否为超级管理员。")


class AdminUserPasswordIn(Schema):
    password: str = Field(..., min_length=8, description="新密码。")


class ForceLogoutOut(Schema):
    deleted_sessions: int


class ResetMfaOut(Schema):
    deleted_authenticators: int


class RealNameIdCardMediaIn(MediaRefIn):
    side: Literal[RealNameIdCardSide.FRONT, RealNameIdCardSide.BACK] = Field(..., description="身份证面：front 人像面，back 国徽面。")
    media_type: Literal[MediaType.IMAGE] = Field(MediaType.IMAGE, description="媒体类型。实名认证固定为 image。")


class RealNameIdCardMediaOut(ResolvedMediaRefOut):
    side: Literal[RealNameIdCardSide.FRONT, RealNameIdCardSide.BACK] = Field(..., description="身份证面：front 人像面，back 国徽面。")
    media_type: Literal[MediaType.IMAGE] = Field(MediaType.IMAGE, description="媒体类型。实名认证固定为 image。")


class RealNamePayloadIn(Schema):
    real_name: str = Field(..., min_length=2, max_length=64, description="真实姓名。")
    id_number: str = Field(..., min_length=15, max_length=18, description="身份证号。")
    id_card_media: list[RealNameIdCardMediaIn] = Field(..., min_length=2, max_length=2, description="身份证正反面媒体引用。")
    source: str = Field("user_submit", description="来源：user_submit 或 business_gate。")

    @field_validator("real_name", mode="before")
    @classmethod
    def normalize_real_name(cls, value):
        return value.strip() if isinstance(value, str) else value

    @field_validator("id_number", mode="before")
    @classmethod
    def normalize_id_number(cls, value):
        return value.strip().upper() if isinstance(value, str) else value

    @field_validator("source", mode="before")
    @classmethod
    def normalize_source(cls, value):
        return value.strip() if isinstance(value, str) else value

    @field_validator("source")
    @classmethod
    def validate_source(cls, value):
        if value not in RealNameSource.values:
            raise ValueError("来源必须是 user_submit 或 business_gate。")
        return value

    @field_validator("id_card_media")
    @classmethod
    def validate_id_card_media(cls, value):
        sides = [item.side for item in value]
        if sorted(sides) != ["back", "front"]:
            raise ValueError("身份证图片必须包含 side=front 和 side=back。")
        return value

class RealNameSubmitIn(RealNamePayloadIn):
    pass


class RealNameRetryIn(RealNamePayloadIn):
    pass


class RealNameLogOut(Schema):
    action: str
    action_label: str
    action__mapping: str = ""
    created_at: str
    from_status: str | None = None
    from_status_label: str = ""
    from_status__mapping: str = ""
    note: str = ""
    operator: str = ""
    to_status: str | None = None
    to_status_label: str = ""
    to_status__mapping: str = ""


class RealNameVerificationOut(Schema):
    id: int
    status: str
    status_label: str
    status__mapping: str
    source: str
    source_label: str
    source__mapping: str
    provider: str
    provider_label: str
    provider__mapping: str
    real_name_masked: str
    id_number_masked: str
    failure_reason: str = ""
    review_note: str = ""
    reviewed_by: str | None = None
    reviewed_at: str | None = None
    provider_request_id: str = ""
    provider_result: dict = {}
    id_card_media: list[RealNameIdCardMediaOut] = []
    is_current: bool
    created_at: str
    updated_at: str


class RealNameVerificationDetailOut(RealNameVerificationOut):
    real_name: str
    id_number: str
    user: dict
    logs: list[RealNameLogOut]


class AdminRealNameVerificationRowOut(RealNameVerificationOut):
    user: dict


class AdminRealNameDecisionIn(Schema):
    note: str = Field("", description="审核备注或驳回原因。")
