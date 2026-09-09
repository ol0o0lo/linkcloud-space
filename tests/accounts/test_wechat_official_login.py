import hashlib
import json
from unittest.mock import patch

from django.core.cache import cache
from django.test import Client, override_settings

import pytest
from allauth.mfa.totp.internal.auth import TOTP, generate_totp_secret
from allauth.socialaccount.models import SocialAccount
from model_bakery import baker

from apps.accounts.models import User
from apps.accounts.providers.wechat_official_account.tickets import delete_login_ticket
from tests.api_helpers import api_data

TEST_SETTINGS = {
    "ACCOUNT_PHONE_VERIFICATION_ENABLED": False,
    "ACCOUNT_SIGNUP_OPEN": True,
    "ALLOWED_HOSTS": ["testserver", "localhost"],
    "CACHES": {
        "default": {
            "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
            "LOCATION": "wechat-official-login-tests",
        }
    },
    "SOCIALACCOUNT_AUTO_SIGNUP": True,
    "WECHAT_OFFICIAL_ACCOUNT_APP_ID": "official-app-id",
    "WECHAT_OFFICIAL_ACCOUNT_APP_SECRET": "official-app-secret",
    "WECHAT_OFFICIAL_ACCOUNT_TOKEN": "official-callback-token",
}


def _signature(timestamp: str, nonce: str) -> str:
    payload = "".join(sorted([TEST_SETTINGS["WECHAT_OFFICIAL_ACCOUNT_TOKEN"], timestamp, nonce])).encode()
    return hashlib.sha1(payload, usedforsecurity=False).hexdigest()  # noqa: S324 - 微信协议固定使用 SHA-1


def _create_qr(client: Client):
    with patch("apps.accounts.api.create_temporary_qr", return_value="https://mp.weixin.qq.com/qr/test") as mock_create:
        response = client.post(
            "/api/users/auth/wechat-official/qr/",
            data=json.dumps({"redirect": "/rental/workbench/overview"}),
            content_type="application/json",
        )
    assert response.status_code == 200
    data = api_data(response)
    scene = mock_create.call_args.args[0]
    return data, scene


def _post_scan_event(client: Client, scene: str, openid: str, *, subscribe: bool = False):
    timestamp = "1720000000"
    nonce = "test-nonce"
    event = "subscribe" if subscribe else "SCAN"
    event_key = f"qrscene_{scene}" if subscribe else scene
    body = f"""
    <xml>
      <ToUserName><![CDATA[gh_test]]></ToUserName>
      <FromUserName><![CDATA[{openid}]]></FromUserName>
      <CreateTime>1720000000</CreateTime>
      <MsgType><![CDATA[event]]></MsgType>
      <Event><![CDATA[{event}]]></Event>
      <EventKey><![CDATA[{event_key}]]></EventKey>
    </xml>
    """.strip()
    return client.post(
        f"/wechat/official-account/callback/?signature={_signature(timestamp, nonce)}&timestamp={timestamp}&nonce={nonce}",
        data=body,
        content_type="application/xml",
    )


@pytest.fixture(autouse=True)
def _clear_cache():
    cache.clear()
    yield
    cache.clear()


@pytest.mark.django_db
@override_settings(**TEST_SETTINGS)
def test_callback_verification_and_invalid_signature():
    client = Client()
    timestamp = "1720000000"
    nonce = "nonce"

    valid = client.get(
        "/wechat/official-account/callback/",
        {
            "signature": _signature(timestamp, nonce),
            "timestamp": timestamp,
            "nonce": nonce,
            "echostr": "verified",
        },
    )
    invalid = client.get(
        "/wechat/official-account/callback/",
        {"signature": "bad", "timestamp": timestamp, "nonce": nonce, "echostr": "ignored"},
    )

    assert valid.status_code == 200
    assert valid.content == b"verified"
    assert invalid.status_code == 403


@pytest.mark.django_db
@override_settings(**TEST_SETTINGS)
def test_scan_event_updates_only_original_browser_ticket():
    client = Client()
    qr, scene = _create_qr(client)

    callback = _post_scan_event(client, scene, "official-openid-1")
    status = client.get(
        f"/api/users/auth/wechat-official/qr/{qr['login_id']}/",
        HTTP_X_WECHAT_LOGIN_TOKEN=qr["poll_token"],
    )
    other_browser = Client().get(
        f"/api/users/auth/wechat-official/qr/{qr['login_id']}/",
        HTTP_X_WECHAT_LOGIN_TOKEN=qr["poll_token"],
    )

    assert callback.status_code == 200
    assert callback.content == b"success"
    assert api_data(status)["status"] == "scanned"
    assert other_browser.status_code == 403


@pytest.mark.django_db
@override_settings(**TEST_SETTINGS)
def test_deleting_old_ticket_keeps_latest_browser_ticket_active():
    client = Client()
    old_qr, _ = _create_qr(client)
    latest_qr, _ = _create_qr(client)

    delete_login_ticket(old_qr["login_id"])
    latest_status = client.get(
        f"/api/users/auth/wechat-official/qr/{latest_qr['login_id']}/",
        HTTP_X_WECHAT_LOGIN_TOKEN=latest_qr["poll_token"],
    )

    assert latest_status.status_code == 200
    assert api_data(latest_status)["status"] == "pending"


@pytest.mark.django_db
@override_settings(**TEST_SETTINGS)
def test_subscribe_event_auto_registers_and_logs_in_user():
    client = Client()
    qr, scene = _create_qr(client)
    assert _post_scan_event(client, scene, "new-official-openid", subscribe=True).status_code == 200

    profile = {
        "openid": "new-official-openid",
        "unionid": "new-unionid",
        "nickname": "新微信用户",
        "headimgurl": "https://example.com/avatar.jpg",
        "subscribe": 1,
    }
    with patch("apps.accounts.api.get_user_info", return_value=profile):
        complete = client.post(
            f"/api/users/auth/wechat-official/qr/{qr['login_id']}/complete/",
            data="{}",
            content_type="application/json",
            HTTP_X_WECHAT_LOGIN_TOKEN=qr["poll_token"],
        )

    assert complete.status_code == 200
    account = SocialAccount.objects.get(provider="wechat_official_account", uid="new-official-openid")
    assert account.extra_data["unionid"] == "new-unionid"
    assert account.user.first_name == "新微信用户"
    assert not account.user.has_usable_password()
    assert client.get("/api/users/me/").status_code == 200


@pytest.mark.django_db
@override_settings(**TEST_SETTINGS)
def test_complete_login_merges_same_unionid_and_is_one_time():
    existing_user = baker.make(User, username="existing-wx-user", email="")
    baker.make(
        SocialAccount,
        user=existing_user,
        provider="wechat_miniprogram",
        uid="miniprogram-openid",
        extra_data={"openid": "miniprogram-openid", "unionid": "shared-unionid"},
    )
    client = Client()
    qr, scene = _create_qr(client)
    assert _post_scan_event(client, scene, "official-openid-2").status_code == 200

    profile = {
        "openid": "official-openid-2",
        "unionid": "shared-unionid",
        "nickname": "已存在用户",
        "subscribe": 1,
    }
    with patch("apps.accounts.api.get_user_info", return_value=profile):
        first = client.post(
            f"/api/users/auth/wechat-official/qr/{qr['login_id']}/complete/",
            data="{}",
            content_type="application/json",
            HTTP_X_WECHAT_LOGIN_TOKEN=qr["poll_token"],
        )
        second = client.post(
            f"/api/users/auth/wechat-official/qr/{qr['login_id']}/complete/",
            data="{}",
            content_type="application/json",
            HTTP_X_WECHAT_LOGIN_TOKEN=qr["poll_token"],
        )

    assert first.status_code == 200
    assert second.status_code == 409
    official_account = SocialAccount.objects.get(provider="wechat_official_account", uid="official-openid-2")
    assert official_account.user == existing_user
    assert User.objects.count() == 1


@pytest.mark.django_db
@override_settings(**TEST_SETTINGS)
def test_existing_user_with_totp_receives_pending_mfa_flow():
    existing_user = baker.make(User, username="official-mfa-user", email="")
    baker.make(
        SocialAccount,
        user=existing_user,
        provider="wechat_official_account",
        uid="official-mfa-openid",
        extra_data={"openid": "official-mfa-openid", "unionid": "official-mfa-unionid"},
    )
    TOTP.activate(existing_user, generate_totp_secret())
    client = Client()
    qr, scene = _create_qr(client)
    assert _post_scan_event(client, scene, "official-mfa-openid").status_code == 200

    profile = {
        "openid": "official-mfa-openid",
        "unionid": "official-mfa-unionid",
        "nickname": "MFA 用户",
        "subscribe": 1,
    }
    with patch("apps.accounts.api.get_user_info", return_value=profile):
        complete = client.post(
            f"/api/users/auth/wechat-official/qr/{qr['login_id']}/complete/",
            data="{}",
            content_type="application/json",
            HTTP_X_WECHAT_LOGIN_TOKEN=qr["poll_token"],
        )

    assert complete.status_code == 401
    flows = complete.json().get("data", {}).get("flows", [])
    assert any(flow["id"] == "mfa_authenticate" and flow["is_pending"] for flow in flows)
    assert client.session.get("_auth_user_id") is None
