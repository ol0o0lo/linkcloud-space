from datetime import datetime

from ninja import Schema

from apps.organizations.schemas import OrgUserOut


class WorkspaceOrganizationOut(Schema):
    id: int
    name: str
    slug: str


class WorkspaceTeamSummaryOut(Schema):
    id: int
    name: str
    member_count: int


class WorkspaceMemberOut(Schema):
    member_id: int
    user: OrgUserOut
    employee_name: str = ""
    job_title: str = ""
    is_owner: bool
    teams: list[WorkspaceTeamSummaryOut]
    has_responsibility: bool
    created_at: datetime
    updated_at: datetime

    @staticmethod
    def resolve_member_id(obj) -> int:
        return obj.pk

    @staticmethod
    def resolve_user(obj) -> OrgUserOut:
        return obj.user

    @staticmethod
    def resolve_teams(obj) -> list[WorkspaceTeamSummaryOut]:
        return getattr(obj.user, "workspace_teams", [])


class OrganizationWorkspaceCapabilitiesOut(Schema):
    member_manage: bool
    invite_manage: bool
    role_view: bool
    role_manage: bool
    team_create: bool
    responsibility_manage: bool
    team_update_ids: list[int]
    team_delete_ids: list[int]
    team_member_manage_ids: list[int]
    team_role_view_ids: list[int]
    team_role_manage_ids: list[int]


class OrganizationNavigationOut(Schema):
    organization: WorkspaceOrganizationOut
    member_count: int
    owner_count: int
    team_count: int
    ungrouped_member_count: int
    pending_invite_count: int | None
    unassigned_responsibility_count: int
    teams: list[WorkspaceTeamSummaryOut]
    capabilities: OrganizationWorkspaceCapabilitiesOut


class OrganizationSearchOut(Schema):
    teams: list[WorkspaceTeamSummaryOut]
    members: list[WorkspaceMemberOut]
