import hashlib
import secrets
from xml.etree import ElementTree

from django.conf import settings
from django.http import HttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from apps.accounts.providers.wechat_official_account.tickets import mark_login_scanned

MAX_CALLBACK_BODY_BYTES = 16 * 1024


def verify_callback_signature(signature: str, timestamp: str, nonce: str) -> bool:
    token = settings.WECHAT_OFFICIAL_ACCOUNT_TOKEN
    if not token or not signature or not timestamp or not nonce:
        return False
    payload = "".join(sorted([token, timestamp, nonce])).encode()
    expected = hashlib.sha1(payload, usedforsecurity=False).hexdigest()  # noqa: S324 - 微信公众号协议固定使用 SHA-1
    return secrets.compare_digest(expected, signature)


def _success_response() -> HttpResponse:
    return HttpResponse("success", content_type="text/plain")


@csrf_exempt
@require_http_methods(["GET", "POST"])
def official_account_callback(request):
    signature = request.GET.get("signature", "")
    timestamp = request.GET.get("timestamp", "")
    nonce = request.GET.get("nonce", "")
    if not verify_callback_signature(signature, timestamp, nonce):
        return HttpResponse("invalid signature", status=403, content_type="text/plain")

    if request.method == "GET":
        return HttpResponse(request.GET.get("echostr", ""), content_type="text/plain")

    if len(request.body) > MAX_CALLBACK_BODY_BYTES:
        return HttpResponse("payload too large", status=413, content_type="text/plain")
    try:
        root = ElementTree.fromstring(request.body)  # noqa: S314 - 请求已通过微信公众号签名验证且限制了大小
    except ElementTree.ParseError:
        return HttpResponse("invalid xml", status=400, content_type="text/plain")

    data = {child.tag: child.text or "" for child in root}
    if data.get("MsgType", "").lower() != "event":
        return _success_response()

    event = data.get("Event", "").upper()
    event_key = data.get("EventKey", "")
    if event == "SUBSCRIBE" and event_key.startswith("qrscene_"):
        scene = event_key.removeprefix("qrscene_")
    elif event == "SCAN":
        scene = event_key
    else:
        return _success_response()

    mark_login_scanned(scene, data.get("FromUserName", ""))
    return _success_response()
