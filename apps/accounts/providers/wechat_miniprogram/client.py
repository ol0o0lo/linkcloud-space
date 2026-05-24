"""微信小程序服务端 API 调用封装。"""

import requests
from django.core.cache import cache

ACCESS_TOKEN_URL = "https://api.weixin.qq.com/cgi-bin/token"  # noqa: S105
GET_PHONE_URL = "https://api.weixin.qq.com/wxa/business/getuserphonenumber"


def get_miniprogram_access_token(app) -> str:
    cache_key = f"wechat_miniprogram_access_token:{app.client_id}"  # noqa: S105
    token = cache.get(cache_key)
    if token:
        return token
    resp = requests.post(
        ACCESS_TOKEN_URL,
        params={
            "grant_type": "client_credential",
            "appid": app.client_id,
            "secret": app.secret,
        },
        timeout=10,
    )
    resp.raise_for_status()
    data = resp.json()
    if "access_token" not in data:
        raise ValueError(f"获取 access_token 失败: {data.get('errmsg', data)}")
    token = data["access_token"]
    cache.set(cache_key, token, timeout=7000)
    return token


def get_phone_number(app, phone_code: str) -> str:
    """返回标准化手机号 +86XXXXXXXXXX，失败抛 ValueError。"""
    access_token = get_miniprogram_access_token(app)
    resp = requests.post(
        GET_PHONE_URL,
        params={"access_token": access_token},
        json={"code": phone_code},
        timeout=10,
    )
    resp.raise_for_status()
    data = resp.json()
    if data.get("errcode") and data["errcode"] != 0:
        raise ValueError(f"微信手机号换取失败: {data.get('errmsg', data['errcode'])}")
    phone_info = data.get("phone_info")
    if not phone_info:
        raise ValueError(f"微信返回数据缺少 phone_info: {data}")
    country_code = phone_info.get("countryCode", "86")
    number = phone_info.get("purePhoneNumber")
    if not number:
        raise ValueError(f"微信返回数据缺少 purePhoneNumber: {phone_info}")
    return f"+{country_code}{number}"
