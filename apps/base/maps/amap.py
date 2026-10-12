"""高德地图 Web Service 适配。"""

import re
from contextlib import suppress

from django.conf import settings

import requests

from apps.base.maps.provider import (
    LocatedRegion,
    MapPlace,
    MapProviderConfigurationError,
    MapProviderResponseError,
    MapProviderUnavailable,
    MapRoute,
    MapRouteNotFound,
    MapTransitSegment,
    NearbyPoi,
    RouteMode,
)
from apps.geography.coordinates import MapPoint

AMAP_NEARBY_POI_TYPE_CODES = {
    "bus": "150700",
    "subway": "150500",
    "education": "140000",
    "medical": "090000",
}
AMAP_NEARBY_POI_TYPE_PREFIXES = {
    "1507": "bus",
    "1505": "subway",
    "14": "education",
    "09": "medical",
}


def _region_component(value: object) -> str:
    if isinstance(value, str):
        return value.strip()
    if isinstance(value, list):
        return next((item.strip() for item in value if isinstance(item, str) and item.strip()), "")
    return ""


def _amap_location(point: MapPoint) -> str:
    longitude, latitude = point.to_gcj02()
    return f"{longitude:.6f},{latitude:.6f}"


class AmapProvider:
    code = "amap"

    def _request(self, path: str, params: dict[str, object], *, route_request: bool = False) -> dict:
        key = settings.AMAP_WEB_SERVICE_KEY
        if not key:
            raise MapProviderConfigurationError("高德 Web Service Key 未配置")
        try:
            response = requests.get(f"https://restapi.amap.com{path}", params={"key": key, **params}, timeout=5)
            response.raise_for_status()
            payload = response.json()
        except (requests.RequestException, ValueError):
            # requests 的异常可能包含带 Key 的完整 URL，不能让它进入调用方日志。
            raise MapProviderUnavailable("高德地图服务暂不可用") from None
        if route_request and isinstance(payload, dict) and str(payload.get("infocode")) == "20803":
            raise MapRouteNotFound("当前起终点超出路线规划范围")
        if not isinstance(payload, dict) or payload.get("status") != "1":
            raise MapProviderUnavailable("高德地图服务暂不可用")
        return payload

    def nearby_pois(self, point: MapPoint) -> dict[str, list[NearbyPoi]]:
        payload = self._request(
            "/v3/place/around",
            {
                "location": _amap_location(point),
                "types": "|".join(AMAP_NEARBY_POI_TYPE_CODES.values()),
                "radius": 2000,
                "offset": 25,
                "page": 1,
                "extensions": "base",
            },
        )
        raw_pois = payload.get("pois")
        if not isinstance(raw_pois, list):
            raise MapProviderResponseError("高德周边设施结果无效")
        pois: dict[str, list[NearbyPoi]] = {category: [] for category in AMAP_NEARBY_POI_TYPE_CODES}
        for index, poi in enumerate(raw_pois):
            if not isinstance(poi, dict) or not str(poi.get("name") or "").strip():
                continue
            typecode = str(poi.get("typecode") or "")
            category = next((value for prefix, value in AMAP_NEARBY_POI_TYPE_PREFIXES.items() if typecode.startswith(prefix)), None)
            if category is None or len(pois[category]) >= 4:
                continue
            try:
                distance = max(0, round(float(poi.get("distance") or 0)))
            except (TypeError, ValueError):
                distance = 0
            address = "".join(value.strip() for field in ("pname", "cityname", "adname", "address") if isinstance((value := poi.get(field)), str) and value.strip())
            pois[category].append(
                {
                    "id": str(poi.get("id") or f"{category}-{index}"),
                    "name": str(poi["name"]).strip(),
                    "address": address or "暂无详细地址",
                    "distance": distance,
                }
            )
        return pois

    def _reverse_geocode_component(self, point: MapPoint) -> dict:
        payload = self._request("/v3/geocode/regeo", {"location": _amap_location(point), "extensions": "base", "radius": 1000})
        regeocode = payload.get("regeocode")
        address_component = regeocode.get("addressComponent") if isinstance(regeocode, dict) else None
        if not isinstance(address_component, dict):
            raise MapProviderResponseError("高德逆地理编码结果无效")
        return address_component

    def reverse_geocode(self, point: MapPoint) -> LocatedRegion:
        address_component = self._reverse_geocode_component(point)
        province = _region_component(address_component.get("province"))
        city = _region_component(address_component.get("city")) or province
        district = _region_component(address_component.get("district"))
        if not province or not city:
            raise MapProviderResponseError("高德逆地理编码结果无效")
        return {"province": province, "city": city, "district": district}

    def search_places(self, keyword: str, city: str = "") -> list[MapPlace]:
        keyword = keyword.strip()
        if not keyword or len(keyword) > 80:
            raise ValueError("地点关键词长度必须在 1 到 80 字之间")
        params: dict[str, object] = {"keywords": keyword, "page_size": 12, "page_num": 1}
        if city:
            params["region"] = city
            params["city_limit"] = "true"
        payload = self._request("/v5/place/text", params)
        return self._parse_places(payload)

    def nearby_places(self, point: MapPoint) -> list[MapPlace]:
        payload = self._request(
            "/v3/place/around",
            {
                "location": _amap_location(point),
                "types": "120000|170000",
                "radius": 1500,
                "sortrule": "distance",
                "offset": 12,
                "page": 1,
                "extensions": "base",
            },
        )
        places = self._parse_places(payload)
        if places and any(not place["city_code"] for place in places):
            region = self._request("/v3/geocode/regeo", {"location": _amap_location(point), "extensions": "base"})
            regeocode = region.get("regeocode")
            component = regeocode.get("addressComponent") if isinstance(regeocode, dict) else None
            city_code = str(component.get("citycode") or "") if isinstance(component, dict) else ""
            if not city_code:
                raise MapProviderResponseError("地图城市编码无效")
            for place in places:
                if not place["city_code"]:
                    place["city_code"] = city_code
        return places

    @staticmethod
    def _parse_places(payload: dict) -> list[MapPlace]:
        raw_places = payload.get("pois")
        if not isinstance(raw_places, list):
            raise MapProviderResponseError("地图地点搜索结果无效")
        places: list[MapPlace] = []
        for item in raw_places:
            if not isinstance(item, dict) or not item.get("id") or not item.get("name"):
                continue
            try:
                longitude, latitude = (float(value) for value in str(item["location"]).split(",", 1))
                point = MapPoint.from_gcj02(longitude, latitude)
            except (KeyError, TypeError, ValueError):
                continue
            places.append(
                {
                    "id": str(item["id"]),
                    "name": str(item["name"]),
                    "address": "".join(value.strip() for field in ("pname", "cityname", "adname", "address") if isinstance((value := item.get(field)), str) and value.strip())
                    if item.get("pname") or item.get("adname")
                    else str(item.get("address") or ""),
                    "city": _region_component(item.get("cityname")),
                    "city_code": str(item.get("citycode") or ""),
                    "point": point,
                }
            )
        return places

    def plan_route(self, origin: MapPoint, destination: MapPoint, mode: RouteMode, *, city_code: str = "") -> MapRoute:
        paths = {
            "metro": "/v5/direction/transit/integrated",
            "ebike": "/v5/direction/electrobike",
            "bicycle": "/v5/direction/bicycling",
            "walking": "/v5/direction/walking",
            "driving": "/v5/direction/driving",
        }
        params: dict[str, object] = {
            "origin": _amap_location(origin),
            "destination": _amap_location(destination),
            "show_fields": "cost",
        }
        if mode == "metro":
            if not city_code:
                raise ValueError("地铁路线需要目的地城市编码")
            params.update({"city1": city_code, "city2": city_code, "strategy": 7, "AlternativeRoute": 10})
        payload = self._request(paths[mode], params, route_request=True)
        route = payload.get("route")
        if not isinstance(route, dict):
            raise MapProviderResponseError("地图路线结果无效")
        alternatives = route.get("transits" if mode == "metro" else "paths")
        if not isinstance(alternatives, list):
            raise MapProviderResponseError("地图路线方案无效")
        if not alternatives:
            raise MapRouteNotFound("当前起终点没有可用路线")
        for alternative in alternatives:
            if not isinstance(alternative, dict):
                continue
            if mode == "metro":
                steps, walking_distance, transit_segments, metro_only = _transit_steps(alternative)
                if not metro_only:
                    continue
            else:
                raw_steps = alternative.get("steps") or []
                steps = [str(step.get("instruction")) for step in raw_steps if isinstance(step, dict) and step.get("instruction")][:30]
                walking_distance = 0
            cost = alternative.get("cost") or {}
            try:
                duration = int(cost.get("duration") or alternative.get("duration") or 0)
                distance = int(float(alternative.get("distance") or route.get("distance") or 0))
            except (TypeError, ValueError):
                continue
            if duration > 0:
                result: MapRoute = {"duration_seconds": duration, "distance_m": distance, "walking_distance_m": walking_distance, "steps": steps}
                if mode == "metro":
                    result["transit_segments"] = transit_segments
                return result
        if mode == "metro":
            raise MapRouteNotFound("当前起终点没有纯地铁路线")
        raise MapProviderResponseError("地图路线耗时无效")


def _optional_duration(value: object) -> int | None:
    try:
        duration = int(float(value))
    except (TypeError, ValueError):
        return None
    return duration if duration > 0 else None


def _transit_steps(alternative: dict) -> tuple[list[str], int, list[MapTransitSegment], bool]:
    steps: list[str] = []
    walking_distance = 0
    transit_segments: list[MapTransitSegment] = []
    has_metro = False
    for segment in alternative.get("segments") or []:
        if not isinstance(segment, dict):
            continue
        walking = segment.get("walking") or {}
        if isinstance(walking, dict):
            segment_distance = 0
            with suppress(TypeError, ValueError):
                segment_distance = max(0, int(float(walking.get("distance") or 0)))
            walking_distance += segment_distance
            for step in walking.get("steps") or []:
                if isinstance(step, dict) and step.get("instruction"):
                    steps.append(str(step["instruction"]))
            if segment_distance:
                cost = walking.get("cost") or {}
                duration = _optional_duration(cost.get("duration")) if isinstance(cost, dict) else None
                duration = duration or _optional_duration(walking.get("duration"))
                transit_segments.append({"kind": "walk", "label": "步行", "distance_m": segment_distance, "duration_seconds": duration})
        bus = segment.get("bus") or {}
        lines = bus.get("buslines") or [] if isinstance(bus, dict) else []
        if isinstance(lines, dict):
            lines = [lines]
        if lines:
            line = lines[0]
            if not isinstance(line, dict):
                return [], 0, [], False
            label = f"{line.get('type') or ''} {line.get('name') or ''}"
            if not any(word in label for word in ("地铁", "轨道", "轻轨")):
                return [], 0, [], False
            has_metro = True
            line_name = re.split(r"[（(]", str(line.get("name") or "地铁"), maxsplit=1)[0].strip()
            line_name = re.sub(r"^地铁\s*", "", line_name).strip() or "地铁"
            line_name = re.sub(r"(?<=\d)\s+(?=号线)", "", line_name)
            steps.append(str(line.get("name") or "乘坐地铁"))
            transit_segments.append({"kind": "metro", "label": line_name, "distance_m": 0, "duration_seconds": None})
        if segment.get("railway") or segment.get("taxi"):
            return [], 0, [], False
    return steps[:30], walking_distance, transit_segments, has_metro
