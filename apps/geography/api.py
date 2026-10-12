from decimal import Decimal
from typing import Literal

from ninja import Query, Router

from apps.geography.locations import get_nearby_pois, resolve_region
from apps.geography.metro import get_metro_city, list_metro_cities
from apps.geography.schemas import LocatedRegionOut, NearbyPoisOut, PublicMetroCityDetailOut, PublicMetroCitySummaryOut

metro_router = Router(tags=["地铁/公开"])
router = Router(tags=["地理信息/公开"])


@router.get("/regions/resolve/", response=LocatedRegionOut, auth=None, summary="根据坐标解析所在地区")
def resolve_location_region(request, latitude: Decimal, longitude: Decimal, coordinate_system: Literal["gcj02"] = Query("gcj02")):
    return resolve_region(latitude=latitude, longitude=longitude, coordinate_system=coordinate_system)


@router.get("/nearby-pois/", response=NearbyPoisOut, auth=None, summary="获取坐标周边设施")
def list_location_nearby_pois(request, lat: Decimal, lng: Decimal):
    return get_nearby_pois(latitude=lat, longitude=lng)


@metro_router.get("/cities/", response=list[PublicMetroCitySummaryOut], auth=None, operation_id="apps_metro_api_list_public_metro_cities", summary="获取已开通地铁城市")
def list_public_metro_cities(request):
    return list_metro_cities()


@metro_router.get("/cities/{city_name}/", response=PublicMetroCityDetailOut, auth=None, operation_id="apps_metro_api_get_public_metro_city", summary="获取城市地铁线路和站点")
def get_public_metro_city(request, city_name: str):
    return get_metro_city(city_name)
