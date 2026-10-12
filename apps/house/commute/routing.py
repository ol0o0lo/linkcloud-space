"""楼栋通勤路线的持久化与计算。"""

from contextlib import contextmanager
from hashlib import blake2b

from django.db import connection

from apps.base.maps import MapPoint, MapRouteNotFound, get_route_provider
from apps.house.exceptions import HouseCommuteRouteBusy
from apps.house.models import Building, HouseCommuteDestination, HouseCommuteRoute

ROUTE_VERSION = 1
METRO_ROUTE_VERSION = 2


def route_version(mode: str) -> int:
    return METRO_ROUTE_VERSION if mode == "metro" else ROUTE_VERSION


def point_key(point) -> str:
    return f"{point.x:.6f},{point.y:.6f}"


def is_current(route: HouseCommuteRoute, building: Building, destination: HouseCommuteDestination, provider_code: str) -> bool:
    return (
        building.location is not None
        and route.version == route_version(route.mode)
        and route.source == provider_code
        and route.origin_key == point_key(building.location)
        and route.destination_key == point_key(destination.location)
    )


def _route_lock_key(building_id: int, destination_id: int, mode: str) -> int:
    identity = f"house-commute:{building_id}:{destination_id}:{mode}".encode()
    return int.from_bytes(blake2b(identity, digest_size=8).digest(), signed=True)


@contextmanager
def _route_compute_lock(building_id: int, destination_id: int, mode: str):
    # 会话锁在进程断开后自动释放，不需要在地图请求期间持有行锁或事务。
    key = _route_lock_key(building_id, destination_id, mode)
    with connection.cursor() as cursor:
        cursor.execute("SELECT pg_try_advisory_lock(%s)", [key])
        acquired = cursor.fetchone()[0]
    if not acquired:
        raise HouseCommuteRouteBusy()
    try:
        yield
    finally:
        with connection.cursor() as cursor:
            cursor.execute("SELECT pg_advisory_unlock(%s)", [key])


def ensure_route(building_id: int, destination_id: int, mode: str) -> HouseCommuteRoute:
    building = Building.objects.get(pk=building_id)
    destination = HouseCommuteDestination.objects.get(pk=destination_id)
    if building.location is None:
        raise ValueError("楼栋缺少坐标")
    provider = get_route_provider()
    route = HouseCommuteRoute.objects.filter(building=building, destination=destination, mode=mode).first()
    if route and is_current(route, building, destination, provider.code):
        return route

    with _route_compute_lock(building_id, destination_id, mode):
        # 锁内再次读取，复用另一个入口刚完成的结果。
        building.refresh_from_db()
        destination.refresh_from_db()
        if building.location is None:
            raise ValueError("楼栋缺少坐标")
        route = HouseCommuteRoute.objects.filter(building=building, destination=destination, mode=mode).first()
        if route and is_current(route, building, destination, provider.code):
            return route
        return _compute_route(building, destination, mode, provider)


def _compute_route(building, destination, mode, provider):

    defaults = {
        "source": provider.code,
        "version": route_version(mode),
        "origin_key": point_key(building.location),
        "destination_key": point_key(destination.location),
        "status": "ready",
        "duration_seconds": None,
        "distance_m": 0,
        "walking_distance_m": 0,
        "steps": [],
        "transit_segments": [],
    }
    try:
        result = provider.plan_route(
            MapPoint(longitude=building.location.x, latitude=building.location.y),
            MapPoint(longitude=destination.location.x, latitude=destination.location.y),
            mode,
            city_code=destination.city_code,
        )
    except MapRouteNotFound:
        defaults["status"] = "unreachable"
    else:
        defaults.update(result)
    route, _ = HouseCommuteRoute.objects.update_or_create(
        building=building,
        destination=destination,
        mode=mode,
        defaults=defaults,
    )
    return route
