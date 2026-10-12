from decimal import Decimal
from typing import Literal

from django.shortcuts import get_object_or_404

from ninja import Query, Router
from ninja.pagination import paginate

from apps.base.ninja_pagination import LegacyPagination
from apps.geography.locations import resolve_region
from apps.house.constants import HouseListingType
from apps.house.queries.maps import list_public_house_map as query_list_public_house_map
from apps.house.queries.public import get_public_house_filters as query_get_public_house_filters
from apps.house.queries.public import get_public_house_regions as query_get_public_house_regions
from apps.house.queries.public import get_public_house_suggestions as query_get_public_house_suggestions
from apps.house.queries.public import get_public_houses_queryset
from apps.house.schemas.public import (
    PublicHouseDetailOut,
    PublicHouseFiltersOut,
    PublicHouseListOut,
    PublicHouseLocatedRegionOut,
    PublicHouseMapOut,
    PublicHouseRegionsOut,
    PublicHouseSearchFilters,
    PublicHouseSuggestionOut,
)
from apps.house.services.search import search_public_houses

public_router = Router(tags=["房源/公开"])


@public_router.get("/", response=list[PublicHouseListOut], auth=None, summary="全局搜索公开房源")
@paginate(LegacyPagination)
def list_public_houses(
    request,
    filters: PublicHouseSearchFilters = Query(...),
    commute_search_id: str | None = Query(None),
    sort: Literal["latest", "rent_asc", "rent_desc", "area_asc", "area_desc", "distance_asc", "commute_asc"] = Query("latest"),
):
    return search_public_houses(filters=filters, commute_search_id=commute_search_id, sort=sort)


@public_router.get("/map/", response=PublicHouseMapOut, auth=None, summary="按地图视野获取公开房源聚合标点")
def list_public_house_map(
    request,
    zoom: int = Query(8),
    west: Decimal | None = Query(None),
    south: Decimal | None = Query(None),
    east: Decimal | None = Query(None),
    north: Decimal | None = Query(None),
    keyword: str | None = Query(None),
    listing_type: HouseListingType | None = Query(None),
    bedrooms: int | None = Query(None),
    bedrooms_min: int | None = Query(None),
    province: str | None = Query(None),
    city: str | None = Query(None),
    district: str | None = Query(None),
    subdistrict: str | None = Query(None),
    longitude: Decimal | None = Query(None),
    latitude: Decimal | None = Query(None),
    radius_m: int = Query(3000),
    coordinate_system: Literal["gcj02"] = Query(...),
):
    return query_list_public_house_map(
        zoom=zoom,
        west=west,
        south=south,
        east=east,
        north=north,
        keyword=keyword,
        listing_type=listing_type,
        bedrooms=bedrooms,
        bedrooms_min=bedrooms_min,
        province=province,
        city=city,
        district=district,
        subdistrict=subdistrict,
        longitude=longitude,
        latitude=latitude,
        radius_m=radius_m,
        coordinate_system=coordinate_system,
    )


@public_router.get("/regions/", response=PublicHouseRegionsOut, auth=None, summary="获取公开房源地区目录")
def get_public_house_regions(request):
    return query_get_public_house_regions()


@public_router.get("/regions/resolve/", response=PublicHouseLocatedRegionOut, auth=None, summary="根据坐标解析所在地区")
def resolve_public_house_region(
    request,
    latitude: Decimal,
    longitude: Decimal,
    coordinate_system: Literal["gcj02"] = Query("gcj02"),
):
    return resolve_region(latitude=latitude, longitude=longitude, coordinate_system=coordinate_system)


@public_router.get("/filters/", response=PublicHouseFiltersOut, auth=None, summary="获取公开房源筛选项")
def get_public_house_filters(request):
    return query_get_public_house_filters()


@public_router.get("/suggestions/", response=list[PublicHouseSuggestionOut], auth=None, summary="联想公开房源搜索词")
def get_public_house_suggestions(
    request,
    keyword: str = Query(""),
    city: str | None = Query(None),
    longitude: Decimal | None = Query(None),
    latitude: Decimal | None = Query(None),
    radius_m: int = Query(1000),
    coordinate_system: Literal["gcj02"] | None = Query(None),
    listing_type: HouseListingType | None = Query(None),
    bedrooms: int | None = Query(None),
    bedrooms_min: int | None = Query(None),
):
    return query_get_public_house_suggestions(
        keyword=keyword,
        city=city,
        longitude=longitude,
        latitude=latitude,
        radius_m=radius_m,
        coordinate_system=coordinate_system,
        listing_type=listing_type,
        bedrooms=bedrooms,
        bedrooms_min=bedrooms_min,
    )


@public_router.get("/{house_id}/", response=PublicHouseDetailOut, auth=None, summary="获取公开房源详情")
def get_public_house(request, house_id: int):
    return get_object_or_404(get_public_houses_queryset(), pk=house_id)
