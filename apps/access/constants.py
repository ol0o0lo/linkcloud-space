from apps.base.enums import StrChoices

ACCESS_PERMISSION_MODEL = "accesspermission"


class AccessScope(StrChoices):
    ORG = "org", "Org"
    TEAM = "team", "Team"


class AccessRoleCode(StrChoices):
    ORG_ADMIN = "org_admin", "Organization admin"
    ORG_FINANCE = "org_finance", "Organization finance"
    TEAM_MANAGER = "team_manager", "Team manager"
    TEAM_FINANCE = "team_finance", "Team finance"
    TEAM_STAFF = "team_staff", "Team staff"
    TEAM_VIEWER = "team_viewer", "Team viewer"


class AccessPermission(StrChoices):
    ROLE_VIEW = "access.role_view", "查看访问角色"
    ROLE_MANAGE = "access.role_manage", "管理访问角色"
    TEAM_ROLE_VIEW = "access.team_role_view", "查看团队访问角色绑定"
    TEAM_ROLE_MANAGE = "access.team_role_manage", "管理团队访问角色绑定"


class OrganizationPermission(StrChoices):
    MEMBER_VIEW = "organizations.member_view", "查看组织成员"
    MEMBER_MANAGE = "organizations.member_manage", "管理组织成员"
    INVITE_MANAGE = "organizations.invite_manage", "管理组织邀请"
    SETTING_MANAGE = "organizations.setting_manage", "管理组织设置"


class TeamPermission(StrChoices):
    VIEW = "teams.team_view", "查看团队"
    CREATE = "teams.team_create", "创建团队"
    UPDATE = "teams.team_update", "更新团队"
    DELETE = "teams.team_delete", "删除团队"
    MEMBER_MANAGE = "teams.team_member_manage", "管理团队成员"


class SettingsPermission(StrChoices):
    ORG_SETTING_VIEW = "settings.org_setting_view", "查看组织设置"
    ORG_SETTING_MANAGE = "settings.org_setting_manage", "管理组织设置"
    TEAM_SETTING_VIEW = "settings.team_setting_view", "查看团队设置"
    TEAM_SETTING_MANAGE = "settings.team_setting_manage", "管理团队设置"


class FinancePermission(StrChoices):
    BILL_VIEW = "finance.finance_bill_view", "查看账单"
    BILL_REFUND = "finance.finance_bill_refund", "退款账单"
    REPORT_EXPORT = "finance.finance_report_export", "导出财务报表"


class AnalyticsPermission(StrChoices):
    VIEW = "analytics.analytics_view", "查看经营分析"


class TeamOperationsPermission(StrChoices):
    ANNOUNCEMENT_MANAGE = "team_operations.announcement_manage", "管理团队公告"
    TASK_MANAGE = "team_operations.task_manage", "管理日常任务"


ALL_PERMISSION_ENUMS = (
    AccessPermission,
    OrganizationPermission,
    TeamPermission,
    SettingsPermission,
    FinancePermission,
    AnalyticsPermission,
    TeamOperationsPermission,
)

# 全量权限 key，供系统角色（如 org_admin）直接复用。
ALL_PERMISSION_KEYS = tuple(permission.value for enum_cls in ALL_PERMISSION_ENUMS for permission in enum_cls)

# 系统角色默认权限定义：只放“定义”，不放同步逻辑。
SYSTEM_ROLE_DEFINITIONS = {
    AccessRoleCode.ORG_ADMIN: {
        "scope": AccessScope.ORG,
        "name": AccessRoleCode.ORG_ADMIN.label,
        "permissions": list(ALL_PERMISSION_KEYS),
    },
    AccessRoleCode.ORG_FINANCE: {
        "scope": AccessScope.ORG,
        "name": AccessRoleCode.ORG_FINANCE.label,
        "permissions": [
            FinancePermission.BILL_VIEW,
            FinancePermission.BILL_REFUND,
            FinancePermission.REPORT_EXPORT,
        ],
    },
    AccessRoleCode.TEAM_MANAGER: {
        "scope": AccessScope.TEAM,
        "name": AccessRoleCode.TEAM_MANAGER.label,
        "permissions": [
            TeamPermission.VIEW,
            TeamPermission.UPDATE,
            TeamPermission.MEMBER_MANAGE,
            SettingsPermission.TEAM_SETTING_VIEW,
            SettingsPermission.TEAM_SETTING_MANAGE,
            TeamOperationsPermission.ANNOUNCEMENT_MANAGE,
            TeamOperationsPermission.TASK_MANAGE,
        ],
    },
    AccessRoleCode.TEAM_FINANCE: {
        "scope": AccessScope.TEAM,
        "name": AccessRoleCode.TEAM_FINANCE.label,
        "permissions": [
            FinancePermission.BILL_VIEW,
            FinancePermission.BILL_REFUND,
        ],
    },
    AccessRoleCode.TEAM_STAFF: {
        "scope": AccessScope.TEAM,
        "name": AccessRoleCode.TEAM_STAFF.label,
        "permissions": [TeamPermission.VIEW, SettingsPermission.TEAM_SETTING_VIEW],
    },
    AccessRoleCode.TEAM_VIEWER: {
        "scope": AccessScope.TEAM,
        "name": AccessRoleCode.TEAM_VIEWER.label,
        "permissions": [TeamPermission.VIEW, SettingsPermission.TEAM_SETTING_VIEW],
    },
}
