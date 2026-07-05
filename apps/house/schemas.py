from datetime import date, datetime
from decimal import Decimal
from typing import Any

from ninja import Schema
from pydantic import ConfigDict, Field

from apps.house.constants import ContactRole, EstatePropertyType, HouseDecoration, HouseOrientation, HousePublishStatus, HouseStatus, LeaseStatus, ViewingRecordStatus


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
    is_active: bool = True


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
    is_active: bool | None = None


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
    is_active: bool

    @staticmethod
    def resolve_property_type__mapping(obj):
        return EstatePropertyType.get_choice_label(obj.property_type)

    @staticmethod
    def resolve_images(obj):
        return obj.images_resolved


class BuildingIn(Schema):
    estate_id: int
    name: str
    floors: int
    under_floors: int | None = None
    year_built: int | None = None
    elevator: bool = False
    lat: Decimal | None = None
    lng: Decimal | None = None
    address: str = ""
    is_active: bool = True


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
    is_active: bool | None = None


class EstateSummaryOut(Schema):
    id: int
    name: str
    display_name: str


class BuildingSummaryOut(Schema):
    id: int
    name: str
    estate_id: int
    estate: EstateSummaryOut


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
        return f"{obj.building.estate.display_name or obj.building.estate.name} / {obj.building.name} / {obj.room_number}"


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
    estate_id: int
    estate: EstateSummaryOut
    name: str
    floors: int
    under_floors: int | None
    year_built: int | None
    elevator: bool
    lat: Decimal | None
    lng: Decimal | None
    address: str
    is_active: bool


class DefaultBuildingIn(Schema):
    building_id: int


class DefaultBuildingOut(Schema):
    id: int
    estate_id: int
    estate: EstateSummaryOut
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
    publish_status: str | None = None
    images: list[dict[str, Any]] | None = None
    videos: list[dict[str, Any]] | None = None
    tags: list[str] | None = None
    public_description: str | None = None
    internal_notes: str | None = None
    extra: dict[str, Any] | None = None
    is_active: bool | None = None


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
    publish_status: str
    publish_status__mapping: str
    images: list[dict[str, Any]]
    videos: list[dict[str, Any]]
    tags: list[str]
    public_description: str
    internal_notes: str
    extra: dict[str, Any]
    is_active: bool

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
    def resolve_publish_status__mapping(obj):
        return HousePublishStatus.get_choice_label(obj.publish_status)

    @staticmethod
    def resolve_images(obj):
        return obj.images_resolved

    @staticmethod
    def resolve_videos(obj):
        return obj.videos_resolved


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
