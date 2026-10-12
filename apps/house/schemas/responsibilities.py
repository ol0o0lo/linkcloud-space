from __future__ import annotations

from ninja import Schema
from pydantic import Field

from apps.house.schemas.common import BuildingSummaryOut, ContactSummaryOut, EstateSummaryOut
from apps.organizations.schemas import OrgUserOut


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
        responsibilities = obj.prefetched_property_responsibilities
        return [item.landlord for item in responsibilities if item.landlord_id]

    @staticmethod
    def resolve_buildings(obj):
        responsibilities = obj.prefetched_property_responsibilities
        return [item.building for item in responsibilities if item.building_id]

    @staticmethod
    def resolve_estates(obj):
        responsibilities = obj.prefetched_property_responsibilities
        return [item.estate for item in responsibilities if item.estate_id]


class PropertyResponsibilitySummaryOut(Schema):
    member_count: int
    configured_member_count: int
    unconfigured_member_count: int
    responsible_house_count_sum: int
