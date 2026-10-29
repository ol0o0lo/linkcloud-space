"""通勤搜索任务与公开房源结果。"""

from uuid import uuid4

from django.contrib.gis.measure import D
from django.core.cache import cache
from django.db.models import F
from django.utils import timezone

from apps.base.exceptions import NotFoundException
from apps.base.maps import get_route_provider
from apps.house.commute.routing import ROUTE_RETRY_COOLDOWN, is_current
from apps.house.exceptions import HouseUnavailableException
from apps.house.models import HouseCommuteDestination, HouseCommuteRoute
from apps.house.queries.public import filter_signature, public_houses_for_filters
from apps.house.schemas.public import PublicHouseSearchFilters

JOB_TTL_SECONDS = 2 * 60 * 60
MAX_CANDIDATE_BUILDINGS = 2000
MAX_QUEUED_ROUTES_PER_SEARCH = 60
# 粗筛采用宽松速度上界；最终结果始终以地图路线时长为准。
MAX_COARSE_SPEED_KMH = {"metro": 120, "ebike": 55, "bicycle": 35, "walking": 10, "driving": 160}


def job_cache_key(search_id: str) -> str:
    return f"house-commute-search:v1:{search_id}"


def route_task_key(building_id: int, destination_id: int, mode: str) -> str:
    return f"house-commute-route-queued:v1:{building_id}:{destination_id}:{mode}"


def route_error_key(building_id: int, destination_id: int, mode: str) -> str:
    return f"house-commute-route-error:v1:{building_id}:{destination_id}:{mode}"


def create_search(destination: HouseCommuteDestination, mode: str, max_minutes: int, filters: PublicHouseSearchFilters | None = None, *, retry: bool = False) -> str:
    filters = filters or PublicHouseSearchFilters()
    radius_m = (MAX_COARSE_SPEED_KMH[mode] * max_minutes * 1000 // 60) + 3000
    houses = public_houses_for_filters(filters).filter(building__location__distance_lte=(destination.location, D(m=radius_m)))
    building_ids = list(houses.order_by().values_list("building_id", flat=True).distinct()[: MAX_CANDIDATE_BUILDINGS + 1])
    if len(building_ids) > MAX_CANDIDATE_BUILDINGS:
        raise ValueError("通勤候选楼栋过多，请缩小区域或其他房源条件")
    search_id = uuid4().hex
    reference_time = timezone.now()
    cache.set(
        job_cache_key(search_id),
        {
            "destination_id": destination.pk,
            "mode": mode,
            "max_minutes": max_minutes,
            "building_ids": building_ids,
            "filters": filters.model_dump(mode="json", exclude_none=True),
            "filter_signature": filter_signature(filters),
            "error": "",
            # 本次搜索固定复用基准，避免轮询时结果过期导致进度回退。
            "reference_time": reference_time,
            "refresh_after": reference_time - ROUTE_RETRY_COOLDOWN if retry else None,
        },
        timeout=JOB_TTL_SECONDS,
    )
    return search_id


def get_search(search_id: str) -> dict | None:
    if len(search_id) != 32 or not all(char in "0123456789abcdef" for char in search_id):
        return None
    return cache.get(job_cache_key(search_id))


def start_search(destination, mode, max_minutes, filters=None, *, retry=False) -> str:
    search_id = create_search(destination, mode, max_minutes, filters, retry=retry)
    job = get_search(search_id)
    if job:
        schedule_missing_routes(search_id, job, retry=retry)
    return search_id


def schedule_missing_routes(search_id: str, job: dict, *, retry=False, limit=MAX_QUEUED_ROUTES_PER_SEARCH) -> None:
    from apps.house.tasks import compute_commute_batch_task

    progress = search_progress(job)
    if retry:
        cache.delete_many([route_error_key(building_id, job["destination_id"], job["mode"]) for building_id in progress["missing_ids"]])
    elif progress["status"] == "failed":
        return
    queued = 0
    for building_id in progress["missing_ids"]:
        key = route_task_key(building_id, job["destination_id"], job["mode"])
        if not cache.add(key, 1, timeout=120):
            continue
        try:
            compute_commute_batch_task.delay(search_id, [building_id])
        except Exception as exc:
            cache.delete(key)
            job["error"] = "路线任务暂时无法提交，请稍后重试计算"
            cache.set(job_cache_key(search_id), job, timeout=JOB_TTL_SECONDS)
            raise HouseUnavailableException(job["error"]) from exc
        queued += 1
        if queued >= limit:
            break


def get_search_progress(search_id: str) -> dict:
    job = get_search(search_id)
    if job is None:
        raise NotFoundException("搜索已过期，请重新搜索")
    progress = search_progress(job)
    return {key: progress[key] for key in ("status", "processed", "total", "error")}


def search_progress(job: dict) -> dict:
    building_ids = job["building_ids"]
    destination = HouseCommuteDestination.objects.get(pk=job["destination_id"])
    provider_code = get_route_provider().code
    routes = HouseCommuteRoute.objects.filter(destination=destination, mode=job["mode"], building_id__in=building_ids).select_related("building")
    reference_time = job.get("reference_time") or timezone.now()
    current_routes = {
        route.building_id: route
        for route in routes
        if is_current(
            route,
            route.building,
            destination,
            provider_code,
            reference_time=reference_time,
            refresh_after=job.get("refresh_after") if route.status == "unreachable" else None,
        )
    }
    done = set(current_routes)
    total = len(building_ids)
    missing_ids = [building_id for building_id in building_ids if building_id not in done]
    failed_keys = cache.get_many([route_error_key(building_id, job["destination_id"], job["mode"]) for building_id in missing_ids])
    failed_ids = [building_id for building_id in missing_ids if route_error_key(building_id, job["destination_id"], job["mode"]) in failed_keys]
    return {
        "status": "failed" if job.get("error") or failed_ids else "ready" if len(done) == total else "pending",
        "processed": len(done),
        "total": total,
        "error": job.get("error") or ("部分路线计算失败，请重试计算" if failed_ids else ""),
        "missing_ids": missing_ids,
        "current_ids": list(done),
    }


def result_queryset(job: dict):
    filters = PublicHouseSearchFilters.model_validate(job["filters"])
    return apply_commute_filter(public_houses_for_filters(filters), job).order_by("commute_seconds", "pk")


def apply_commute_filter(qs, job: dict):
    """将通勤条件叠加到任意公开房源查询，不改变其已有筛选与排序。"""
    destination = HouseCommuteDestination.objects.get(pk=job["destination_id"])
    current_ids = search_progress(job)["current_ids"]
    return qs.filter(
        building_id__in=current_ids,
        building__commute_routes__destination=destination,
        building__commute_routes__mode=job["mode"],
        building__commute_routes__status="ready",
        building__commute_routes__duration_seconds__lte=job["max_minutes"] * 60,
    ).annotate(
        commute_seconds=F("building__commute_routes__duration_seconds"),
        commute_route_id=F("building__commute_routes__id"),
    )
