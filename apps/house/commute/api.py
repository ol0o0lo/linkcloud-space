"""公开通勤找房 API。"""

import time
from math import asin, cos, radians, sin, sqrt

from django.contrib.gis.geos import Point
from django.core import signing
from django.core.cache import cache
from django.http import Http404
from django.shortcuts import get_object_or_404
from django.utils.crypto import salted_hmac

from ninja import Query, Router, Status
from ninja.errors import HttpError
from ninja.pagination import paginate

from apps.base.maps import MapPoint, MapProviderConfigurationError, MapProviderError, get_place_provider, get_route_provider
from apps.base.ninja_pagination import LegacyPagination
from apps.house.commute.presentation import route_payload
from apps.house.commute.routing import ensure_route, is_current
from apps.house.commute.schemas import (
    CommuteDestinationIn,
    CommuteDestinationOut,
    CommuteHouseOut,
    CommutePlaceOut,
    CommuteProgressOut,
    CommuteRouteForHouseIn,
    CommuteRouteOut,
    CommuteSearchCreatedOut,
    CommuteSearchIn,
)
from apps.house.commute.search import get_search, get_search_progress, result_queryset, start_search
from apps.house.models import HouseCommuteDestination, HouseCommuteRoute
from apps.house.queries.public import get_public_houses_queryset

public_router = Router(tags=["房源/通勤找房"])
PLACE_SIGNING_NAMESPACE = "house-commute-place-v1"


def _enforce_public_rate_limit(request, *, scope: str, limit: int, window_seconds: int) -> None:
    identity = salted_hmac("house.commute-rate", request.META.get("REMOTE_ADDR", "unknown")).hexdigest()[:24]
    key = f"house-commute:rate:{scope}:{identity}:{int(time.time() // window_seconds)}"
    if cache.add(key, 1, timeout=window_seconds + 10):
        count = 1
    else:
        try:
            count = cache.incr(key)
        except ValueError:
            cache.set(key, 1, timeout=window_seconds + 10)
            count = 1
    if count > limit:
        raise HttpError(429, "通勤搜索过于频繁，请稍后重试")


def _distance_m(origin: MapPoint, destination: MapPoint) -> int:
    latitude_delta = radians(destination.latitude - origin.latitude)
    longitude_delta = radians(destination.longitude - origin.longitude)
    haversine = sin(latitude_delta / 2) ** 2 + cos(radians(origin.latitude)) * cos(radians(destination.latitude)) * sin(longitude_delta / 2) ** 2
    return round(2 * 6371000 * asin(min(1, sqrt(haversine))))


@public_router.get("/places/", auth=None, response=list[CommutePlaceOut], summary="搜索或推荐通勤目的地")
def search_commute_places(request, keyword: str = Query(""), city: str = Query(""), lat: float | None = Query(None), lng: float | None = Query(None)):
    _enforce_public_rate_limit(request, scope="place", limit=60, window_seconds=60)
    keyword = keyword.strip()
    if len(keyword) > 80 or len(city) > 64 or (keyword and len(keyword) < 2):
        raise HttpError(422, "请输入 2 至 80 字的地点关键词")
    if (lat is None) != (lng is None):
        raise HttpError(422, "请提供完整的位置坐标")
    try:
        location = MapPoint.from_gcj02(lng, lat) if lat is not None and lng is not None else None
    except ValueError as exc:
        raise HttpError(422, str(exc)) from exc
    if not keyword and location is None:
        raise HttpError(422, "请输入地点关键词或提供当前位置")
    provider = get_place_provider()
    try:
        if keyword:
            places = provider.search_places(keyword, city)
        else:
            cache_key = f"house-commute:nearby:v2:{provider.code}:{lng:.3f}:{lat:.3f}"
            places = cache.get(cache_key)
            if places is None:
                places = provider.nearby_places(location)
                cache.set(cache_key, places, timeout=300)
    except MapProviderConfigurationError as exc:
        raise HttpError(503, str(exc)) from exc
    except MapProviderError as exc:
        raise HttpError(502, str(exc)) from exc
    return [
        {
            "name": place["name"],
            "address": place["address"],
            "city": place["city"],
            "longitude": place["point"].to_gcj02()[0],
            "latitude": place["point"].to_gcj02()[1],
            "distance_m": _distance_m(location, place["point"]) if location else None,
            "token": signing.dumps(
                {
                    "provider_code": provider.code,
                    "provider_place_id": place["id"],
                    "name": place["name"],
                    "address": place["address"],
                    "city": place["city"],
                    "city_code": place["city_code"],
                    "longitude": place["point"].longitude,
                    "latitude": place["point"].latitude,
                },
                salt=PLACE_SIGNING_NAMESPACE,
            ),
        }
        for place in places
        if place["city"] and place["city_code"]
    ]


def _destination_from_token(place_token: str) -> HouseCommuteDestination:
    try:
        place = signing.loads(place_token, salt=PLACE_SIGNING_NAMESPACE, max_age=3600)
    except signing.BadSignature as exc:
        raise HttpError(422, "地点已失效，请重新选择") from exc
    if place.get("provider_code") != get_place_provider().code:
        raise HttpError(422, "地图地点来源已变化，请重新选择")
    destination, _ = HouseCommuteDestination.objects.update_or_create(
        provider_code=place["provider_code"],
        provider_place_id=place["provider_place_id"],
        defaults={
            "name": place["name"],
            "address": place["address"],
            "city": place["city"],
            "city_code": place["city_code"],
            "location": Point(place["longitude"], place["latitude"], srid=4326),
        },
    )
    return destination


@public_router.post("/destinations/", auth=None, response={201: CommuteDestinationOut}, summary="保存通勤目的地")
def save_commute_destination(request, payload: CommuteDestinationIn):
    _enforce_public_rate_limit(request, scope="destination", limit=120, window_seconds=3600)
    return Status(201, {"destination_id": _destination_from_token(payload.place_token).pk})


@public_router.post("/searches/", auth=None, response={201: CommuteSearchCreatedOut}, summary="创建通勤找房搜索")
def start_commute_search(request, payload: CommuteSearchIn):
    _enforce_public_rate_limit(request, scope="search", limit=120, window_seconds=3600)
    if bool(payload.place_token) == bool(payload.destination_id):
        raise HttpError(422, "请选择一个有效的通勤目的地")
    destination = get_object_or_404(HouseCommuteDestination, pk=payload.destination_id) if payload.destination_id else _destination_from_token(payload.place_token or "")
    try:
        search_id = start_search(destination, payload.mode, payload.max_minutes, payload.filters, retry=payload.retry)
    except ValueError as exc:
        raise HttpError(422, str(exc)) from exc
    return Status(201, {"search_id": search_id, "destination_id": destination.pk})


@public_router.get("/searches/{search_id}/", auth=None, response=CommuteProgressOut, summary="获取通勤计算进度")
def get_commute_search(request, search_id: str):
    return get_search_progress(search_id)


@public_router.get("/searches/{search_id}/houses/", auth=None, response=list[CommuteHouseOut], summary="获取通勤房源")
@paginate(LegacyPagination)
def list_commute_houses(request, search_id: str):
    job = get_search(search_id)
    if job is None:
        raise HttpError(404, "搜索已过期，请重新搜索")
    return result_queryset(job)


@public_router.post("/routes/for-house/", auth=None, response=CommuteRouteOut, summary="计算房源到上班地点的通勤路线")
def get_house_commute_route(request, payload: CommuteRouteForHouseIn):
    _enforce_public_rate_limit(request, scope="house-route", limit=120, window_seconds=3600)
    house = get_object_or_404(get_public_houses_queryset(), pk=payload.house_id)
    get_object_or_404(HouseCommuteDestination, pk=payload.destination_id)
    try:
        route = ensure_route(house.building_id, payload.destination_id, payload.mode)
    except ValueError as exc:
        raise HttpError(422, str(exc)) from exc
    except MapProviderError as exc:
        raise HttpError(503, "路线暂时无法计算，请稍后重试") from exc
    if route.status != "ready":
        raise HttpError(404, "当前出行方式暂无可用路线")
    return route_payload(route)


@public_router.get("/routes/{route_id}/", auth=None, response=CommuteRouteOut, summary="获取房源通勤路线")
def get_commute_route(request, route_id: int, house_id: int = Query(...)):
    route = get_object_or_404(HouseCommuteRoute.objects.select_related("building", "destination"), pk=route_id, status="ready")
    if not get_public_houses_queryset().filter(pk=house_id, building_id=route.building_id).exists():
        raise Http404
    if not is_current(route, route.building, route.destination, get_route_provider().code):
        raise Http404
    return route_payload(route)
