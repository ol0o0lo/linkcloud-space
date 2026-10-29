"""公开通勤找房接口结构。"""

from typing import Literal

from ninja import Field, Schema

from apps.house.schemas.public import PublicHouseListOut, PublicHouseSearchFilters

CommuteMode = Literal["metro", "ebike", "bicycle", "walking", "driving"]


class CommutePlaceOut(Schema):
    name: str
    address: str
    city: str
    token: str
    longitude: float
    latitude: float
    distance_m: int | None = None


class CommuteDestinationIn(Schema):
    place_token: str


class CommuteDestinationOut(Schema):
    destination_id: int


class CommuteSearchIn(Schema):
    place_token: str | None = None
    destination_id: int | None = None
    mode: CommuteMode
    max_minutes: int = Field(ge=15, le=120)
    filters: PublicHouseSearchFilters = Field(default_factory=PublicHouseSearchFilters)
    retry: bool = False


class CommuteSearchCreatedOut(Schema):
    search_id: str
    destination_id: int


class CommuteProgressOut(Schema):
    status: Literal["pending", "ready", "failed"]
    processed: int
    total: int
    error: str


class CommuteHouseOut(PublicHouseListOut):
    commute_minutes: int
    commute_route_id: int

    @staticmethod
    def resolve_commute_minutes(obj):
        return (obj.commute_seconds + 59) // 60


class CommuteTransitSegmentOut(Schema):
    kind: Literal["walk", "metro"]
    label: str
    distance_m: int
    duration_seconds: int | None
    color: str = ""


class CommuteRouteOut(Schema):
    mode: CommuteMode
    destination_name: str
    duration_minutes: int
    distance_m: int
    walking_distance_m: int
    steps: list[str]
    transit_segments: list[CommuteTransitSegmentOut]


class CommuteRouteForHouseIn(Schema):
    house_id: int = Field(gt=0)
    destination_id: int = Field(gt=0)
    mode: CommuteMode
    retry: bool = False
