"""兼容旧导入路径；通用坐标实现位于 apps.geography.coordinates。"""

from apps.geography.coordinates import (
    COORDINATE_SYSTEM_GCJ02,
    COORDINATE_SYSTEM_WGS84,
    CoordinateSystem,
    MapPoint,
    convert_viewport_to_wgs84,
    gcj02_to_wgs84,
    is_outside_china,
    make_wgs84_point,
    serialize_point,
    validate_longitude_latitude,
    wgs84_to_gcj02,
)

__all__ = [
    "COORDINATE_SYSTEM_GCJ02",
    "COORDINATE_SYSTEM_WGS84",
    "CoordinateSystem",
    "MapPoint",
    "convert_viewport_to_wgs84",
    "gcj02_to_wgs84",
    "is_outside_china",
    "make_wgs84_point",
    "serialize_point",
    "validate_longitude_latitude",
    "wgs84_to_gcj02",
]
