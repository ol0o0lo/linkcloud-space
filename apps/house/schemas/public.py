from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Literal

from ninja import Schema
from pydantic import Field

from apps.data_migration.presentation import migration_media_for
from apps.house.constants import HouseDecoration, HouseListingType, HouseOrientation
from apps.house.schemas.common import BuildingRegionOut, GeoPointOut, resolve_gcj02_location
from apps.media.schemas import ResolvedMediaRefOut


class PublicPublisherOut(Schema):
    slug: str
    name: str
    logo: list[ResolvedMediaRefOut]
    description: str

    @staticmethod
    def resolve_logo(obj):
        return obj.logo_resolved


class PublicLandlordProfileOut(Schema):
    public_key: str
    name: str
    avatar: list[ResolvedMediaRefOut]
    phone: str
    organization: PublicPublisherOut
    house_count: int


class PublicEstateOut(Schema):
    id: int
    name: str
    display_name: str
    province: str
    city: str
    district: str
    subdistrict: str
    address: str


class PublicBuildingOut(Schema):
    id: int
    name: str
    address: str
    location: GeoPointOut | None
    estate: PublicEstateOut | None
    region: BuildingRegionOut

    @staticmethod
    def resolve_region(obj):
        return obj.effective_region

    resolve_location = staticmethod(resolve_gcj02_location)


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
    location: GeoPointOut | None
    images: list[ResolvedMediaRefOut]
    description: str
    publisher: PublicPublisherOut

    @staticmethod
    def resolve_images(obj):
        return obj.images_resolved

    @staticmethod
    def resolve_publisher(obj):
        return obj.organization

    resolve_location = staticmethod(resolve_gcj02_location)


class NearestMetroStationOut(Schema):
    name: str
    line_names: list[str]


class PublicHouseListOut(Schema):
    id: int
    room_number: str
    listing_type: HouseListingType | None
    floor: int | None
    area: Decimal | None
    asking_rent: Decimal | None
    deposit_amount: Decimal | None
    bedrooms: int | None
    living_rooms: int | None
    bathrooms: int | None
    orientation: str | None
    orientation__mapping: str
    decoration: str | None
    decoration__mapping: str
    has_elevator_access: bool
    images: list[ResolvedMediaRefOut]
    migration_media: list[dict] = Field(default_factory=list)
    resolve_migration_media = staticmethod(migration_media_for)
    tags: list[str]
    effective_tags: list[str]
    public_description: str
    building: PublicBuildingOut
    publisher: PublicPublisherOut
    updated_at: datetime
    distance_m: int | None = None
    nearest_metro_station: NearestMetroStationOut | None = None
    commute_minutes: int | None = None
    commute_route_id: int | None = None

    @staticmethod
    def resolve_commute_minutes(obj):
        seconds = getattr(obj, "commute_seconds", None)
        return (seconds + 59) // 60 if seconds is not None else None

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

    @staticmethod
    def resolve_distance_m(obj):
        distance = getattr(obj, "distance", None)
        if distance is None:
            return None
        meters = distance.m if hasattr(distance, "m") else float(distance)
        return round(meters)

    @staticmethod
    def resolve_nearest_metro_station(obj):
        name = getattr(obj, "nearest_metro_station_name", "")
        if not name:
            return None
        return {
            "name": name,
            "line_names": getattr(obj, "nearest_metro_line_names", []),
        }


class PublicHouseDetailOut(PublicHouseListOut):
    interior_area: Decimal | None
    kitchens: int | None
    balconies: int | None
    videos: list[ResolvedMediaRefOut]

    @staticmethod
    def resolve_videos(obj):
        return obj.videos_resolved


class PublicHouseFiltersOut(Schema):
    rent_min: Decimal | None
    rent_max: Decimal | None
    area_min: Decimal | None
    area_max: Decimal | None
    provinces: list[str]
    cities: list[str]
    districts: list[str]
    bedrooms: list[int]
    living_rooms: list[int]
    tags: list[str]


class PublicHouseSuggestionOut(Schema):
    keyword: str
    category: Literal["区域", "商圈", "小区", "楼栋", "房号"]
    house_count: int
    address: str = ""


class PublicHouseRegionSubdistrictOut(Schema):
    subdistrict: str
    house_count: int


class PublicHouseRegionDistrictOut(Schema):
    district: str
    house_count: int
    subdistricts: list[PublicHouseRegionSubdistrictOut]


class PublicHouseRegionCityOut(Schema):
    city: str
    house_count: int
    districts: list[PublicHouseRegionDistrictOut]


class PublicHouseRegionProvinceOut(Schema):
    province: str
    house_count: int
    cities: list[PublicHouseRegionCityOut]


class PublicHouseRegionsOut(Schema):
    items: list[PublicHouseRegionProvinceOut]


class PublicHouseLocatedRegionOut(Schema):
    province: str
    city: str
    district: str


PublicHouseMapLevel = Literal["city", "district", "estate", "building"]


class PublicHouseMapMarkerOut(Schema):
    key: str
    level: PublicHouseMapLevel
    name: str
    address: str
    location: GeoPointOut
    house_count: int
    child_count: int
    min_rent: Decimal | None
    target_zoom: int
    city: str = ""
    district: str = ""
    estate_id: int | None = None
    building_id: int | None = None


class PublicHouseMapOut(Schema):
    level: PublicHouseMapLevel
    zoom: int
    visible_house_count: int
    marker_count: int
    unlocated_house_count: int
    truncated: bool
    items: list[PublicHouseMapMarkerOut]


class PublicHouseSearchFilters(Schema):
    keyword: str | None = None
    listing_type: HouseListingType | None = None
    province: str | None = None
    city: str | None = None
    district: str | None = None
    subdistrict: str | None = None
    estate_id: int | None = None
    building_id: int | None = None
    min_rent: Decimal | None = None
    max_rent: Decimal | None = None
    min_area: Decimal | None = None
    max_area: Decimal | None = None
    bedrooms: int | None = None
    bedrooms_min: int | None = None
    living_rooms: int | None = None
    decoration: str | None = None
    has_elevator_access: bool | None = None
    tags: list[str] | None = None
    publisher_slug: str | None = None
    metro_stations: list[str] | None = None
    longitude: Decimal | None = None
    latitude: Decimal | None = None
    radius_m: int = 1000
    coordinate_system: Literal["gcj02"] | None = None
