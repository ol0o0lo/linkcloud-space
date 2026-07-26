# apps/organizations/hooks.py
"""
Organization 创建 Hook。

pre_create_organization  — 创建前调用，可 raise QuotaExceededException 阻止创建。
post_create_organization — 创建后调用（在 transaction.atomic 内），用于后续初始化。

当前逻辑留空，后续根据用户付费等级填充配额检查及初始化逻辑。
"""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from django.http import HttpRequest

    from apps.organizations.models import Organization


def pre_create_organization(request: HttpRequest) -> None:
    """
    创建组织前调用。

    后续在此处根据 request.user 的付费等级检查可创建组织数量上限，
    超限时 raise QuotaExceededException("组织数量已达上限，请升级套餐。")
    """
    from apps.subscriptions.exceptions import QuotaExceededException, SubscriptionRuleException
    from apps.subscriptions.services import count_currently_owned_organizations, get_subscription_settings

    if not request.user.phone_verified:
        raise SubscriptionRuleException("创建组织前请先完成手机号验证。")
    limit = get_subscription_settings().organization_creation_limit
    current = count_currently_owned_organizations(request.user)
    if current >= limit:
        raise QuotaExceededException("已达到可创建组织上限。", data={"current": current, "limit": limit, "resource": "organization"})


def post_create_organization(request: HttpRequest, org: Organization) -> None:
    """
    创建组织后调用（位于 transaction.atomic 内，org 已持久化）。

    后续可在此处触发初始化动作，例如：开通默认功能、写入审计日志、
    发送欢迎通知等。
    """
    from apps.subscriptions.services import can_grant_trial, grant_trial

    if can_grant_trial(organization=org, granted_to=request.user):
        grant_trial(organization=org, granted_to=request.user)
