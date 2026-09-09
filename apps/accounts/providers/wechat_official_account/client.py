from urllib.parse import quote

from django.conf import settings
from django.core.cache import cache

import requests

ACCESS_TOKEN_URL = "https://api.weixin.qq.com/cgi-bin/token"  # noqa: S105
CREATE_QR_URL = "https://api.weixin.qq.com/cgi-bin/qrcode/create"
QR_IMAGE_URL = "https://mp.weixin.qq.com/cgi-bin/showqrcode"
USER_INFO_URL = "https://api.weixin.qq.com/cgi-bin/user/info"


class WechatOfficialAccountError(ValueError):
    pass


def _credentials() -> tuple[str, str]:
    app_id = settings.WECHAT_OFFICIAL_ACCOUNT_APP_ID
    app_secret = settings.WECHAT_OFFICIAL_ACCOUNT_APP_SECRET
    if not app_id or not app_secret:
        raise WechatOfficialAccountError("公众号登录未配置。")
    return app_id, app_secret


def _json_response(response, action: str) -> dict:
    try:
        response.raise_for_status()
        data = response.json()
    except (requests.RequestException, ValueError) as exc:
        raise WechatOfficialAccountError(f"{action}失败，请稍后重试。") from exc
    if data.get("errcode") not in (None, 0):
        raise WechatOfficialAccountError(f"{action}失败：{data.get('errmsg', data['errcode'])}")
    return data


def get_access_token() -> str:
    app_id, app_secret = _credentials()
    cache_key = f"wechat_official_account:access_token:{app_id}"  # noqa: S105
    token = cache.get(cache_key)
    if token:
        return str(token)

    try:
        response = requests.get(
            ACCESS_TOKEN_URL,
            params={
                "grant_type": "client_credential",
                "appid": app_id,
                "secret": app_secret,
            },
            timeout=5,
        )
    except requests.RequestException as exc:
        raise WechatOfficialAccountError("获取公众号 access token 失败，请稍后重试。") from exc
    data = _json_response(response, "获取公众号 access token")
    token = data.get("access_token")
    if not token:
        raise WechatOfficialAccountError("公众号未返回 access token。")
    expires_in = max(int(data.get("expires_in", 7200)) - 200, 60)
    cache.set(cache_key, token, timeout=expires_in)
    return str(token)


def create_temporary_qr(scene: str, *, expire_seconds: int) -> str:
    token = get_access_token()
    try:
        response = requests.post(
            CREATE_QR_URL,
            params={"access_token": token},
            json={
                "expire_seconds": expire_seconds,
                "action_name": "QR_STR_SCENE",
                "action_info": {"scene": {"scene_str": scene}},
            },
            timeout=5,
        )
    except requests.RequestException as exc:
        raise WechatOfficialAccountError("创建公众号登录二维码失败，请稍后重试。") from exc
    data = _json_response(response, "创建公众号登录二维码")
    ticket = data.get("ticket")
    if not ticket:
        raise WechatOfficialAccountError("公众号未返回二维码 ticket。")
    return f"{QR_IMAGE_URL}?ticket={quote(str(ticket), safe='')}"


def get_user_info(openid: str) -> dict:
    token = get_access_token()
    try:
        response = requests.get(
            USER_INFO_URL,
            params={
                "access_token": token,
                "openid": openid,
                "lang": "zh_CN",
            },
            timeout=5,
        )
    except requests.RequestException as exc:
        raise WechatOfficialAccountError("获取公众号用户信息失败，请稍后重试。") from exc
    data = _json_response(response, "获取公众号用户信息")
    if not data.get("openid"):
        raise WechatOfficialAccountError("公众号用户信息缺少 OpenID。")
    return data
