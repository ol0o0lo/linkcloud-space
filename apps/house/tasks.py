from django.utils import timezone

from celery import shared_task

from apps.allocation.constants import AllocationRequestStatus
from apps.house.allocation_services import expire_lease_allocation
from apps.house.models import LeaseAllocation


@shared_task(bind=True, rate_limit="3/s", max_retries=2)
def compute_commute_batch_task(self, search_id: str, building_ids: list[int]) -> int:
    """小批量补齐路线；失败搜索可重试，已算结果长期保留。"""
    from django.core.cache import cache

    from apps.base.maps import MapProviderResponseError, MapProviderUnavailable
    from apps.house.commute.routing import ensure_route
    from apps.house.commute.search import JOB_TTL_SECONDS, get_search, job_cache_key, route_error_key, route_task_key

    job = get_search(search_id)
    if not job:
        return 0
    completed = 0
    retrying = False
    try:
        for building_id in building_ids:
            ensure_route(building_id, job["destination_id"], job["mode"])
            cache.delete(route_error_key(building_id, job["destination_id"], job["mode"]))
            completed += 1
    except (MapProviderUnavailable, MapProviderResponseError) as exc:
        if self.request.retries < self.max_retries:
            retrying = True
            raise self.retry(exc=exc, countdown=3 * (self.request.retries + 1)) from exc
        job["error"] = "地图路线服务暂不可用，请稍后重新搜索"
        cache.set(job_cache_key(search_id), job, timeout=JOB_TTL_SECONDS)
        cache.set(route_error_key(building_id, job["destination_id"], job["mode"]), 1, timeout=120)
    except Exception:
        job["error"] = "路线计算失败，请重试计算"
        cache.set(job_cache_key(search_id), job, timeout=JOB_TTL_SECONDS)
        cache.set(route_error_key(building_id, job["destination_id"], job["mode"]), 1, timeout=120)
        raise
    finally:
        if not retrying:
            for building_id in building_ids:
                cache.delete(route_task_key(building_id, job["destination_id"], job["mode"]))
    return completed


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
