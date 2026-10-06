"""天气服务统一协议；对外使用经纬度，供应商地区编码仅留在适配器内。"""

from typing import Protocol, TypedDict

from apps.base.maps.coordinates import MapPoint


class WeatherRegion(TypedDict):
    province: str
    city: str
    district: str
    location_id: str


class CurrentWeather(TypedDict):
    temperature_c: float
    condition: str
    humidity_percent: int | None
    observed_at: str


class WeatherReading(TypedDict):
    current: CurrentWeather
    stale: bool


class WeatherProviderError(Exception):
    """天气服务错误。"""


class WeatherProviderConfigurationError(WeatherProviderError):
    """天气服务配置错误。"""


class WeatherProviderUnavailable(WeatherProviderError):
    """天气服务暂不可用。"""


class WeatherProviderResponseError(WeatherProviderError):
    """天气服务响应无效。"""


class WeatherProvider(Protocol):
    code: str
    default_region: WeatherRegion

    def resolve_weather_region(self, point: MapPoint) -> WeatherRegion: ...

    def current_weather(self, region: WeatherRegion) -> WeatherReading: ...
