from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Any

from ninja import Schema

from apps.house.constants import HouseDecoration, HouseOrientation, HouseStatus
from apps.house.schemas.common import BuildingSummaryOut, ContactSummaryOut


class LandlordInvitationOut(Schema):
    organization_name: str
    contact_name: str
    invitee_phone_masked: str
    expires_at: datetime
    action_url: str | None = None


class LandlordInvitationAcceptOut(Schema):
    contact_id: int
    organization_id: int
    organization_name: str
    public_key: str


class LandlordRelationshipOut(Schema):
    contact_id: int
    organization_id: int
    organization_name: str
    organization_slug: str
    contact_name: str
    house_count: int
    public_house_count: int
    public_key: str
    public_url: str


class LandlordHouseOut(Schema):
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

    @staticmethod
    def resolve_orientation__mapping(obj):
        return HouseOrientation.get_choice_label(obj.orientation) if obj.orientation else ""

    @staticmethod
    def resolve_decoration__mapping(obj):
        return HouseDecoration.get_choice_label(obj.decoration) if obj.decoration else ""

    @staticmethod
    def resolve_status__mapping(obj):
        return HouseStatus.get_choice_label(obj.status)

    @staticmethod
    def resolve_images(obj):
        return obj.images_resolved

    @staticmethod
    def resolve_videos(obj):
        return obj.videos_resolved
