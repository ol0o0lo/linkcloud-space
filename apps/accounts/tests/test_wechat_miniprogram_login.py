"""
微信小程序登录集成测试。

测试策略：
- provider 骨架：wechat_miniprogram 出现在未认证时的 flows 中
- 登录流程：mock jscode2session，用 provider/token 端点完成登录
- 自动注册：新 openid 自动创建 User（username=wx_xxx，email 为空）
- 已有账号：同一 openid 再次登录返回已有 User
- unionid 合并：先小程序后扫码、先扫码后小程序两种场景
- 错误处理：微信返回 errcode 时响应非 5xx

注意：allauth 65.x 中，如果 settings.SOCIALACCOUNT_PROVIDERS 包含 APP 块，
同时 DB 里也有 SocialApp 记录，会报 MultipleObjectsReturned。
因此测试中使用 settings APP 方式（不建 DB 记录）。
"""

from unittest.mock import MagicMock, patch

from django.test import override_settings

import pytest

MINIPROGRAM_TEST_SETTINGS = {
    "SOCIALACCOUNT_PROVIDERS": {
        "wechat_miniprogram": {
            "APP": {
                "client_id": "test-miniprogram-appid",
                "secret": "test-miniprogram-secret",
            },
        },
    },
    "SOCIALACCOUNT_AUTO_SIGNUP": True,
    "SOCIALACCOUNT_EMAIL_REQUIRED": False,
    "SOCIALACCOUNT_EMAIL_VERIFICATION": "none",
    "ACCOUNT_LOGIN_METHODS": {"email"},
    "ACCOUNT_PHONE_VERIFICATION_ENABLED": False,
    "ALLOWED_HOSTS": ["localhost", "localhost:5173"],
}


@pytest.fixture
def client():
    from django.test import Client
    return Client(SERVER_NAME="localhost")


@override_settings(**MINIPROGRAM_TEST_SETTINGS)
def test_wechat_miniprogram_provider_token_endpoint_reachable(client, db):
    """
    provider/token 端点接受 wechat_miniprogram 请求（验证 provider 已注册）。

    小程序走 app 端（/_allauth/app/v1/auth/provider/token）。
    此测试不 mock 微信 API，只验证端点存在且 provider 被识别（不返回 404/405）。
    """
    mock_resp = MagicMock()
    mock_resp.json.return_value = {"openid": "probe_openid", "session_key": "sk"}
    mock_resp.raise_for_status = MagicMock()

    with patch("apps.accounts.providers.wechat_miniprogram.provider.http_requests.get", return_value=mock_resp):
        resp = client.post(
            "/_allauth/app/v1/auth/provider/token",
            {
                "provider": "wechat_miniprogram",
                "process": "login",
                "token": {"client_id": "test-miniprogram-appid", "id_token": "probe_code"},
            },
            content_type="application/json",
        )
    # 任何非 404/405 都说明 provider 已注册且端点正常工作
    assert resp.status_code not in (404, 405), \
        f"Provider 未注册或端点不存在: {resp.status_code} {resp.content[:200]}"


@override_settings(**MINIPROGRAM_TEST_SETTINGS)
def test_miniprogram_login_calls_jscode2session(client, db):
    """provider/token 端点收到 code 后调用微信 jscode2session API。"""
    mock_resp = MagicMock()
    mock_resp.json.return_value = {"openid": "test_openid_123", "session_key": "test_session_key"}
    mock_resp.raise_for_status = MagicMock()

    with patch(
        "apps.accounts.providers.wechat_miniprogram.provider.http_requests.get",
        return_value=mock_resp,
    ) as mock_get:
        client.post(
            "/_allauth/app/v1/auth/provider/token",
            {
                "provider": "wechat_miniprogram",
                "process": "login",
                "token": {"client_id": "test-miniprogram-appid", "id_token": "test_code_abc"},
            },
            content_type="application/json",
        )
        mock_get.assert_called_once()
        call_kwargs = mock_get.call_args
        assert "jscode2session" in call_kwargs[0][0]
        assert call_kwargs[1]["params"]["js_code"] == "test_code_abc"
        assert call_kwargs[1]["params"]["appid"] == "test-miniprogram-appid"


def _mock_wx_login(client, openid, *, unionid=None):
    """辅助函数：mock 微信登录，返回 response。"""
    wx_data = {"openid": openid, "session_key": "sk"}
    if unionid:
        wx_data["unionid"] = unionid

    mock_resp = MagicMock()
    mock_resp.json.return_value = wx_data
    mock_resp.raise_for_status = MagicMock()

    with patch(
        "apps.accounts.providers.wechat_miniprogram.provider.http_requests.get",
        return_value=mock_resp,
    ):
        return client.post(
            "/_allauth/app/v1/auth/provider/token",
            {
                "provider": "wechat_miniprogram",
                "process": "login",
                "token": {"client_id": "test-miniprogram-appid", "id_token": "code"},
            },
            content_type="application/json",
        )


@override_settings(**MINIPROGRAM_TEST_SETTINGS)
def test_miniprogram_new_user_auto_registers(client, db):
    """新 openid 首次登录自动创建 User 和 SocialAccount。"""
    from django.contrib.auth import get_user_model

    from allauth.socialaccount.models import SocialAccount

    User = get_user_model()

    resp = _mock_wx_login(client, "new_openid_001")

    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.content[:300]}"

    assert User.objects.filter(socialaccount__uid="new_openid_001").exists()
    user = User.objects.get(socialaccount__uid="new_openid_001")
    assert user.username.startswith("wx_"), f"username 应以 wx_ 开头: {user.username}"
    assert user.email == "", f"email 应为空: {user.email}"

    sa = SocialAccount.objects.get(provider="wechat_miniprogram", uid="new_openid_001")
    assert sa.extra_data.get("openid") == "new_openid_001"


@override_settings(**MINIPROGRAM_TEST_SETTINGS)
def test_miniprogram_username_format(client, db):
    """两次不同 openid 登录，username 各自以 wx_ 开头且互不重复。"""
    from django.contrib.auth import get_user_model

    User = get_user_model()

    _mock_wx_login(client, "openid_aaa")
    client2 = __import__("django.test", fromlist=["Client"]).Client(SERVER_NAME="localhost")
    _mock_wx_login(client2, "openid_bbb")

    usernames = list(User.objects.filter(username__startswith="wx_").values_list("username", flat=True))
    assert len(usernames) == 2, f"应有 2 个 wx_ 用户: {usernames}"
    assert len(set(usernames)) == 2, f"username 不应重复: {usernames}"


@override_settings(**MINIPROGRAM_TEST_SETTINGS)
def test_miniprogram_existing_user_logs_in(client, db):
    """已有 SocialAccount 的 openid 再次登录，直接返回已有 User，不重复创建。"""
    from django.contrib.auth import get_user_model

    from allauth.socialaccount.models import SocialAccount
    from model_bakery import baker

    User = get_user_model()
    existing_user = baker.make(User, username="wx_existing", email="")
    baker.make(
        SocialAccount,
        user=existing_user,
        provider="wechat_miniprogram",
        uid="existing_openid_999",
        extra_data={"openid": "existing_openid_999"},
    )

    resp = _mock_wx_login(client, "existing_openid_999")

    assert resp.status_code == 200
    assert User.objects.filter(username="wx_existing").count() == 1, "不应重复创建 User"


@override_settings(**MINIPROGRAM_TEST_SETTINGS)
def test_miniprogram_invalid_code_returns_error(client, db):
    """微信返回 errcode 时，响应为 4xx 而非 500。"""
    mock_resp = MagicMock()
    mock_resp.json.return_value = {"errcode": 40029, "errmsg": "invalid code"}
    mock_resp.raise_for_status = MagicMock()

    with patch(
        "apps.accounts.providers.wechat_miniprogram.provider.http_requests.get",
        return_value=mock_resp,
    ):
        resp = client.post(
            "/_allauth/app/v1/auth/provider/token",
            {
                "provider": "wechat_miniprogram",
                "process": "login",
                "token": {"client_id": "test-miniprogram-appid", "id_token": "bad_code"},
            },
            content_type="application/json",
        )

    assert resp.status_code < 500, f"不应返回 5xx: {resp.status_code} {resp.content[:200]}"


MINIPROGRAM_AND_WEIXIN_SETTINGS = {
    **MINIPROGRAM_TEST_SETTINGS,
    "SOCIALACCOUNT_PROVIDERS": {
        **MINIPROGRAM_TEST_SETTINGS["SOCIALACCOUNT_PROVIDERS"],
        "weixin": {
            "APP": {
                "client_id": "test-weixin-appid",
                "secret": "test-weixin-secret",
            },
            "SCOPE": ["snsapi_login"],
        },
    },
}


@override_settings(**MINIPROGRAM_AND_WEIXIN_SETTINGS)
def test_unionid_merge_miniprogram_then_weixin(db):
    """先小程序登录建立账号，再用相同 unionid 的 weixin provider 登录，应合并为同一 User。"""
    from django.contrib.auth import get_user_model
    from django.test import RequestFactory

    from allauth.socialaccount.models import SocialAccount, SocialLogin, SocialToken
    from model_bakery import baker

    User = get_user_model()

    mp_user = baker.make(User, username="wx_mp_user", email="")
    baker.make(
        SocialAccount,
        user=mp_user,
        provider="wechat_miniprogram",
        uid="mp_openid_001",
        extra_data={"openid": "mp_openid_001", "unionid": "shared_unionid_xyz"},
    )

    from apps.accounts.auth_adapter import AccountAdapter

    weixin_account = SocialAccount(
        provider="weixin",
        uid="shared_unionid_xyz",
        extra_data={"unionid": "shared_unionid_xyz"},
    )
    weixin_login = SocialLogin(account=weixin_account)
    weixin_login.token = SocialToken(token="fake_access_token")

    request = RequestFactory().get("/")
    request.session = {}

    adapter = AccountAdapter()
    adapter.pre_social_login(request, weixin_login)

    assert weixin_login.user == mp_user, f"应合并到 mp_user，实际: {weixin_login.user}"


@override_settings(**MINIPROGRAM_AND_WEIXIN_SETTINGS)
def test_unionid_merge_weixin_then_miniprogram(db):
    """先网页扫码登录建立账号，再用相同 unionid 的小程序登录，应合并为同一 User。"""
    from django.contrib.auth import get_user_model
    from django.test import RequestFactory

    from allauth.socialaccount.models import SocialAccount, SocialLogin, SocialToken
    from model_bakery import baker

    User = get_user_model()

    wx_user = baker.make(User, username="weixin_user", email="")
    baker.make(
        SocialAccount,
        user=wx_user,
        provider="weixin",
        uid="shared_unionid_abc",
        extra_data={},
    )

    from apps.accounts.auth_adapter import AccountAdapter

    mp_account = SocialAccount(
        provider="wechat_miniprogram",
        uid="mp_openid_002",
        extra_data={"openid": "mp_openid_002", "unionid": "shared_unionid_abc"},
    )
    mp_login = SocialLogin(account=mp_account)
    mp_login.token = SocialToken(token="fake_code")

    request = RequestFactory().get("/")
    request.session = {}

    adapter = AccountAdapter()
    adapter.pre_social_login(request, mp_login)

    assert mp_login.user == wx_user, f"应合并到 wx_user，实际: {mp_login.user}"


@override_settings(**MINIPROGRAM_TEST_SETTINGS)
def test_no_unionid_creates_independent_accounts(client, db):
    """小程序登录没有 unionid 时，不合并，独立创建账号。"""
    from django.contrib.auth import get_user_model

    from allauth.socialaccount.models import SocialAccount
    from model_bakery import baker

    User = get_user_model()

    existing = baker.make(User, username="wx_other", email="")
    baker.make(
        SocialAccount,
        user=existing,
        provider="wechat_miniprogram",
        uid="other_openid",
        extra_data={"openid": "other_openid", "unionid": "some_unionid"},
    )

    resp = _mock_wx_login(client, "no_unionid_openid")  # 无 unionid

    assert resp.status_code == 200
    assert User.objects.count() == 2, f"应有 2 个 User，实际: {User.objects.count()}"
