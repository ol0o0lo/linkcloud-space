from ninja import Schema


class AppContextUserOut(Schema):
    id: int
    email: str
    username: str
    first_name: str
    last_name: str
    timezone: str
    timezone_display: str
    avatar_url: str | None
    phone: str | None
    phone_verified: bool
    is_staff: bool
    is_superuser: bool
    is_hijacked: bool
    organizations: list[dict]


class AppContextOrgOut(Schema):
    id: int
    name: str
    slug: str
    is_owner: bool


class AppContextOut(Schema):
    user: AppContextUserOut | None
    org: AppContextOrgOut | None
    organizations: list[dict]
    orgMemberCount: int
    orgOwnerCount: int
    siteName: str
    instance: str
    signupOpen: bool
    version: str
