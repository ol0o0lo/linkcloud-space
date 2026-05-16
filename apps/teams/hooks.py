# apps/teams/hooks.py
"""
Team 创建 Hook。

pre_create_team  — 创建前调用，可 raise QuotaExceededError 阻止创建。
post_create_team — 创建后调用（在 transaction.atomic 内），用于后续初始化。

当前逻辑留空，后续根据用户付费等级填充配额检查及初始化逻辑。
"""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from django.http import HttpRequest

    from apps.teams.models import Team


def pre_create_team(request: "HttpRequest") -> None:
    """
    创建团队前调用。

    后续在此处根据 request.user / request.org 的付费等级检查可创建团队数量上限，
    超限时 raise QuotaExceededError("团队数量已达上限，请升级套餐。")
    """
    pass  # TODO: 付费等级配额检查


def post_create_team(request: "HttpRequest", team: "Team") -> None:
    """
    创建团队后调用（位于 transaction.atomic 内，team 已持久化）。

    后续可在此处触发初始化动作，例如：写入审计日志、发送通知等。
    """
    pass  # TODO: 创建后初始化逻辑
