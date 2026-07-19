from datetime import date, datetime
from decimal import Decimal
from typing import Any, Literal

from ninja import Schema
from pydantic import ConfigDict, Field

from apps.house.constants import ContactRole, EstatePropertyType, HouseDecoration, HouseOrientation, HouseStatus, LeaseStatus, ViewingRecordStatus
from apps.media.schemas import ResolvedMediaRefOut
from apps.organizations.schemas import OrgUserOut


class RelatedResourceItemOut(Schema):
    id: int
    label: str


class RelatedResourceTargetOut(Schema):
    path: str
    query: dict[str, int | str]


class RelatedResourceOut(Schema):
    type: str
    label: str
    count: int
    items: list[RelatedResourceItemOut]
    truncated: bool
    target: RelatedResourceTargetOut


class DeleteCheckOut(Schema):
    can_delete: bool
    resources: list[RelatedResourceOut]


class TagSuggestionsOut(Schema):
    tags: list[str]


class EstateIn(Schema):
    name: str
    display_name: str
    developer: str | None = None
    built_year: int | None = None
    property_type: str = EstatePropertyType.RESIDENTIAL
    province: str
    city: str
    district: str
    address: str = ""
    lat: Decimal | None = None
    lng: Decimal | None = None
    images: list[dict[str, Any]] = Field(default_factory=list)
    description: str = ""


class EstatePatchIn(Schema):
    name: str | None = None
    display_name: str | None = None
    developer: str | None = None
    built_year: int | None = None
    property_type: str | None = None
    province: str | None = None
    city: str | None = None
    district: str | None = None
    address: str | None = None
    lat: Decimal | None = None
    lng: Decimal | None = None
    images: list[dict[str, Any]] | None = None
    description: str | None = None


class EstateOut(Schema):
    id: int
    name: str
    display_name: str
    property_type: str
    property_type__mapping: str
    province: str
    city: str
    district: str
    address: str
    lat: Decimal | None
    lng: Decimal | None
    images: list[dict[str, Any]]

    @staticmethod
    def resolve_property_type__mapping(obj):
        return EstatePropertyType.get_choice_label(obj.property_type)

    @staticmethod
    def resolve_images(obj):
        return obj.images_resolved


class InventoryCountsOut(Schema):
    total: int
    vacant: int
    listed: int
    rented: int
    renovating: int


def resolve_inventory_counts(obj):
    return {name: getattr(obj, f"inventory_{name}", 0) for name in ("total", "vacant", "listed", "rented", "renovating")}


class EstateDetailOut(EstateOut):
    building_count: int
    counts: InventoryCountsOut

    @staticmethod
    def resolve_counts(obj):
        return resolve_inventory_counts(obj)


class BuildingIn(Schema):
    estate_id: int | None = None
    name: str
    floors: int
    under_floors: int | None = None
    year_built: int | None = None
    elevator: bool = False
    lat: Decimal | None = None
    lng: Decimal | None = None
    address: str = ""
    images: list[dict[str, Any]] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)


class BuildingPatchIn(Schema):
    estate_id: int | None = None
    name: str | None = None
    floors: int | None = None
    under_floors: int | None = None
    year_built: int | None = None
    elevator: bool | None = None
    lat: Decimal | None = None
    lng: Decimal | None = None
    address: str | None = None
    images: list[dict[str, Any]] | None = None
    tags: list[str] | None = None


class EstateSummaryOut(Schema):
    id: int
    name: str
    display_name: str


class BuildingSummaryOut(Schema):
    id: int
    name: str
    estate_id: int | None
    estate: EstateSummaryOut | None
    address: str
    lat: Decimal | None
    lng: Decimal | None


def building_display_label(building) -> str:
    if building.estate_id:
        return f"{building.estate.display_name or building.estate.name} / {building.name}"
    return f"{building.name} · {building.address}"


class ContactSummaryOut(Schema):
    id: int
    name: str
    phone: str


class HouseSummaryOut(Schema):
    id: int
    label: str
    room_number: str
    building_id: int
    building: BuildingSummaryOut

    @staticmethod
    def resolve_label(obj):
        return f"{building_display_label(obj.building)} / {obj.room_number}"


class ViewingRecordSummaryOut(Schema):
    id: int
    label: str
    customer_name: str
    customer_phone: str

    @staticmethod
    def resolve_label(obj):
        return f"{obj.customer_name} / {obj.customer_phone}"


class BuildingOut(Schema):
    id: int
    estate_id: int | None
    estate: EstateSummaryOut | None
    name: str
    floors: int
    under_floors: int | None
    year_built: int | None
    elevator: bool
    lat: Decimal | None
    lng: Decimal | None
    address: str
    images: list[dict[str, Any]]
    tags: list[str]

    @staticmethod
    def resolve_images(obj):
        if isinstance(obj, dict):
            return obj.get("images", [])
        return obj.images_resolved


class BuildingInventoryOut(BuildingOut):
    counts: InventoryCountsOut

    @staticmethod
    def resolve_counts(obj):
        return resolve_inventory_counts(obj)


class BuildingMapCountsOut(Schema):
    total: int
    vacant: int
    listed: int
    rented: int
    renovating: int


class BuildingMapUnlocatedCountOut(Schema):
    count: int


class BuildingMapUnlocatedOut(Schema):
    id: int
    estate: EstateSummaryOut | None
    name: str
    address: str
    counts: BuildingMapCountsOut

    @staticmethod
    def resolve_counts(obj):
        return {name: getattr(obj, name) for name in ("total", "vacant", "listed", "rented", "renovating")}


class BuildingMapMarkerOut(Schema):
    id: int
    estate: EstateSummaryOut | None
    name: str
    address: str
    lat: Decimal
    lng: Decimal
    counts: BuildingMapCountsOut

    @staticmethod
    def resolve_counts(obj):
        return {name: getattr(obj, name) for name in ("total", "vacant", "listed", "rented", "renovating")}


class EstateMapMarkerOut(Schema):
    id: int
    name: str
    display_name: str
    address: str
    lat: Decimal
    lng: Decimal
    location_source: Literal["estate", "building_centroid"]
    building_count: int
    located_building_count: int
    unlocated_building_count: int
    counts: BuildingMapCountsOut

    @staticmethod
    def resolve_lat(obj):
        return obj.map_lat

    @staticmethod
    def resolve_lng(obj):
        return obj.map_lng

    @staticmethod
    def resolve_counts(obj):
        return {name: getattr(obj, name) for name in ("total", "vacant", "listed", "rented", "renovating")}


class BuildingMapHouseOut(Schema):
    id: int
    room_number: str
    floor: int | None
    area: Decimal | None
    asking_rent: Decimal | None
    status: str
    status__mapping: str


class BuildingMapDetailOut(BuildingOut):
    counts: BuildingMapCountsOut
    houses: list[BuildingMapHouseOut]


class DefaultBuildingIn(Schema):
    building_id: int


class DefaultBuildingOut(Schema):
    id: int
    estate_id: int | None
    estate: EstateSummaryOut | None
    name: str
    floors: int
    address: str


class ContactIn(Schema):
    model_config = ConfigDict(extra="forbid")

    name: str
    phone: str
    email: str = ""
    roles: list[str] = Field(default_factory=list)
    notes: str = ""
    is_active: bool = True


class ContactPatchIn(Schema):
    model_config = ConfigDict(extra="forbid")

    name: str | None = None
    phone: str | None = None
    email: str | None = None
    roles: list[str] | None = None
    notes: str | None = None
    is_active: bool | None = None


class ContactOut(Schema):
    id: int
    name: str
    phone: str
    email: str
    roles: list[str]
    roles__mapping: list[str]
    user_id: int | None
    notes: str
    is_active: bool

    @staticmethod
    def resolve_roles__mapping(obj):
        return [ContactRole.get_choice_label(role) for role in (obj.roles or [])]


class PropertyResponsibilityUpdateIn(Schema):
    landlord_ids: list[int] = Field(default_factory=list)
    building_ids: list[int] = Field(default_factory=list)
    estate_ids: list[int] = Field(default_factory=list)


class PropertyResponsibilityMemberOut(Schema):
    member_id: int
    user: OrgUserOut
    is_owner: bool
    landlords: list[ContactSummaryOut]
    buildings: list[BuildingSummaryOut]
    estates: list[EstateSummaryOut]
    responsible_house_count: int

    @staticmethod
    def resolve_member_id(obj):
        return obj.pk

    @staticmethod
    def resolve_landlords(obj):
        responsibilities = getattr(obj, "prefetched_property_responsibilities", None)
        if responsibilities is None:
            responsibilities = obj.property_responsibilities.select_related("landlord").all()
        return [item.landlord for item in responsibilities if item.landlord_id]

    @staticmethod
    def resolve_buildings(obj):
        responsibilities = getattr(obj, "prefetched_property_responsibilities", None)
        if responsibilities is None:
            responsibilities = obj.property_responsibilities.select_related("building__estate").all()
        return [item.building for item in responsibilities if item.building_id]

    @staticmethod
    def resolve_estates(obj):
        responsibilities = getattr(obj, "prefetched_property_responsibilities", None)
        if responsibilities is None:
            responsibilities = obj.property_responsibilities.select_related("estate").all()
        return [item.estate for item in responsibilities if item.estate_id]


class VacancySyncBuildingOverrideIn(Schema):
    block_index: int = Field(..., ge=0)
    building_id: int = Field(..., gt=0)


class VacancySyncIn(Schema):
    model_config = ConfigDict(extra="forbid")

    mode: Literal["preview", "apply"] = "preview"
    raw_text: str
    building_overrides: list[VacancySyncBuildingOverrideIn] = Field(default_factory=list)
    ignored_lines: list[int] = Field(default_factory=list)
    plan_hash: str | None = None


class VacancySyncErrorOut(Schema):
    code: str
    message: str
    block_index: int | None
    line_number: int | None


class VacancySyncLineOut(Schema):
    line_number: int
    raw: str
    status: Literal["valid", "error", "ignored"]
    error_code: str | None
    message: str | None
    room_number: str | None
    floor: int | None
    asking_rent: Decimal | None
    bedrooms: int | None
    living_rooms: int | None
    tags: list[str]


class VacancySyncBuildingCandidateOut(Schema):
    id: int
    name: str
    address: str


class VacancySyncBuildingMatchOut(Schema):
    status: Literal["matched", "overridden", "ambiguous", "new", "created"]
    building_id: int | None
    name: str | None
    address: str
    candidates: list[VacancySyncBuildingCandidateOut]


class VacancySyncHouseChangeOut(Schema):
    house_id: int | None
    room_number: str
    before_status: str | None
    after_status: str | None
    changed_fields: list[str]


class VacancySyncChangesOut(Schema):
    create_houses: list[VacancySyncHouseChangeOut]
    update_houses: list[VacancySyncHouseChangeOut]
    mark_vacant: list[VacancySyncHouseChangeOut]
    mark_rented: list[VacancySyncHouseChangeOut]
    preserve_special_status: list[VacancySyncHouseChangeOut]
    inactive_conflicts: list[VacancySyncHouseChangeOut]


class VacancySyncBlockOut(Schema):
    block_index: int
    address: str
    building_match: VacancySyncBuildingMatchOut
    lines: list[VacancySyncLineOut]
    changes: VacancySyncChangesOut
    errors: list[VacancySyncErrorOut]


class VacancySyncSummaryOut(Schema):
    buildings: int
    valid_lines: int
    error_lines: int
    ignored_lines: int
    create_buildings: int
    create_houses: int
    update_houses: int
    mark_vacant: int
    mark_rented: int
    preserve_special_status: int


class VacancySyncOut(Schema):
    mode: Literal["preview", "apply"]
    applied: bool
    can_apply: bool
    plan_hash: str | None
    force_rented: bool
    summary: VacancySyncSummaryOut
    blocks: list[VacancySyncBlockOut]
    errors: list[VacancySyncErrorOut]


class HouseIn(Schema):
    model_config = ConfigDict(extra="forbid")

    building_id: int
    landlord_id: int | None = None
    room_number: str
    floor: int | None = None
    area: Decimal | None = None
    interior_area: Decimal | None = None
    asking_rent: Decimal | None = None
    deposit_amount: Decimal | None = None
    bedrooms: int | None = None
    living_rooms: int | None = None
    bathrooms: int | None = None
    kitchens: int | None = None
    balconies: int | None = None
    orientation: str | None = None
    decoration: str | None = None
    has_elevator_access: bool = False
    images: list[dict[str, Any]] = Field(default_factory=list)
    videos: list[dict[str, Any]] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)
    public_description: str = ""


class HousePatchIn(Schema):
    building_id: int | None = None
    landlord_id: int | None = None
    room_number: str | None = None
    floor: int | None = None
    area: Decimal | None = None
    interior_area: Decimal | None = None
    asking_rent: Decimal | None = None
    deposit_amount: Decimal | None = None
    bedrooms: int | None = None
    living_rooms: int | None = None
    bathrooms: int | None = None
    kitchens: int | None = None
    balconies: int | None = None
    orientation: str | None = None
    decoration: str | None = None
    has_elevator_access: bool | None = None
    status: str | None = None
    images: list[dict[str, Any]] | None = None
    videos: list[dict[str, Any]] | None = None
    tags: list[str] | None = None
    public_description: str | None = None
    internal_notes: str | None = None
    extra: dict[str, Any] | None = None


class HouseOut(Schema):
    id: int
    building_id: int
    building: BuildingSummaryOut
    landlord_id: int | None
    landlord: ContactSummaryOut | None
    room_number: str
    floor: int | None
    area: Decimal | None
    interior_area: Decimal | None
    asking_rent: Decimal | None
    deposit_amount: Decimal | None
    bedrooms: int | None
    living_rooms: int | None
    bathrooms: int | None
    kitchens: int | None
    balconies: int | None
    orientation: str | None
    orientation__mapping: str
    decoration: str | None
    decoration__mapping: str
    has_elevator_access: bool
    status: str
    status__mapping: str
    images: list[dict[str, Any]]
    videos: list[dict[str, Any]]
    tags: list[str]
    effective_tags: list[str]
    public_description: str
    internal_notes: str
    extra: dict[str, Any]

    @staticmethod
    def resolve_orientation__mapping(obj):
        if not obj.orientation:
            return ""
        return HouseOrientation.get_choice_label(obj.orientation)

    @staticmethod
    def resolve_decoration__mapping(obj):
        if not obj.decoration:
            return ""
        return HouseDecoration.get_choice_label(obj.decoration)

    @staticmethod
    def resolve_status__mapping(obj):
        return HouseStatus.get_choice_label(obj.status)

    @staticmethod
    def resolve_images(obj):
        return obj.images_resolved

    @staticmethod
    def resolve_videos(obj):
        return obj.videos_resolved


class PublicPublisherOut(Schema):
    slug: str
    name: str
    logo: list[ResolvedMediaRefOut]
    description: str

    @staticmethod
    def resolve_logo(obj):
        return obj.logo_resolved


class PublicEstateOut(Schema):
    id: int
    name: str
    display_name: str
    province: str
    city: str
    district: str
    address: str


class PublicBuildingOut(Schema):
    id: int
    name: str
    address: str
    lat: Decimal | None
    lng: Decimal | None
    estate: PublicEstateOut | None


class FavoriteBuildingTargetOut(PublicBuildingOut):
    floors: int
    elevator: bool
    images: list[ResolvedMediaRefOut]
    tags: list[str]
    publisher: PublicPublisherOut

    @staticmethod
    def resolve_images(obj):
        return obj.images_resolved

    @staticmethod
    def resolve_publisher(obj):
        return obj.organization


class FavoriteEstateTargetOut(PublicEstateOut):
    lat: Decimal | None
    lng: Decimal | None
    images: list[ResolvedMediaRefOut]
    description: str
    publisher: PublicPublisherOut

    @staticmethod
    def resolve_images(obj):
        return obj.images_resolved

    @staticmethod
    def resolve_publisher(obj):
        return obj.organization


class PublicHouseListOut(Schema):
    id: int
    room_number: str
    floor: int | None
    area: Decimal | None
    asking_rent: Decimal | None
    bedrooms: int | None
    living_rooms: int | None
    bathrooms: int | None
    orientation: str | None
    orientation__mapping: str
    decoration: str | None
    decoration__mapping: str
    has_elevator_access: bool
    images: list[ResolvedMediaRefOut]
    tags: list[str]
    effective_tags: list[str]
    public_description: str
    building: PublicBuildingOut
    publisher: PublicPublisherOut
    updated_at: datetime

    @staticmethod
    def resolve_orientation__mapping(obj):
        return HouseOrientation.get_choice_label(obj.orientation) if obj.orientation else ""

    @staticmethod
    def resolve_decoration__mapping(obj):
        return HouseDecoration.get_choice_label(obj.decoration) if obj.decoration else ""

    @staticmethod
    def resolve_images(obj):
        return obj.images_resolved

    @staticmethod
    def resolve_publisher(obj):
        return obj.building.organization


class ViewingRecordIn(Schema):
    model_config = ConfigDict(extra="forbid")

    house_id: int
    contact_id: int | None = None
    customer_name: str
    customer_phone: str
    scheduled_at: datetime
    assigned_to_id: int | None = None
    notes: str = ""


class ViewingRecordPatchIn(Schema):
    house_id: int | None = None
    contact_id: int | None = None
    customer_name: str | None = None
    customer_phone: str | None = None
    scheduled_at: datetime | None = None
    viewed_at: datetime | None = None
    status: str | None = None
    assigned_to_id: int | None = None
    notes: str | None = None
    extra: dict[str, Any] | None = None
    is_active: bool | None = None


class ViewingRecordOut(Schema):
    id: int
    house_id: int
    house: HouseSummaryOut
    contact_id: int | None
    contact: ContactSummaryOut | None
    customer_name: str
    customer_phone: str
    scheduled_at: datetime
    viewed_at: datetime | None
    status: str
    status__mapping: str
    assigned_to_id: int | None
    notes: str
    extra: dict[str, Any]
    is_active: bool
    signed_lease_id: int | None = None

    @staticmethod
    def resolve_status__mapping(obj):
        return ViewingRecordStatus.get_choice_label(obj.status)

    @staticmethod
    def resolve_signed_lease_id(obj):
        annotated = getattr(obj, "signed_lease_id", None)
        if annotated is not None:
            return annotated
        return obj.converted_leases.order_by("id").values_list("id", flat=True).first()


class LeaseIn(Schema):
    model_config = ConfigDict(extra="forbid")

    house_id: int
    tenant_id: int
    source_viewing_record_id: int | None = None
    sign_at: datetime | None = None
    start_date: date
    end_date: date
    monthly_rent: Decimal
    deposit: Decimal | None = None
    payment_day: int = 1
    contract_files: list[dict[str, Any]] = Field(default_factory=list)
    notes: str = ""
    extra: dict[str, Any] = Field(default_factory=dict)


class LeasePatchIn(Schema):
    house_id: int | None = None
    tenant_id: int | None = None
    source_viewing_record_id: int | None = None
    sign_at: datetime | None = None
    start_date: date | None = None
    end_date: date | None = None
    monthly_rent: Decimal | None = None
    deposit: Decimal | None = None
    payment_day: int | None = None
    status: str | None = None
    contract_files: list[dict[str, Any]] | None = None
    notes: str | None = None
    extra: dict[str, Any] | None = None


class LeaseOut(Schema):
    id: int
    house_id: int
    house: HouseSummaryOut
    tenant_id: int
    tenant: ContactSummaryOut
    source_viewing_record_id: int | None
    source_viewing_record: ViewingRecordSummaryOut | None
    sign_at: datetime | None
    start_date: date
    end_date: date
    monthly_rent: Decimal
    deposit: Decimal | None
    payment_day: int
    status: str
    status__mapping: str
    contract_files: list[dict[str, Any]]
    notes: str
    extra: dict[str, Any]

    @staticmethod
    def resolve_status__mapping(obj):
        return LeaseStatus.get_choice_label(obj.status)

    @staticmethod
    def resolve_contract_files(obj):
        return obj.contract_files_resolved
