"""和风天气 GeoAPI 与坐标实况天气 v1 适配器。"""

import math
import re

from django.conf import settings
from django.utils import timezone

import requests

from apps.base.weather_providers.cache import CachedWeatherProvider
from apps.base.weather_providers.provider import (
    CurrentWeather,
    WeatherProviderConfigurationError,
    WeatherProviderResponseError,
    WeatherProviderUnavailable,
    WeatherRegion,
)
from apps.geography.coordinates import MapPoint


class QWeatherProvider(CachedWeatherProvider):
    code = "qweather"
    region_coordinate_decimals = 3
    weather_coordinate_decimals = 2
    region_cache_seconds = 30 * 60
    weather_cache_seconds = 30 * 60
    stale_cache_seconds = 60 * 60
    default_region: WeatherRegion = {
        "province": "广东省",
        "city": "广州市",
        "district": "天河区",
        "location_id": "113.36,23.12",
    }

    def _request(self, path: str, params: dict[str, str]) -> dict:
        host = settings.QWEATHER_API_HOST.strip().lower()
        key = settings.QWEATHER_API_KEY.strip()
        if not host or not key or not re.fullmatch(r"[a-z0-9][a-z0-9.-]*\.qweatherapi\.com", host):
            raise WeatherProviderConfigurationError("和风天气 API Host 或 Key 未正确配置")
        try:
            response = requests.get(f"https://{host}{path}", params=params, headers={"X-QW-Api-Key": key}, timeout=5)
            response.raise_for_status()
            payload = response.json()
        except (requests.RequestException, ValueError):
            raise WeatherProviderUnavailable("和风天气服务暂不可用") from None
        if not isinstance(payload, dict) or (path.startswith("/geo/") and str(payload.get("code")) != "200"):
            raise WeatherProviderUnavailable("和风天气服务暂不可用")
        return payload

    def _resolve_weather_region(self, point: MapPoint) -> WeatherRegion:
        longitude, latitude = point.to_gcj02()
        location = f"{longitude:.6f},{latitude:.6f}"
        payload = self._request("/geo/v2/city/lookup", {"location": location, "lang": "zh"})
        locations = payload.get("location")
        first = locations[0] if isinstance(locations, list) and locations else None
        if not isinstance(first, dict):
            raise WeatherProviderResponseError("和风天气地区结果无效")
        province = str(first.get("adm1") or "").strip()
        city = str(first.get("adm2") or "").strip()
        district = str(first.get("name") or "").strip()
        if not province or not city or not district:
            raise WeatherProviderResponseError("和风天气地区结果无效")
        precision = self.weather_coordinate_decimals
        return {"province": province, "city": city, "district": district, "location_id": f"{longitude:.{precision}f},{latitude:.{precision}f}"}

    def _fetch_current_weather(self, region: WeatherRegion) -> CurrentWeather:
        coordinates = region["location_id"]
        if not re.fullmatch(r"-?\d{1,3}\.\d{2},-?\d{1,2}\.\d{2}", coordinates):
            raise WeatherProviderResponseError("和风天气坐标无效")
        longitude, latitude = coordinates.split(",", 1)
        payload = self._request(f"/weather/v1/current/{latitude}/{longitude}", {"lang": "zh", "localTime": "true"})
        condition_data = payload.get("condition")
        temperature_data = payload.get("temperature")
        if not isinstance(condition_data, dict) or not isinstance(temperature_data, dict):
            raise WeatherProviderResponseError("和风天气实况结果无效")
        condition = str(condition_data.get("text") or "").strip()
        try:
            temperature = float(temperature_data["value"])
        except (KeyError, TypeError, ValueError) as exc:
            raise WeatherProviderResponseError("和风天气实况结果无效") from exc
        try:
            humidity = round(float(payload["humidity"]) * 100) if payload.get("humidity") is not None else None
        except (TypeError, ValueError):
            humidity = None
        if (
            temperature_data.get("unit") != "°C"
            or not condition
            or not math.isfinite(temperature)
            or not -100 <= temperature <= 70
            or (humidity is not None and not 0 <= humidity <= 100)
        ):
            raise WeatherProviderResponseError("和风天气实况结果无效")
        # v1 不返回观测时间，沿用对外字段记录本次获取时间。
        return {"temperature_c": temperature, "condition": condition, "humidity_percent": humidity, "observed_at": timezone.now().isoformat()}
