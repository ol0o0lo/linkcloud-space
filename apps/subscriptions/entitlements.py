from dataclasses import dataclass
from typing import Literal

from django.conf import settings
from django.db.models import Prefetch
from django.utils import timezone

from apps.subscriptions.constants import SubscriptionStatus
from apps.subscriptions.exceptions import QuotaExceededException
from apps.subscriptions.models import Plan, PlanEntitlement, Subscription

RESOURCE_LIMIT_FIELDS = {
    "member": "member_limit",
    "team": "team_limit",
    "house": "house_limit",
}
DEFAULT_UPGRADE_RECOMMENDATION_PERCENT = 60


@dataclass(frozen=True, slots=True)
class Entitlement:
    plan_code: str
    plan_name: str
    member_limit: int | None
    team_limit: int | None
    house_limit: int | None
    feature_flags: dict
    starts_at: object | None
    ends_at: object | None
    source: Literal["subscription", "free"]

    def limit_for(self, resource: str) -> int | None:
        return {"member": self.member_limit, "team": self.team_limit, "house": self.house_limit}[resource]


class EntitlementService:
    """组织权益唯一读取和配额校验入口。"""

    @classmethod
    def for_organization(cls, organization) -> Entitlement:
        now = timezone.now()
        subscription = (
            Subscription.objects.filter(
                organization=organization,
                status__in=[SubscriptionStatus.TRIALING, SubscriptionStatus.ACTIVE],
                ends_at__gt=now,
            )
            .only("plan_snapshot", "entitlement_snapshot", "starts_at", "ends_at")
            .first()
        )
        if subscription:
            data = subscription.entitlement_snapshot
            return Entitlement(
                plan_code=subscription.plan_snapshot.get("code", ""),
                plan_name=subscription.plan_snapshot.get("name", ""),
                member_limit=data.get("member_limit"),
                team_limit=data.get("team_limit"),
                house_limit=data.get("house_limit"),
                feature_flags=data.get("feature_flags", {}),
                starts_at=subscription.starts_at,
                ends_at=subscription.ends_at,
                source="subscription",
            )
        return cls._free_entitlement()

    @classmethod
    def _free_entitlement(cls) -> Entitlement:
        plan = Plan.objects.filter(code="free", is_active=True).first()
        entitlement = PlanEntitlement.objects.filter(plan=plan, is_current=True).first() if plan else None
        return Entitlement(
            plan_code=plan.code if plan else "free",
            plan_name=plan.name if plan else "免费版",
            member_limit=entitlement.member_limit if entitlement else 3,
            team_limit=entitlement.team_limit if entitlement else 1,
            house_limit=entitlement.house_limit if entitlement else 50,
            feature_flags=entitlement.feature_flags if entitlement else {},
            starts_at=None,
            ends_at=None,
            source="free",
        )

    @classmethod
    def usage_for(cls, organization) -> dict[str, int]:
        from apps.house.models import House
        from apps.organizations.models import OrganizationMember
        from apps.teams.models import Team

        return {
            "member": OrganizationMember.objects.filter(organization=organization).count(),
            "team": Team.objects.filter(organization=organization).count(),
            "house": House.objects.filter(building__organization=organization).count(),
        }

    @classmethod
    def upgrade_recommendation_for(
        cls,
        organization,
        *,
        entitlement: Entitlement | None = None,
        usage: dict[str, int] | None = None,
    ) -> dict | None:
        entitlement = entitlement or cls.for_organization(organization)
        usage = usage or cls.usage_for(organization)
        threshold_percent = getattr(
            settings,
            "SUBSCRIPTIONS_UPGRADE_RECOMMENDATION_PERCENT",
            DEFAULT_UPGRADE_RECOMMENDATION_PERCENT,
        )
        triggered_resources = []
        for resource, limit_field in RESOURCE_LIMIT_FIELDS.items():
            limit = getattr(entitlement, limit_field)
            current = usage.get(resource, 0)
            if limit is None or limit <= 0 or current * 100 <= limit * threshold_percent:
                continue
            triggered_resources.append(
                {
                    "resource": resource,
                    "current": current,
                    "limit": limit,
                    "usage_percent": round(current / limit * 100),
                }
            )
        if not triggered_resources:
            return None

        current_plan = Plan.objects.filter(code=entitlement.plan_code).only("display_order").first()
        if current_plan is None:
            return None
        candidates = (
            Plan.objects.filter(is_active=True, display_order__gt=current_plan.display_order)
            .prefetch_related(
                Prefetch(
                    "entitlements",
                    queryset=PlanEntitlement.objects.filter(is_current=True),
                    to_attr="current_entitlement_versions",
                )
            )
            .order_by("display_order", "pk")
        )
        triggered_keys = {item["resource"] for item in triggered_resources}
        for plan in candidates:
            candidate_entitlement = next(iter(plan.current_entitlement_versions), None)
            if candidate_entitlement is None:
                continue
            has_capacity = True
            for resource, limit_field in RESOURCE_LIMIT_FIELDS.items():
                target_limit = getattr(candidate_entitlement, limit_field)
                current = usage.get(resource, 0)
                if target_limit is not None and (target_limit < current or (resource in triggered_keys and target_limit <= current)):
                    has_capacity = False
                    break
            if has_capacity:
                return {
                    "reason": "usage_threshold_exceeded",
                    "threshold_percent": threshold_percent,
                    "target_plan_code": plan.code,
                    "target_plan_name": plan.name,
                    "triggered_resources": triggered_resources,
                }
        return None

    @classmethod
    def check_can_add(cls, organization, resource: Literal["member", "team", "house"], amount: int = 1) -> None:
        entitlement = cls.for_organization(organization)
        limit = entitlement.limit_for(resource)
        usage = cls.usage_for(organization)[resource]
        if limit is not None and usage + amount > limit:
            labels = {"member": "成员", "team": "团队", "house": "房源"}
            raise QuotaExceededException(
                f"当前套餐的{labels[resource]}数量已达上限。",
                data={
                    "resource": resource,
                    "current": usage,
                    "limit": limit,
                    "plan_code": entitlement.plan_code,
                    "plan_name": entitlement.plan_name,
                },
            )

    @classmethod
    def has_feature(cls, organization, feature_key: str) -> bool:
        return bool(cls.for_organization(organization).feature_flags.get(feature_key))
