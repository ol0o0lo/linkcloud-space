import json
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from django.core.cache import cache
from django.test import Client, override_settings

import pytest
from allauth.socialaccount.models import SocialAccount

from apps.accounts.models import User
from tests.api_helpers import api_data

TEST_SETTINGS = {
    "ACCOUNT_PHONE_VERIFICATION_ENABLED": False,
    "ACCOUNT_SIGNUP_OPEN": True,
    "ALLOWED_HOSTS": ["testserver", "localhost"],
    "CACHES": {
        "default": {
            "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
            "LOCATION": "wechat-miniprogram-pc-login-tests",
        }
    },
    "SOCIALACCOUNT_AUTO_SIGNUP": True,
    "SOCIALACCOUNT_EMAIL_REQUIRED": False,
    "SOCIALACCOUNT_EMAIL_VERIFICATION": "none",
    "SOCIALACCOUNT_PROVIDERS": {
        "wechat_miniprogram": {
            "APP": {
                "client_id": "test-miniprogram-appid",
                "secret": "test-miniprogram-secret",
            },
        },
    },
    "WECHAT_MINIPROGRAM_PC_LOGIN_CHECK_PATH": False,
    "WECHAT_MINIPROGRAM_PC_LOGIN_ENV_VERSION": "develop",
}


@pytest.fixture(autouse=True)
def _clear_cache():
    cache.clear()
    yield
    cache.clear()


def _create_qr(client: Client):
    with patch(
        "apps.accounts.api.create_miniprogram_login_qr",
        return_value="data:image/png;base64,cWItYnl0ZXM=",
        create=True,
    ) as mock_create:
        response = client.post(
            "/api/users/auth/wechat-miniprogram/qr/",
            data=json.dumps({"redirect": "/rental/workbench/overview"}),
            content_type="application/json",
        )
    assert response.status_code == 200
    data = api_data(response)
    return data, mock_create.call_args.args[1]


@pytest.mark.django_db
@override_settings(**TEST_SETTINGS)
def test_create_miniprogram_qr_returns_embeddable_image_and_short_scene():
    qr, scene = _create_qr(Client())

    assert qr["qr_image_url"].startswith("data:image/png;base64,")
    assert qr["expires_in"] == 300
    assert qr["poll_interval"] == 2
    assert len(scene) <= 32


@pytest.mark.django_db
@override_settings(**TEST_SETTINGS)
def test_scan_miniprogram_code_auto_registers_and_logs_in_original_browser():
    client = Client()
    qr, scene = _create_qr(client)

    with patch(
        "apps.accounts.api.jscode2session",
        return_value={"openid": "pc-login-openid", "unionid": "pc-login-unionid", "session_key": "session-key"},
        create=True,
    ):
        confirmed = client.post(
            "/api/users/auth/wechat-miniprogram/pc-login/confirm/",
            data=json.dumps({"scene": scene, "code": "wx-login-code"}),
            content_type="application/json",
        )

    status = client.get(
        f"/api/users/auth/wechat-miniprogram/qr/{qr['login_id']}/",
        HTTP_X_WECHAT_LOGIN_TOKEN=qr["poll_token"],
    )
    completed = client.post(
        f"/api/users/auth/wechat-miniprogram/qr/{qr['login_id']}/complete/",
        data="{}",
        content_type="application/json",
        HTTP_X_WECHAT_LOGIN_TOKEN=qr["poll_token"],
    )

    assert confirmed.status_code == 200
    assert api_data(status)["status"] == "scanned"
    assert completed.status_code == 200
    account = SocialAccount.objects.get(provider="wechat_miniprogram", uid="pc-login-openid")
    assert account.extra_data["unionid"] == "pc-login-unionid"
    assert User.objects.count() == 1
    assert client.get("/api/users/me/").status_code == 200


@pytest.mark.django_db
@override_settings(**TEST_SETTINGS)
def test_miniprogram_confirmation_is_one_time():
    client = Client()
    _, scene = _create_qr(client)

    with patch(
        "apps.accounts.api.jscode2session",
        return_value={"openid": "one-time-openid", "session_key": "session-key"},
        create=True,
    ):
        first = client.post(
            "/api/users/auth/wechat-miniprogram/pc-login/confirm/",
            data=json.dumps({"scene": scene, "code": "first-code"}),
            content_type="application/json",
        )
        second = client.post(
            "/api/users/auth/wechat-miniprogram/pc-login/confirm/",
            data=json.dumps({"scene": scene, "code": "second-code"}),
            content_type="application/json",
        )

    assert first.status_code == 200
    assert second.status_code == 409


@pytest.mark.django_db
@override_settings(**TEST_SETTINGS)
def test_create_unlimited_qr_uses_short_scene_and_returns_data_url():
    from apps.accounts.providers.wechat_miniprogram import client as miniprogram_client

    assert hasattr(miniprogram_client, "create_unlimited_qr")

    token_response = MagicMock()
    token_response.raise_for_status.return_value = None
    token_response.json.return_value = {"access_token": "access-token"}
    image_response = MagicMock()
    image_response.raise_for_status.return_value = None
    image_response.headers = {"Content-Type": "image/png"}
    image_response.content = b"qr-image"
    app = SimpleNamespace(client_id="test-miniprogram-appid", secret="test-miniprogram-secret")

    with patch(
        "apps.accounts.providers.wechat_miniprogram.client.requests.post",
        side_effect=[token_response, image_response],
    ) as mock_post:
        result = miniprogram_client.create_unlimited_qr(
            app,
            "lcpc_short_scene",
            page="pages/auth/pc-login",
            env_version="develop",
            check_path=False,
        )

    assert result == "data:image/png;base64,cXItaW1hZ2U="
    qr_request = mock_post.call_args_list[1]
    assert qr_request.kwargs["json"] == {
        "scene": "lcpc_short_scene",
        "page": "pages/auth/pc-login",
        "check_path": False,
        "env_version": "develop",
        "width": 430,
    }
