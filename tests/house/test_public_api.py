from decimal import Decimal
from unittest.mock import Mock, patch

from django.core.cache import cache
from django.test import TestCase
from django.test.utils import override_settings
from django.utils import timezone

import requests
from model_bakery import baker

from apps.house.constants import ContactRole, EstatePropertyType, HouseListingType, HouseStatus
from apps.house.geo.coordinates import make_wgs84_point
from apps.house.models import Building, Contact, Estate, House
from apps.metro.models import MetroCity, MetroLine, MetroLineStation, MetroStation
from tests.api_helpers import api_data


class PublicHouseApiTestCase(TestCase):
    def setUp(self):
        cache.clear()

    def make_house(
        self,
        *,
        org_slug: str,
        org_name: str,
        room_number: str,
        status: str = HouseStatus.LISTED,
        asking_rent: Decimal = Decimal("2600.00"),
        org_active: bool = True,
        province: str = "广东",
        city: str = "深圳",
        district: str = "南山",
        subdistrict: str = "",
    ) -> House:
        organization = baker.make(
            "organizations.Organization",
            name=org_name,
            slug=org_slug,
            description=f"{org_name}介绍",
            billing_email=f"billing@{org_slug}.example.com",
            is_active=org_active,
        )
        estate = Estate.objects.create(
            organization=organization,
            name=f"{org_name}小区",
            display_name=f"{org_name}小区",
            property_type=EstatePropertyType.RESIDENTIAL,
            province=province,
            city=city,
            district=district,
            subdistrict=subdistrict,
            address="科技园路",
        )
        building = Building.objects.create(
            organization=organization,
            estate=estate,
            name="1栋",
            address="科技园路 1 号",
            floors=20,
        )
        landlord = Contact.objects.create(
            organization=organization,
            name=f"{org_name}房东",
            phone="13800138000",
            roles=[ContactRole.LANDLORD],
        )
        return House.objects.create(
            building=building,
            landlord=landlord,
            room_number=room_number,
            status=status,
            asking_rent=asking_rent,
            bedrooms=1,
            living_rooms=0,
            public_description=f"{room_number}公开描述",
            internal_notes=f"{room_number}内部备注",
            extra={"internal_source": "private"},
        )

    def test_anonymous_user_can_search_listed_houses_across_organizations(self):
        first = self.make_house(org_slug="publisher-a", org_name="发布方甲", room_number="101")
        first.deposit_amount = Decimal("2600.00")
        first.save(update_fields=["deposit_amount", "updated_at"])
        second = self.make_house(org_slug="publisher-b", org_name="发布方乙", room_number="101", asking_rent=Decimal("3200.00"))
        self.make_house(org_slug="publisher-c", org_name="发布方丙", room_number="303", status=HouseStatus.VACANT)
        self.make_house(org_slug="publisher-d", org_name="发布方丁", room_number="404", org_active=False)

        response = self.client.get("/api/public/houses/", {"page": 1, "page_size": 20})

        self.assertEqual(response.status_code, 200)
        payload = api_data(response)
        self.assertEqual({item["id"] for item in payload["items"]}, {first.pk, second.pk})
        first_item = next(item for item in payload["items"] if item["id"] == first.pk)
        self.assertEqual(
            first_item["publisher"],
            {
                "slug": "publisher-a",
                "name": "发布方甲",
                "logo": [],
                "description": "发布方甲介绍",
            },
        )
        self.assertEqual(first_item["deposit_amount"], "2600.00")
        self.assertNotIn("landlord", first_item)
        self.assertNotIn("internal_notes", first_item)
        self.assertNotIn("extra", first_item)
        self.assertNotIn("billing_email", first_item["publisher"])

    def test_anonymous_user_can_read_public_house_detail_without_internal_fields(self):
        house = self.make_house(org_slug="detail-publisher", org_name="详情发布方", room_number="801")
        house.deposit_amount = Decimal("5200.00")
        house.interior_area = Decimal("36.50")
        house.kitchens = 1
        house.balconies = 1
        house.save()

        response = self.client.get(f"/api/public/houses/{house.pk}/")

        self.assertEqual(response.status_code, 200)
        payload = api_data(response)
        self.assertEqual(payload["id"], house.pk)
        self.assertEqual(payload["deposit_amount"], "5200.00")
        self.assertEqual(payload["interior_area"], "36.50")
        self.assertEqual(payload["publisher"]["slug"], "detail-publisher")
        self.assertNotIn("landlord", payload)
        self.assertNotIn("internal_notes", payload)
        self.assertNotIn("extra", payload)

    def test_public_house_suggestions_only_include_visible_houses_in_selected_city(self):
        visible = self.make_house(org_slug="suggest-a", org_name="联想甲", room_number="A101", subdistrict="科技园")
        self.make_house(org_slug="suggest-b", org_name="联想乙", room_number="B202", status=HouseStatus.VACANT, subdistrict="科技园")
        self.make_house(org_slug="suggest-c", org_name="联想丙", room_number="C303", city="广州", subdistrict="科技园")

        response = self.client.get("/api/public/houses/suggestions/", {"keyword": "联想", "city": "深圳"})
        self.assertEqual(response.status_code, 200)
        suggestions = api_data(response)
        self.assertEqual([item["keyword"] for item in suggestions], [visible.building.estate.display_name])
        self.assertEqual(suggestions[0]["house_count"], 1)

        self.assertEqual(api_data(self.client.get("/api/public/houses/suggestions/", {"city": "深圳"})), [])
        self.assertEqual(api_data(self.client.get("/api/public/houses/suggestions/", {"keyword": "  ", "city": "深圳"})), [])

        district_results = api_data(self.client.get("/api/public/houses/", {"keyword": "南山", "city": "深圳", "page": 1, "page_size": 20}))
        self.assertEqual([item["id"] for item in district_results["items"]], [visible.pk])

    def test_public_house_search_filters_global_inventory(self):
        matching = self.make_house(org_slug="filter-a", org_name="筛选甲", room_number="101", asking_rent=Decimal("2600.00"), subdistrict="科技园")
        matching.tags = ["近地铁", "采光好"]
        matching.area = Decimal("42.00")
        matching.building.tags = ["有电梯"]
        matching.building.save(update_fields=["tags", "updated_at"])
        matching.save()

        expensive = self.make_house(org_slug="filter-b", org_name="筛选乙", room_number="202", asking_rent=Decimal("3600.00"), subdistrict="后海")
        expensive.tags = ["近地铁"]
        expensive.area = Decimal("45.00")
        expensive.save()

        other_city = self.make_house(org_slug="filter-c", org_name="筛选丙", room_number="303", asking_rent=Decimal("2800.00"))
        other_city.tags = ["近地铁"]
        other_city.building.estate.city = "广州"
        other_city.building.estate.save(update_fields=["city", "updated_at"])

        response = self.client.get(
            "/api/public/houses/",
            {
                "city": "深圳",
                "district": "南山",
                "subdistrict": "科技园",
                "min_rent": "2500",
                "max_rent": "3000",
                "min_area": "40",
                "max_area": "43",
                "bedrooms": 1,
                "living_rooms": 0,
                "tags": ["近地铁", "有电梯"],
                "page": 1,
                "page_size": 20,
            },
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual([item["id"] for item in api_data(response)["items"]], [matching.pk])

    def test_listing_type_and_minimum_bedrooms_filter_public_houses(self):
        whole = self.make_house(org_slug="category-whole", org_name="整租方", room_number="101")
        whole.listing_type = HouseListingType.WHOLE
        whole.bedrooms = 3
        whole.save(update_fields=["listing_type", "bedrooms", "updated_at"])
        shared = self.make_house(org_slug="category-shared", org_name="合租方", room_number="202")
        shared.listing_type = HouseListingType.SHARED
        shared.bedrooms = 3
        shared.save(update_fields=["listing_type", "bedrooms", "updated_at"])
        self.make_house(org_slug="category-unknown", org_name="旧房源", room_number="303")

        response = self.client.get("/api/public/houses/", {"listing_type": "whole", "bedrooms_min": 3, "page": 1, "page_size": 20})
        self.assertEqual(response.status_code, 200)
        self.assertEqual([item["id"] for item in api_data(response)["items"]], [whole.pk])
        self.assertEqual(api_data(response)["items"][0]["listing_type"], "whole")
        self.assertNotEqual(whole.listing_type, shared.listing_type)

    def test_public_house_map_uses_viewport_bounds_and_zoom_levels(self):
        first = self.make_house(org_slug="map-a", org_name="地图甲", room_number="101", asking_rent=Decimal("2600.00"))
        second = self.make_house(org_slug="map-b", org_name="地图乙", room_number="202", asking_rent=Decimal("3200.00"))
        outside = self.make_house(org_slug="map-c", org_name="地图丙", room_number="303", asking_rent=Decimal("4200.00"))

        locations = [
            (first, "广州", "黄埔", Decimal("23.125000"), Decimal("113.360000")),
            (second, "广州", "天河", Decimal("23.135000"), Decimal("113.330000")),
            (outside, "深圳", "南山", Decimal("22.533000"), Decimal("113.930000")),
        ]
        for house, city, district, lat, lng in locations:
            estate = house.building.estate
            estate.city = city
            estate.district = district
            estate.location = make_wgs84_point(float(lng), float(lat), "gcj02")
            estate.save(update_fields=["city", "district", "location", "updated_at"])
            house.building.location = make_wgs84_point(float(lng + Decimal("0.000100")), float(lat + Decimal("0.000100")), "gcj02")
            house.building.save(update_fields=["location", "updated_at"])

        bounds = {"west": "113.20", "south": "23.00", "east": "113.50", "north": "23.30", "coordinate_system": "gcj02"}
        city_response = self.client.get("/api/public/houses/map/", {**bounds, "zoom": 7})
        district_response = self.client.get("/api/public/houses/map/", {**bounds, "zoom": 9})
        estate_response = self.client.get("/api/public/houses/map/", {**bounds, "zoom": 12})
        building_response = self.client.get("/api/public/houses/map/", {**bounds, "zoom": 15})

        self.assertEqual(city_response.status_code, 200)
        self.assertEqual(api_data(city_response)["level"], "city")
        self.assertEqual(api_data(city_response)["visible_house_count"], 2)
        self.assertEqual(api_data(city_response)["marker_count"], 1)
        self.assertEqual([(item["name"], item["house_count"], item["target_zoom"]) for item in api_data(city_response)["items"]], [("广州", 2, 9)])

        self.assertEqual(district_response.status_code, 200)
        self.assertEqual(api_data(district_response)["level"], "district")
        self.assertEqual({item["name"] for item in api_data(district_response)["items"]}, {"黄埔", "天河"})

        self.assertEqual(estate_response.status_code, 200)
        self.assertEqual(api_data(estate_response)["level"], "estate")
        self.assertEqual({item["estate_id"] for item in api_data(estate_response)["items"]}, {first.building.estate_id, second.building.estate_id})

        self.assertEqual(building_response.status_code, 200)
        self.assertEqual(api_data(building_response)["level"], "building")
        self.assertEqual({item["building_id"] for item in api_data(building_response)["items"]}, {first.building_id, second.building_id})
        self.assertEqual({item["min_rent"] for item in api_data(building_response)["items"]}, {"2600.00", "3200.00"})

    def test_public_house_map_rejects_invalid_bounds_and_zoom(self):
        invalid_bounds = self.client.get(
            "/api/public/houses/map/",
            {"west": "114", "south": "22", "east": "113", "north": "23", "zoom": 12, "coordinate_system": "gcj02"},
        )
        invalid_zoom = self.client.get("/api/public/houses/map/", {"zoom": 21, "coordinate_system": "gcj02"})

        self.assertEqual(invalid_bounds.status_code, 422)
        self.assertEqual(invalid_zoom.status_code, 422)

    def test_public_house_list_filters_radius_and_orders_by_distance(self):
        nearest = self.make_house(org_slug="near-a", org_name="附近甲", room_number="101")
        farther = self.make_house(org_slug="near-b", org_name="附近乙", room_number="202")
        outside = self.make_house(org_slug="near-c", org_name="附近丙", room_number="303")
        nearest.building.location = make_wgs84_point(113.93, 22.533, "gcj02")
        farther.building.location = make_wgs84_point(113.94, 22.533, "gcj02")
        outside.building.location = make_wgs84_point(114.1, 22.533, "gcj02")
        nearest.building.save(update_fields=["location", "updated_at"])
        farther.building.save(update_fields=["location", "updated_at"])
        outside.building.save(update_fields=["location", "updated_at"])

        response = self.client.get(
            "/api/public/houses/",
            {
                "longitude": "113.93",
                "latitude": "22.533",
                "radius_m": 2000,
                "coordinate_system": "gcj02",
                "sort": "distance_asc",
                "page": 1,
                "page_size": 20,
            },
        )

        self.assertEqual(response.status_code, 200)
        items = api_data(response)["items"]
        self.assertEqual([item["id"] for item in items], [nearest.pk, farther.pk])
        self.assertEqual(items[0]["distance_m"], 0)
        self.assertGreater(items[1]["distance_m"], 0)

    def test_public_house_list_filters_multiple_metro_stations_and_returns_nearest_station(self):
        city = MetroCity.objects.create(name="深圳市", province="广东省", data_version="2026-09", imported_at=timezone.now())
        line = MetroLine.objects.create(city=city, name="1号线", sort_order=1)
        luohu = MetroStation.objects.create(city=city, name="罗湖", location=make_wgs84_point(114.117, 22.531, "gcj02"))
        guomao = MetroStation.objects.create(city=city, name="国贸", location=make_wgs84_point(114.1188, 22.538, "gcj02"))
        MetroLineStation.objects.create(line=line, station=luohu, sort_order=1)
        MetroLineStation.objects.create(line=line, station=guomao, sort_order=2)

        nearest = self.make_house(org_slug="metro-a", org_name="地铁甲", room_number="101", city="深圳市", district="罗湖区")
        farther = self.make_house(org_slug="metro-b", org_name="地铁乙", room_number="202", city="深圳市", district="罗湖区")
        outside = self.make_house(org_slug="metro-c", org_name="地铁丙", room_number="303", city="深圳市", district="罗湖区")
        unlocated = self.make_house(org_slug="metro-d", org_name="地铁丁", room_number="404", city="深圳市", district="罗湖区")
        nearest.building.location = make_wgs84_point(114.117, 22.531, "gcj02")
        farther.building.location = make_wgs84_point(114.123, 22.538, "gcj02")
        outside.building.location = make_wgs84_point(114.20, 22.60, "gcj02")
        nearest.building.save(update_fields=["location", "updated_at"])
        farther.building.save(update_fields=["location", "updated_at"])
        outside.building.save(update_fields=["location", "updated_at"])

        response = self.client.get(
            "/api/public/houses/",
            {
                "city": "深圳市",
                "metro_stations": ["罗湖", "国贸"],
                "radius_m": 1000,
                "sort": "distance_asc",
                "page": 1,
                "page_size": 20,
            },
        )

        self.assertEqual(response.status_code, 200)
        items = api_data(response)["items"]
        self.assertEqual([item["id"] for item in items], [nearest.pk, farther.pk])
        self.assertEqual(items[0]["nearest_metro_station"], {"name": "罗湖", "line_names": ["1号线"]})
        self.assertEqual(len({item["id"] for item in items}), len(items))
        self.assertNotIn(outside.pk, {item["id"] for item in items})
        self.assertNotIn(unlocated.pk, {item["id"] for item in items})

    def test_public_house_list_rejects_invalid_metro_spatial_parameters(self):
        city = MetroCity.objects.create(name="深圳市", province="广东省", data_version="2026-09", imported_at=timezone.now())
        line = MetroLine.objects.create(city=city, name="1号线", sort_order=1)
        station = MetroStation.objects.create(city=city, name="罗湖", location=make_wgs84_point(114.117, 22.531, "gcj02"))
        MetroLineStation.objects.create(line=line, station=station, sort_order=1)

        conflict = self.client.get(
            "/api/public/houses/",
            {
                "city": "深圳市",
                "metro_stations": ["罗湖"],
                "longitude": "114.12",
                "latitude": "22.54",
                "coordinate_system": "gcj02",
            },
        )
        unknown = self.client.get("/api/public/houses/", {"city": "深圳市", "metro_stations": ["不存在"], "radius_m": 1000})
        missing_city = self.client.get("/api/public/houses/", {"metro_stations": ["罗湖"], "radius_m": 1000})
        invalid_radius = self.client.get("/api/public/houses/", {"city": "深圳市", "metro_stations": ["罗湖"], "radius_m": 3000})
        too_many = self.client.get(
            "/api/public/houses/",
            {"city": "深圳市", "metro_stations": ["站1", "站2", "站3", "站4", "站5", "站6"], "radius_m": 1000},
        )

        self.assertEqual(conflict.status_code, 422)
        self.assertEqual(unknown.status_code, 422)
        self.assertEqual(missing_city.status_code, 422)
        self.assertEqual(invalid_radius.status_code, 422)
        self.assertEqual(too_many.status_code, 422)

    def test_public_house_list_requires_spatial_center_for_distance_sort(self):
        response = self.client.get("/api/public/houses/", {"sort": "distance_asc", "page": 1, "page_size": 20})

        self.assertEqual(response.status_code, 422)

    def test_public_house_list_can_filter_map_target(self):
        first = self.make_house(org_slug="target-a", org_name="目标甲", room_number="101")
        second = self.make_house(org_slug="target-b", org_name="目标乙", room_number="202")

        estate_response = self.client.get("/api/public/houses/", {"estate_id": first.building.estate_id, "page": 1, "page_size": 20})
        building_response = self.client.get("/api/public/houses/", {"building_id": second.building_id, "page": 1, "page_size": 20})

        self.assertEqual([item["id"] for item in api_data(estate_response)["items"]], [first.pk])
        self.assertEqual([item["id"] for item in api_data(building_response)["items"]], [second.pk])

    def test_public_house_filter_options_only_use_visible_inventory(self):
        first = self.make_house(org_slug="options-a", org_name="选项甲", room_number="101", asking_rent=Decimal("2600.00"))
        first.area = Decimal("42.00")
        first.tags = ["近地铁"]
        first.building.tags = ["有电梯"]
        first.building.save(update_fields=["tags", "updated_at"])
        first.save()

        second = self.make_house(org_slug="options-b", org_name="选项乙", room_number="202", asking_rent=Decimal("3200.00"))
        second.area = Decimal("55.00")
        second.bedrooms = 2
        second.living_rooms = 1
        second.tags = ["采光好"]
        second.save()

        hidden = self.make_house(org_slug="options-c", org_name="选项丙", room_number="303", status=HouseStatus.VACANT, asking_rent=Decimal("9999.00"))
        hidden.tags = ["内部标签"]
        hidden.save()

        response = self.client.get("/api/public/houses/filters/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            api_data(response),
            {
                "rent_min": "2600.00",
                "rent_max": "3200.00",
                "area_min": "42.00",
                "area_max": "55.00",
                "provinces": ["广东"],
                "cities": ["深圳"],
                "districts": ["南山"],
                "bedrooms": [1, 2],
                "living_rooms": [0, 1],
                "tags": ["有电梯", "近地铁", "采光好"],
            },
        )

    def test_public_house_regions_builds_hierarchy_from_visible_inventory(self):
        self.make_house(org_slug="region-a", org_name="地区甲", room_number="101", province=" 广东 ", city=" 深圳 ", district=" 南山 ", subdistrict=" 科技园 ")
        self.make_house(org_slug="region-b", org_name="地区乙", room_number="202", province="广东", city="深圳", district="福田", subdistrict="车公庙")
        self.make_house(org_slug="region-c", org_name="地区丙", room_number="303", province="广东", city="广州", district="南山")
        invalid = self.make_house(org_slug="region-invalid", org_name="地区占位", room_number="404", province="默认", city="默认", district="默认")
        Estate.objects.filter(pk=invalid.building.estate_id).update(province=" ", city=" ", district=" ")
        self.make_house(org_slug="region-hidden", org_name="地区隐藏", room_number="505", city="珠海", district="香洲", status=HouseStatus.VACANT)
        self.make_house(org_slug="region-disabled", org_name="地区停用", room_number="606", city="东莞", district="南城", org_active=False)

        response = self.client.get("/api/public/houses/regions/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            api_data(response),
            {
                "items": [
                    {
                        "province": "广东",
                        "house_count": 3,
                        "cities": [
                            {
                                "city": "广州",
                                "house_count": 1,
                                "districts": [{"district": "南山", "house_count": 1, "subdistricts": []}],
                            },
                            {
                                "city": "深圳",
                                "house_count": 2,
                                "districts": [
                                    {"district": "南山", "house_count": 1, "subdistricts": [{"subdistrict": "科技园", "house_count": 1}]},
                                    {"district": "福田", "house_count": 1, "subdistricts": [{"subdistrict": "车公庙", "house_count": 1}]},
                                ],
                            },
                        ],
                    }
                ]
            },
        )

    @override_settings(CACHES={"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}})
    def test_public_house_regions_uses_short_cache(self):
        cache.clear()
        self.make_house(org_slug="region-cache-a", org_name="缓存甲", room_number="101")
        first = api_data(self.client.get("/api/public/houses/regions/"))
        self.make_house(org_slug="region-cache-b", org_name="缓存乙", room_number="202", city="广州", district="天河")

        second = api_data(self.client.get("/api/public/houses/regions/"))

        self.assertEqual(second, first)

    def test_public_house_map_filters_by_full_region_identity(self):
        shenzhen = self.make_house(org_slug="map-region-a", org_name="地图地区甲", room_number="101", province="广东", city="深圳", district="南山")
        guangzhou = self.make_house(org_slug="map-region-b", org_name="地图地区乙", room_number="202", province="广东", city="广州", district="南山")
        for index, house in enumerate((shenzhen, guangzhou)):
            house.building.location = make_wgs84_point(113.93 + index * 0.01, 22.533, "gcj02")
            house.building.save(update_fields=["location", "updated_at"])

        response = self.client.get(
            "/api/public/houses/map/",
            {"zoom": 15, "province": "广东", "city": "深圳", "district": "南山", "coordinate_system": "gcj02"},
        )

        self.assertEqual(response.status_code, 200)
        payload = api_data(response)
        self.assertEqual(payload["visible_house_count"], 1)
        self.assertEqual([item["building_id"] for item in payload["items"]], [shenzhen.building_id])

    @override_settings(AMAP_WEB_SERVICE_KEY="test-amap-key")
    @patch("apps.base.maps.amap.requests.get")
    def test_public_house_region_resolve_uses_amap_and_falls_back_for_municipality(self, mocked_get):
        amap_response = Mock()
        amap_response.raise_for_status.return_value = None
        amap_response.json.return_value = {
            "status": "1",
            "regeocode": {
                "addressComponent": {
                    "province": "北京市",
                    "city": [],
                    "district": "朝阳区",
                }
            },
        }
        mocked_get.return_value = amap_response

        response = self.client.get(
            "/api/public/houses/regions/resolve/",
            {"longitude": "116.397428", "latitude": "39.909230", "coordinate_system": "gcj02"},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(api_data(response), {"province": "北京市", "city": "北京市", "district": "朝阳区"})
        mocked_get.assert_called_once()
        self.assertEqual(mocked_get.call_args.kwargs["params"]["location"], "116.397428,39.909230")

    @override_settings(AMAP_WEB_SERVICE_KEY="")
    def test_public_house_region_resolve_requires_amap_configuration(self):
        response = self.client.get(
            "/api/public/houses/regions/resolve/",
            {"longitude": "113.930000", "latitude": "22.533000", "coordinate_system": "gcj02"},
        )

        self.assertEqual(response.status_code, 503)

    @override_settings(AMAP_WEB_SERVICE_KEY="test-amap-key")
    @patch("apps.base.maps.amap.requests.get")
    def test_public_house_region_resolve_handles_provider_failure(self, mocked_get):
        mocked_get.side_effect = requests.RequestException("amap unavailable")

        response = self.client.get(
            "/api/public/houses/regions/resolve/",
            {"longitude": "113.930000", "latitude": "22.533000", "coordinate_system": "gcj02"},
        )

        self.assertEqual(response.status_code, 502)

    def test_non_public_houses_cannot_be_viewed(self):
        vacant = self.make_house(org_slug="private-vacant", org_name="未发布租户", room_number="601", status=HouseStatus.VACANT)
        archived = self.make_house(org_slug="private-archived", org_name="停用租户", room_number="602", org_active=False)

        self.assertEqual(self.client.get(f"/api/public/houses/{vacant.pk}/").status_code, 404)
        self.assertEqual(self.client.get(f"/api/public/houses/{archived.pk}/").status_code, 404)
