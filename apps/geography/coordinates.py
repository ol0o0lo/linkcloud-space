from __future__ import annotations

import math
from dataclasses import dataclass
from decimal import Decimal
from typing import Literal

from django.contrib.gis.geos import Point, Polygon

CoordinateSystem = Literal["gcj02", "wgs84"]
COORDINATE_SYSTEM_GCJ02: CoordinateSystem = "gcj02"
COORDINATE_SYSTEM_WGS84: CoordinateSystem = "wgs84"

_PI = math.pi
_AXIS = 6378245.0
_ECCENTRICITY_SQUARED = 0.006693421622965943


def _finite_coordinate(value: float, *, minimum: float, maximum: float, label: str) -> float:
    numeric = float(value)
    if not math.isfinite(numeric) or not minimum <= numeric <= maximum:
        raise ValueError(f"{label}必须在 {minimum:g} 到 {maximum:g} 之间")
    return numeric


def validate_longitude_latitude(longitude: float, latitude: float) -> tuple[float, float]:
    return (
        _finite_coordinate(longitude, minimum=-180, maximum=180, label="经度"),
        _finite_coordinate(latitude, minimum=-90, maximum=90, label="纬度"),
    )


def is_outside_china(longitude: float, latitude: float) -> bool:
    return longitude < 72.004 or longitude > 137.8347 or latitude < 0.8293 or latitude > 55.8271


def _transform_latitude(longitude_offset: float, latitude_offset: float) -> float:
    result = -100.0 + 2.0 * longitude_offset + 3.0 * latitude_offset + 0.2 * latitude_offset**2 + 0.1 * longitude_offset * latitude_offset
    result += 0.2 * math.sqrt(abs(longitude_offset))
    result += (20.0 * math.sin(6.0 * longitude_offset * _PI) + 20.0 * math.sin(2.0 * longitude_offset * _PI)) * 2.0 / 3.0
    result += (20.0 * math.sin(latitude_offset * _PI) + 40.0 * math.sin(latitude_offset / 3.0 * _PI)) * 2.0 / 3.0
    result += (160.0 * math.sin(latitude_offset / 12.0 * _PI) + 320.0 * math.sin(latitude_offset * _PI / 30.0)) * 2.0 / 3.0
    return result


def _transform_longitude(longitude_offset: float, latitude_offset: float) -> float:
    result = 300.0 + longitude_offset + 2.0 * latitude_offset + 0.1 * longitude_offset**2 + 0.1 * longitude_offset * latitude_offset
    result += 0.1 * math.sqrt(abs(longitude_offset))
    result += (20.0 * math.sin(6.0 * longitude_offset * _PI) + 20.0 * math.sin(2.0 * longitude_offset * _PI)) * 2.0 / 3.0
    result += (20.0 * math.sin(longitude_offset * _PI) + 40.0 * math.sin(longitude_offset / 3.0 * _PI)) * 2.0 / 3.0
    result += (150.0 * math.sin(longitude_offset / 12.0 * _PI) + 300.0 * math.sin(longitude_offset / 30.0 * _PI)) * 2.0 / 3.0
    return result


def wgs84_to_gcj02(longitude: float, latitude: float) -> tuple[float, float]:
    longitude, latitude = validate_longitude_latitude(longitude, latitude)
    if is_outside_china(longitude, latitude):
        return longitude, latitude

    latitude_delta = _transform_latitude(longitude - 105.0, latitude - 35.0)
    longitude_delta = _transform_longitude(longitude - 105.0, latitude - 35.0)
    radian_latitude = latitude / 180.0 * _PI
    magic = 1 - _ECCENTRICITY_SQUARED * math.sin(radian_latitude) ** 2
    sqrt_magic = math.sqrt(magic)
    latitude_delta = latitude_delta * 180.0 / ((_AXIS * (1 - _ECCENTRICITY_SQUARED)) / (magic * sqrt_magic) * _PI)
    longitude_delta = longitude_delta * 180.0 / (_AXIS / sqrt_magic * math.cos(radian_latitude) * _PI)
    return longitude + longitude_delta, latitude + latitude_delta


def gcj02_to_wgs84(longitude: float, latitude: float) -> tuple[float, float]:
    longitude, latitude = validate_longitude_latitude(longitude, latitude)
    if is_outside_china(longitude, latitude):
        return longitude, latitude

    wgs_longitude, wgs_latitude = longitude, latitude
    for _ in range(10):
        converted_longitude, converted_latitude = wgs84_to_gcj02(wgs_longitude, wgs_latitude)
        longitude_delta = converted_longitude - longitude
        latitude_delta = converted_latitude - latitude
        wgs_longitude -= longitude_delta
        wgs_latitude -= latitude_delta
        if max(abs(longitude_delta), abs(latitude_delta)) <= 1e-7:
            break
    return wgs_longitude, wgs_latitude


@dataclass(frozen=True)
class MapPoint:
    """应用内部统一使用 WGS84；厂商坐标仅在适配器内转换。"""

    longitude: float
    latitude: float

    def __post_init__(self) -> None:
        longitude, latitude = validate_longitude_latitude(self.longitude, self.latitude)
        object.__setattr__(self, "longitude", longitude)
        object.__setattr__(self, "latitude", latitude)

    @classmethod
    def from_gcj02(cls, longitude: float | Decimal, latitude: float | Decimal) -> MapPoint:
        return cls(*gcj02_to_wgs84(float(longitude), float(latitude)))

    def to_gcj02(self) -> tuple[float, float]:
        return wgs84_to_gcj02(self.longitude, self.latitude)


def make_wgs84_point(longitude: float, latitude: float, coordinate_system: CoordinateSystem) -> Point:
    longitude, latitude = validate_longitude_latitude(longitude, latitude)
    if coordinate_system == COORDINATE_SYSTEM_GCJ02:
        longitude, latitude = gcj02_to_wgs84(longitude, latitude)
    elif coordinate_system != COORDINATE_SYSTEM_WGS84:
        raise ValueError("当前仅支持 gcj02 或 wgs84 坐标系")
    return Point(longitude, latitude, srid=4326)


def serialize_point(point: Point | None, coordinate_system: CoordinateSystem = COORDINATE_SYSTEM_GCJ02) -> dict[str, float | str] | None:
    if point is None:
        return None
    if point.srid != 4326:
        point = point.clone()
        point.transform(4326)
    if coordinate_system != COORDINATE_SYSTEM_GCJ02:
        raise ValueError("当前仅支持 gcj02 坐标系")
    longitude, latitude = wgs84_to_gcj02(point.x, point.y)
    return {
        "longitude": round(longitude, 6),
        "latitude": round(latitude, 6),
        "coordinate_system": coordinate_system,
    }


def convert_viewport_to_wgs84(
    west: float,
    south: float,
    east: float,
    north: float,
    coordinate_system: CoordinateSystem,
) -> Polygon:
    corners = (
        make_wgs84_point(west, south, coordinate_system),
        make_wgs84_point(west, north, coordinate_system),
        make_wgs84_point(east, south, coordinate_system),
        make_wgs84_point(east, north, coordinate_system),
    )
    longitudes = [point.x for point in corners]
    latitudes = [point.y for point in corners]
    viewport = Polygon.from_bbox((min(longitudes), min(latitudes), max(longitudes), max(latitudes)))
    viewport.srid = 4326
    return viewport
