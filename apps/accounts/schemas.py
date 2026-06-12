from ninja import Schema
from pydantic import Field


class UserOut(Schema):
    id: int
    username: str
    first_name: str = ""
    last_name: str = ""
    real_name_status: str = "unverified"
    real_name_masked: str = ""
    id_number_masked: str = ""
    timezone: str
    avatar_url: str | None = None


class AdminUserOut(UserOut):
    email: str = ""
    phone: str | None = None
    phone_verified: bool
    is_active: bool
    is_staff: bool
    is_superuser: bool


class MeOut(Schema):
    id: int
    email: str
    username: str
    first_name: str
    last_name: str
    timezone: str
    avatar_url: str | None
    phone: str | None
    phone_verified: bool
    real_name_status: str
    real_name_masked: str = ""
    id_number_masked: str = ""
    real_name_verified_at: str | None = None
    is_staff: bool
    is_superuser: bool


class UserPatchIn(Schema):
    first_name: str | None = Field(None, description="用户名字。")
    last_name: str | None = Field(None, description="用户姓氏。")
    timezone: str | None = Field(None, description="用户时区标识。")


class ImpersonateUserOut(Schema):
    id: int
    username: str
    email: str = ""
    first_name: str = ""
    last_name: str = ""
    full_name: str
    avatar_url: str | None = None


class AvatarOut(Schema):
    avatar_url: str | None


class WechatPhoneIn(Schema):
    phone_code: str = Field(..., description="微信小程序获取手机号接口返回的 phone code。")


class WechatPhoneOut(Schema):
    phone: str
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
    phone: str | None = Field(None, description="手机号。")
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
    phone: str | None = Field(None, description="手机号。")
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


class RealNameSubmitIn(Schema):
    real_name: str = Field(..., min_length=2, description="真实姓名。")
    id_number: str = Field(..., min_length=15, description="身份证号。")
    source: str = Field("user_submit", description="来源：user_submit 或 business_gate。")


class RealNameRetryIn(Schema):
    real_name: str = Field(..., min_length=2, description="真实姓名。")
    id_number: str = Field(..., min_length=15, description="身份证号。")
    source: str = Field("user_submit", description="来源：user_submit 或 business_gate。")


class RealNameLogOut(Schema):
    action: str
    action_label: str
    created_at: str
    from_status: str | None = None
    from_status_label: str = ""
    note: str = ""
    operator: str = ""
    to_status: str | None = None
    to_status_label: str = ""


class RealNameVerificationOut(Schema):
    id: int
    status: str
    status_label: str
    source: str
    source_label: str
    provider: str
    provider_label: str
    real_name_masked: str
    id_number_masked: str
    id_number_last4: str
    failure_reason: str = ""
    review_note: str = ""
    reviewed_by: str | None = None
    reviewed_at: str | None = None
    provider_request_id: str = ""
    provider_result: dict = {}
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
