"""一次性组装路线展示数据，序列化期间不访问数据库。"""

import re

from apps.geography.models import MetroLine

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


def route_payload(route) -> dict:
    segments = route.transit_segments
    if route.mode == "metro" and segments:
        colors = _metro_line_colors(route.destination.city)
        segments = [{**segment, "color": _line_color(segment["label"], colors) if segment["kind"] == "metro" else ""} for segment in segments]
    return {
        "mode": route.mode,
        "destination_name": route.destination.name,
        "duration_minutes": (route.duration_seconds + 59) // 60,
        "distance_m": route.distance_m,
        "walking_distance_m": route.walking_distance_m,
        "steps": route.steps,
        "transit_segments": segments,
    }
