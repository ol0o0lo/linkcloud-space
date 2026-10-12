"""高德专有的演示数据快照读取，与运行时地图 Provider 分开。"""

import hashlib
import json
from collections import Counter

import requests

from apps.base.maps.provider import MapProviderResponseError, MapProviderUnavailable

AMAP_GUANGZHOU_METRO_URL = "https://map.amap.com/service/subway?srhdata=4401_drw_guangzhou.json"


def fetch_amap_guangzhou_metro_payload() -> dict:
    try:
        response = requests.get(AMAP_GUANGZHOU_METRO_URL, timeout=20)
        response.raise_for_status()
        payload = response.json()
    except (requests.RequestException, ValueError) as exc:
        raise MapProviderUnavailable("广州地铁数据获取失败") from exc
    if not isinstance(payload, dict) or not isinstance(payload.get("l"), list) or not payload["l"]:
        raise MapProviderResponseError("广州地铁数据格式无效")
    return payload


def _normalized_line_name(raw_name: str, station_names: list[str], duplicate_counts: Counter) -> str:
    if duplicate_counts[raw_name] == 1:
        return raw_name
    if raw_name == "3号线":
        return "3号线北延段" if "机场北(T2)" in station_names else "3号线"
    if raw_name == "12号线":
        return "12号线西段" if "广州体育馆" in station_names else "12号线东段"
    return f"{raw_name}（{station_names[0]}—{station_names[-1]}）"


def build_guangzhou_metro_import_payload(source: dict) -> dict:
    source_lines = source.get("l")
    if not isinstance(source_lines, list) or not source_lines:
        raise MapProviderResponseError("广州地铁线路为空")

    raw_names = [str(line.get("ln") or "").strip() for line in source_lines]
    if any(not name for name in raw_names):
        raise MapProviderResponseError("广州地铁存在无名称线路")
    duplicate_counts = Counter(raw_names)
    canonical_stations: dict[str, tuple[float, float]] = {}
    for source_line in source_lines:
        for source_station in source_line.get("st") or []:
            name = str(source_station.get("n") or "").strip()
            coordinate = str(source_station.get("sl") or "").strip()
            if not name or "," not in coordinate:
                raise MapProviderResponseError("广州地铁存在无名称或无坐标站点")
            try:
                longitude, latitude = (float(value) for value in coordinate.split(",", maxsplit=1))
            except ValueError as exc:
                raise MapProviderResponseError(f"广州地铁站点坐标无效：{name}") from exc
            canonical_stations.setdefault(name, (longitude, latitude))

    lines = []
    for line_order, source_line in enumerate(source_lines, start=1):
        source_stations = source_line.get("st") or []
        station_names = [str(item.get("n") or "").strip() for item in source_stations]
        if not station_names:
            raise MapProviderResponseError(f"广州地铁线路无站点：{raw_names[line_order - 1]}")
        lines.append(
            {
                "name": _normalized_line_name(raw_names[line_order - 1], station_names, duplicate_counts),
                "color": f"#{str(source_line.get('cl') or '').strip().lstrip('#')}",
                "sort_order": line_order,
                "is_loop": False,
                "stations": [
                    {
                        "name": station_name,
                        "aliases": [],
                        "district": "",
                        "address": "",
                        "longitude": canonical_stations[station_name][0],
                        "latitude": canonical_stations[station_name][1],
                        "sort_order": station_order,
                    }
                    for station_order, station_name in enumerate(station_names, start=1)
                ],
            }
        )

    snapshot = json.dumps(source, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()
    return {
        "schema_version": 1,
        "data_version": f"amap-{hashlib.sha256(snapshot).hexdigest()[:12]}",
        "coordinate_system": "gcj02",
        "city": {"name": "广州市", "province": "广东省"},
        "lines": lines,
    }
