"""天气 Provider 共享的坐标与实况缓存。"""

from abc import ABC, abstractmethod

from django.core.cache import cache

from apps.base.weather_providers.provider import CurrentWeather, WeatherProviderError, WeatherReading, WeatherRegion
from apps.geography.coordinates import MapPoint


class CachedWeatherProvider(ABC):
    code: str
    default_region: WeatherRegion
    region_coordinate_decimals: int
    region_cache_seconds: int
    weather_cache_seconds: int
    stale_cache_seconds: int

    @abstractmethod
    def _resolve_weather_region(self, point: MapPoint) -> WeatherRegion: ...

    @abstractmethod
    def _fetch_current_weather(self, region: WeatherRegion) -> CurrentWeather: ...

    def resolve_weather_region(self, point: MapPoint) -> WeatherRegion:
        longitude, latitude = point.to_gcj02()
        precision = self.region_coordinate_decimals
        cache_key = f"weather:region:v3:{self.code}:{longitude:.{precision}f}:{latitude:.{precision}f}"
        region = cache.get(cache_key)
        if region is None:
            region = self._resolve_weather_region(point)
            cache.set(cache_key, region, timeout=self.region_cache_seconds)
        return region

    def current_weather(self, region: WeatherRegion) -> WeatherReading:
        cache_key = f"weather:current:{self.code}:{region['location_id']}"
        stale_key = f"{cache_key}:stale"
        current = cache.get(cache_key)
        if current is not None:
            return {"current": current, "stale": False}
        try:
            current = self._fetch_current_weather(region)
        except WeatherProviderError:
            current = cache.get(stale_key)
            if current is None:
                raise
            return {"current": current, "stale": True}
        cache.set(cache_key, current, timeout=self.weather_cache_seconds)
        cache.set(stale_key, current, timeout=self.stale_cache_seconds)
        return {"current": current, "stale": False}
