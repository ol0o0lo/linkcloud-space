"""高德专有的演示数据快照读取，与运行时地图 Provider 分开。"""

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
