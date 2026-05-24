from ninja import Schema


class UserOut(Schema):
    id: int
    username: str
    first_name: str = ""
    last_name: str = ""
    timezone: str
    avatar_url: str | None = None


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
    first_name: str | None = None
    last_name: str | None = None
    timezone: str | None = None


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
    phone_code: str


class WechatPhoneOut(Schema):
    phone: str
    merged: bool
