"""公开通勤找房接口结构。"""

import re
from typing import Literal

from ninja import Field, Schema

from apps.house.public_search import PublicHouseSearchFilters
from apps.house.schemas import PublicHouseListOut
from apps.metro.models import MetroLine

CommuteMode = Literal["metro", "ebike", "bicycle", "walking", "driving"]
HEX_COLOR = re.compile(r"^#[0-9a-fA-F]{6}$")


def _line_key(name: str) -> str:
    return re.sub(r"\s+", "", re.split(r"[（(]", name, maxsplit=1)[0]).removeprefix("地铁")


def _metro_line_colors(city_name: str) -> dict[str, str]:
    city = city_name.strip().removesuffix("市")
    colors: dict[str, str] = {}
    for name, color in MetroLine.objects.filter(city__name__in=[city, f"{city}市"], is_active=True).values_list("name", "color"):
        if HEX_COLOR.fullmatch(color):
            colors[_line_key(name)] = color
    return colors


def _line_color(line_name: str, colors: dict[str, str]) -> str:
    key = _line_key(line_name)
    if key in colors:
        return colors[key]
    candidates = {color for name, color in colors.items() if name.startswith(key) or key.startswith(name)}
    return candidates.pop() if len(candidates) == 1 else ""


class CommutePlaceOut(Schema):
    name: str
    address: str
    city: str
    token: str
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

    @staticmethod
    def resolve_duration_minutes(obj):
        return (obj.duration_seconds + 59) // 60

    @staticmethod
    def resolve_destination_name(obj):
        return obj.destination.name

    @staticmethod
    def resolve_transit_segments(obj):
        segments = obj.transit_segments
        if obj.mode != "metro" or not segments:
            return segments
        colors = _metro_line_colors(obj.destination.city)
        return [{**segment, "color": _line_color(segment["label"], colors) if segment["kind"] == "metro" else ""} for segment in segments]


class CommuteRouteForHouseIn(Schema):
    house_id: int = Field(gt=0)
    destination_id: int = Field(gt=0)
    mode: CommuteMode
