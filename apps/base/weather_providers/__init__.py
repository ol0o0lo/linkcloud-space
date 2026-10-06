"""天气服务的统一入口。"""

from django.conf import settings

from apps.base.weather_providers.provider import WeatherProvider, WeatherProviderConfigurationError


def get_weather_provider() -> WeatherProvider:
    code = settings.WEATHER_PROVIDER
    if code == "amap":
        from apps.base.weather_providers.amap import AmapWeatherProvider

        return AmapWeatherProvider()
    if code == "qweather":
        from apps.base.weather_providers.qweather import QWeatherProvider

        return QWeatherProvider()
    raise WeatherProviderConfigurationError("未知天气服务提供方")
