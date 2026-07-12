from decimal import Decimal

from django.db.models import Count, Exists, OuterRef, Q, Subquery
from django.shortcuts import get_object_or_404

from ninja import Query, Router, Status
from ninja.errors import HttpError
from ninja.pagination import paginate

from apps.base.ninja_pagination import LegacyPagination
from apps.base.permissions import require_org_selected
from apps.house.constants import ContactRole, HousePublishStatus, HouseStatus, ViewingRecordStatus
from apps.house.models import Building, Contact, Estate, House, Lease, ViewingRecord
from apps.house.schemas import (
    BuildingIn,
    BuildingMapDetailOut,
    BuildingMapMarkerOut,
    BuildingMapUnlocatedCountOut,
    BuildingOut,
    BuildingPatchIn,
    ContactIn,
    ContactOut,
    ContactPatchIn,
    DefaultBuildingIn,
    DefaultBuildingOut,
    DeleteCheckOut,
    EstateIn,
    EstateOut,
    EstatePatchIn,
    HouseIn,
    HouseOut,
    HousePatchIn,
    LeaseIn,
    LeaseOut,
    LeasePatchIn,
    ViewingRecordIn,
    ViewingRecordOut,
    ViewingRecordPatchIn,
)
from apps.house.services import (
    building_map_counts,
    delete_building,
    delete_estate,
    ensure_default_building,
    get_building_delete_check,
    get_estate_delete_check,
    get_landlord_houses,
    get_landlord_leases,
    set_default_building,
    sort_houses_for_building,
)
from apps.organizations.models import OrganizationMember

router = Router(tags=["房源/管理"])
landlord_router = Router(tags=["房源/房东"])


def _patch(obj, payload):
    for field, value in payload.dict(exclude_unset=True).items():
        setattr(obj, field, value)
    obj.save()
    return obj


def _get_house_in_org(house_id: int, org):
    return get_object_or_404(House.objects.select_related("building__estate", "landlord"), pk=house_id, building__organization=org)


def _get_contact_in_org(contact_id: int, org):
    return get_object_or_404(Contact, pk=contact_id, organization=org)


def _get_viewing_record_in_org(record_id: int, org):
    return get_object_or_404(ViewingRecord, pk=record_id, organization=org)


def _validate_assignee_in_org(user_id: int | None, org) -> None:
    if user_id is None:
        return
    get_object_or_404(OrganizationMember, organization=org, user_id=user_id)


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


@router.get("/estates/{estate_id}/", response=EstateOut, summary="获取项目片区详情")
def get_estate(request, estate_id: int):
    org = require_org_selected(request)
    return get_object_or_404(Estate, pk=estate_id, organization=org)


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


@router.get("/buildings/", response=list[BuildingOut], summary="获取楼栋列表")
@paginate(LegacyPagination)
def list_buildings(request, estate_id: int | None = Query(None), keyword: str | None = Query(None)):
    org = require_org_selected(request)
    qs = Building.objects.filter(organization=org).select_related("estate").order_by("estate__name", "name")
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


@router.get("/buildings/{building_id}/", response=BuildingOut, summary="获取楼栋详情")
def get_building(request, building_id: int):
    org = require_org_selected(request)
    return get_object_or_404(Building.objects.select_related("estate"), pk=building_id, organization=org)


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


def _building_map_queryset(org, *, house_status: str | None, include_inactive: bool):
    qs = Building.objects.filter(organization=org, lat__isnull=False, lng__isnull=False).select_related("estate")
    if not include_inactive:
        qs = qs.filter(is_active=True)
    if house_status:
        qs = qs.filter(Exists(House.objects.filter(building_id=OuterRef("pk"), is_active=True, status=house_status)))
    return qs.annotate(
        total=Count("houses", filter=Q(houses__is_active=True)),
        vacant=Count("houses", filter=Q(houses__is_active=True, houses__status=HouseStatus.VACANT)),
        rented=Count("houses", filter=Q(houses__is_active=True, houses__status=HouseStatus.RENTED)),
        renovating=Count("houses", filter=Q(houses__is_active=True, houses__status=HouseStatus.RENOVATING)),
        locked=Count("houses", filter=Q(houses__is_active=True, houses__status=HouseStatus.LOCKED)),
        published=Count("houses", filter=Q(houses__is_active=True, houses__publish_status=HousePublishStatus.PUBLISHED)),
    )


@router.get("/building-map/", response=list[BuildingMapMarkerOut], summary="获取楼栋房源地图标点")
@paginate(LegacyPagination)
def list_building_map(
    request,
    keyword: str | None = Query(None),
    estate_id: int | None = Query(None),
    house_status: str | None = Query(None),
    include_inactive: bool = Query(False),
    west: Decimal | None = Query(None),
    south: Decimal | None = Query(None),
    east: Decimal | None = Query(None),
    north: Decimal | None = Query(None),
):
    bounds = (west, south, east, north)
    if any(value is not None for value in bounds):
        if any(value is None for value in bounds) or west >= east or south >= north:
            raise HttpError(422, "地图范围无效")

    org = require_org_selected(request)
    qs = _building_map_queryset(org, house_status=house_status, include_inactive=include_inactive)
    if estate_id is not None:
        qs = qs.filter(estate_id=estate_id)
    if keyword:
        qs = qs.filter(Q(name__icontains=keyword) | Q(address__icontains=keyword) | Q(estate__name__icontains=keyword) | Q(estate__display_name__icontains=keyword))
    if west is not None:
        qs = qs.filter(lng__gte=west, lng__lte=east, lat__gte=south, lat__lte=north)
    return qs.order_by("name", "id")


@router.get("/building-map-unlocated-count/", response=BuildingMapUnlocatedCountOut, summary="获取待定位楼栋数量")
def get_building_map_unlocated_count(request):
    org = require_org_selected(request)
    return {"count": Building.objects.filter(organization=org).filter(Q(lat__isnull=True) | Q(lng__isnull=True)).count()}


@router.get("/building-map/{building_id}/", response=BuildingMapDetailOut, summary="获取楼栋房源地图详情")
def get_building_map_detail(request, building_id: int):
    org = require_org_selected(request)
    building = get_object_or_404(Building.objects.select_related("estate"), pk=building_id, organization=org)
    houses = sort_houses_for_building(building.houses.filter(is_active=True))
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
        "is_active": building.is_active,
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
                "publish_status": house.publish_status,
                "publish_status__mapping": HousePublishStatus.get_choice_label(house.publish_status),
            }
            for house in houses
        ],
    }


@router.get("/contacts/", response=list[ContactOut], summary="获取联系人列表")
@paginate(LegacyPagination)
def list_contacts(request, role: str | None = Query(None), task: str | None = Query(None), keyword: str | None = Query(None)):
    org = require_org_selected(request)
    qs = Contact.objects.filter(organization=org).order_by("name", "id")
    if task == "inactive":
        qs = qs.filter(is_active=False)
    if keyword:
        qs = qs.filter(Q(name__icontains=keyword) | Q(phone__icontains=keyword))
    if role or task in {"dual_role", "role_missing"}:
        contacts = list(qs)
        if role:
            contacts = [contact for contact in contacts if role in (contact.roles or [])]
        if task == "dual_role":
            contacts = [contact for contact in contacts if {ContactRole.LANDLORD, ContactRole.TENANT}.issubset(set(contact.roles or []))]
        if task == "role_missing":
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
    status: str | None = Query(None),
    publish_status: str | None = Query(None),
    keyword: str | None = Query(None),
):
    org = require_org_selected(request)
    qs = House.objects.filter(building__organization=org).select_related("building__estate", "landlord").order_by("building__estate__name", "building__name", "room_number")
    if estate_id:
        qs = qs.filter(building__estate_id=estate_id)
    if building_id:
        qs = qs.filter(building_id=building_id)
    if status:
        qs = qs.filter(status=status)
    if publish_status:
        qs = qs.filter(publish_status=publish_status)
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
    building = get_object_or_404(Building, pk=payload.building_id, organization=org)
    data = payload.dict()
    data.pop("building_id")
    landlord_id = data.pop("landlord_id", None)
    landlord = _get_contact_in_org(landlord_id, org) if landlord_id is not None else None
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
    data = payload.dict(exclude_unset=True)
    building_id = data.pop("building_id", None)
    if building_id is not None:
        house.building = get_object_or_404(Building, pk=building_id, organization=house.organization)
    if "landlord_id" in data:
        landlord_id = data.pop("landlord_id")
        house.landlord = _get_contact_in_org(landlord_id, house.organization) if landlord_id is not None else None
    for field, value in data.items():
        setattr(house, field, value)
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
        data["contact"] = _get_contact_in_org(contact_id, org)
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
        record.contact = _get_contact_in_org(contact_id, org) if contact_id is not None else None
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
    data["tenant"] = _get_contact_in_org(tenant_id, org)
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
        lease.tenant = _get_contact_in_org(data.pop("tenant_id"), lease.organization)
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
