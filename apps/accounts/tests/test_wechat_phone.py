"""
小程序手机号授权绑定测试。

测试策略：
- access_token 首次获取后缓存，第二次不重复请求微信 API
- 换取手机号：mock 微信 API，验证标准化格式 +86XXXXXXXXXX
- 未登录拒绝：401
- 绑定新手机号：无已有账号，写入当前 User
- 幂等：重复绑定同一手机号 → 200
- 账号合并：已有 User B 有此手机号，迁移 SocialAccount，软删除当前 User，session 切换
- 微信 API errcode → 400
"""

from unittest.mock import MagicMock, patch

from django.test import override_settings

import pytest

WECHAT_PHONE_SETTINGS = {
    "CACHES": {
        "default": {
            "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
        }
    },
    "SOCIALACCOUNT_PROVIDERS": {
        "wechat_miniprogram": {
            "APP": {
                "client_id": "test-miniprogram-appid",
                "secret": "test-miniprogram-secret",
            },
        },
    },
    "ACCOUNT_PHONE_VERIFICATION_ENABLED": False,
    "ALLOWED_HOSTS": ["localhost"],
}


def _make_access_token_mock(token="fake_access_token"):  # noqa: S107
    mock = MagicMock()
    mock.json.return_value = {"access_token": token, "expires_in": 7200}
    mock.raise_for_status = MagicMock()
    return mock


def _make_phone_mock(phone_number="13800138000", country_code="86"):
    mock = MagicMock()
    mock.json.return_value = {
        "errcode": 0,
        "phone_info": {
            "phoneNumber": phone_number,
            "purePhoneNumber": phone_number,
            "countryCode": country_code,
        },
    }
    mock.raise_for_status = MagicMock()
    return mock


@override_settings(**WECHAT_PHONE_SETTINGS)
def test_access_token_cached_on_second_call(db):
    """access_token 首次调用请求微信 API，第二次从 cache 读取。"""
    from django.core.cache import cache

    from allauth.socialaccount.models import SocialApp

    from apps.accounts.wechat_phone import get_miniprogram_access_token

    cache.clear()
    app = SocialApp(provider="wechat_miniprogram", client_id="test-miniprogram-appid", secret="test-miniprogram-secret")

    with patch("apps.accounts.wechat_phone.requests.post", return_value=_make_access_token_mock()) as mock_post:
        token1 = get_miniprogram_access_token(app)
        token2 = get_miniprogram_access_token(app)

    assert token1 == "fake_access_token"
    assert token2 == "fake_access_token"
    mock_post.assert_called_once()  # 只调用了一次微信 API
    cache.clear()


@override_settings(**WECHAT_PHONE_SETTINGS)
def test_get_phone_number_returns_normalized(db):
    """换取手机号返回 +86XXXXXXXXXX 格式。"""
    from django.core.cache import cache

    from allauth.socialaccount.models import SocialApp

    from apps.accounts.wechat_phone import get_phone_number

    cache.delete("wechat_miniprogram_access_token:test-miniprogram-appid")
    app = SocialApp(provider="wechat_miniprogram", client_id="test-miniprogram-appid", secret="test-miniprogram-secret")

    with patch("apps.accounts.wechat_phone.requests.post") as mock_post:
        mock_post.side_effect = [_make_access_token_mock(), _make_phone_mock("13912345678", "86")]
        phone = get_phone_number(app, "test_phone_code")

    assert phone == "+8613912345678"
    cache.clear()


@override_settings(**WECHAT_PHONE_SETTINGS)
def test_get_phone_number_raises_on_errcode(db):
    """微信返回 errcode 时抛出 ValueError。"""
    from django.core.cache import cache

    from allauth.socialaccount.models import SocialApp

    from apps.accounts.wechat_phone import get_phone_number

    cache.delete("wechat_miniprogram_access_token:test-miniprogram-appid")
    app = SocialApp(provider="wechat_miniprogram", client_id="test-miniprogram-appid", secret="test-miniprogram-secret")

    error_mock = MagicMock()
    error_mock.json.return_value = {"errcode": 40029, "errmsg": "invalid code"}
    error_mock.raise_for_status = MagicMock()

    with patch("apps.accounts.wechat_phone.requests.post") as mock_post:
        mock_post.side_effect = [_make_access_token_mock(), error_mock]
        with pytest.raises(ValueError, match="微信手机号换取失败"):
            get_phone_number(app, "bad_code")
    cache.clear()


@pytest.fixture
def client():
    from django.test import Client
    return Client(SERVER_NAME="localhost")


def test_wechat_phone_requires_auth(client, db):
    """未登录请求 /api/auth/wechat-phone/ 返回 401。"""
    resp = client.post(
        "/api/auth/wechat-phone/",
        {"phone_code": "some_code"},
        content_type="application/json",
    )
    assert resp.status_code == 401, f"Expected 401, got {resp.status_code}: {resp.content[:200]}"


def _login_user(client, user):
    """辅助：强制登录指定 user。"""
    client.force_login(user)


def _post_wechat_phone(client, phone_number="13800138000"):
    """辅助：mock 微信 API，POST /api/auth/wechat-phone/。"""
    from django.core.cache import cache
    cache.set("wechat_miniprogram_access_token:test-miniprogram-appid", "cached_token", timeout=7000)

    phone_mock = _make_phone_mock(phone_number)
    with patch("apps.accounts.wechat_phone.requests.post", return_value=phone_mock):
        return client.post(
            "/api/auth/wechat-phone/",
            {"phone_code": "test_phone_code"},
            content_type="application/json",
        )


@override_settings(**WECHAT_PHONE_SETTINGS)
def test_bind_new_phone_to_user(client, db):
    """已登录用户，无已有账号使用此手机号，直接写入手机号。"""
    from django.contrib.auth import get_user_model

    from model_bakery import baker

    User = get_user_model()
    user = baker.make(User, username="wx_testuser", email="", phone=None)
    _login_user(client, user)

    resp = _post_wechat_phone(client, "13800138000")

    assert resp.status_code == 200, f"{resp.status_code}: {resp.content[:200]}"
    body = resp.json()
    assert body["phone"] == "+8613800138000"
    assert body["merged"] is False

    user.refresh_from_db()
    assert user.phone == "+8613800138000"
    assert user.phone_verified is True


@override_settings(**WECHAT_PHONE_SETTINGS)
def test_bind_same_phone_is_idempotent(client, db):
    """重复绑定同一手机号，返回 200 不报错。"""
    from django.contrib.auth import get_user_model

    from model_bakery import baker

    User = get_user_model()
    user = baker.make(User, username="wx_testuser2", email="", phone="+8613800138000", phone_verified=True)
    _login_user(client, user)

    resp = _post_wechat_phone(client, "13800138000")

    assert resp.status_code == 200
    assert resp.json()["merged"] is False


@override_settings(**WECHAT_PHONE_SETTINGS)
def test_bind_phone_merges_existing_account(client, db):
    """手机号已属于 User B，迁移 SocialAccount，软删除当前 User，session 切换到 User B。"""
    from django.contrib.auth import get_user_model

    from allauth.socialaccount.models import SocialAccount
    from model_bakery import baker

    User = get_user_model()

    # User A：微信 openid 登录创建的空白账号（当前登录用户）
    user_a = baker.make(User, username="wx_blank", email="", phone=None)
    baker.make(
        SocialAccount,
        user=user_a,
        provider="wechat_miniprogram",
        uid="openid_abc",
        extra_data={"openid": "openid_abc"},
    )

    # User B：已有手机号账号
    user_b = baker.make(User, username="real_user", email="user@example.com", phone="+8613800138000", phone_verified=True)

    _login_user(client, user_a)
    resp = _post_wechat_phone(client, "13800138000")

    assert resp.status_code == 200
    body = resp.json()
    assert body["merged"] is True
    assert body["phone"] == "+8613800138000"

    # SocialAccount 已迁移到 user_b
    assert SocialAccount.objects.filter(uid="openid_abc", user=user_b).exists()

    # user_a 已软删除
    user_a.refresh_from_db()
    assert user_a.is_active is False

    # session 已切换到 user_b
    from django.contrib.auth import get_user as get_session_user
    session_user = get_session_user(client)
    assert session_user == user_b


@override_settings(**WECHAT_PHONE_SETTINGS)
def test_wechat_phone_api_error_returns_400(client, db):
    """微信 API 返回 errcode 时，端点返回 400。"""
    from django.contrib.auth import get_user_model

    from model_bakery import baker

    User = get_user_model()
    user = baker.make(User, username="wx_err", email="", phone=None)
    _login_user(client, user)

    from django.core.cache import cache
    cache.set("wechat_miniprogram_access_token:test-miniprogram-appid", "cached_token", timeout=7000)

    error_mock = MagicMock()
    error_mock.json.return_value = {"errcode": 40029, "errmsg": "invalid code"}
    error_mock.raise_for_status = MagicMock()

    with patch("apps.accounts.wechat_phone.requests.post", return_value=error_mock):
        resp = client.post(
            "/api/auth/wechat-phone/",
            {"phone_code": "bad_code"},
            content_type="application/json",
        )

    assert resp.status_code == 400
