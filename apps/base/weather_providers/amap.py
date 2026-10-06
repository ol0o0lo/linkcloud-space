"""高德实况天气适配器。"""

import math
import re

from apps.base.maps.amap import AmapProvider, _region_component
from apps.base.maps.coordinates import MapPoint
from apps.base.maps.provider import MapProviderConfigurationError, MapProviderResponseError, MapProviderUnavailable
from apps.base.weather_providers.cache import CachedWeatherProvider
from apps.base.weather_providers.provider import (
    CurrentWeather,
    WeatherProviderConfigurationError,
    WeatherProviderResponseError,
    WeatherProviderUnavailable,
    WeatherRegion,
)


class AmapWeatherProvider(CachedWeatherProvider):
    code = "amap"
    region_coordinate_decimals = 3
    region_cache_seconds = 30 * 60
    weather_cache_seconds = 30 * 60
    stale_cache_seconds = 60 * 60
    default_region: WeatherRegion = {"province": "广东省", "city": "广州市", "district": "天河区", "location_id": "440106"}

    def __init__(self):
        self._client = AmapProvider()

    def _request(self, path: str, params: dict[str, object]) -> dict:
        try:
            return self._client._request(path, params)
        except MapProviderConfigurationError:
            raise WeatherProviderConfigurationError("高德天气 Key 未配置") from None
        except MapProviderResponseError:
            raise WeatherProviderResponseError("高德天气结果无效") from None
        except MapProviderUnavailable:
            raise WeatherProviderUnavailable("高德天气服务暂不可用") from None

    def _resolve_weather_region(self, point: MapPoint) -> WeatherRegion:
        payload = self._request("/v3/geocode/regeo", {"location": f"{point.to_gcj02()[0]:.6f},{point.to_gcj02()[1]:.6f}", "extensions": "base", "radius": 1000})
        regeocode = payload.get("regeocode")
        component = regeocode.get("addressComponent") if isinstance(regeocode, dict) else None
        if not isinstance(component, dict):
            raise WeatherProviderResponseError("高德天气地区结果无效")
        province = _region_component(component.get("province"))
        city = _region_component(component.get("city")) or province
        district = _region_component(component.get("district"))
        adcode = str(component.get("adcode") or "").strip()
        if not province or not city or not district or not re.fullmatch(r"\d{6}", adcode):
            raise WeatherProviderResponseError("高德天气地区编码无效")
        return {"province": province, "city": city, "district": district, "location_id": adcode}

    def _fetch_current_weather(self, region: WeatherRegion) -> CurrentWeather:
        adcode = region["location_id"]
        if not re.fullmatch(r"\d{6}", adcode):
            raise WeatherProviderResponseError("高德天气地区编码无效")
        payload = self._request("/v3/weather/weatherInfo", {"city": adcode, "extensions": "base"})
        lives = payload.get("lives")
        live = lives[0] if isinstance(lives, list) and lives else None
        if not isinstance(live, dict) or str(live.get("adcode") or "") != adcode:
            raise WeatherProviderResponseError("高德实况天气结果无效")
        condition = str(live.get("weather") or "").strip()
        observed_at = str(live.get("reporttime") or "").strip()
        try:
            temperature = float(live["temperature"])
        except (KeyError, TypeError, ValueError) as exc:
            raise WeatherProviderResponseError("高德实况天气结果无效") from exc
        try:
            humidity = int(live["humidity"]) if live.get("humidity") not in (None, "") else None
        except (TypeError, ValueError):
            humidity = None
        if not condition or not observed_at or not math.isfinite(temperature) or not -100 <= temperature <= 70 or (humidity is not None and not 0 <= humidity <= 100):
            raise WeatherProviderResponseError("高德实况天气结果无效")
        return {"temperature_c": temperature, "condition": condition, "humidity_percent": humidity, "observed_at": observed_at}
