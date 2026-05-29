from django.db import models

ACCESS_PERMISSION_MODEL = "accesspermission"


class AccessScope(models.TextChoices):
    ORG = "org", "Org"
    TEAM = "team", "Team"


class AccessRoleCode(models.TextChoices):
    ORG_ADMIN = "org_admin", "Organization admin"
    ORG_FINANCE = "org_finance", "Organization finance"
    TEAM_MANAGER = "team_manager", "Team manager"
    TEAM_FINANCE = "team_finance", "Team finance"
    TEAM_STAFF = "team_staff", "Team staff"
    TEAM_VIEWER = "team_viewer", "Team viewer"


class AccessPermission:
    ROLE_VIEW = "access.role_view"
    ROLE_MANAGE = "access.role_manage"
    TEAM_ROLE_VIEW = "access.team_role_view"
    TEAM_ROLE_MANAGE = "access.team_role_manage"


class OrganizationPermission:
    MEMBER_VIEW = "organizations.member_view"
    MEMBER_MANAGE = "organizations.member_manage"
    INVITE_MANAGE = "organizations.invite_manage"
    SETTING_MANAGE = "organizations.setting_manage"


class TeamPermission:
    VIEW = "teams.team_view"
    CREATE = "teams.team_create"
    UPDATE = "teams.team_update"
    DELETE = "teams.team_delete"
    MEMBER_MANAGE = "teams.team_member_manage"


class SettingsPermission:
    ORG_SETTING_VIEW = "settings.org_setting_view"
    ORG_SETTING_MANAGE = "settings.org_setting_manage"
    TEAM_SETTING_VIEW = "settings.team_setting_view"
    TEAM_SETTING_MANAGE = "settings.team_setting_manage"


class FinancePermission:
    BILL_VIEW = "finance.finance_bill_view"
    BILL_REFUND = "finance.finance_bill_refund"
    REPORT_EXPORT = "finance.finance_report_export"
