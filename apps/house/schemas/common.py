from __future__ import annotations

from ninja import Schema

from apps.geography.coordinates import serialize_point
from apps.geography.schemas import GeoPointIn as GeoPointIn
from apps.geography.schemas import GeoPointOut as GeoPointOut


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


def resolve_gcj02_location(obj):
    if isinstance(obj, dict):
        return obj.get("location")
    return serialize_point(obj.location)


class EstateSummaryOut(Schema):
    id: int
    name: str
    display_name: str


class BuildingRegionOut(Schema):
    province: str
    city: str
    district: str
    subdistrict: str


class BuildingSummaryOut(Schema):
    id: int
    name: str
    estate_id: int | None
    estate: EstateSummaryOut | None
    elevator: bool
    address: str
    location: GeoPointOut | None

    resolve_location = staticmethod(resolve_gcj02_location)


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
