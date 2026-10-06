"""工作台实况天气：定位失败时回退广州天河区。"""

from decimal import Decimal
from typing import Literal, TypedDict

from apps.base.maps import MapPoint
from apps.base.weather_providers import get_weather_provider
from apps.base.weather_providers.provider import CurrentWeather, WeatherProviderError


class WeatherLocation(TypedDict):
    province: str
    city: str
    district: str
    source: Literal["device", "default"]


class WeatherResult(TypedDict):
    provider: str
    location: WeatherLocation
    current: CurrentWeather
    stale: bool


def get_current_weather(latitude: Decimal | None = None, longitude: Decimal | None = None) -> WeatherResult:
    provider = get_weather_provider()
    region = provider.default_region
    location_source: Literal["device", "default"] = "default"
    if latitude is not None and longitude is not None:
        try:
            region = provider.resolve_weather_region(MapPoint.from_gcj02(longitude, latitude))
            location_source = "device"
        except WeatherProviderError:
            pass

    reading = provider.current_weather(region)

    return {
        "provider": provider.code,
        "location": {"province": region["province"], "city": region["city"], "district": region["district"], "source": location_source},
        "current": reading["current"],
        "stale": reading["stale"],
    }
