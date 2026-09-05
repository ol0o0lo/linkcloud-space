from apps.base.enums import StrChoices

ACCESS_PERMISSION_MODEL = "accesspermission"

PERMISSION_MODULES = {
    "access": ("access", "角色与权限"),
    "organizations": ("organization", "成员与组织"),
    "teams": ("team", "团队管理"),
    "settings": ("settings", "系统设置"),
    "allocation": ("allocation", "收益分配"),
    "finance": ("finance", "财务管理"),
    "subscriptions": ("subscription", "套餐与订阅"),
    "analytics": ("analytics", "数据与报表"),
    "team_operations": ("team_operations", "团队协作"),
}


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


class AllocationPermission(StrChoices):
    VIEW = "allocation.view", "查看分配申请和应计收益"
    SUBMIT = "allocation.submit", "提交分配申请"
    CHANGE_BENEFICIARIES = "allocation.change_beneficiaries", "修改分配受益人"
    REVIEW = "allocation.review", "审核分配申请"
    ADJUST = "allocation.adjust", "人工调整应计收益"
    VOID = "allocation.void", "作废已生效分配"


class SubscriptionPermission(StrChoices):
    VIEW = "subscriptions.subscription_view", "查看订阅与支付记录"
    MANAGE = "subscriptions.subscription_manage", "管理订阅、购买与开票"


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
    AllocationPermission,
    FinancePermission,
    SubscriptionPermission,
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
        "description": "拥有空间内组织、成员、团队、角色及业务设置的完整管理权限。",
        "permissions": list(ALL_PERMISSION_KEYS),
    },
    AccessRoleCode.ORG_FINANCE: {
        "scope": AccessScope.ORG,
        "name": AccessRoleCode.ORG_FINANCE.label,
        "description": "负责空间财务、订阅、退款和报表相关操作。",
        "permissions": [
            FinancePermission.BILL_VIEW,
            FinancePermission.BILL_REFUND,
            FinancePermission.REPORT_EXPORT,
            AllocationPermission.VIEW,
            AllocationPermission.REVIEW,
            AllocationPermission.ADJUST,
            AllocationPermission.VOID,
            SubscriptionPermission.VIEW,
            SubscriptionPermission.MANAGE,
        ],
    },
    AccessRoleCode.TEAM_MANAGER: {
        "scope": AccessScope.TEAM,
        "name": AccessRoleCode.TEAM_MANAGER.label,
        "description": "负责当前团队的成员、设置、公告和任务管理。",
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
        "description": "负责当前团队范围内的财务查看与退款操作。",
        "permissions": [
            FinancePermission.BILL_VIEW,
            FinancePermission.BILL_REFUND,
        ],
    },
    AccessRoleCode.TEAM_STAFF: {
        "scope": AccessScope.TEAM,
        "name": AccessRoleCode.TEAM_STAFF.label,
        "description": "可查看当前团队及团队设置，适用于普通团队成员。",
        "permissions": [TeamPermission.VIEW, SettingsPermission.TEAM_SETTING_VIEW],
    },
    AccessRoleCode.TEAM_VIEWER: {
        "scope": AccessScope.TEAM,
        "name": AccessRoleCode.TEAM_VIEWER.label,
        "description": "仅查看当前团队与团队设置，不参与管理操作。",
        "permissions": [TeamPermission.VIEW, SettingsPermission.TEAM_SETTING_VIEW],
    },
}
