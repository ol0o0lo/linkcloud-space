from dataclasses import dataclass
from typing import Protocol
from uuid import uuid4

from apps.ai.runtime.contracts import AIExecutionContext, AIUsage


@dataclass(frozen=True, slots=True)
class QuotaReservation:
    reservation_id: str
    policy: str


class QuotaPolicy(Protocol):
    def reserve(self, context: AIExecutionContext | None, estimated_usage: AIUsage) -> QuotaReservation: ...

    def settle(self, reservation: QuotaReservation, actual_usage: AIUsage) -> None: ...

    def release(self, reservation: QuotaReservation) -> None: ...


class UnlimitedQuotaPolicy:
    """首期无限额策略，保留完整生命周期以便后续替换。"""

    def reserve(self, context: AIExecutionContext | None, estimated_usage: AIUsage) -> QuotaReservation:
        return QuotaReservation(reservation_id=str(uuid4()), policy="unlimited")

    def settle(self, reservation: QuotaReservation, actual_usage: AIUsage) -> None:
        return None

    def release(self, reservation: QuotaReservation) -> None:
        return None


quota_policy: QuotaPolicy = UnlimitedQuotaPolicy()
