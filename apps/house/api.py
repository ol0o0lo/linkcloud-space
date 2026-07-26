from decimal import Decimal
from typing import Literal

from django.db import transaction
from django.db.models import Avg, Case, CharField, Count, DecimalField, Exists, F, IntegerField, Max, Min, OuterRef, Prefetch, Q, Subquery, Value, When
from django.db.models.functions import Coalesce
from django.shortcuts import get_object_or_404

from ninja import Query, Router, Status
from ninja.errors import HttpError
from ninja.pagination import paginate

from apps.access.constants import OrganizationPermission
from apps.access.permissions import require_org_permission
from apps.base.ninja_pagination import LegacyPagination
from apps.base.permissions import require_org_selected
from apps.house.constants import HOUSE_ACTIVE_STATUSES, ContactRole, HouseStatus, ViewingRecordStatus
from apps.house.models import Building, Contact, Estate, House, Lease, PropertyResponsibility, ViewingRecord
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
    DefaultBuildingIn,
    DefaultBuildingOut,
    DeleteCheckOut,
    EstateDetailOut,
    EstateIn,
    EstateMapMarkerOut,
    EstateOut,
    EstatePatchIn,
    HouseIn,
    HouseOut,
    HousePatchIn,
    LeaseIn,
    LeaseOut,
    LeasePatchIn,
    PropertyResponsibilityMemberOut,
    PropertyResponsibilityUpdateIn,
    PublicHouseDetailOut,
    PublicHouseFiltersOut,
    PublicHouseListOut,
    TagSuggestionsOut,
    VacancySyncIn,
    VacancySyncOut,
    ViewingRecordIn,
    ViewingRecordOut,
    ViewingRecordPatchIn,
)
from apps.house.services import (
    building_map_counts,
    delete_building,
    delete_estate,
    ensure_default_building,
    evaluate_house_publish_state,
    get_building_delete_check,
    get_estate_delete_check,
    get_landlord_houses,
    get_landlord_leases,
    get_org_house_publish_rules,
    get_public_houses_queryset,
    get_tag_suggestions,
    set_default_building,
    sort_houses_for_building,
)
from apps.house.vacancy_sync import apply_vacancy_sync, build_vacancy_sync_plan
from apps.organizations.models import OrganizationMember

router = Router(tags=["房源/管理"])
landlord_router = Router(tags=["房源/房东"])
public_router = Router(tags=["房源/公开"])


@public_router.get("/", response=list[PublicHouseListOut], auth=None, summary="全局搜索公开房源")
@paginate(LegacyPagination)
def list_public_houses(
    request,
    keyword: str | None = Query(None),
    province: str | None = Query(None),
    city: str | None = Query(None),
    district: str | None = Query(None),
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
    sort: Literal["latest", "rent_asc", "rent_desc", "area_asc", "area_desc"] = Query("latest"),
):
    qs = get_public_houses_queryset()
    if keyword:
        qs = qs.filter(
            Q(room_number__icontains=keyword)
            | Q(public_description__icontains=keyword)
            | Q(building__name__icontains=keyword)
            | Q(building__address__icontains=keyword)
            | Q(building__estate__name__icontains=keyword)
            | Q(building__estate__display_name__icontains=keyword)
            | Q(building__organization__name__icontains=keyword)
        )
    if province:
        qs = qs.filter(building__estate__province__iexact=province)
    if city:
        qs = qs.filter(building__estate__city__iexact=city)
    if district:
        qs = qs.filter(building__estate__district__iexact=district)
    if min_rent is not None:
        qs = qs.filter(asking_rent__gte=min_rent)
    if max_rent is not None:
        qs = qs.filter(asking_rent__lte=max_rent)
    if min_area is not None:
        qs = qs.filter(area__gte=min_area)
    if max_area is not None:
        qs = qs.filter(area__lte=max_area)
    if bedrooms is not None:
        qs = qs.filter(bedrooms=bedrooms)
    if living_rooms is not None:
        qs = qs.filter(living_rooms=living_rooms)
    if decoration:
        qs = qs.filter(decoration=decoration)
    if has_elevator_access is not None:
        qs = qs.filter(has_elevator_access=has_elevator_access)
    for tag in tags or []:
        qs = qs.filter(Q(tags__contains=[tag]) | Q(building__tags__contains=[tag]))
    if publisher_slug:
        qs = qs.filter(building__organization__slug=publisher_slug)

    ordering = {
        "latest": ("-updated_at", "-pk"),
        "rent_asc": (F("asking_rent").asc(nulls_last=True), "-pk"),
        "rent_desc": (F("asking_rent").desc(nulls_last=True), "-pk"),
        "area_asc": (F("area").asc(nulls_last=True), "-pk"),
        "area_desc": (F("area").desc(nulls_last=True), "-pk"),
    }
    return qs.order_by(*ordering[sort])


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


@router.get("/tag-suggestions/", response=TagSuggestionsOut, summary="获取房源与楼栋标签快捷候选")
def get_property_rental_tag_suggestions(request):
    require_org_selected(request)
    return {"tags": get_tag_suggestions()}


@router.post("/vacancy-sync/", response=VacancySyncOut, summary="预览或执行房表空置同步")
def vacancy_sync(request, payload: VacancySyncIn):
    org = require_org_selected(request)
    building_overrides = [item.dict() for item in payload.building_overrides]
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


def _inventory_annotations(house_lookup: str):
    active_houses = Q(**{f"{house_lookup}__status__in": HOUSE_ACTIVE_STATUSES})
    return {
        "inventory_total": Count(house_lookup, filter=active_houses),
        "inventory_vacant": Count(house_lookup, filter=active_houses & Q(**{f"{house_lookup}__status": HouseStatus.VACANT})),
        "inventory_listed": Count(house_lookup, filter=active_houses & Q(**{f"{house_lookup}__status": HouseStatus.LISTED})),
        "inventory_rented": Count(house_lookup, filter=active_houses & Q(**{f"{house_lookup}__status": HouseStatus.RENTED})),
        "inventory_renovating": Count(house_lookup, filter=active_houses & Q(**{f"{house_lookup}__status": HouseStatus.RENOVATING})),
    }


def _patch(obj, payload):
    for field, value in payload.dict(exclude_unset=True).items():
        setattr(obj, field, value)
    obj.save()
    return obj


def _get_house_in_org(house_id: int, org):
    return get_object_or_404(House.objects.select_related("building__estate", "landlord"), pk=house_id, building__organization=org)


def _get_contact_in_org(contact_id: int, org):
    return get_object_or_404(Contact, pk=contact_id, organization=org)


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
def list_staff_responsibilities(request, keyword: str | None = Query(None)):
    org = require_org_permission(request, OrganizationPermission.MEMBER_VIEW)
    qs = _property_responsibility_members_qs(org)
    if keyword:
        qs = qs.filter(Q(user__first_name__icontains=keyword) | Q(user__last_name__icontains=keyword) | Q(user__username__icontains=keyword) | Q(user__email__icontains=keyword))
    return qs


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


@router.get("/estates/", response=list[EstateOut], summary="获取项目片区列表")
@paginate(LegacyPagination)
def list_estates(request, keyword: str | None = Query(None)):
    org = require_org_selected(request)
    qs = Estate.objects.filter(organization=org).order_by("name", "id")
    if keyword:
        qs = qs.filter(name__icontains=keyword) | qs.filter(display_name__icontains=keyword)
    return qs


@router.post("/estates/", response={201: EstateOut}, summary="创建项目片区")
def create_estate(request, payload: EstateIn):
    org = require_org_selected(request)
    estate = Estate.objects.create(organization=org, **payload.dict())
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
def list_buildings(request, estate_id: int | None = Query(None), keyword: str | None = Query(None)):
    org = require_org_selected(request)
    qs = Building.objects.filter(organization=org).select_related("estate").annotate(**_inventory_annotations("houses")).order_by("estate__name", "name")
    if estate_id:
        qs = qs.filter(estate_id=estate_id)
    if keyword:
        qs = qs.filter(Q(name__icontains=keyword) | Q(estate__name__icontains=keyword) | Q(estate__display_name__icontains=keyword))
    return qs


@router.post("/buildings/", response={201: BuildingOut}, summary="创建楼栋")
def create_building(request, payload: BuildingIn):
    org = require_org_selected(request)
    data = payload.dict()
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
    data = payload.dict(exclude_unset=True)
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
    qs = qs.filter(lat__isnull=False, lng__isnull=False) if located else qs.filter(Q(lat__isnull=True) | Q(lng__isnull=True))
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

    located_buildings = eligible_buildings.filter(lat__isnull=False, lng__isnull=False)
    building_centroid = located_buildings.values("estate_id").annotate(avg_lat=Avg("lat"), avg_lng=Avg("lng"))

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
    coordinate_field = DecimalField(max_digits=10, decimal_places=6)
    qs = qs.annotate(
        map_lat=Case(
            When(lat__isnull=False, lng__isnull=False, then=F("lat")),
            default=Subquery(building_centroid.values("avg_lat")[:1], output_field=coordinate_field),
            output_field=coordinate_field,
        ),
        map_lng=Case(
            When(lat__isnull=False, lng__isnull=False, then=F("lng")),
            default=Subquery(building_centroid.values("avg_lng")[:1], output_field=coordinate_field),
            output_field=coordinate_field,
        ),
        location_source=Case(
            When(lat__isnull=False, lng__isnull=False, then=Value("estate")),
            default=Value("building_centroid"),
            output_field=CharField(),
        ),
        building_count=Count("buildings", filter=eligible_building_filter, distinct=True),
        located_building_count=Count(
            "buildings",
            filter=eligible_building_filter & Q(buildings__lat__isnull=False, buildings__lng__isnull=False),
            distinct=True,
        ),
        unlocated_building_count=Count(
            "buildings",
            filter=eligible_building_filter & (Q(buildings__lat__isnull=True) | Q(buildings__lng__isnull=True)),
            distinct=True,
        ),
        **_map_count_annotations("buildings__houses", active_houses),
    ).filter(map_lat__isnull=False, map_lng__isnull=False)
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
):
    _validate_map_bounds(west=west, south=south, east=east, north=north)
    org = require_org_selected(request)
    qs = _estate_map_queryset(org, keyword=keyword, estate_id=estate_id, house_status=house_status)
    if west is not None:
        qs = qs.filter(map_lng__gte=west, map_lng__lte=east, map_lat__gte=south, map_lat__lte=north)
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
):
    _validate_map_bounds(west=west, south=south, east=east, north=north)

    org = require_org_selected(request)
    qs = _building_map_queryset(org, house_status=house_status)
    qs = _filter_building_map_queryset(qs, keyword=keyword, estate_id=estate_id)
    if standalone_only:
        qs = qs.filter(estate__isnull=True)
    if west is not None:
        qs = qs.filter(lng__gte=west, lng__lte=east, lat__gte=south, lat__lte=north)
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
    return {"count": Building.objects.filter(organization=org).filter(Q(lat__isnull=True) | Q(lng__isnull=True)).count()}


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
        "lat": building.lat,
        "lng": building.lng,
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
    data = payload.dict(exclude_unset=True)
    contact = Contact.objects.create(organization=org, **data)
    return Status(201, contact)


@router.get("/contacts/{contact_id}/", response=ContactOut, summary="获取联系人详情")
def get_contact(request, contact_id: int):
    org = require_org_selected(request)
    return get_object_or_404(Contact, pk=contact_id, organization=org)


@router.patch("/contacts/{contact_id}/", response=ContactOut, summary="更新联系人")
def patch_contact(request, contact_id: int, payload: ContactPatchIn):
    data = payload.dict(exclude_unset=True)
    contact = get_contact(request, contact_id)
    for field, value in data.items():
        setattr(contact, field, value)
    contact.save()
    return contact


@router.get("/houses/", response=list[HouseOut], summary="获取房源列表")
@paginate(LegacyPagination)
def list_houses(
    request,
    estate_id: int | None = Query(None),
    building_id: int | None = Query(None),
    responsible_member_id: int | None = Query(None),
    status: str | None = Query(None),
    keyword: str | None = Query(None),
):
    org = require_org_selected(request)
    qs = House.objects.filter(building__organization=org).select_related("building__estate", "landlord").order_by("building__estate__name", "building__name", "room_number")
    if estate_id:
        qs = qs.filter(building__estate_id=estate_id)
    if building_id:
        qs = qs.filter(building_id=building_id)
    if responsible_member_id:
        member = get_object_or_404(OrganizationMember, pk=responsible_member_id, organization=org)
        qs = _filter_responsible_houses(qs, org, member.pk)
    qs = qs.filter(status=status) if status else qs.exclude(status=HouseStatus.INACTIVE)
    if keyword:
        qs = qs.filter(
            Q(room_number__icontains=keyword)
            | Q(building__name__icontains=keyword)
            | Q(building__estate__name__icontains=keyword)
            | Q(building__estate__display_name__icontains=keyword)
            | Q(landlord__name__icontains=keyword)
            | Q(landlord__phone__icontains=keyword)
        )
    return qs


@router.post("/houses/", response={201: HouseOut}, summary="创建房源")
def create_house(request, payload: HouseIn):
    org = require_org_selected(request)
    from apps.subscriptions.entitlements import EntitlementService

    EntitlementService.check_can_add(org, "house")
    building = get_object_or_404(Building, pk=payload.building_id, organization=org)
    data = payload.dict()
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


@router.patch("/houses/{house_id}/", response=HouseOut, summary="更新房源")
def patch_house(request, house_id: int, payload: HousePatchIn):
    house = get_house(request, house_id)
    previous_status = house.status
    data = payload.dict(exclude_unset=True)
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
    data = payload.dict()
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
    data = payload.dict(exclude_unset=True)
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
    data = payload.dict()
    house_id = data.pop("house_id")
    tenant_id = data.pop("tenant_id")
    source_viewing_record_id = data.pop("source_viewing_record_id", None)
    data["house"] = _get_house_in_org(house_id, org)
    data["tenant"] = _get_contact_for_new_business(tenant_id, org, ContactRole.TENANT)
    if source_viewing_record_id is not None:
        data["source_viewing_record"] = _get_viewing_record_in_org(source_viewing_record_id, org)
    lease = Lease.objects.create(organization=org, **data)
    return Status(201, lease)


@router.get("/leases/{lease_id}/", response=LeaseOut, summary="获取租约详情")
def get_lease(request, lease_id: int):
    org = require_org_selected(request)
    return get_object_or_404(Lease.objects.select_related("house__building__estate", "tenant", "source_viewing_record"), pk=lease_id, organization=org)


@router.patch("/leases/{lease_id}/", response=LeaseOut, summary="更新租约")
def patch_lease(request, lease_id: int, payload: LeasePatchIn):
    lease = get_lease(request, lease_id)
    data = payload.dict(exclude_unset=True)
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
