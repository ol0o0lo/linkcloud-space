from decimal import Decimal
from typing import Literal

from ninja import Query, Router
from ninja.pagination import paginate

from apps.base.ninja_pagination import LegacyPagination
from apps.base.permissions import require_org_selected
from apps.house.queries.maps import get_building_map_detail as query_get_building_map_detail
from apps.house.queries.maps import get_building_map_unlocated_count as query_get_building_map_unlocated_count
from apps.house.queries.maps import list_building_map as query_list_building_map
from apps.house.queries.maps import list_building_map_unlocated as query_list_building_map_unlocated
from apps.house.queries.maps import list_estate_map as query_list_estate_map
from apps.house.schemas.properties import BuildingMapDetailOut, BuildingMapMarkerOut, BuildingMapUnlocatedCountOut, BuildingMapUnlocatedOut, EstateMapMarkerOut

router = Router(tags=["房源/管理"])


@router.get("/estate-map/", response=list[EstateMapMarkerOut], summary="获取小区房源地图聚合标点")
@paginate(LegacyPagination)
def list_estate_map(
    request,
    keyword: str | None = Query(None),
    estate_id: int | None = Query(None),
    house_status: str | None = Query(None),
    west: Decimal | None = Query(None),
    south: Decimal | None = Query(None),
    east: Decimal | None = Query(None),
    north: Decimal | None = Query(None),
    coordinate_system: Literal["gcj02"] = Query(...),
):
    org = require_org_selected(request)
    return query_list_estate_map(
        org=org, keyword=keyword, estate_id=estate_id, house_status=house_status, west=west, south=south, east=east, north=north, coordinate_system=coordinate_system
    )


@router.get("/building-map/", response=list[BuildingMapMarkerOut], summary="获取楼栋房源地图标点")
@paginate(LegacyPagination)
def list_building_map(
    request,
    keyword: str | None = Query(None),
    estate_id: int | None = Query(None),
    house_status: str | None = Query(None),
    standalone_only: bool = Query(False),
    west: Decimal | None = Query(None),
    south: Decimal | None = Query(None),
    east: Decimal | None = Query(None),
    north: Decimal | None = Query(None),
    coordinate_system: Literal["gcj02"] = Query(...),
):
    org = require_org_selected(request)
    return query_list_building_map(
        org=org,
        keyword=keyword,
        estate_id=estate_id,
        house_status=house_status,
        standalone_only=standalone_only,
        west=west,
        south=south,
        east=east,
        north=north,
        coordinate_system=coordinate_system,
    )


@router.get("/building-map-unlocated/", response=list[BuildingMapUnlocatedOut], summary="获取待定位楼栋列表")
@paginate(LegacyPagination)
def list_building_map_unlocated(
    request,
    keyword: str | None = Query(None),
    estate_id: int | None = Query(None),
    house_status: str | None = Query(None),
):
    org = require_org_selected(request)
    return query_list_building_map_unlocated(org=org, keyword=keyword, estate_id=estate_id, house_status=house_status)


@router.get("/building-map-unlocated-count/", response=BuildingMapUnlocatedCountOut, summary="获取待定位楼栋数量")
def get_building_map_unlocated_count(request):
    org = require_org_selected(request)
    return query_get_building_map_unlocated_count(org=org)


@router.get("/building-map/{building_id}/", response=BuildingMapDetailOut, summary="获取楼栋房源地图详情")
def get_building_map_detail(request, building_id: int):
    org = require_org_selected(request)
    return query_get_building_map_detail(org=org, building_id=building_id)
