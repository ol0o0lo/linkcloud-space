from django.core.cache import cache
from django.db.models import Prefetch
from django.shortcuts import get_object_or_404

from ninja import Router

from apps.metro.models import MetroCity, MetroLine, MetroLineStation
from apps.metro.schemas import PublicMetroCityDetailOut, PublicMetroCitySummaryOut

public_router = Router(tags=["地铁/公开"])


def _active_cities():
    return MetroCity.objects.filter(
        imported_at__isnull=False,
        lines__is_active=True,
        lines__station_links__is_active=True,
        lines__station_links__station__is_active=True,
    ).distinct()


@public_router.get("/cities/", response=list[PublicMetroCitySummaryOut], auth=None, summary="获取已开通地铁城市")
def list_public_metro_cities(request):
    return _active_cities().order_by("province", "name")


@public_router.get("/cities/{city_name}/", response=PublicMetroCityDetailOut, auth=None, summary="获取城市地铁线路和站点")
def get_public_metro_city(request, city_name: str):
    cache_key = f"public-metro-city:v1:{city_name}"
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    links = MetroLineStation.objects.filter(is_active=True, station__is_active=True).select_related("station").order_by("sort_order", "station__name")
    lines = MetroLine.objects.filter(is_active=True).order_by("sort_order", "name").prefetch_related(Prefetch("station_links", queryset=links))
    city = get_object_or_404(_active_cities().prefetch_related(Prefetch("lines", queryset=lines)), name=city_name)
    result = {
        "name": city.name,
        "province": city.province,
        "data_version": city.data_version,
        "lines": [
            {
                "name": line.name,
                "color": line.color,
                "stations": [{"name": link.station.name} for link in line.station_links.all()],
            }
            for line in city.lines.all()
        ],
    }
    cache.set(cache_key, result, timeout=24 * 60 * 60)
    return result

