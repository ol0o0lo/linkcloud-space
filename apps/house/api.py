from datetime import timedelta
from decimal import Decimal
from typing import Literal
from uuid import UUID

from django.conf import settings
from django.contrib.gis.db.models import GeometryField
from django.contrib.gis.db.models.aggregates import Collect
from django.contrib.gis.db.models.functions import Centroid
from django.core.cache import cache
from django.core.exceptions import PermissionDenied
from django.db import transaction
from django.db.models import (
    BooleanField,
    Case,
    CharField,
    Count,
    DateTimeField,
    Exists,
    ExpressionWrapper,
    F,
    IntegerField,
    Max,
    Min,
    OuterRef,
    Prefetch,
    Q,
    Subquery,
    Sum,
    Value,
    When,
)
from django.db.models.functions import Cast, Coalesce
from django.http import Http404
from django.shortcuts import get_object_or_404
from django.utils import timezone

import requests
from ninja import Query, Router, Status
from ninja.errors import HttpError
from ninja.pagination import paginate

from apps.access.constants import AllocationPermission, OrganizationPermission, TeamPermission
from apps.access.permissions import require_org_permission, require_team_permission
from apps.access.services import has_permission
from apps.ai.services import AIErrorCode, AIExecutionError
from apps.allocation.schemas import AllocationRequestOut
from apps.base.invitation_exceptions import (
    InvitationBindingConflictException,
    InvitationPhoneVerificationRequiredException,
    InvitationRecipientMismatchException,
    InvitationUnavailableException,
)
from apps.base.invitation_receipts import get_invitation_receipt, save_invitation_receipt
from apps.base.ninja_pagination import LegacyPagination
from apps.base.permissions import require_authenticated, require_org_selected
from apps.base.sms import send_invitation_sms
from apps.house.ai_insights import HouseAIInsightBusyError, HouseAIInsightInsufficientDataError, generate_house_ai_insight, get_house_ai_insight
from apps.house.allocation_services import create_lease_with_allocation, get_lease_allocation, review_lease_allocation, void_lease_allocation
from apps.house.constants import HOUSE_ACTIVE_STATUSES, ContactRole, HouseStatus, ViewingRecordStatus
from apps.house.geo.coordinates import convert_viewport_to_wgs84, make_wgs84_point, serialize_point
from apps.house.geo.queries import NamedGeoOrigin, apply_nearby_house_filter, filter_by_viewport
from apps.house.landlord_invitations import (
    LANDLORD_INVITATION_VALID_DAYS,
    LandlordInvitationCacheError,
    consume_landlord_invitation,
    create_landlord_invitation,
    get_landlord_invitation,
    invitation_action_url,
    invitation_expires_at,
    mask_phone,
    normalize_invitation_phone,
)
from apps.house.models import Building, Contact, Estate, House, Lease, LeaseAllocation, PropertyResponsibility, ViewingRecord
from apps.house.ordering import HOUSE_DEFAULT_ORDERING, HOUSE_ORDERING_DESCRIPTION, HOUSE_ORDERING_PATTERN, apply_house_ordering
from apps.house.schemas import (
    BuildingIn,
    BuildingInventoryOut,
    BuildingMapDetailOut,
    BuildingMapMarkerOut,
    BuildingMapUnlocatedCountOut,
    BuildingMapUnlocatedOut,
    BuildingOut,
    BuildingPatchIn,
    ContactIn,
    ContactOut,
    ContactPatchIn,
    DealSigningWithAllocationIn,
    DefaultBuildingIn,
    DefaultBuildingOut,
    DeleteCheckOut,
    EstateDetailOut,
    EstateIn,
    EstateMapMarkerOut,
    EstateOut,
    EstatePatchIn,
    HouseAIInsightOut,
    HouseIn,
    HouseInspectionReason,
    HouseOut,
    HousePatchIn,
    HouseScope,
    HouseStatusValue,
    LandlordHouseOut,
    LandlordInvitationAcceptOut,
    LandlordInvitationOut,
    LandlordRelationshipOut,
    LeaseAllocationOut,
    LeaseAllocationReviewIn,
    LeaseAllocationVoidIn,
    LeaseIn,
    LeaseOut,
    LeasePatchIn,
    LeaseWithAllocationIn,
    PropertyResponsibilityMemberOut,
    PropertyResponsibilitySummaryOut,
    PropertyResponsibilityUpdateIn,
    PublicHouseDetailOut,
    PublicHouseFiltersOut,
    PublicHouseListOut,
    PublicHouseLocatedRegionOut,
    PublicHouseMapOut,
    PublicHouseRegionsOut,
    PublicLandlordProfileOut,
    TagSuggestionsOut,
    TenantContactRequestIn,
    TenantContactRequestOut,
    TenantLeaseOut,
    TenantViewingRecordIn,
    TenantViewingRecordOut,
    VacancySyncIn,
    VacancySyncOut,
    ViewingRecordIn,
    ViewingRecordOut,
    ViewingRecordPatchIn,
)
from apps.house.services import (
    apply_public_house_filters,
    build_public_house_regions,
    building_map_counts,
    delete_building,
    delete_estate,
    ensure_default_building,
    evaluate_house_publish_state,
    get_building_delete_check,
    get_estate_delete_check,
    get_landlord_houses,
    get_landlord_houses_for_contact,
    get_landlord_leases,
    get_landlord_leases_for_contact,
    get_landlord_relationship_contacts,
    get_org_house_publish_rules,
    get_org_inspection_max_age_days,
    get_public_houses_queryset,
    get_tag_suggestions,
    resolve_deal_signing_tenant,
    set_default_building,
    sort_houses_for_building,
)
from apps.house.tenant_services import (
    TenantContactConflict,
    TenantContactRecipientUnavailable,
    TenantContactValidationError,
    get_or_bind_tenant_contact,
    send_tenant_contact_request,
)
from apps.house.vacancy_sync import apply_vacancy_sync, build_vacancy_sync_plan
from apps.metro.models import MetroLineStation, MetroStation
from apps.organizations.models import OrganizationMember

router = Router(tags=["房源/管理"])
landlord_router = Router(tags=["房源/房东"])
tenant_router = Router(tags=["房源/租客"])
public_router = Router(tags=["房源/公开"])
public_landlord_router = Router(tags=["房源/房东公开店铺"])

AI_INSIGHT_ERROR_STATUS = {
    AIErrorCode.INVALID_REQUEST: 400,
    AIErrorCode.PERMISSION_DENIED: 403,
    AIErrorCode.CONTENT_REJECTED: 422,
    AIErrorCode.STRUCTURED_OUTPUT_INVALID: 422,
    AIErrorCode.CAPABILITY_UNAVAILABLE: 503,
    AIErrorCode.PROVIDER_AUTH_ERROR: 503,
    AIErrorCode.RATE_LIMITED: 503,
    AIErrorCode.TIMEOUT: 504,
    AIErrorCode.PROVIDER_UNAVAILABLE: 503,
    AIErrorCode.STREAM_INTERRUPTED: 502,
    AIErrorCode.INTERNAL_ERROR: 500,
}


def _house_ai_call(function, **kwargs):
    try:
        return function(**kwargs)
    except HouseAIInsightBusyError as exc:
        raise HttpError(409, str(exc)) from exc
    except HouseAIInsightInsufficientDataError as exc:
        raise HttpError(422, str(exc)) from exc
    except AIExecutionError as exc:
        raise HttpError(AI_INSIGHT_ERROR_STATUS.get(exc.code, 500), exc.safe_message) from exc


def _get_public_landlord_contact(public_key: UUID):
    contact = get_object_or_404(
        Contact.objects.select_related("organization", "user"),
        public_key=public_key,
        is_active=True,
        organization__is_active=True,
        user__is_active=True,
        user__phone_verified=True,
    )
    if ContactRole.LANDLORD not in (contact.roles or []) or not contact.user.phone:
        raise Http404
    return contact


@public_landlord_router.get("/{public_key}/", response=PublicLandlordProfileOut, auth=None, summary="获取房东公开店铺")
def get_public_landlord_profile(request, public_key: UUID):
    contact = _get_public_landlord_contact(public_key)
    user = contact.user
    return {
        "public_key": str(contact.public_key),
        "name": user.get_full_name() or user.username,
        "avatar": user.avatar_resolved,
        "phone": user.phone,
        "organization": contact.organization,
        "house_count": get_public_houses_queryset().filter(landlord=contact).count(),
    }


@public_landlord_router.get("/{public_key}/houses/", response=list[PublicHouseListOut], auth=None, summary="获取房东店铺公开房源")
@paginate(LegacyPagination)
def list_public_landlord_houses(request, public_key: UUID):
    contact = _get_public_landlord_contact(public_key)
    return get_public_houses_queryset().filter(landlord=contact)


@public_landlord_router.get("/{public_key}/houses/{house_id}/", response=PublicHouseDetailOut, auth=None, summary="获取房东店铺公开房源详情")
def get_public_landlord_house(request, public_key: UUID, house_id: int):
    contact = _get_public_landlord_contact(public_key)
    return get_object_or_404(get_public_houses_queryset().filter(landlord=contact), pk=house_id)


@public_router.get("/", response=list[PublicHouseListOut], auth=None, summary="全局搜索公开房源")
@paginate(LegacyPagination)
def list_public_houses(
    request,
    keyword: str | None = Query(None),
    province: str | None = Query(None),
    city: str | None = Query(None),
    district: str | None = Query(None),
    subdistrict: str | None = Query(None),
    estate_id: int | None = Query(None),
    building_id: int | None = Query(None),
    min_rent: Decimal | None = Query(None),
    max_rent: Decimal | None = Query(None),
    min_area: Decimal | None = Query(None),
    max_area: Decimal | None = Query(None),
    bedrooms: int | None = Query(None),
    living_rooms: int | None = Query(None),
    decoration: str | None = Query(None),
    has_elevator_access: bool | None = Query(None),
    tags: list[str] | None = Query(None),
    publisher_slug: str | None = Query(None),
    metro_stations: list[str] | None = Query(None),
    longitude: Decimal | None = Query(None),
    latitude: Decimal | None = Query(None),
    radius_m: int = Query(1000),
    coordinate_system: Literal["gcj02"] | None = Query(None),
    sort: Literal["latest", "rent_asc", "rent_desc", "area_asc", "area_desc", "distance_asc"] = Query("latest"),
):
    if radius_m not in ALLOWED_PUBLIC_HOUSE_RADIUS_M:
        raise HttpError(422, "范围只支持 500、1000、1500、2000 米")
    metro_origins = _resolve_metro_origins(city=city, metro_stations=metro_stations)
    if metro_origins and (longitude is not None or latitude is not None):
        raise HttpError(422, "当前位置与地铁站不能同时作为搜索中心")
    origin = _resolve_nearby_origin(
        longitude=longitude,
        latitude=latitude,
        radius_m=radius_m,
        coordinate_system=coordinate_system,
        require_for_distance=sort == "distance_asc" and not metro_origins,
    )
    return apply_public_house_filters(
        get_public_houses_queryset(),
        keyword=keyword,
        province=province,
        city=city,
        district=district,
        subdistrict=subdistrict,
        estate_id=estate_id,
        building_id=building_id,
        min_rent=min_rent,
        max_rent=max_rent,
        min_area=min_area,
        max_area=max_area,
        bedrooms=bedrooms,
        living_rooms=living_rooms,
        decoration=decoration,
        has_elevator_access=has_elevator_access,
        tags=tags,
        publisher_slug=publisher_slug,
        origin=origin,
        radius_m=radius_m,
        metro_origins=metro_origins,
        sort=sort,
    )


PUBLIC_HOUSE_MAP_MAX_MARKERS = 200
ALLOWED_PUBLIC_HOUSE_RADIUS_M = {500, 1000, 1500, 2000}
PUBLIC_HOUSE_METRO_STATION_LIMIT = 5
PUBLIC_HOUSE_REGIONS_CACHE_KEY = "public-house-regions:v2"
PUBLIC_HOUSE_REGIONS_CACHE_SECONDS = 5 * 60
PUBLIC_HOUSE_REGION_RESOLVE_CACHE_SECONDS = 30 * 24 * 60 * 60


def _unique_names(values: list[str] | None) -> list[str]:
    return list(dict.fromkeys(value.strip() for value in values or [] if value.strip()))


def _resolve_metro_origins(*, city: str | None, metro_stations: list[str] | None) -> list[NamedGeoOrigin]:
    names = _unique_names(metro_stations)
    if not names:
        return []
    if not city:
        raise HttpError(422, "选择地铁站时必须提供完整城市名称")
    if len(names) > PUBLIC_HOUSE_METRO_STATION_LIMIT:
        raise HttpError(422, "最多选择 5 个地铁站")

    active_links = MetroLineStation.objects.filter(is_active=True, line__is_active=True).select_related("line")
    stations = list(
        MetroStation.objects.filter(
            city__name=city,
            city__imported_at__isnull=False,
            name__in=names,
            is_active=True,
            line_links__is_active=True,
            line_links__line__is_active=True,
        )
        .prefetch_related(Prefetch("line_links", queryset=active_links))
        .distinct()
    )
    stations_by_name = {station.name: station for station in stations}
    unknown = [name for name in names if name not in stations_by_name]
    if unknown:
        raise HttpError(422, f"地铁站不存在或已停用：{'、'.join(unknown)}")

    return [
        NamedGeoOrigin(
            name=name,
            location=stations_by_name[name].location,
            line_names=tuple(sorted({link.line.name for link in stations_by_name[name].line_links.all()})),
        )
        for name in names
    ]


def _resolve_nearby_origin(
    *,
    longitude: Decimal | None,
    latitude: Decimal | None,
    radius_m: int,
    coordinate_system: Literal["gcj02"] | None,
    require_for_distance: bool = False,
):
    if longitude is None and latitude is None:
        if require_for_distance:
            raise HttpError(422, "按距离排序时必须提供当前位置")
        return None
    if longitude is None or latitude is None:
        raise HttpError(422, "经度和纬度必须同时提供")
    if coordinate_system != "gcj02":
        raise HttpError(422, "提供当前位置时必须指定 coordinate_system=gcj02")
    if not 100 <= radius_m <= 50000:
        raise HttpError(422, "附近范围必须在 100 到 50000 米之间")
    try:
        return make_wgs84_point(float(longitude), float(latitude), coordinate_system)
    except ValueError as exc:
        raise HttpError(422, str(exc)) from exc


def _public_house_map_level(zoom: int) -> Literal["city", "district", "estate", "building"]:
    if zoom <= 7:
        return "city"
    if zoom <= 10:
        return "district"
    if zoom <= 14:
        return "estate"
    return "building"


def _public_house_map_coordinates(qs, level: Literal["city", "district", "estate", "building"]):
    geometry_field = GeometryField(srid=4326)
    building_geometry = Cast("building__location", output_field=geometry_field)
    if level != "estate":
        return qs.annotate(map_geometry=building_geometry)
    return qs.annotate(
        map_geometry=Case(
            When(building__estate__location__isnull=False, then=Cast("building__estate__location", output_field=geometry_field)),
            default=building_geometry,
            output_field=geometry_field,
        )
    )


def _public_house_map_rows(qs, level: Literal["city", "district", "estate", "building"]):
    common_annotations = {
        "map_location": Centroid(Collect("map_geometry")),
        "house_count": Count("id", distinct=True),
        "min_rent": Min("asking_rent"),
    }
    if level == "city":
        return (
            qs.exclude(building__estate__city="")
            .values("building__estate__province", "building__estate__city")
            .annotate(child_count=Count("building__estate__district", distinct=True), **common_annotations)
            .order_by("-house_count", "building__estate__city")
        )
    if level == "district":
        return (
            qs.exclude(building__estate__district="")
            .values("building__estate__province", "building__estate__city", "building__estate__district")
            .annotate(child_count=Count("building__estate_id", distinct=True), **common_annotations)
            .order_by("-house_count", "building__estate__district")
        )
    if level == "estate":
        return (
            qs.filter(building__estate_id__isnull=False)
            .values(
                "building__estate_id",
                "building__estate__display_name",
                "building__estate__name",
                "building__estate__address",
                "building__estate__city",
                "building__estate__district",
            )
            .annotate(child_count=Count("building_id", distinct=True), **common_annotations)
            .order_by("-house_count", "building__estate__display_name", "building__estate__name")
        )
    return (
        qs.filter(building__location__isnull=False)
        .values(
            "building_id",
            "building__estate_id",
            "building__name",
            "building__address",
            "building__estate__city",
            "building__estate__district",
        )
        .annotate(child_count=Count("id", distinct=True), **common_annotations)
        .order_by("-house_count", "building__name")
    )


def _serialize_public_house_map_marker(row, level: Literal["city", "district", "estate", "building"]):
    city = row.get("building__estate__city") or ""
    district = row.get("building__estate__district") or ""
    if level == "city":
        name = city
        address = row.get("building__estate__province") or ""
        key = f"city:{address}:{city}"
        target_zoom = 9
    elif level == "district":
        name = district
        address = " · ".join(part for part in (city, district) if part)
        key = f"district:{city}:{district}"
        target_zoom = 12
    elif level == "estate":
        name = row.get("building__estate__display_name") or row.get("building__estate__name") or "未命名小区"
        address = row.get("building__estate__address") or ""
        key = f"estate:{row['building__estate_id']}"
        target_zoom = 15
    else:
        name = row.get("building__name") or "未命名楼栋"
        address = row.get("building__address") or ""
        key = f"building:{row['building_id']}"
        target_zoom = 17
    return {
        "key": key,
        "level": level,
        "name": name,
        "address": address,
        "location": serialize_point(row["map_location"]),
        "house_count": row["house_count"],
        "child_count": row["child_count"],
        "min_rent": row["min_rent"],
        "target_zoom": target_zoom,
        "city": city,
        "district": district,
        "estate_id": row.get("building__estate_id"),
        "building_id": row.get("building_id"),
    }


@public_router.get("/map/", response=PublicHouseMapOut, auth=None, summary="按地图视野获取公开房源聚合标点")
def list_public_house_map(
    request,
    zoom: int = Query(8),
    west: Decimal | None = Query(None),
    south: Decimal | None = Query(None),
    east: Decimal | None = Query(None),
    north: Decimal | None = Query(None),
    keyword: str | None = Query(None),
    province: str | None = Query(None),
    city: str | None = Query(None),
    district: str | None = Query(None),
    subdistrict: str | None = Query(None),
    longitude: Decimal | None = Query(None),
    latitude: Decimal | None = Query(None),
    radius_m: int = Query(3000),
    coordinate_system: Literal["gcj02"] = Query(...),
):
    if zoom < 3 or zoom > 20:
        raise HttpError(422, "地图缩放级别无效")
    _validate_map_bounds(west=west, south=south, east=east, north=north)

    origin = _resolve_nearby_origin(
        longitude=longitude,
        latitude=latitude,
        radius_m=radius_m,
        coordinate_system=coordinate_system,
    )
    filtered = apply_public_house_filters(
        get_public_houses_queryset(),
        keyword=keyword,
        province=province,
        city=city,
        district=district,
        subdistrict=subdistrict,
        sort="rent_asc",
    ).order_by()
    level = _public_house_map_level(zoom)
    unlocated_house_count = filtered.filter(building__location__isnull=True).count()
    located = filtered.filter(building__location__isnull=False)
    if origin is not None:
        located = apply_nearby_house_filter(located, origin, radius_m)
    if west is not None:
        try:
            viewport = convert_viewport_to_wgs84(float(west), float(south), float(east), float(north), coordinate_system)
        except ValueError as exc:
            raise HttpError(422, str(exc)) from exc
        located = filter_by_viewport(located, "building__location", viewport)

    visible_house_count = located.count()
    coordinates = _public_house_map_coordinates(located, level)
    rows = list(_public_house_map_rows(coordinates, level)[: PUBLIC_HOUSE_MAP_MAX_MARKERS + 1])
    truncated = len(rows) > PUBLIC_HOUSE_MAP_MAX_MARKERS
    items = [_serialize_public_house_map_marker(row, level) for row in rows[:PUBLIC_HOUSE_MAP_MAX_MARKERS]]
    return {
        "level": level,
        "zoom": zoom,
        "visible_house_count": visible_house_count,
        "marker_count": len(items),
        "unlocated_house_count": unlocated_house_count,
        "truncated": truncated,
        "items": items,
    }


@public_router.get("/regions/", response=PublicHouseRegionsOut, auth=None, summary="获取公开房源地区目录")
def get_public_house_regions(request):
    cached = cache.get(PUBLIC_HOUSE_REGIONS_CACHE_KEY)
    if cached is not None:
        return cached
    result = build_public_house_regions(get_public_houses_queryset())
    cache.set(PUBLIC_HOUSE_REGIONS_CACHE_KEY, result, timeout=PUBLIC_HOUSE_REGIONS_CACHE_SECONDS)
    return result


def _amap_region_component(value) -> str:
    if isinstance(value, str):
        return value.strip()
    if isinstance(value, list):
        return next((item.strip() for item in value if isinstance(item, str) and item.strip()), "")
    return ""


@public_router.get("/regions/resolve/", response=PublicHouseLocatedRegionOut, auth=None, summary="根据坐标解析所在地区")
def resolve_public_house_region(
    request,
    latitude: Decimal,
    longitude: Decimal,
    coordinate_system: Literal["gcj02"] = Query("gcj02"),
):
    if coordinate_system != "gcj02":
        raise HttpError(422, "定位坐标必须使用 coordinate_system=gcj02")
    if not Decimal("-90") <= latitude <= Decimal("90") or not Decimal("-180") <= longitude <= Decimal("180"):
        raise HttpError(422, "经纬度无效")

    normalized_latitude = f"{latitude:.6f}"
    normalized_longitude = f"{longitude:.6f}"
    cache_key = f"public-house-region-resolve:v1:{normalized_longitude}:{normalized_latitude}"
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    key = settings.AMAP_WEB_SERVICE_KEY
    if not key:
        raise HttpError(503, "高德逆地理编码服务未配置")
    try:
        response = requests.get(
            "https://restapi.amap.com/v3/geocode/regeo",
            params={
                "key": key,
                "location": f"{normalized_longitude},{normalized_latitude}",
                "extensions": "base",
                "radius": 1000,
            },
            timeout=5,
        )
        response.raise_for_status()
        payload = response.json()
    except (requests.RequestException, ValueError) as exc:
        raise HttpError(502, "高德逆地理编码服务暂不可用") from exc

    if not isinstance(payload, dict) or payload.get("status") != "1":
        raise HttpError(502, "高德逆地理编码服务暂不可用")
    regeocode = payload.get("regeocode")
    address_component = regeocode.get("addressComponent") if isinstance(regeocode, dict) else None
    if not isinstance(address_component, dict):
        raise HttpError(502, "高德逆地理编码结果无效")

    province = _amap_region_component(address_component.get("province"))
    city = _amap_region_component(address_component.get("city")) or province
    district = _amap_region_component(address_component.get("district"))
    if not province or not city:
        raise HttpError(502, "高德逆地理编码结果无效")
    result = {"province": province, "city": city, "district": district}
    cache.set(cache_key, result, timeout=PUBLIC_HOUSE_REGION_RESOLVE_CACHE_SECONDS)
    return result


@public_router.get("/filters/", response=PublicHouseFiltersOut, auth=None, summary="获取公开房源筛选项")
def get_public_house_filters(request):
    qs = get_public_houses_queryset()
    amounts = qs.aggregate(
        rent_min=Min("asking_rent"),
        rent_max=Max("asking_rent"),
        area_min=Min("area"),
        area_max=Max("area"),
    )
    tag_values: set[str] = set()
    for house_tags, building_tags in qs.values_list("tags", "building__tags"):
        tag_values.update(tag for tag in [*(building_tags or []), *(house_tags or [])] if isinstance(tag, str) and tag.strip())
    return {
        **amounts,
        "provinces": list(qs.exclude(building__estate__province="").values_list("building__estate__province", flat=True).distinct().order_by("building__estate__province")),
        "cities": list(qs.exclude(building__estate__city="").values_list("building__estate__city", flat=True).distinct().order_by("building__estate__city")),
        "districts": list(qs.exclude(building__estate__district="").values_list("building__estate__district", flat=True).distinct().order_by("building__estate__district")),
        "bedrooms": list(qs.exclude(bedrooms__isnull=True).values_list("bedrooms", flat=True).distinct().order_by("bedrooms")),
        "living_rooms": list(qs.exclude(living_rooms__isnull=True).values_list("living_rooms", flat=True).distinct().order_by("living_rooms")),
        "tags": sorted(tag_values),
    }


@public_router.get("/{house_id}/", response=PublicHouseDetailOut, auth=None, summary="获取公开房源详情")
def get_public_house(request, house_id: int):
    return get_object_or_404(get_public_houses_queryset(), pk=house_id)


def _tenant_viewing_records_qs(user):
    signed_lease_qs = Lease.objects.filter(source_viewing_record_id=OuterRef("pk")).order_by("id")
    return (
        ViewingRecord.objects.filter(contact__user=user)
        .select_related("organization", "house__building__estate", "house__building__organization")
        .annotate(signed_lease_id=Subquery(signed_lease_qs.values("id")[:1]))
    )


@tenant_router.get("/viewing-records/", response=list[TenantViewingRecordOut], summary="获取租客个人带看记录")
@paginate(LegacyPagination)
def list_tenant_viewing_records(request, scope: Literal["current", "history"] | None = Query(None)):
    require_authenticated(request)
    qs = _tenant_viewing_records_qs(request.user)
    if scope == "current":
        qs = qs.filter(status=ViewingRecordStatus.SCHEDULED)
    elif scope == "history":
        qs = qs.exclude(status=ViewingRecordStatus.SCHEDULED)
    return qs.order_by("-scheduled_at", "-id")


@tenant_router.post("/contact/", response={201: TenantContactRequestOut}, summary="租客发送预约联系方式")
def create_tenant_contact_request(request, payload: TenantContactRequestIn):
    require_authenticated(request)
    house = get_object_or_404(get_public_houses_queryset(), pk=payload.house_id)
    try:
        notification = send_tenant_contact_request(
            house=house,
            user=request.user,
            channels=payload.channels,
            phone=payload.phone,
            wechat=payload.wechat,
        )
    except TenantContactValidationError as exc:
        raise HttpError(422, str(exc)) from exc
    except TenantContactRecipientUnavailable as exc:
        raise HttpError(409, str(exc)) from exc
    return Status(201, {"notification_id": notification.pk})


@tenant_router.get("/viewing-records/{viewing_record_id}/", response=TenantViewingRecordOut, summary="获取租客个人带看详情")
def get_tenant_viewing_record(request, viewing_record_id: int):
    require_authenticated(request)
    return get_object_or_404(_tenant_viewing_records_qs(request.user), pk=viewing_record_id)


@tenant_router.post("/viewing-records/{viewing_record_id}/cancel/", response=TenantViewingRecordOut, summary="取消租客个人带看预约")
def cancel_tenant_viewing_record(request, viewing_record_id: int):
    require_authenticated(request)
    record = get_object_or_404(_tenant_viewing_records_qs(request.user), pk=viewing_record_id)
    if record.status != ViewingRecordStatus.SCHEDULED:
        raise HttpError(409, "只有已预约的带看可以取消。")
    record.status = ViewingRecordStatus.CANCELED
    record.save(update_fields=["status", "updated_at"])
    return record


def _tenant_leases_qs(user):
    return Lease.objects.filter(tenant__user=user).select_related("organization", "house__building__estate", "house__building__organization")


@tenant_router.get("/leases/", response=list[TenantLeaseOut], summary="获取租客个人租约")
@paginate(LegacyPagination)
def list_tenant_leases(request):
    require_authenticated(request)
    return _tenant_leases_qs(request.user).order_by("-start_date", "-id")


@tenant_router.get("/leases/{lease_id}/", response=TenantLeaseOut, summary="获取租客个人租约详情")
def get_tenant_lease(request, lease_id: int):
    require_authenticated(request)
    return get_object_or_404(_tenant_leases_qs(request.user), pk=lease_id)


@tenant_router.post("/viewing-records/", response={201: TenantViewingRecordOut}, summary="租客预约看房")
def create_tenant_viewing_record(request, payload: TenantViewingRecordIn):
    require_authenticated(request)
    if not request.user.phone_verified or not request.user.phone:
        raise PermissionDenied("预约看房前请先验证手机号。")
    house = get_object_or_404(get_public_houses_queryset(), pk=payload.house_id)
    try:
        contact = get_or_bind_tenant_contact(organization=house.building.organization, user=request.user)
    except TenantContactConflict as exc:
        raise HttpError(409, str(exc)) from exc
    record = ViewingRecord.objects.create(
        organization=house.building.organization,
        house=house,
        contact=contact,
        customer_name=contact.name,
        customer_phone=request.user.phone,
        scheduled_at=payload.scheduled_at,
        notes=payload.notes,
    )
    return Status(201, record)


@router.get("/tag-suggestions/", response=TagSuggestionsOut, summary="获取房源与楼栋标签快捷候选")
def get_property_rental_tag_suggestions(request):
    require_org_selected(request)
    return {"tags": get_tag_suggestions()}


@router.post("/vacancy-sync/", response=VacancySyncOut, summary="预览或执行房表空置同步")
def vacancy_sync(request, payload: VacancySyncIn):
    org = require_org_selected(request)
    building_overrides = [item.model_dump() for item in payload.building_overrides]
    if payload.mode == "preview":
        return build_vacancy_sync_plan(
            org,
            raw_text=payload.raw_text,
            building_overrides=building_overrides,
            ignored_lines=payload.ignored_lines,
        )
    return apply_vacancy_sync(
        org,
        raw_text=payload.raw_text,
        building_overrides=building_overrides,
        ignored_lines=payload.ignored_lines,
        expected_plan_hash=payload.plan_hash,
    )


def _inventory_annotations(house_lookup: str, scope_filter: Q | None = None):
    active_houses = Q(**{f"{house_lookup}__status__in": HOUSE_ACTIVE_STATUSES})
    if scope_filter is not None:
        active_houses &= scope_filter
    return {
        "inventory_total": Count(house_lookup, filter=active_houses, distinct=True),
        "inventory_vacant": Count(house_lookup, filter=active_houses & Q(**{f"{house_lookup}__status": HouseStatus.VACANT}), distinct=True),
        "inventory_listed": Count(house_lookup, filter=active_houses & Q(**{f"{house_lookup}__status": HouseStatus.LISTED}), distinct=True),
        "inventory_rented": Count(house_lookup, filter=active_houses & Q(**{f"{house_lookup}__status": HouseStatus.RENTED}), distinct=True),
        "inventory_renovating": Count(house_lookup, filter=active_houses & Q(**{f"{house_lookup}__status": HouseStatus.RENOVATING}), distinct=True),
    }


def _houses_in_scope(org, user, scope: HouseScope | None):
    qs = House.objects.filter(building__organization=org)
    if scope == "mine":
        member = get_object_or_404(OrganizationMember, organization=org, user=user)
        qs = _filter_responsible_houses(qs, org, member.pk)
    return qs


def _location_from_payload(value):
    if value is None:
        return None
    return make_wgs84_point(value["longitude"], value["latitude"], value["coordinate_system"])


def _payload_model_data(payload, *, exclude_unset: bool = False):
    data = payload.model_dump(exclude_unset=exclude_unset)
    if "location" in data:
        data["location"] = _location_from_payload(data["location"])
    return data


def _patch(obj, payload):
    for field, value in _payload_model_data(payload, exclude_unset=True).items():
        setattr(obj, field, value)
    obj.save()
    return obj


def _get_house_in_org(house_id: int, org):
    return get_object_or_404(House.objects.select_related("building__estate", "landlord"), pk=house_id, building__organization=org)


def _get_contact_in_org(contact_id: int, org):
    return get_object_or_404(Contact, pk=contact_id, organization=org)


def _get_landlord_contact_for_user(request, contact_id: int):
    require_authenticated(request)
    contact = get_object_or_404(
        Contact.objects.select_related("organization"),
        pk=contact_id,
        user=request.user,
        is_active=True,
        organization__is_active=True,
    )
    if ContactRole.LANDLORD not in (contact.roles or []):
        raise Http404
    return contact


def _get_contact_for_new_business(contact_id: int, org, role: str):
    contact = _get_contact_in_org(contact_id, org)
    if not contact.is_active:
        raise HttpError(422, "已停用联系人不能用于新业务")
    if not contact.has_role(role):
        role_label = "房东" if role == ContactRole.LANDLORD else "租客"
        raise HttpError(422, f"联系人必须具备{role_label}角色")
    return contact


def _get_viewing_record_in_org(record_id: int, org):
    return get_object_or_404(ViewingRecord, pk=record_id, organization=org)


def _validate_assignee_in_org(user_id: int | None, org) -> None:
    if user_id is None:
        return
    get_object_or_404(OrganizationMember, organization=org, user_id=user_id)


def _filter_responsible_houses(qs, org, member_id):
    responsibilities = PropertyResponsibility.objects.filter(organization=org)
    return (
        qs.annotate(
            has_landlord_responsibility=Exists(responsibilities.filter(landlord_id=OuterRef("landlord_id"))),
            has_building_responsibility=Exists(responsibilities.filter(building_id=OuterRef("building_id"))),
        )
        .filter(
            Q(has_landlord_responsibility=True, landlord__property_responsibilities__member_id=member_id)
            | Q(
                has_landlord_responsibility=False,
                has_building_responsibility=True,
                building__property_responsibilities__member_id=member_id,
            )
            | Q(
                has_landlord_responsibility=False,
                has_building_responsibility=False,
                building__estate__property_responsibilities__member_id=member_id,
            )
        )
        .distinct()
    )


def _annotate_house_inspection_state(qs, org):
    max_age_days = get_org_inspection_max_age_days(org)
    cutoff = timezone.now() - timedelta(days=max_age_days)
    return qs.annotate(
        inspection_due_at=ExpressionWrapper(F("updated_at") + timedelta(days=max_age_days), output_field=DateTimeField()),
        inspection_max_age_days=Value(max_age_days, output_field=IntegerField()),
        inspection_expired=Case(
            When(updated_at__lt=cutoff, then=Value(True)),
            default=Value(False),
            output_field=BooleanField(),
        ),
    )


def _property_responsibility_members_qs(org):
    assignments = PropertyResponsibility.objects.select_related("landlord", "building__estate", "estate").order_by(
        "landlord__name", "building__estate__name", "building__name", "estate__name", "id"
    )
    responsible_house_count = (
        _filter_responsible_houses(House.objects.filter(building__organization=org), org, OuterRef("pk"))
        .order_by()
        .values("building__organization_id")
        .annotate(total=Count("pk", distinct=True))
        .values("total")
    )
    return (
        OrganizationMember.objects.filter(organization=org)
        .select_related("user")
        .prefetch_related(Prefetch("property_responsibilities", queryset=assignments, to_attr="prefetched_property_responsibilities"))
        .annotate(
            responsible_house_count=Coalesce(
                Subquery(responsible_house_count[:1], output_field=IntegerField()),
                Value(0),
                output_field=IntegerField(),
            )
        )
        .order_by("user__first_name", "user__last_name", "user__username", "pk")
    )


@router.get("/staff-responsibilities/", response=list[PropertyResponsibilityMemberOut], summary="获取员工房源职责列表")
@paginate(LegacyPagination)
def list_staff_responsibilities(
    request,
    keyword: str | None = Query(None),
    team_id: int | None = Query(None),
):
    org = require_org_permission(request, OrganizationPermission.MEMBER_VIEW)
    qs = _property_responsibility_members_qs(org)
    if keyword:
        qs = qs.filter(Q(user__first_name__icontains=keyword) | Q(user__last_name__icontains=keyword) | Q(user__username__icontains=keyword) | Q(user__email__icontains=keyword))
    if team_id is not None:
        team = require_team_permission(request, team_id, TeamPermission.VIEW)
        qs = qs.filter(user__teams=team)
    return qs


@router.get("/staff-responsibilities/summary/", response=PropertyResponsibilitySummaryOut, summary="获取团队员工房源职责汇总")
def get_staff_responsibility_summary(request, team_id: int = Query(...)):
    org = require_org_permission(request, OrganizationPermission.MEMBER_VIEW)
    team = require_team_permission(request, team_id, TeamPermission.VIEW)
    qs = _property_responsibility_members_qs(org).filter(user__teams=team).distinct()
    member_count = qs.count()
    configured_member_count = qs.filter(property_responsibilities__isnull=False).distinct().count()
    responsible_house_count_sum = qs.aggregate(total=Coalesce(Sum("responsible_house_count"), Value(0), output_field=IntegerField()))["total"]
    return {
        "member_count": member_count,
        "configured_member_count": configured_member_count,
        "unconfigured_member_count": member_count - configured_member_count,
        "responsible_house_count_sum": responsible_house_count_sum,
    }


@router.get("/staff-responsibilities/{member_id}/", response=PropertyResponsibilityMemberOut, summary="获取员工房源职责")
def get_staff_responsibility(request, member_id: int):
    org = require_org_permission(request, OrganizationPermission.MEMBER_VIEW)
    return get_object_or_404(_property_responsibility_members_qs(org), pk=member_id)


@router.put("/staff-responsibilities/{member_id}/", response=PropertyResponsibilityMemberOut, summary="替换员工房源职责")
def replace_staff_responsibilities(request, member_id: int, payload: PropertyResponsibilityUpdateIn):
    org = require_org_permission(request, OrganizationPermission.MEMBER_MANAGE)
    member = get_object_or_404(OrganizationMember.objects.select_related("user"), pk=member_id, organization=org)
    landlord_ids = list(dict.fromkeys(payload.landlord_ids))
    building_ids = list(dict.fromkeys(payload.building_ids))
    estate_ids = list(dict.fromkeys(payload.estate_ids))
    landlords = list(Contact.objects.filter(pk__in=landlord_ids, organization=org, is_active=True))
    buildings = list(Building.objects.filter(pk__in=building_ids, organization=org).select_related("estate"))
    estates = list(Estate.objects.filter(pk__in=estate_ids, organization=org))
    if len(landlords) != len(landlord_ids) or any(not landlord.has_role(ContactRole.LANDLORD) for landlord in landlords):
        raise HttpError(422, "房东职责目标无效、已停用或不属于当前组织")
    if len(buildings) != len(building_ids):
        raise HttpError(422, "楼栋职责目标无效或不属于当前组织")
    if len(estates) != len(estate_ids):
        raise HttpError(422, "小区职责目标无效或不属于当前组织")

    with transaction.atomic():
        PropertyResponsibility.objects.filter(organization=org, member=member).delete()
        audit_fields = {"created_by": request.user.username, "updated_by": request.user.username}
        for landlord in landlords:
            PropertyResponsibility.objects.create(organization=org, member=member, landlord=landlord, **audit_fields)
        for building in buildings:
            PropertyResponsibility.objects.create(organization=org, member=member, building=building, **audit_fields)
        for estate in estates:
            PropertyResponsibility.objects.create(organization=org, member=member, estate=estate, **audit_fields)
    return _property_responsibility_members_qs(org).get(pk=member.pk)


@router.get("/estates/", response=list[EstateDetailOut], summary="获取项目片区列表")
@paginate(LegacyPagination)
def list_estates(request, keyword: str | None = Query(None), scope: HouseScope | None = Query(None)):
    org = require_org_selected(request)
    scoped_houses = _houses_in_scope(org, request.user, scope)
    scope_filter = Q(buildings__houses__in=scoped_houses) if scope == "mine" else None
    qs = (
        Estate.objects.filter(organization=org)
        .annotate(
            building_count=Count("buildings", filter=scope_filter, distinct=True),
            **_inventory_annotations("buildings__houses", scope_filter),
        )
        .order_by("name", "id")
    )
    if scope == "mine":
        qs = qs.filter(buildings__houses__in=scoped_houses).distinct()
    if keyword:
        qs = qs.filter(Q(name__icontains=keyword) | Q(display_name__icontains=keyword))
    return qs


@router.post("/estates/", response={201: EstateOut}, summary="创建项目片区")
def create_estate(request, payload: EstateIn):
    org = require_org_selected(request)
    estate = Estate.objects.create(organization=org, **_payload_model_data(payload))
    return Status(201, estate)


@router.get("/estates/{estate_id}/", response=EstateDetailOut, summary="获取项目片区详情")
def get_estate(request, estate_id: int):
    org = require_org_selected(request)
    return get_object_or_404(
        Estate.objects.filter(pk=estate_id, organization=org).annotate(
            building_count=Count("buildings", distinct=True),
            **_inventory_annotations("buildings__houses"),
        ),
    )


@router.get("/estates/{estate_id}/delete-check/", response=DeleteCheckOut, summary="检查项目片区删除关联资源")
def check_estate_delete(request, estate_id: int):
    return get_estate_delete_check(get_estate(request, estate_id))


@router.patch("/estates/{estate_id}/", response=EstateOut, summary="更新项目片区")
def patch_estate(request, estate_id: int, payload: EstatePatchIn):
    return _patch(get_estate(request, estate_id), payload)


@router.delete("/estates/{estate_id}/", response={200: dict}, summary="删除项目片区")
def delete_estate_endpoint(request, estate_id: int):
    org = require_org_selected(request)
    return {"deleted": delete_estate(org, estate_id)}


@router.get("/buildings/", response=list[BuildingInventoryOut], summary="获取楼栋列表")
@paginate(LegacyPagination)
def list_buildings(
    request,
    estate_id: int | None = Query(None),
    keyword: str | None = Query(None),
    scope: HouseScope | None = Query(None),
):
    org = require_org_selected(request)
    scoped_houses = _houses_in_scope(org, request.user, scope)
    scope_filter = Q(houses__in=scoped_houses) if scope == "mine" else None
    qs = Building.objects.filter(organization=org).select_related("estate").annotate(**_inventory_annotations("houses", scope_filter)).order_by("estate__name", "name")
    if scope == "mine":
        qs = qs.filter(houses__in=scoped_houses).distinct()
    if estate_id:
        qs = qs.filter(estate_id=estate_id)
    if keyword:
        qs = qs.filter(Q(name__icontains=keyword) | Q(address__icontains=keyword) | Q(estate__name__icontains=keyword) | Q(estate__display_name__icontains=keyword))
    return qs


@router.post("/buildings/", response={201: BuildingOut}, summary="创建楼栋")
def create_building(request, payload: BuildingIn):
    org = require_org_selected(request)
    data = _payload_model_data(payload)
    estate_id = data.pop("estate_id")
    estate = get_object_or_404(Estate, pk=estate_id, organization=org) if estate_id is not None else None
    building = Building.objects.create(organization=org, estate=estate, **data)
    return Status(201, building)


@router.get("/buildings/{building_id}/", response=BuildingInventoryOut, summary="获取楼栋详情")
def get_building(request, building_id: int):
    org = require_org_selected(request)
    return get_object_or_404(Building.objects.select_related("estate").annotate(**_inventory_annotations("houses")), pk=building_id, organization=org)


@router.get("/buildings/{building_id}/delete-check/", response=DeleteCheckOut, summary="检查楼栋删除关联资源")
def check_building_delete(request, building_id: int):
    return get_building_delete_check(get_building(request, building_id))


@router.patch("/buildings/{building_id}/", response=BuildingOut, summary="更新楼栋")
def patch_building(request, building_id: int, payload: BuildingPatchIn):
    building = get_building(request, building_id)
    data = _payload_model_data(payload, exclude_unset=True)
    if "estate_id" in data:
        estate_id = data.pop("estate_id")
        building.estate = get_object_or_404(Estate, pk=estate_id, organization=building.organization) if estate_id is not None else None
    for field, value in data.items():
        setattr(building, field, value)
    building.save()
    return building


@router.delete("/buildings/{building_id}/", response={200: dict}, summary="删除楼栋")
def delete_building_endpoint(request, building_id: int):
    org = require_org_selected(request)
    return {"deleted": delete_building(org, building_id)}


@router.get("/default-building/", response=DefaultBuildingOut, summary="获取默认楼栋")
def get_default_building(request):
    org = require_org_selected(request)
    building = ensure_default_building(org)
    return {
        "id": building.pk,
        "estate_id": building.estate_id,
        "estate": building.estate,
        "name": building.name,
        "floors": building.floors,
        "address": building.address,
    }


@router.put("/default-building/", response=DefaultBuildingOut, summary="设置默认楼栋")
def put_default_building(request, payload: DefaultBuildingIn):
    org = require_org_selected(request)
    get_object_or_404(Building, pk=payload.building_id, organization=org)
    building = set_default_building(org, payload.building_id)
    return {
        "id": building.pk,
        "estate_id": building.estate_id,
        "estate": building.estate,
        "name": building.name,
        "floors": building.floors,
        "address": building.address,
    }


def _building_map_queryset(org, *, house_status: str | None, located: bool = True):
    qs = Building.objects.filter(organization=org).select_related("estate")
    qs = qs.filter(location__isnull=False) if located else qs.filter(location__isnull=True)
    if house_status:
        qs = qs.filter(Exists(House.objects.filter(building_id=OuterRef("pk"), status=house_status)))
    return qs.annotate(
        **_map_count_annotations("houses", Q(houses__status__in=HOUSE_ACTIVE_STATUSES)),
    )


def _filter_building_map_queryset(qs, *, keyword: str | None, estate_id: int | None):
    if estate_id is not None:
        qs = qs.filter(estate_id=estate_id)
    if keyword:
        qs = qs.filter(
            Q(name__icontains=keyword)
            | Q(address__icontains=keyword)
            | Q(estate__name__icontains=keyword)
            | Q(estate__display_name__icontains=keyword)
            | Q(estate__address__icontains=keyword)
        )
    return qs


def _map_count_annotations(house_lookup: str, active_houses: Q):
    return {
        "total": Count(house_lookup, filter=active_houses, distinct=True),
        "vacant": Count(house_lookup, filter=active_houses & Q(**{f"{house_lookup}__status": HouseStatus.VACANT}), distinct=True),
        "listed": Count(house_lookup, filter=active_houses & Q(**{f"{house_lookup}__status": HouseStatus.LISTED}), distinct=True),
        "rented": Count(house_lookup, filter=active_houses & Q(**{f"{house_lookup}__status": HouseStatus.RENTED}), distinct=True),
        "renovating": Count(house_lookup, filter=active_houses & Q(**{f"{house_lookup}__status": HouseStatus.RENOVATING}), distinct=True),
    }


def _validate_map_bounds(*, west: Decimal | None, south: Decimal | None, east: Decimal | None, north: Decimal | None) -> None:
    bounds = (west, south, east, north)
    if not any(value is not None for value in bounds):
        return
    if west is None or south is None or east is None or north is None or west >= east or south >= north:
        raise HttpError(422, "地图范围无效")


def _estate_map_queryset(org, *, keyword: str | None, estate_id: int | None, house_status: str | None):
    eligible_buildings = Building.objects.filter(organization=org, estate_id=OuterRef("pk"))

    geometry_field = GeometryField(srid=4326)
    located_buildings = eligible_buildings.filter(location__isnull=False)
    building_centroid = located_buildings.order_by().values("estate_id").annotate(point=Centroid(Collect(Cast("location", output_field=geometry_field)))).values("point")

    qs = Estate.objects.filter(organization=org).filter(Exists(eligible_buildings))
    if estate_id is not None:
        qs = qs.filter(pk=estate_id)
    if keyword:
        keyword_buildings = eligible_buildings.filter(Q(name__icontains=keyword) | Q(address__icontains=keyword))
        qs = qs.filter(Q(name__icontains=keyword) | Q(display_name__icontains=keyword) | Q(address__icontains=keyword) | Exists(keyword_buildings))
    if house_status:
        matching_houses = House.objects.filter(
            building__organization=org,
            building__estate_id=OuterRef("pk"),
            status=house_status,
        )
        qs = qs.filter(Exists(matching_houses))

    eligible_building_filter = Q(buildings__pk__isnull=False)
    active_houses = eligible_building_filter & Q(buildings__houses__status__in=HOUSE_ACTIVE_STATUSES)
    qs = qs.annotate(
        map_location=Case(
            When(location__isnull=False, then=Cast("location", output_field=geometry_field)),
            default=Subquery(building_centroid[:1], output_field=geometry_field),
            output_field=geometry_field,
        ),
        location_source=Case(
            When(location__isnull=False, then=Value("estate")),
            default=Value("building_centroid"),
            output_field=CharField(),
        ),
        building_count=Count("buildings", filter=eligible_building_filter, distinct=True),
        located_building_count=Count(
            "buildings",
            filter=eligible_building_filter & Q(buildings__location__isnull=False),
            distinct=True,
        ),
        unlocated_building_count=Count(
            "buildings",
            filter=eligible_building_filter & Q(buildings__location__isnull=True),
            distinct=True,
        ),
        **_map_count_annotations("buildings__houses", active_houses),
    ).filter(map_location__isnull=False)
    return qs


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
    _validate_map_bounds(west=west, south=south, east=east, north=north)
    org = require_org_selected(request)
    qs = _estate_map_queryset(org, keyword=keyword, estate_id=estate_id, house_status=house_status)
    if west is not None:
        viewport = convert_viewport_to_wgs84(float(west), float(south), float(east), float(north), coordinate_system)
        qs = filter_by_viewport(qs, "map_location", viewport)
    return qs.order_by("display_name", "id")


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
    _validate_map_bounds(west=west, south=south, east=east, north=north)

    org = require_org_selected(request)
    qs = _building_map_queryset(org, house_status=house_status)
    qs = _filter_building_map_queryset(qs, keyword=keyword, estate_id=estate_id)
    if standalone_only:
        qs = qs.filter(estate__isnull=True)
    if west is not None:
        viewport = convert_viewport_to_wgs84(float(west), float(south), float(east), float(north), coordinate_system)
        qs = filter_by_viewport(qs, "location", viewport)
    return qs.order_by("name", "id")


@router.get("/building-map-unlocated/", response=list[BuildingMapUnlocatedOut], summary="获取待定位楼栋列表")
@paginate(LegacyPagination)
def list_building_map_unlocated(
    request,
    keyword: str | None = Query(None),
    estate_id: int | None = Query(None),
    house_status: str | None = Query(None),
):
    org = require_org_selected(request)
    qs = _building_map_queryset(org, house_status=house_status, located=False)
    return _filter_building_map_queryset(qs, keyword=keyword, estate_id=estate_id).order_by("name", "id")


@router.get("/building-map-unlocated-count/", response=BuildingMapUnlocatedCountOut, summary="获取待定位楼栋数量")
def get_building_map_unlocated_count(request):
    org = require_org_selected(request)
    return {"count": Building.objects.filter(organization=org, location__isnull=True).count()}


@router.get("/building-map/{building_id}/", response=BuildingMapDetailOut, summary="获取楼栋房源地图详情")
def get_building_map_detail(request, building_id: int):
    org = require_org_selected(request)
    building = get_object_or_404(Building.objects.select_related("estate"), pk=building_id, organization=org)
    houses = sort_houses_for_building(building.houses.filter(status__in=HOUSE_ACTIVE_STATUSES))
    return {
        "id": building.pk,
        "estate_id": building.estate_id,
        "estate": building.estate,
        "name": building.name,
        "floors": building.floors,
        "under_floors": building.under_floors,
        "year_built": building.year_built,
        "elevator": building.elevator,
        "location": serialize_point(building.location),
        "address": building.address,
        "images": building.images_resolved,
        "tags": building.tags,
        "counts": building_map_counts(houses),
        "houses": [
            {
                "id": house.pk,
                "room_number": house.room_number,
                "floor": house.floor,
                "area": house.area,
                "asking_rent": house.asking_rent,
                "status": house.status,
                "status__mapping": HouseStatus.get_choice_label(house.status),
            }
            for house in houses
        ],
    }


@router.get("/contacts/", response=list[ContactOut], summary="获取联系人列表")
@paginate(LegacyPagination)
def list_contacts(request, role: str | None = Query(None), task: str | None = Query(None), keyword: str | None = Query(None)):
    org = require_org_selected(request)
    qs = Contact.objects.filter(organization=org).order_by("name", "id")
    role_missing_task = task in {"role_missing", "role_missing_active", "role_missing_inactive"}
    if task in {"active", "role_missing_active"}:
        qs = qs.filter(is_active=True)
    elif task in {"inactive", "role_missing_inactive"}:
        qs = qs.filter(is_active=False)
    if keyword:
        qs = qs.filter(Q(name__icontains=keyword) | Q(phone__icontains=keyword) | Q(email__icontains=keyword))
    if role or task == "dual_role" or role_missing_task:
        contacts = list(qs)
        if role:
            contacts = [contact for contact in contacts if role in (contact.roles or [])]
        if task == "dual_role":
            contacts = [contact for contact in contacts if {ContactRole.LANDLORD, ContactRole.TENANT}.issubset(set(contact.roles or []))]
        if role_missing_task:
            contacts = [contact for contact in contacts if not (contact.roles or [])]
        return contacts
    return qs


@router.post("/contacts/", response={201: ContactOut}, summary="创建联系人")
def create_contact(request, payload: ContactIn):
    org = require_org_selected(request)
    data = payload.model_dump(exclude_unset=True)
    contact = Contact.objects.create(organization=org, **data)
    return Status(201, contact)


@router.get("/contacts/{contact_id}/", response=ContactOut, summary="获取联系人详情")
def get_contact(request, contact_id: int):
    org = require_org_selected(request)
    return get_object_or_404(Contact, pk=contact_id, organization=org)


@router.patch("/contacts/{contact_id}/", response=ContactOut, summary="更新联系人")
def patch_contact(request, contact_id: int, payload: ContactPatchIn):
    data = payload.model_dump(exclude_unset=True)
    contact = get_contact(request, contact_id)
    for field, value in data.items():
        setattr(contact, field, value)
    contact.save()
    return contact


@router.post("/contacts/{contact_id}/landlord-invite/", response=LandlordInvitationOut, summary="邀请房东绑定账号")
def invite_landlord_contact(request, contact_id: int, delivery_method: Literal["sms", "manual"] = Query("sms")):
    org = require_org_selected(request)
    contact = _get_contact_in_org(contact_id, org)
    if not contact.is_active:
        raise HttpError(422, "已停用联系人不能邀请房东。")
    if ContactRole.LANDLORD not in (contact.roles or []):
        raise HttpError(422, "联系人必须具备房东角色。")
    if contact.user_id:
        raise HttpError(409, "该房东联系人已绑定账号。")
    try:
        normalize_invitation_phone(contact.phone)
        invitation = create_landlord_invitation(contact=contact, inviter=request.user)
    except ValueError as err:
        raise HttpError(422, str(err)) from err
    except LandlordInvitationCacheError as err:
        raise HttpError(503, str(err)) from err

    expires_at = invitation_expires_at(invitation)
    if expires_at is None:
        raise HttpError(503, "房东邀请失效时间无效。")
    action_url = invitation_action_url(invitation["token"], expires_at)
    if delivery_method == "sms":
        send_invitation_sms(invitation["phone"], action_url, LANDLORD_INVITATION_VALID_DAYS)
    return {
        "organization_name": org.name,
        "contact_name": contact.name,
        "invitee_phone_masked": mask_phone(invitation["phone"]),
        "expires_at": expires_at,
        "action_url": action_url,
    }


@router.get("/houses/", response=list[HouseOut], summary="获取房源列表")
@paginate(LegacyPagination)
def list_houses(
    request,
    estate_id: int | None = Query(None),
    building_id: int | None = Query(None),
    responsible_member_id: int | None = Query(None),
    scope: HouseScope | None = Query(None),
    responsibility: Literal["mine"] | None = Query(None),
    inspection_due: bool = Query(False),
    inspection_reason: HouseInspectionReason | None = Query(None),
    status: HouseStatusValue | None = Query(None),
    keyword: str | None = Query(None),
    ordering: str = Query(
        HOUSE_DEFAULT_ORDERING,
        description=HOUSE_ORDERING_DESCRIPTION,
        pattern=HOUSE_ORDERING_PATTERN,
        example="-asking_rent,room_number",
    ),
):
    org = require_org_selected(request)
    if scope == "all" and responsibility == "mine":
        raise HttpError(422, "scope=all 与 responsibility=mine 不能同时使用")
    effective_scope = scope or ("mine" if responsibility == "mine" else "all")
    if effective_scope == "mine" and responsible_member_id is not None:
        raise HttpError(422, "scope=mine 与 responsible_member_id 不能同时使用")
    qs = House.objects.filter(building__organization=org).select_related("building__estate", "landlord")
    if estate_id:
        qs = qs.filter(building__estate_id=estate_id)
    if building_id:
        qs = qs.filter(building_id=building_id)
    if responsible_member_id is not None:
        member = get_object_or_404(OrganizationMember, pk=responsible_member_id, organization=org)
        qs = _filter_responsible_houses(qs, org, member.pk)
    if effective_scope == "mine":
        member = get_object_or_404(OrganizationMember, organization=org, user=request.user)
        qs = _filter_responsible_houses(qs, org, member.pk)
    if inspection_due or inspection_reason:
        qs = _annotate_house_inspection_state(qs, org)
    if inspection_due:
        qs = qs.filter(Q(images=[]) | Q(videos=[]) | Q(inspection_expired=True))
    if inspection_reason == "missing_images":
        qs = qs.filter(images=[])
    elif inspection_reason == "missing_videos":
        qs = qs.filter(videos=[])
    elif inspection_reason == "expired":
        qs = qs.filter(inspection_expired=True)
    if status:
        qs = qs.filter(status=status)
    if keyword:
        qs = qs.filter(
            Q(room_number__icontains=keyword)
            | Q(building__name__icontains=keyword)
            | Q(building__estate__name__icontains=keyword)
            | Q(building__estate__display_name__icontains=keyword)
            | Q(landlord__name__icontains=keyword)
            | Q(landlord__phone__icontains=keyword)
        )
    return apply_house_ordering(qs, ordering)


@router.post("/houses/", response={201: HouseOut}, summary="创建房源")
def create_house(request, payload: HouseIn):
    org = require_org_selected(request)
    from apps.subscriptions.entitlements import EntitlementService

    EntitlementService.check_can_add(org, "house")
    building = get_object_or_404(Building, pk=payload.building_id, organization=org)
    data = payload.model_dump()
    data.pop("building_id")
    landlord_id = data.pop("landlord_id", None)
    landlord = _get_contact_for_new_business(landlord_id, org, ContactRole.LANDLORD) if landlord_id is not None else None
    if landlord is not None:
        data["landlord"] = landlord
    house = House.objects.create(building=building, **data)
    return Status(201, house)


@router.get("/houses/{house_id}/", response=HouseOut, summary="获取房源详情")
def get_house(request, house_id: int):
    org = require_org_selected(request)
    return _get_house_in_org(house_id, org)


@router.get("/houses/{house_id}/ai-insight/", response=HouseAIInsightOut, summary="获取房源 AI 洞察")
def get_house_ai_insight_endpoint(request, house_id: int):
    org = require_org_selected(request)
    house = _get_house_in_org(house_id, org)
    return _house_ai_call(get_house_ai_insight, actor=request.user, organization=org, house=house)


@router.post("/houses/{house_id}/ai-insight/generate/", response=HouseAIInsightOut, summary="生成房源 AI 洞察")
def generate_house_ai_insight_endpoint(request, house_id: int):
    org = require_org_selected(request)
    house = _get_house_in_org(house_id, org)
    return _house_ai_call(generate_house_ai_insight, actor=request.user, organization=org, house=house)


@router.patch("/houses/{house_id}/", response=HouseOut, summary="更新房源")
def patch_house(request, house_id: int, payload: HousePatchIn):
    house = get_house(request, house_id)
    previous_status = house.status
    data = payload.model_dump(exclude_unset=True)
    data.pop("confirm_current", False)
    building_id = data.pop("building_id", None)
    if building_id is not None:
        house.building = get_object_or_404(Building, pk=building_id, organization=house.organization)
    if "landlord_id" in data:
        landlord_id = data.pop("landlord_id")
        if landlord_id is None:
            house.landlord = None
        elif landlord_id != house.landlord_id:
            house.landlord = _get_contact_for_new_business(landlord_id, house.organization, ContactRole.LANDLORD)
    for field, value in data.items():
        setattr(house, field, value)
    if previous_status != HouseStatus.LISTED and house.status == HouseStatus.LISTED:
        publish_state = evaluate_house_publish_state(house, get_org_house_publish_rules(house.organization))
        if publish_state["blocking_issues"]:
            raise HttpError(422, f"房源暂不能发布：{'、'.join(publish_state['blocking_issues'])}")
    house.save()
    return house


def _viewing_records_qs(org):
    signed_lease_qs = Lease.objects.filter(source_viewing_record_id=OuterRef("pk")).order_by("id")
    return (
        ViewingRecord.objects.filter(organization=org)
        .select_related("house__building__estate", "contact", "assigned_to")
        .annotate(signed_lease_id=Subquery(signed_lease_qs.values("id")[:1]))
    )


@router.get("/viewing-records/", response=list[ViewingRecordOut], summary="获取带看记录列表")
@paginate(LegacyPagination)
def list_viewing_records(
    request,
    house_id: int | None = Query(None),
    status: str | None = Query(None),
    pending_lease: bool | None = Query(None),
    contact_missing: bool | None = Query(None),
    keyword: str | None = Query(None),
):
    org = require_org_selected(request)
    qs = _viewing_records_qs(org).order_by("-scheduled_at", "-id")
    if house_id:
        qs = qs.filter(house_id=house_id)
    if status:
        qs = qs.filter(status=status)
    if pending_lease:
        qs = qs.filter(status=ViewingRecordStatus.CONVERTED, converted_leases__isnull=True)
    if contact_missing is not None:
        qs = qs.filter(contact__isnull=contact_missing)
    if keyword:
        qs = qs.filter(
            Q(customer_name__icontains=keyword)
            | Q(customer_phone__icontains=keyword)
            | Q(contact__name__icontains=keyword)
            | Q(contact__phone__icontains=keyword)
            | Q(house__room_number__icontains=keyword)
            | Q(house__building__name__icontains=keyword)
            | Q(house__building__estate__name__icontains=keyword)
            | Q(house__building__estate__display_name__icontains=keyword)
        )
    return qs


@router.get("/viewing-records/{record_id}/", response=ViewingRecordOut, summary="获取带看记录详情")
def get_viewing_record(request, record_id: int):
    org = require_org_selected(request)
    return get_object_or_404(_viewing_records_qs(org), pk=record_id)


@router.post("/viewing-records/", response={201: ViewingRecordOut}, summary="创建带看记录")
def create_viewing_record(request, payload: ViewingRecordIn):
    org = require_org_selected(request)
    data = payload.model_dump()
    house_id = data.pop("house_id")
    contact_id = data.pop("contact_id", None)
    _validate_assignee_in_org(data.get("assigned_to_id"), org)
    data["house"] = _get_house_in_org(house_id, org)
    if contact_id is not None:
        data["contact"] = _get_contact_for_new_business(contact_id, org, ContactRole.TENANT)
    record = ViewingRecord.objects.create(organization=org, **data)
    return Status(201, record)


@router.patch("/viewing-records/{record_id}/", response=ViewingRecordOut, summary="更新带看记录")
def patch_viewing_record(request, record_id: int, payload: ViewingRecordPatchIn):
    org = require_org_selected(request)
    record = get_object_or_404(ViewingRecord.objects.select_related("house__building__estate", "contact", "assigned_to"), pk=record_id, organization=org)
    data = payload.model_dump(exclude_unset=True)
    if "house_id" in data:
        record.house = _get_house_in_org(data.pop("house_id"), org)
    if "contact_id" in data:
        contact_id = data.pop("contact_id")
        if contact_id is None:
            record.contact = None
        elif contact_id != record.contact_id:
            record.contact = _get_contact_for_new_business(contact_id, org, ContactRole.TENANT)
    if "assigned_to_id" in data:
        _validate_assignee_in_org(data["assigned_to_id"], org)
    for field, value in data.items():
        setattr(record, field, value)
    record.save()
    return record


@router.get("/leases/", response=list[LeaseOut], summary="获取租约列表")
@paginate(LegacyPagination)
def list_leases(
    request,
    house_id: int | None = Query(None),
    status: str | None = Query(None),
    contract_missing: bool | None = Query(None),
    keyword: str | None = Query(None),
):
    org = require_org_selected(request)
    qs = Lease.objects.filter(organization=org).select_related("house__building__estate", "tenant", "source_viewing_record").order_by("-start_date", "-id")
    if house_id:
        qs = qs.filter(house_id=house_id)
    if status:
        qs = qs.filter(status=status)
    if keyword:
        qs = qs.filter(
            Q(house__room_number__icontains=keyword)
            | Q(house__building__name__icontains=keyword)
            | Q(house__building__estate__name__icontains=keyword)
            | Q(house__building__estate__display_name__icontains=keyword)
            | Q(tenant__name__icontains=keyword)
            | Q(tenant__phone__icontains=keyword)
        )
    if contract_missing:
        qs = qs.filter(contract_files=[])
    return qs


@router.post("/leases/", response={201: LeaseOut}, summary="创建租约")
def create_lease(request, payload: LeaseIn):
    org = require_org_selected(request)
    data = payload.model_dump()
    house_id = data.pop("house_id")
    tenant_id = data.pop("tenant_id")
    source_viewing_record_id = data.pop("source_viewing_record_id", None)
    data["house"] = _get_house_in_org(house_id, org)
    data["tenant"] = _get_contact_for_new_business(tenant_id, org, ContactRole.TENANT)
    if source_viewing_record_id is not None:
        data["source_viewing_record"] = _get_viewing_record_in_org(source_viewing_record_id, org)
    lease = Lease.objects.create(organization=org, **data)
    return Status(201, lease)


def _create_lease_allocation_from_payload(request, payload: LeaseWithAllocationIn):
    org = require_org_permission(request, AllocationPermission.SUBMIT)
    beneficiary_user_ids = sorted(set(payload.beneficiary_user_ids))
    if not has_permission(request.user, org, AllocationPermission.CHANGE_BENEFICIARIES) and beneficiary_user_ids != [request.user.pk]:
        raise PermissionDenied("你没有修改收益受益人的权限。")

    lease_data = payload.lease.model_dump()
    house_id = lease_data.pop("house_id")
    tenant_id = lease_data.pop("tenant_id")
    source_viewing_record_id = lease_data.pop("source_viewing_record_id", None)
    lease_data["house"] = _get_house_in_org(house_id, org)
    lease_data["tenant"] = _get_contact_for_new_business(tenant_id, org, ContactRole.TENANT)
    if source_viewing_record_id is not None:
        lease_data["source_viewing_record"] = _get_viewing_record_in_org(source_viewing_record_id, org)
    return create_lease_with_allocation(
        organization=org,
        submitted_by=request.user,
        lease_data=lease_data,
        beneficiary_user_ids=beneficiary_user_ids,
        team_id=payload.team_id,
    )


@transaction.atomic
def _create_deal_signing_allocation_from_payload(request, payload: DealSigningWithAllocationIn):
    org = require_org_permission(request, AllocationPermission.SUBMIT)
    beneficiary_user_ids = sorted(set(payload.beneficiary_user_ids))
    if not has_permission(request.user, org, AllocationPermission.CHANGE_BENEFICIARIES) and beneficiary_user_ids != [request.user.pk]:
        raise PermissionDenied("你没有修改收益受益人的权限。")

    lease_data = payload.lease.model_dump()
    house_id = lease_data.pop("house_id")
    tenant_id = lease_data.pop("tenant_id")
    tenant_identity = lease_data.pop("tenant_identity")
    source_viewing_record_id = lease_data.pop("source_viewing_record_id", None)
    lease_data["house"] = _get_house_in_org(house_id, org)
    if tenant_id is not None:
        lease_data["tenant"] = _get_contact_for_new_business(tenant_id, org, ContactRole.TENANT)
    else:
        lease_data["tenant"] = resolve_deal_signing_tenant(organization=org, **tenant_identity)
    if source_viewing_record_id is not None:
        lease_data["source_viewing_record"] = _get_viewing_record_in_org(source_viewing_record_id, org)
    return create_lease_with_allocation(
        organization=org,
        submitted_by=request.user,
        lease_data=lease_data,
        beneficiary_user_ids=beneficiary_user_ids,
        team_id=payload.team_id,
    )


@router.post("/leases/deal-signing/", response={201: LeaseAllocationOut}, summary="登记签约并提交收益分配申请")
def deal_signing(request, payload: DealSigningWithAllocationIn):
    return Status(201, _create_deal_signing_allocation_from_payload(request, payload))


@router.post("/leases/with-allocation/", response={201: LeaseAllocationOut}, summary="创建租约并提交收益分配申请")
def create_lease_and_allocation(request, payload: LeaseWithAllocationIn):
    return Status(201, _create_lease_allocation_from_payload(request, payload))


@router.get("/lease-allocations/", response=list[LeaseAllocationOut], summary="获取租约收益分配申请列表")
@paginate(LegacyPagination)
def list_lease_allocations(
    request,
    status: str | None = Query(None),
    keyword: str | None = Query(None),
    submitted_by_id: int | None = Query(None),
    beneficiary_user_id: int | None = Query(None),
):
    org = require_org_selected(request)
    if not OrganizationMember.objects.filter(organization=org, user=request.user, user__is_active=True).exists():
        raise PermissionDenied("你不是当前组织的有效成员。")
    qs = (
        LeaseAllocation.objects.filter(lease__organization=org)
        .select_related(
            "lease__house__building__estate",
            "lease__tenant",
            "lease__source_viewing_record",
            "allocation_request__organization",
            "allocation_request__team",
            "allocation_request__submitted_by",
            "allocation_request__reviewed_by",
            "allocation_request__voided_by",
        )
        .prefetch_related("allocation_request__items", "allocation_request__shares__beneficiary_user")
        .order_by("-allocation_request__submitted_at", "-pk")
    )
    if not has_permission(request.user, org, AllocationPermission.VIEW):
        qs = qs.filter(Q(allocation_request__submitted_by=request.user) | Q(allocation_request__shares__beneficiary_user=request.user)).distinct()
    if status:
        qs = qs.filter(allocation_request__status=status)
    if submitted_by_id:
        qs = qs.filter(allocation_request__submitted_by_id=submitted_by_id)
    if beneficiary_user_id:
        qs = qs.filter(allocation_request__shares__beneficiary_user_id=beneficiary_user_id).distinct()
    if keyword:
        qs = qs.filter(
            Q(lease__house__room_number__icontains=keyword)
            | Q(lease__house__building__name__icontains=keyword)
            | Q(lease__house__building__estate__name__icontains=keyword)
            | Q(lease__house__building__estate__display_name__icontains=keyword)
            | Q(lease__tenant__name__icontains=keyword)
            | Q(allocation_request__submitted_by_name_snapshot__icontains=keyword)
            | Q(allocation_request__shares__beneficiary_name_snapshot__icontains=keyword)
        ).distinct()
    return qs


@router.get("/leases/{lease_id}/", response=LeaseOut, summary="获取租约详情")
def get_lease(request, lease_id: int):
    org = require_org_selected(request)
    return get_object_or_404(Lease.objects.select_related("house__building__estate", "tenant", "source_viewing_record"), pk=lease_id, organization=org)


@router.get("/leases/{lease_id}/allocation/", response=LeaseAllocationOut, summary="获取租约收益分配申请")
def get_lease_allocation_request(request, lease_id: int):
    org = require_org_selected(request)
    if not OrganizationMember.objects.filter(organization=org, user=request.user, user__is_active=True).exists():
        raise PermissionDenied("你不是当前组织的有效成员。")
    link = get_lease_allocation(organization=org, lease_id=lease_id)
    allocation_request = link.allocation_request
    can_view = has_permission(request.user, org, AllocationPermission.VIEW) or allocation_request.submitted_by_id == request.user.pk
    if not can_view:
        can_view = allocation_request.shares.filter(beneficiary_user=request.user).exists()
    if not can_view:
        raise PermissionDenied("你没有查看该收益申请的权限。")
    return link


@router.post("/leases/{lease_id}/allocation/review/", response=AllocationRequestOut, summary="审核租约收益分配申请")
def review_lease_allocation_request(request, lease_id: int, payload: LeaseAllocationReviewIn):
    org = require_org_permission(request, AllocationPermission.REVIEW)
    return review_lease_allocation(
        organization=org,
        lease_id=lease_id,
        reviewer=request.user,
        approved=payload.decision == "approve",
        reason=payload.reason,
    )


@router.post("/leases/{lease_id}/allocation/void/", response=AllocationRequestOut, summary="作废租约收益分配申请")
def void_lease_allocation_request(request, lease_id: int, payload: LeaseAllocationVoidIn):
    org = require_org_permission(request, AllocationPermission.VOID)
    return void_lease_allocation(organization=org, lease_id=lease_id, actor=request.user, reason=payload.reason)


@router.patch("/leases/{lease_id}/", response=LeaseOut, summary="更新租约")
def patch_lease(request, lease_id: int, payload: LeasePatchIn):
    lease = get_lease(request, lease_id)
    data = payload.model_dump(exclude_unset=True)
    if "house_id" in data:
        lease.house = _get_house_in_org(data.pop("house_id"), lease.organization)
    if "tenant_id" in data:
        tenant_id = data.pop("tenant_id")
        if tenant_id != lease.tenant_id:
            lease.tenant = _get_contact_for_new_business(tenant_id, lease.organization, ContactRole.TENANT)
    if "source_viewing_record_id" in data:
        source_viewing_record_id = data.pop("source_viewing_record_id")
        lease.source_viewing_record = _get_viewing_record_in_org(source_viewing_record_id, lease.organization) if source_viewing_record_id is not None else None
    for field, value in data.items():
        setattr(lease, field, value)
    lease.save()
    return lease


@landlord_router.get("/my-houses/", response=list[HouseOut], summary="房东查询名下房源")
@paginate(LegacyPagination)
def list_my_houses(request):
    org = require_org_selected(request)
    return get_landlord_houses(request.user, org)


@landlord_router.get("/my-leases/", response=list[LeaseOut], summary="房东查询名下租约")
@paginate(LegacyPagination)
def list_my_leases(request):
    org = require_org_selected(request)
    return get_landlord_leases(request.user, org)


@landlord_router.get("/invites/{token}/", response=LandlordInvitationOut, auth=None, summary="查询房东邀请")
def get_landlord_invite(request, token: str):
    try:
        invitation = get_landlord_invitation(token)
    except LandlordInvitationCacheError as err:
        raise HttpError(503, str(err)) from err
    if invitation is None:
        raise HttpError(404, "邀请无效或已过期。")

    contact = get_object_or_404(
        Contact.objects.select_related("organization"),
        pk=invitation["contact_id"],
        organization_id=invitation["organization_id"],
        is_active=True,
    )
    if ContactRole.LANDLORD not in (contact.roles or []):
        raise Http404
    return {
        "organization_name": contact.organization.name,
        "contact_name": contact.name,
        "invitee_phone_masked": mask_phone(invitation["phone"]),
        "expires_at": invitation_expires_at(invitation),
    }


@landlord_router.post("/invites/{token}/accept/", response=LandlordInvitationAcceptOut, summary="接受房东邀请")
def accept_landlord_invite(request, token: str):
    require_authenticated(request)
    receipt = get_invitation_receipt("landlord", token, request.user.pk)
    if receipt:
        return receipt
    try:
        invitation = get_landlord_invitation(token)
    except LandlordInvitationCacheError as err:
        raise HttpError(503, str(err)) from err
    if invitation is None:
        raise InvitationUnavailableException()

    with transaction.atomic():
        contact = get_object_or_404(
            Contact.objects.select_for_update().select_related("organization"),
            pk=invitation["contact_id"],
            organization_id=invitation["organization_id"],
            is_active=True,
        )
        if ContactRole.LANDLORD not in (contact.roles or []):
            raise Http404
        if contact.user_id and contact.user_id != request.user.pk:
            raise InvitationBindingConflictException("该房东联系人已绑定其他账号。")
        if not contact.user_id:
            if not request.user.phone_verified or not request.user.phone:
                raise InvitationPhoneVerificationRequiredException()
            try:
                user_phone = normalize_invitation_phone(request.user.phone)
                contact_phone = normalize_invitation_phone(contact.phone)
            except ValueError as err:
                raise InvitationRecipientMismatchException("当前账号手机号与房东联系人手机号不一致。") from err
            if user_phone != contact_phone or user_phone != invitation["phone"]:
                raise InvitationRecipientMismatchException("当前账号手机号与房东联系人手机号不一致。")
            contact.user = request.user
        contact.ensure_public_key()
        contact.save(update_fields=["user", "public_key", "updated_at"])
        result = {
            "contact_id": contact.pk,
            "organization_id": contact.organization_id,
            "organization_name": contact.organization.name,
            "public_key": str(contact.public_key),
        }
        save_invitation_receipt("landlord", token, request.user.pk, result)
        transaction.on_commit(lambda: consume_landlord_invitation(invitation))
    return result


@landlord_router.get("/relationships/", response=list[LandlordRelationshipOut], summary="获取房东绑定关系")
def list_landlord_relationships(request):
    require_authenticated(request)
    relationships = []
    for contact in get_landlord_relationship_contacts(request.user):
        if contact.public_key is None:
            contact.ensure_public_key()
            contact.save(update_fields=["public_key", "updated_at"])
        relationships.append(
            {
                "contact_id": contact.pk,
                "organization_id": contact.organization_id,
                "organization_name": contact.organization.name,
                "organization_slug": contact.organization.slug,
                "contact_name": contact.name,
                "house_count": contact.house_count,
                "public_house_count": contact.public_house_count,
                "public_key": str(contact.public_key),
                "public_url": f"{settings.SITE_URL}/dashboard/landlords/{contact.public_key}",
            }
        )
    return relationships


@landlord_router.get("/contacts/{contact_id}/houses/", response=list[LandlordHouseOut], summary="按房东关系查询房源")
@paginate(LegacyPagination)
def list_landlord_contact_houses(request, contact_id: int):
    contact = _get_landlord_contact_for_user(request, contact_id)
    return get_landlord_houses_for_contact(contact)


@landlord_router.get("/contacts/{contact_id}/leases/", response=list[LeaseOut], summary="按房东关系查询租约")
@paginate(LegacyPagination)
def list_landlord_contact_leases(request, contact_id: int):
    contact = _get_landlord_contact_for_user(request, contact_id)
    return get_landlord_leases_for_contact(contact)
