from datetime import datetime

from ninja import Schema
from pydantic import Field

from apps.media.schemas import MediaRefIn, ResolvedMediaRefOut


class OrganizationCreateIn(Schema):
    name: str = Field(..., description="租户名称。")
    slug: str = Field(..., description="租户 slug，用于切换与公开链接。")


class OrganizationCreateOut(Schema):
    id: int
    name: str
    slug: str


class OrganizationOut(Schema):
    id: int
    name: str
    slug: str
    billing_email: str | None = None
    logo: list[ResolvedMediaRefOut] = []
    description: str = ""
    is_active: bool

    @staticmethod
    def resolve_logo(obj):
        return obj.logo_resolved


class OrganizationPatchIn(Schema):
    name: str | None = Field(None, description="租户显示名称。")
    slug: str | None = Field(None, description="租户 slug。")
    billing_email: str | None = Field(None, description="租户账单联系邮箱。")
    logo: list[MediaRefIn] | None = Field(None, max_length=1, description="租户 Logo 媒体引用，最多 1 个。")
    description: str | None = Field(None, description="租户介绍。")


class OrganizationStatusPatchIn(Schema):
    is_active: bool = Field(..., description="是否启用租户。")


class OrganizationUsageOut(Schema):
    member_count: int
    team_count: int


class SwitchListItemOut(Schema):
    id: int
    name: str
    slug: str
    is_primary: bool
    is_current: bool


class OrgSelectOut(Schema):
    id: int
    slug: str
    name: str
    is_owner: bool


class SuccessOut(Schema):
    success: bool


class SetPrimaryOut(Schema):
    success: bool
    is_primary: bool


class OrgUserOut(Schema):
    id: int
    username: str
    first_name: str = ""
    last_name: str = ""
    email: str = ""
    avatar_url: str | None = None


class MemberOut(Schema):
    pk: int
    organization: int
    user: OrgUserOut
    is_owner: bool
    created_at: datetime
    updated_at: datetime

    @staticmethod
    def resolve_organization(obj) -> int:
        return obj.organization_id

    @staticmethod
    def resolve_user(obj) -> OrgUserOut:
        u = obj.user
        return OrgUserOut(
            id=u.pk,
            username=u.username,
            first_name=u.first_name,
            last_name=u.last_name,
            email=u.email,
            avatar_url=u.avatar_url,
        )


class MemberIn(Schema):
    user: int = Field(..., description="要添加到租户的用户 ID。")
    is_owner: bool = Field(False, description="是否授予该成员租户 owner 权限。")


class TransferOwnerIn(Schema):
    user: int = Field(..., description="新的 owner 用户 ID，必须已经是当前租户成员。")


class MemberPatchIn(Schema):
    is_owner: bool | None = Field(None, description="是否修改为租户 owner。")


class MemberSearchOut(Schema):
    pk: int
    first_name: str = ""
    last_name: str = ""
    username: str
    email: str = ""
    avatar_url: str | None = None


class InviteOut(Schema):
    pk: int
    organization: int
    sender: int
    invitee: int | None = None
    invitee_email: str = ""
    invitee_phone: str = ""
    is_owner: bool
    access_role: int | None = None
    key: str
    is_expired: bool
    created_at: datetime
    updated_at: datetime

    @staticmethod
    def resolve_organization(obj) -> int:
        return obj.organization_id

    @staticmethod
    def resolve_sender(obj) -> int:
        return obj.sender_id

    @staticmethod
    def resolve_invitee(obj) -> int | None:
        return obj.invitee_id

    @staticmethod
    def resolve_invitee_phone(obj) -> str:
        return obj.invitee_phone or ""

    @staticmethod
    def resolve_access_role(obj) -> int | None:
        return obj.access_role_id

    @staticmethod
    def resolve_is_expired(obj) -> bool:
        return obj.is_expired


class InviteIn(Schema):
    invitee_email: str = Field("", description="被邀请人邮箱，可用于未注册用户邀请。")
    invitee_phone: str = Field("", description="被邀请人手机号，可用于未注册用户邀请。")
    invitee: int | None = Field(None, description="被邀请用户 ID，可用于站内已存在用户邀请。")
    is_owner: bool = Field(False, description="接受邀请后是否授予租户 owner 权限。")
    access_role: int | None = Field(None, description="接受邀请后预设绑定的组织级访问角色。")


class PublicInviteOut(Schema):
    """Invite payload for unauthenticated lookup at /api/invite-by-key/{key}/."""

    organization_name: str
    sender_name: str
    invitee_email: str = ""
    invitee_phone: str = ""
    is_expired: bool
    is_already_member: bool


class SettingsOut(Schema):
    billing_email: str = ""


class SettingsPatchIn(Schema):
    billing_email: str | None = Field(None, description="租户账单联系邮箱。")
