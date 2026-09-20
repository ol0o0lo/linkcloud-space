"""微信小程序服务端 API 调用封装。"""

import base64

from django.core.cache import cache

import requests

JSCODE2SESSION_URL = "https://api.weixin.qq.com/sns/jscode2session"
ACCESS_TOKEN_URL = "https://api.weixin.qq.com/cgi-bin/token"  # noqa: S105
GET_PHONE_URL = "https://api.weixin.qq.com/wxa/business/getuserphonenumber"
GET_UNLIMITED_QR_URL = "https://api.weixin.qq.com/wxa/getwxacodeunlimit"
GENERATE_URL_LINK_URL = "https://api.weixin.qq.com/wxa/generate_urllink"


def jscode2session(app, js_code: str) -> dict:
    """用小程序 code 换取 openid / session_key / unionid，失败抛 ValueError。"""
    resp = requests.get(
        JSCODE2SESSION_URL,
        params={
            "appid": app.client_id,
            "secret": app.secret,
            "js_code": js_code,
            "grant_type": "authorization_code",
        },
        timeout=10,
    )
    resp.raise_for_status()
    data = resp.json()
    if data.get("errcode"):
        raise ValueError(f"微信登录失败: {data.get('errmsg', data['errcode'])}")
    return data


def get_miniprogram_access_token(app) -> str:
    if not app.client_id or not app.secret:
        raise ValueError("小程序登录未配置。")
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


def create_unlimited_qr(app, scene: str, *, page: str, env_version: str = "release", check_path: bool = True) -> str:
    """生成可直接嵌入网页的小程序码 data URL。"""
    if not scene or len(scene) > 32:
        raise ValueError("小程序码 scene 必须为 1 至 32 个字符。")
    if env_version not in {"develop", "trial", "release"}:
        raise ValueError("小程序码版本必须是 develop、trial 或 release。")

    access_token = get_miniprogram_access_token(app)
    resp = requests.post(
        GET_UNLIMITED_QR_URL,
        params={"access_token": access_token},
        json={
            "scene": scene,
            "page": page.removeprefix("/"),
            "check_path": check_path,
            "env_version": env_version,
            "width": 430,
        },
        timeout=10,
    )
    resp.raise_for_status()
    content_type = str(resp.headers.get("Content-Type") or "").split(";", 1)[0].lower()
    if content_type == "application/json" or resp.content.lstrip().startswith(b"{"):
        data = resp.json()
        raise ValueError(f"生成小程序码失败: {data.get('errmsg', data.get('errcode', data))}")
    if not resp.content:
        raise ValueError("微信未返回小程序码图片。")
    if not content_type.startswith("image/"):
        content_type = "image/png"
    encoded = base64.b64encode(resp.content).decode("ascii")
    return f"data:{content_type};base64,{encoded}"


def create_url_link(app, *, path: str, query: str, expire_time: int, env_version: str = "release") -> str:
    """生成微信小程序 URL Link，微信业务失败时抛出 ValueError。"""
    if env_version not in {"develop", "trial", "release"}:
        raise ValueError("小程序 URL Link 版本必须是 develop、trial 或 release。")
    normalized_path = path.removeprefix("/").strip()
    if not normalized_path:
        raise ValueError("小程序 URL Link 页面路径不能为空。")
    if expire_time <= 0:
        raise ValueError("小程序 URL Link 失效时间无效。")

    access_token = get_miniprogram_access_token(app)
    resp = requests.post(
        GENERATE_URL_LINK_URL,
        params={"access_token": access_token},
        json={
            "path": normalized_path,
            "query": query,
            "expire_type": 0,
            "expire_time": expire_time,
            "env_version": env_version,
        },
        timeout=10,
    )
    resp.raise_for_status()
    data = resp.json()
    if data.get("errcode") not in (None, 0):
        raise ValueError(f"生成小程序 URL Link 失败: {data.get('errmsg', data['errcode'])}")
    url_link = data.get("url_link")
    if not isinstance(url_link, str) or not url_link.startswith("https://"):
        raise ValueError("生成小程序 URL Link 失败: 微信未返回有效链接。")
    return url_link


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
