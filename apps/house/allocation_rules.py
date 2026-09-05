from dataclasses import dataclass
from decimal import Decimal

from apps.allocation.constants import AllocationDistributionMethod, AllocationRuleSource
from apps.settings.service import LEASE_ALLOCATION_RULE_SETTING_KEY, get_org_setting, get_team_setting


@dataclass(frozen=True)
class LeaseAllocationRule:
    method: str
    rate_bp: int | None
    fixed_amount: Decimal | None
    source: str


def resolve_lease_allocation_rule(organization, team=None) -> LeaseAllocationRule:
    setting = get_team_setting(team, LEASE_ALLOCATION_RULE_SETTING_KEY) if team else get_org_setting(organization, LEASE_ALLOCATION_RULE_SETTING_KEY)
    value = setting["value"]
    method = value["method"]
    source = setting["value_source"]
    if method == AllocationDistributionMethod.PERCENTAGE:
        return LeaseAllocationRule(
            method=method,
            rate_bp=int(value["rate_bp"]),
            fixed_amount=None,
            source=source,
        )
    return LeaseAllocationRule(
        method=method,
        rate_bp=None,
        fixed_amount=Decimal(str(value["fixed_amount"])),
        source=source if source in AllocationRuleSource.values else AllocationRuleSource.DEFAULT,
    )
