from unittest.mock import patch

from django.core.cache import cache
from django.test import SimpleTestCase, TestCase, override_settings

from apps.accounts.models import User
from apps.base.maps import MapPoint
from apps.base.weather_providers import get_weather_provider
from apps.base.weather_providers.amap import AmapWeatherProvider
from apps.base.weather_providers.provider import WeatherProviderConfigurationError, WeatherProviderResponseError, WeatherProviderUnavailable
from apps.base.weather_providers.qweather import QWeatherProvider
from tests.api_helpers import api_data

WEATHER_DATA = {"temperature_c": 27.0, "condition": "多云", "humidity_percent": 68, "observed_at": "2026-09-27 16:00:00"}
TIANHE = {"province": "广东省", "city": "广州市", "district": "天河区", "location_id": "440106"}
NANSHAN = {"province": "广东省", "city": "深圳市", "district": "南山区", "location_id": "440305"}


@override_settings(AMAP_WEB_SERVICE_KEY="test-weather-key")
class AmapWeatherProviderTests(SimpleTestCase):
    @patch("apps.base.maps.amap.requests.get")
    def test_resolves_adcode_and_reads_live_weather(self, mock_get):
        mock_get.return_value.json.side_effect = [
            {"status": "1", "regeocode": {"addressComponent": {"province": "广东省", "city": "广州市", "district": "天河区", "adcode": "440106"}}},
            {"status": "1", "count": "1", "lives": [{"adcode": "440106", "weather": "多云", "temperature": "27", "humidity": "68", "reporttime": "2026-09-27 16:00:00"}]},
        ]
        provider = AmapWeatherProvider()

        self.assertEqual(provider._resolve_weather_region(MapPoint.from_gcj02(113.36, 23.12)), TIANHE)
        self.assertEqual(provider._fetch_current_weather(TIANHE), WEATHER_DATA)
        self.assertIn("/v3/weather/weatherInfo", mock_get.call_args.args[0])
        self.assertEqual(mock_get.call_args.kwargs["params"]["city"], "440106")
        self.assertEqual(mock_get.call_args.kwargs["params"]["extensions"], "base")

    @patch("apps.base.maps.amap.requests.get")
    def test_rejects_empty_weather_result(self, mock_get):
        mock_get.return_value.json.return_value = {"status": "1", "count": "0", "lives": []}
        with self.assertRaises(WeatherProviderResponseError):
            AmapWeatherProvider()._fetch_current_weather(TIANHE)


@override_settings(QWEATHER_API_HOST="example.qweatherapi.com", QWEATHER_API_KEY="test-qweather-key")
class QWeatherProviderTests(SimpleTestCase):
    @patch("apps.base.weather_providers.qweather.requests.get")
    def test_resolves_coordinates_and_reads_live_weather(self, mock_get):
        mock_get.return_value.json.side_effect = [
            {"code": "200", "location": [{"id": "101280109", "name": "天河", "adm1": "广东省", "adm2": "广州市"}]},
            {"condition": {"text": "多云"}, "temperature": {"value": 27, "unit": "°C"}, "humidity": 0.68},
        ]
        provider = QWeatherProvider()
        region = provider._resolve_weather_region(MapPoint.from_gcj02(113.36, 23.12))

        self.assertEqual(region["district"], "天河")
        self.assertIn(",", region["location_id"])
        self.assertEqual(mock_get.call_args_list[0].args[0], "https://example.qweatherapi.com/geo/v2/city/lookup")
        self.assertEqual(mock_get.call_args_list[0].kwargs["params"]["location"], "113.360000,23.120000")
        self.assertEqual(provider._fetch_current_weather(region)["humidity_percent"], 68)
        self.assertIn("/weather/v1/current/", mock_get.call_args.args[0])
        self.assertEqual(mock_get.call_args.kwargs["headers"], {"X-QW-Api-Key": "test-qweather-key"})

    @patch("apps.base.weather_providers.qweather.requests.get")
    def test_default_region_uses_tianhe_coordinates(self, mock_get):
        mock_get.return_value.json.return_value = {"condition": {"text": "多云"}, "temperature": {"value": 27, "unit": "°C"}, "humidity": 0.68}
        region = QWeatherProvider.default_region

        self.assertEqual(region["district"], "天河区")
        self.assertEqual(QWeatherProvider()._fetch_current_weather(region)["condition"], "多云")
        self.assertIn("/weather/v1/current/", mock_get.call_args.args[0])

    @patch("apps.base.weather_providers.qweather.requests.get")
    def test_rejects_invalid_weather_response(self, mock_get):
        mock_get.return_value.json.return_value = {"condition": {"text": "多云"}, "temperature": {"value": "nan", "unit": "°C"}, "humidity": 0.68}
        with self.assertRaises(WeatherProviderResponseError):
            QWeatherProvider()._fetch_current_weather(QWeatherProvider.default_region)

    @override_settings(QWEATHER_API_HOST="https://example.com/path")
    def test_rejects_invalid_host(self):
        with self.assertRaises(WeatherProviderConfigurationError):
            QWeatherProvider()._fetch_current_weather(QWeatherProvider.default_region)


class WeatherProviderSelectionTests(SimpleTestCase):
    @override_settings(WEATHER_PROVIDER="amap")
    def test_amap_choice(self):
        self.assertIsInstance(get_weather_provider(), AmapWeatherProvider)

    @override_settings(WEATHER_PROVIDER="qweather")
    def test_qweather_choice(self):
        self.assertIsInstance(get_weather_provider(), QWeatherProvider)


@override_settings(CACHES={"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache", "LOCATION": "weather-api-test"}})
class CurrentWeatherApiTests(TestCase):
    def setUp(self):
        cache.clear()
        user = User.objects.create_user(username="weather-user", email="weather@example.com", password="secret123")  # noqa: S106
        self.client.force_login(user)

    @patch("apps.base.weather.get_weather_provider")
    def test_no_location_uses_tianhe(self, provider_factory):
        provider = provider_factory.return_value
        provider.code = "amap"
        provider.default_region = TIANHE
        provider.current_weather.return_value = {"current": WEATHER_DATA, "stale": False}

        first = self.client.get("/api/weather/current/")
        second = self.client.get("/api/weather/current/")

        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 200)
        self.assertEqual(api_data(first)["location"], {"province": "广东省", "city": "广州市", "district": "天河区", "source": "default"})
        self.assertEqual(api_data(first)["current"], WEATHER_DATA)
        self.assertEqual(provider.current_weather.call_count, 2)
        provider.resolve_weather_region.assert_not_called()

    @override_settings(WEATHER_PROVIDER="amap")
    @patch("apps.base.weather_providers.amap.AmapWeatherProvider._fetch_current_weather", return_value=WEATHER_DATA)
    @patch("apps.base.weather_providers.amap.AmapWeatherProvider._resolve_weather_region", return_value=NANSHAN)
    def test_nearby_device_coordinates_share_thirty_minute_cache(self, resolve_region, fetch_weather):
        first_params = {"latitude": "22.53311", "longitude": "113.93041", "coordinate_system": "gcj02"}
        second_params = {"latitude": "22.53314", "longitude": "113.93044", "coordinate_system": "gcj02"}

        with patch("apps.base.weather_providers.cache.cache.set", wraps=cache.set) as cache_set:
            first = self.client.get("/api/weather/current/", first_params)
            second = self.client.get("/api/weather/current/", second_params)

        self.assertEqual(api_data(first)["location"], {"province": "广东省", "city": "深圳市", "district": "南山区", "source": "device"})
        self.assertEqual(api_data(second)["current"], WEATHER_DATA)
        resolve_region.assert_called_once()
        fetch_weather.assert_called_once_with(NANSHAN)
        cache_set.assert_any_call("weather:region:v3:amap:113.930:22.533", NANSHAN, timeout=1800)
        cache_set.assert_any_call("weather:current:amap:440305", WEATHER_DATA, timeout=1800)

    @patch("apps.base.weather.get_weather_provider")
    def test_reverse_geocode_failure_uses_default_region(self, provider_factory):
        provider = provider_factory.return_value
        provider.code = "amap"
        provider.default_region = TIANHE
        provider.resolve_weather_region.side_effect = WeatherProviderUnavailable("地图不可用")
        provider.current_weather.return_value = {"current": WEATHER_DATA, "stale": False}

        response = self.client.get("/api/weather/current/", {"latitude": "22.5331", "longitude": "113.9304"})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(api_data(response)["location"]["source"], "default")
        provider.current_weather.assert_called_once_with(TIANHE)

    @patch("apps.base.weather.get_weather_provider")
    def test_upstream_failure_without_cache_returns_502(self, provider_factory):
        provider = provider_factory.return_value
        provider.code = "amap"
        provider.default_region = TIANHE
        provider.current_weather.side_effect = WeatherProviderUnavailable("天气不可用")
        self.assertEqual(self.client.get("/api/weather/current/").status_code, 502)

    @override_settings(WEATHER_PROVIDER="amap")
    @patch("apps.base.weather_providers.amap.AmapWeatherProvider._fetch_current_weather", side_effect=WeatherProviderUnavailable("天气不可用"))
    def test_upstream_failure_uses_stale_cache(self, fetch_weather):
        cache.set("weather:current:amap:440106:stale", WEATHER_DATA, timeout=60)

        response = self.client.get("/api/weather/current/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(api_data(response)["current"], WEATHER_DATA)
        self.assertTrue(api_data(response)["stale"])
        fetch_weather.assert_called_once_with(TIANHE)

    def test_rejects_incomplete_or_invalid_coordinates(self):
        self.assertEqual(self.client.get("/api/weather/current/", {"latitude": "23.1"}).status_code, 422)
        self.assertEqual(self.client.get("/api/weather/current/", {"latitude": "93", "longitude": "113"}).status_code, 422)
        self.assertEqual(self.client.get("/api/weather/current/", {"latitude": "NaN", "longitude": "113"}).status_code, 400)

    @override_settings(WEATHER_PROVIDER="qweather", QWEATHER_API_HOST="example.qweatherapi.com", QWEATHER_API_KEY="test-qweather-key")
    @patch("apps.base.weather_providers.qweather.requests.get")
    def test_qweather_device_coordinates_through_api(self, mock_get):
        mock_get.return_value.json.side_effect = [
            {"code": "200", "location": [{"id": "101280109", "name": "天河", "adm1": "广东省", "adm2": "广州市"}]},
            {"condition": {"text": "多云"}, "temperature": {"value": 27, "unit": "°C"}, "humidity": 0.68},
        ]

        response = self.client.get("/api/weather/current/", {"latitude": "23.124", "longitude": "113.361"})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(api_data(response)["provider"], "qweather")
        self.assertEqual(api_data(response)["location"]["source"], "device")
        self.assertEqual(api_data(response)["current"]["humidity_percent"], 68)
        self.assertEqual(mock_get.call_count, 2)

    @override_settings(WEATHER_PROVIDER="qweather", QWEATHER_API_HOST="example.qweatherapi.com", QWEATHER_API_KEY="test-qweather-key")
    @patch("apps.base.weather_providers.qweather.requests.get")
    def test_qweather_weather_cache_uses_hundredth_degree(self, mock_get):
        location = {"code": "200", "location": [{"name": "天河", "adm1": "广东省", "adm2": "广州市"}]}
        current = {"condition": {"text": "晴"}, "temperature": {"value": 29.1, "unit": "°C"}, "humidity": 0.65}
        mock_get.return_value.json.side_effect = [location, current, location]

        with patch("apps.base.weather_providers.cache.cache.set", wraps=cache.set) as cache_set:
            first = self.client.get("/api/weather/current/", {"latitude": "23.1201", "longitude": "113.3601"})
            second = self.client.get("/api/weather/current/", {"latitude": "23.1209", "longitude": "113.3611"})

        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 200)
        self.assertEqual(api_data(first)["current"], api_data(second)["current"])
        self.assertEqual(mock_get.call_count, 3)
        self.assertEqual(sum("/weather/v1/current/" in call.args[0] for call in mock_get.call_args_list), 1)
        cache_set.assert_any_call("weather:current:qweather:113.36,23.12", api_data(first)["current"], timeout=1800)
