from decimal import Decimal
from unittest.mock import patch

from django.core.cache import cache
from django.test import SimpleTestCase, override_settings

from ninja.errors import HttpError

from apps.base.maps import MapProviderConfigurationError, MapProviderResponseError, MapProviderUnavailable
from apps.geography.locations import get_nearby_pois, resolve_region
from tests.api_helpers import api_data


@override_settings(CACHES={"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache", "LOCATION": "geography-location-tests"}})
class GeographyLocationApiTestCase(SimpleTestCase):
    def setUp(self):
        cache.clear()
        self.params = {"longitude": "113.330000", "latitude": "23.140000", "coordinate_system": "gcj02"}

    def test_existing_metro_operation_ids_remain_compatible_with_generated_clients(self):
        from config.api import api

        schema = api.get_openapi_schema()
        self.assertEqual(schema["paths"]["/api/public/metro/cities/"]["get"]["operationId"], "apps_metro_api_list_public_metro_cities")
        self.assertEqual(schema["paths"]["/api/public/metro/cities/{city_name}/"]["get"]["operationId"], "apps_metro_api_get_public_metro_city")

    @patch("apps.geography.locations.get_place_provider")
    def test_region_resolution_and_house_legacy_route_share_cache(self, provider_factory):
        provider = provider_factory.return_value
        provider.code = "amap"
        provider.reverse_geocode.return_value = {"province": "广东省", "city": "广州市", "district": "天河区"}

        for url in ("/api/geography/regions/resolve/", "/api/public/houses/regions/resolve/"):
            response = self.client.get(url, self.params)
            self.assertEqual(response.status_code, 200, response.content)
            self.assertEqual(api_data(response), provider.reverse_geocode.return_value)
        provider.reverse_geocode.assert_called_once()

    @patch("apps.geography.locations.get_place_provider")
    def test_region_cache_is_isolated_by_provider(self, provider_factory):
        provider = provider_factory.return_value
        provider.reverse_geocode.return_value = {"province": "广东省", "city": "广州市", "district": "天河区"}

        for code in ("amap", "another-map"):
            provider.code = code
            self.assertEqual(self.client.get("/api/geography/regions/resolve/", self.params).status_code, 200)
        self.assertEqual(provider.reverse_geocode.call_count, 2)

    @patch("apps.geography.locations.get_place_provider")
    def test_region_errors_keep_existing_http_statuses(self, provider_factory):
        provider = provider_factory.return_value
        provider.code = "amap"
        for error, status in ((MapProviderConfigurationError, 503), (MapProviderResponseError, 502), (MapProviderUnavailable, 502)):
            with self.subTest(error=error):
                provider.reverse_geocode.side_effect = error("地图不可用")
                self.assertEqual(self.client.get("/api/geography/regions/resolve/", self.params).status_code, status)

    @patch("apps.geography.locations.get_place_provider")
    def test_nearby_pois_and_legacy_route_share_cache(self, provider_factory):
        provider = provider_factory.return_value
        provider.code = "amap"
        provider.nearby_pois.return_value = {"bus": [], "subway": [], "education": [], "medical": []}
        params = {"lat": "23.140000", "lng": "113.330000"}

        for url in ("/api/geography/nearby-pois/", "/api/nearby-pois/"):
            response = self.client.get(url, params)
            self.assertEqual(response.status_code, 200, response.content)
            self.assertEqual(api_data(response), provider.nearby_pois.return_value)
        provider.nearby_pois.assert_called_once()

    @patch("apps.geography.locations.get_place_provider")
    def test_invalid_coordinates_do_not_query_map_provider(self, provider_factory):
        response = self.client.get("/api/geography/regions/resolve/", {**self.params, "latitude": "91"})
        self.assertEqual(response.status_code, 422)
        response = self.client.get("/api/geography/nearby-pois/", {"lat": "91", "lng": "113.33"})
        self.assertEqual(response.status_code, 422)
        provider_factory.assert_not_called()

    @patch("apps.geography.locations.get_place_provider")
    def test_non_finite_coordinates_and_exact_out_of_range_values_are_rejected(self, provider_factory):
        for latitude in (Decimal("NaN"), Decimal("Infinity"), Decimal("90.00000000000000001")):
            with self.subTest(latitude=latitude):
                params = {"latitude": latitude, "longitude": Decimal("113.33")}
                with self.assertRaises(HttpError) as error:
                    resolve_region(**params, coordinate_system="gcj02")
                self.assertEqual(error.exception.status_code, 422)
                with self.assertRaises(HttpError) as error:
                    get_nearby_pois(**params)
                self.assertEqual(error.exception.status_code, 422)
        provider_factory.assert_not_called()
