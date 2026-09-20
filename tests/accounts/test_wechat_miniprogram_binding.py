import json
from unittest.mock import patch

from django.test import Client, override_settings

import pytest
from allauth.socialaccount.models import SocialAccount

from apps.accounts.models import User
from tests.api_helpers import api_data, api_error

MINIPROGRAM_SETTINGS = {
    "SOCIALACCOUNT_PROVIDERS": {
        "wechat_miniprogram": {
            "APP": {
                "client_id": "test-miniprogram-appid",
                "secret": "test-miniprogram-secret",
            },
        },
    },
    "ALLOWED_HOSTS": ["testserver", "localhost"],
}


def _post_binding(client: Client, *, openid: str = "binding-openid", unionid: str = "binding-unionid"):
    identity = {"openid": openid, "session_key": "must-not-be-stored"}
    if unionid:
        identity["unionid"] = unionid
    with patch("apps.accounts.api.jscode2session", return_value=identity) as exchange:
        response = client.post(
            "/api/users/me/wechat-miniprogram/",
            data=json.dumps({"code": "wx-login-code"}),
            content_type="application/json",
        )
    exchange.assert_called_once()
    return response


@pytest.mark.django_db
@override_settings(**MINIPROGRAM_SETTINGS)
def test_wechat_miniprogram_binding_requires_login():
    response = Client().post(
        "/api/users/me/wechat-miniprogram/",
        data=json.dumps({"code": "wx-login-code"}),
        content_type="application/json",
    )

    assert response.status_code == 401


@pytest.mark.django_db
@override_settings(**MINIPROGRAM_SETTINGS)
def test_wechat_miniprogram_binding_connects_identity_to_current_user():
    user = User.objects.create_user(username="phone-user", password="secret123")  # noqa: S106
    client = Client()
    client.force_login(user)

    response = _post_binding(client)

    assert response.status_code == 200
    assert api_data(response) == {"connected": True}
    account = SocialAccount.objects.get(provider="wechat_miniprogram", uid="binding-openid")
    assert account.user_id == user.pk
    assert account.extra_data == {"openid": "binding-openid", "unionid": "binding-unionid"}


@pytest.mark.django_db
@override_settings(**MINIPROGRAM_SETTINGS)
def test_wechat_miniprogram_binding_is_idempotent_and_repairs_extra_data():
    user = User.objects.create_user(username="bound-user", password="secret123")  # noqa: S106
    SocialAccount.objects.create(user=user, provider="wechat_miniprogram", uid="binding-openid", extra_data={})
    client = Client()
    client.force_login(user)

    first = _post_binding(client)
    second = _post_binding(client)

    assert first.status_code == 200
    assert second.status_code == 200
    assert SocialAccount.objects.filter(user=user, provider="wechat_miniprogram").count() == 1
    assert SocialAccount.objects.get(user=user, provider="wechat_miniprogram").extra_data == {
        "openid": "binding-openid",
        "unionid": "binding-unionid",
    }


@pytest.mark.django_db
@override_settings(**MINIPROGRAM_SETTINGS)
def test_wechat_miniprogram_binding_rejects_openid_owned_by_another_user():
    current = User.objects.create_user(username="current-user", password="secret123")  # noqa: S106
    other = User.objects.create_user(username="other-user", password="secret123")  # noqa: S106
    SocialAccount.objects.create(user=other, provider="wechat_miniprogram", uid="binding-openid", extra_data={"openid": "binding-openid"})
    client = Client()
    client.force_login(current)

    response = _post_binding(client)

    assert response.status_code == 409
    assert api_error(response)["message"] == "该微信小程序身份已绑定其他账号。"
    assert not SocialAccount.objects.filter(user=current, provider="wechat_miniprogram").exists()


@pytest.mark.django_db
@override_settings(**MINIPROGRAM_SETTINGS)
def test_wechat_miniprogram_binding_rejects_second_identity_for_current_user():
    user = User.objects.create_user(username="already-bound", password="secret123")  # noqa: S106
    SocialAccount.objects.create(user=user, provider="wechat_miniprogram", uid="old-openid", extra_data={"openid": "old-openid"})
    client = Client()
    client.force_login(user)

    response = _post_binding(client, openid="new-openid", unionid="new-unionid")

    assert response.status_code == 409
    assert api_error(response)["message"] == "当前账号已绑定其他微信小程序身份。"
    assert not SocialAccount.objects.filter(uid="new-openid").exists()


@pytest.mark.django_db
@override_settings(**MINIPROGRAM_SETTINGS)
def test_wechat_miniprogram_binding_rejects_unionid_owned_by_another_user():
    current = User.objects.create_user(username="union-current", password="secret123")  # noqa: S106
    other = User.objects.create_user(username="union-other", password="secret123")  # noqa: S106
    SocialAccount.objects.create(
        user=other,
        provider="wechat_official_account",
        uid="official-openid",
        extra_data={"openid": "official-openid", "unionid": "binding-unionid"},
    )
    client = Client()
    client.force_login(current)

    response = _post_binding(client)

    assert response.status_code == 409
    assert api_error(response)["message"] == "该微信身份已绑定其他账号。"
    assert not SocialAccount.objects.filter(user=current, provider="wechat_miniprogram").exists()


@pytest.mark.django_db
@override_settings(**MINIPROGRAM_SETTINGS)
def test_wechat_miniprogram_binding_accepts_unionid_already_connected_to_current_user():
    user = User.objects.create_user(username="same-union-user", password="secret123")  # noqa: S106
    SocialAccount.objects.create(
        user=user,
        provider="wechat_official_account",
        uid="official-openid",
        extra_data={"openid": "official-openid", "unionid": "binding-unionid"},
    )
    client = Client()
    client.force_login(user)

    response = _post_binding(client)

    assert response.status_code == 200
    assert SocialAccount.objects.filter(user=user, provider="wechat_miniprogram", uid="binding-openid").exists()
