from django.utils import timezone

from celery import shared_task

from apps.allocation.constants import AllocationRequestStatus
from apps.house.allocation_services import expire_lease_allocation
from apps.house.models import LeaseAllocation


@shared_task
def expire_lease_allocation_requests_task(batch_size: int = 200) -> int:
    now = timezone.now()
    links = list(
        LeaseAllocation.objects.filter(
            allocation_request__status=AllocationRequestStatus.PENDING,
            allocation_request__expires_at__lte=now,
        )
        .select_related("lease__organization")
        .order_by("allocation_request__expires_at")[:batch_size]
    )
    expired_count = 0
    for link in links:
        allocation_request = expire_lease_allocation(organization=link.lease.organization, lease_id=link.lease_id, expired_at=now)
        if allocation_request.status == AllocationRequestStatus.EXPIRED:
            expired_count += 1
    return expired_count
