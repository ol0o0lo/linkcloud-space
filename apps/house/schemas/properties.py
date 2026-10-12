from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Any, Literal

from ninja import Schema
from pydantic import ConfigDict, Field

from apps.geography.coordinates import serialize_point
from apps.house.constants import EstatePropertyType, HouseDecoration, HouseListingType, HouseOrientation, HouseStatus
from apps.house.schemas.common import BuildingSummaryOut, ContactSummaryOut, EstateSummaryOut, GeoPointIn, GeoPointOut, resolve_gcj02_location

HouseScope = Literal["all", "mine"]


HouseStatusValue = HouseStatus


HouseInspectionReason = Literal["missing_images", "missing_videos", "expired"]


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
    subdistrict: str = ""
    address: str = ""
    location: GeoPointIn | None = None
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
    subdistrict: str | None = None
    address: str | None = None
    location: GeoPointIn | None = None
    images: list[dict[str, Any]] | None = None
    description: str | None = None


class EstateOut(Schema):
    id: int
    name: str
    display_name: str
    developer: str | None
    built_year: int | None
    property_type: str
    property_type__mapping: str
    province: str
    city: str
    district: str
    subdistrict: str
    address: str
    location: GeoPointOut | None
    images: list[dict[str, Any]]
    description: str

    @staticmethod
    def resolve_property_type__mapping(obj):
        return EstatePropertyType.get_choice_label(obj.property_type)

    resolve_location = staticmethod(resolve_gcj02_location)

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
    province: str = Field(default="", max_length=64)
    city: str = Field(default="", max_length=64)
    district: str = Field(default="", max_length=64)
    subdistrict: str = Field(default="", max_length=64)
    floors: int
    under_floors: int | None = None
    year_built: int | None = None
    elevator: bool = False
    location: GeoPointIn | None = None
    address: str = ""
    images: list[dict[str, Any]] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)


class BuildingPatchIn(Schema):
    estate_id: int | None = None
    name: str | None = None
    province: str | None = Field(default=None, max_length=64)
    city: str | None = Field(default=None, max_length=64)
    district: str | None = Field(default=None, max_length=64)
    subdistrict: str | None = Field(default=None, max_length=64)
    floors: int | None = None
    under_floors: int | None = None
    year_built: int | None = None
    elevator: bool | None = None
    location: GeoPointIn | None = None
    address: str | None = None
    images: list[dict[str, Any]] | None = None
    tags: list[str] | None = None


class BuildingOut(Schema):
    id: int
    estate_id: int | None
    estate: EstateSummaryOut | None
    name: str
    province: str = ""
    city: str = ""
    district: str = ""
    subdistrict: str = ""
    floors: int
    under_floors: int | None
    year_built: int | None
    elevator: bool
    location: GeoPointOut | None
    address: str
    images: list[dict[str, Any]]
    tags: list[str]

    @staticmethod
    def resolve_images(obj):
        if isinstance(obj, dict):
            return obj.get("images", [])
        return obj.images_resolved

    resolve_location = staticmethod(resolve_gcj02_location)


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
    location: GeoPointOut
    counts: BuildingMapCountsOut

    @staticmethod
    def resolve_counts(obj):
        return {name: getattr(obj, name) for name in ("total", "vacant", "listed", "rented", "renovating")}

    resolve_location = staticmethod(resolve_gcj02_location)


class EstateMapMarkerOut(Schema):
    id: int
    name: str
    display_name: str
    address: str
    location: GeoPointOut
    location_source: Literal["estate", "building_centroid"]
    building_count: int
    located_building_count: int
    unlocated_building_count: int
    counts: BuildingMapCountsOut

    @staticmethod
    def resolve_location(obj):
        return serialize_point(obj.map_location)

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


class HouseIn(Schema):
    model_config = ConfigDict(extra="forbid")

    building_id: int
    landlord_id: int | None = None
    room_number: str
    listing_type: HouseListingType | None = None
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
    confirm_current: bool = False
    building_id: int | None = None
    landlord_id: int | None = None
    room_number: str | None = None
    listing_type: HouseListingType | None = None
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
    status: HouseStatusValue | None = None
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
    listing_type: HouseListingType | None
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
    status: HouseStatusValue
    status__mapping: str
    images: list[dict[str, Any]]
    videos: list[dict[str, Any]]
    tags: list[str]
    effective_tags: list[str]
    public_description: str
    internal_notes: str
    extra: dict[str, Any]
    updated_at: datetime
    inspection_reasons: list[HouseInspectionReason]
    inspection_due_at: datetime | None
    inspection_max_age_days: int | None

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

    @staticmethod
    def resolve_inspection_reasons(obj):
        if getattr(obj, "inspection_max_age_days", None) is None:
            return []
        reasons = []
        if not obj.images:
            reasons.append("missing_images")
        if not obj.videos:
            reasons.append("missing_videos")
        if getattr(obj, "inspection_expired", False):
            reasons.append("expired")
        return reasons

    @staticmethod
    def resolve_inspection_due_at(obj):
        return getattr(obj, "inspection_due_at", None)

    @staticmethod
    def resolve_inspection_max_age_days(obj):
        return getattr(obj, "inspection_max_age_days", None)
