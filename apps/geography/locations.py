"""定位相关的地区解析、周边设施查询与缓存。"""

from decimal import Decimal

from django.core.cache import cache

from ninja.errors import HttpError

from apps.base.maps import MapProviderConfigurationError, MapProviderError, MapProviderResponseError, get_place_provider
from apps.base.maps.provider import LocatedRegion, NearbyPoi
from apps.geography.coordinates import CoordinateSystem, MapPoint

REGION_RESOLVE_CACHE_SECONDS = 30 * 24 * 60 * 60
NEARBY_POI_CACHE_SECONDS = 30 * 24 * 60 * 60


def _normalized_coordinates(longitude: Decimal, latitude: Decimal) -> tuple[str, str]:
    if not longitude.is_finite() or not latitude.is_finite() or not -180 <= longitude <= 180 or not -90 <= latitude <= 90:
        raise HttpError(422, "经纬度无效")
    return f"{longitude:.6f}", f"{latitude:.6f}"


def resolve_region(*, latitude: Decimal, longitude: Decimal, coordinate_system: CoordinateSystem) -> LocatedRegion:
    if coordinate_system != "gcj02":
        raise HttpError(422, "定位坐标必须使用 coordinate_system=gcj02")
    normalized_longitude, normalized_latitude = _normalized_coordinates(longitude, latitude)
    provider = get_place_provider()
    cache_key = f"geography-region-resolve:v1:{provider.code}:{normalized_longitude}:{normalized_latitude}"
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    try:
        result = provider.reverse_geocode(MapPoint.from_gcj02(Decimal(normalized_longitude), Decimal(normalized_latitude)))
    except MapProviderConfigurationError as exc:
        raise HttpError(503, "地图逆地理编码服务未配置") from exc
    except MapProviderResponseError as exc:
        raise HttpError(502, "地图逆地理编码结果无效") from exc
    except MapProviderError as exc:
        raise HttpError(502, "地图逆地理编码服务暂不可用") from exc
    cache.set(cache_key, result, timeout=REGION_RESOLVE_CACHE_SECONDS)
    return result


def get_nearby_pois(*, latitude: Decimal, longitude: Decimal) -> dict[str, list[NearbyPoi]]:
    normalized_longitude, normalized_latitude = _normalized_coordinates(longitude, latitude)
    provider = get_place_provider()
    cache_key = f"nearby-pois:v3:{provider.code}:{normalized_longitude}:{normalized_latitude}"
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    try:
        pois = provider.nearby_pois(MapPoint.from_gcj02(Decimal(normalized_longitude), Decimal(normalized_latitude)))
    except MapProviderConfigurationError as exc:
        raise HttpError(503, "地图周边服务未配置") from exc
    except MapProviderError as exc:
        raise HttpError(502, "地图周边服务暂不可用") from exc
    cache.set(cache_key, pois, timeout=NEARBY_POI_CACHE_SECONDS)
    return pois
