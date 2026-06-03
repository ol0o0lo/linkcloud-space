from ninja import Schema
from pydantic import Field


class UserOut(Schema):
    id: int
    username: str
    first_name: str = ""
    last_name: str = ""
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


class UserStatusPatchIn(Schema):
    is_active: bool = Field(..., description="是否启用用户。")


class ForceLogoutOut(Schema):
    deleted_sessions: int


class ResetMfaOut(Schema):
    deleted_authenticators: int
