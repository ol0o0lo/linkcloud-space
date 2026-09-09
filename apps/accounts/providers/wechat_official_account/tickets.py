import secrets
import time
from dataclasses import dataclass

from django.core.cache import cache
from django.utils.crypto import salted_hmac

TICKET_TTL_SECONDS = 300
POLL_INTERVAL_SECONDS = 2
BROWSER_SESSION_KEY = "wechat_official_login_browser_id"


class LoginTicketError(ValueError):
    pass


class LoginTicketForbidden(LoginTicketError):
    pass


class LoginTicketExpired(LoginTicketError):
    pass


class LoginTicketConflict(LoginTicketError):
    pass


@dataclass(frozen=True)
class CreatedLoginTicket:
    login_id: str
    poll_token: str
    scene: str
    expires_at: float


def _digest(value: str) -> str:
    return salted_hmac("accounts.wechat-official-login", value).hexdigest()


def _login_key(login_id: str) -> str:
    return f"wechat_official_login:login:{login_id}"


def _scene_key(scene: str) -> str:
    return f"wechat_official_login:scene:{scene}"


def _active_key(browser_digest: str) -> str:
    return f"wechat_official_login:active:{browser_digest}"


def _claim_key(login_id: str) -> str:
    return f"wechat_official_login:claim:{login_id}"


def _consume_key(login_id: str) -> str:
    return f"wechat_official_login:consume:{login_id}"


def get_or_create_browser_id(request) -> str:
    browser_id = request.session.get(BROWSER_SESSION_KEY)
    if not browser_id:
        browser_id = secrets.token_urlsafe(32)
        request.session[BROWSER_SESSION_KEY] = browser_id
    return str(browser_id)


def create_login_ticket(request, redirect_path: str) -> CreatedLoginTicket:
    browser_id = get_or_create_browser_id(request)
    browser_digest = _digest(browser_id)
    login_id = secrets.token_urlsafe(24)
    poll_token = secrets.token_urlsafe(32)
    scene = f"lc_login_{secrets.token_urlsafe(18)}"
    expires_at = time.time() + TICKET_TTL_SECONDS
    record = {
        "browser_digest": browser_digest,
        "expires_at": expires_at,
        "login_id": login_id,
        "openid": "",
        "poll_token_digest": _digest(poll_token),
        "redirect_path": redirect_path,
        "scene": scene,
        "status": "pending",
    }
    cache.set(_login_key(login_id), record, timeout=TICKET_TTL_SECONDS)
    cache.set(_scene_key(scene), login_id, timeout=TICKET_TTL_SECONDS)
    cache.set(_active_key(browser_digest), login_id, timeout=TICKET_TTL_SECONDS)
    return CreatedLoginTicket(login_id=login_id, poll_token=poll_token, scene=scene, expires_at=expires_at)


def delete_login_ticket(login_id: str) -> None:
    record = cache.get(_login_key(login_id))
    if not isinstance(record, dict):
        return
    active_key = _active_key(str(record.get("browser_digest") or ""))
    cache.delete_many([_login_key(login_id), _scene_key(str(record.get("scene") or "")), _claim_key(login_id), _consume_key(login_id)])
    if cache.get(active_key) == login_id:
        cache.delete(active_key)


def _verified_record(request, login_id: str, poll_token: str) -> dict:
    record = cache.get(_login_key(login_id))
    if not isinstance(record, dict) or float(record.get("expires_at") or 0) <= time.time():
        raise LoginTicketExpired("微信登录二维码已过期。")

    browser_id = request.session.get(BROWSER_SESSION_KEY)
    if not browser_id:
        raise LoginTicketForbidden("微信登录请求不属于当前浏览器。")
    browser_digest = _digest(str(browser_id))
    if not secrets.compare_digest(str(record.get("browser_digest") or ""), browser_digest):
        raise LoginTicketForbidden("微信登录请求不属于当前浏览器。")
    if not secrets.compare_digest(str(record.get("poll_token_digest") or ""), _digest(poll_token)):
        raise LoginTicketForbidden("微信登录票据无效。")
    if cache.get(_active_key(browser_digest)) != login_id:
        raise LoginTicketConflict("该微信登录二维码已失效，请重新获取。")
    return record


def get_login_status(request, login_id: str, poll_token: str) -> dict:
    record = _verified_record(request, login_id, poll_token)
    return {
        "status": str(record.get("status") or "pending"),
        "expires_in": max(0, int(float(record["expires_at"]) - time.time())),
    }


def mark_login_scanned(scene: str, openid: str) -> bool:
    login_id = cache.get(_scene_key(scene))
    if not login_id or not openid:
        return False
    login_id = str(login_id)
    record = cache.get(_login_key(login_id))
    if not isinstance(record, dict) or record.get("status") != "pending":
        return False
    if not cache.add(_claim_key(login_id), openid, timeout=TICKET_TTL_SECONDS):
        return False
    record = {**record, "openid": openid, "status": "scanned"}
    remaining = max(1, int(float(record["expires_at"]) - time.time()))
    cache.set(_login_key(login_id), record, timeout=remaining)
    return True


def begin_login_completion(request, login_id: str, poll_token: str) -> dict:
    record = _verified_record(request, login_id, poll_token)
    if record.get("status") != "scanned" or not record.get("openid"):
        raise LoginTicketConflict("微信尚未完成扫码。")
    if not cache.add(_consume_key(login_id), True, timeout=TICKET_TTL_SECONDS):
        raise LoginTicketConflict("该微信登录票据已被使用。")
    record = {**record, "status": "processing"}
    remaining = max(1, int(float(record["expires_at"]) - time.time()))
    cache.set(_login_key(login_id), record, timeout=remaining)
    return record


def finish_login_completion(login_id: str, *, success: bool) -> None:
    record = cache.get(_login_key(login_id))
    if not isinstance(record, dict):
        return
    record = {**record, "status": "completed" if success else "failed"}
    remaining = max(1, int(float(record["expires_at"]) - time.time()))
    cache.set(_login_key(login_id), record, timeout=remaining)
    active_key = _active_key(str(record.get("browser_digest") or ""))
    if cache.get(active_key) == login_id:
        cache.delete(active_key)
