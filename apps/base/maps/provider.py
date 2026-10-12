"""服务端地图能力的调用接口与统一入口。"""

from typing import Literal, NotRequired, Protocol, TypedDict

from apps.geography.coordinates import MapPoint


class NearbyPoi(TypedDict):
    id: str
    name: str
    address: str
    distance: int


class LocatedRegion(TypedDict):
    province: str
    city: str
    district: str


RouteMode = Literal["metro", "ebike", "bicycle", "walking", "driving"]


class MapPlace(TypedDict):
    id: str
    name: str
    address: str
    city: str
    city_code: str
    point: MapPoint


class MapRoute(TypedDict):
    duration_seconds: int
    distance_m: int
    walking_distance_m: int
    steps: list[str]
    transit_segments: NotRequired[list["MapTransitSegment"]]


class MapTransitSegment(TypedDict):
    kind: Literal["walk", "metro"]
    label: str
    distance_m: int
    duration_seconds: int | None


class MapProviderError(Exception):
    """地图服务调用失败。"""


class MapProviderConfigurationError(MapProviderError):
    """地图服务缺少必要配置。"""


class MapProviderUnavailable(MapProviderError):
    """地图服务请求失败或暂不可用。"""


class MapProviderResponseError(MapProviderError):
    """地图服务返回的数据无法解析。"""


class MapRouteNotFound(MapProviderError):
    """地图服务确认起终点之间没有指定方式的路线。"""


class PlaceProvider(Protocol):
    code: str

    def nearby_pois(self, point: MapPoint) -> dict[str, list[NearbyPoi]]: ...

    def reverse_geocode(self, point: MapPoint) -> LocatedRegion: ...

    def search_places(self, keyword: str, city: str = "") -> list[MapPlace]: ...

    def nearby_places(self, point: MapPoint) -> list[MapPlace]: ...


class RouteProvider(Protocol):
    code: str

    def plan_route(self, origin: MapPoint, destination: MapPoint, mode: RouteMode, *, city_code: str = "") -> MapRoute: ...


def get_place_provider() -> PlaceProvider:
    """当前地点查询提供方；请求时创建以读取最新 Django 配置。"""
    from apps.base.maps.amap import AmapProvider

    return AmapProvider()


def get_route_provider() -> RouteProvider:
    """当前路线规划提供方。"""
    from apps.base.maps.amap import AmapProvider

    return AmapProvider()
