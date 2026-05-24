"""
微信网页扫码登录配置测试。

weixin provider 是 allauth 内置实现，此处只验证配置正确、
provider 可用、redirect 返回到微信授权页。
"""

from django.test import override_settings

import pytest

WEIXIN_TEST_SETTINGS = {
    "SOCIALACCOUNT_PROVIDERS": {
        "weixin": {
            "APP": {
                "client_id": "test-weixin-appid",
                "secret": "test-weixin-secret",
            },
            "SCOPE": ["snsapi_login"],
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
def browser_client():
    from django.test import Client

    return Client(SERVER_NAME="localhost")


@override_settings(**WEIXIN_TEST_SETTINGS)
def test_weixin_redirect_returns_302(browser_client, db):
    """发起 weixin 登录返回重定向到微信开放平台授权页。"""
    resp = browser_client.post(
        "/_allauth/browser/v1/auth/provider/redirect",
        {
            "provider": "weixin",
            "callback_url": "http://localhost:5173/accounts/callback/",
            "process": "login",
        },
    )
    assert resp.status_code == 302, f"Expected 302, got {resp.status_code}: {resp.content[:200]}"
    location = resp["Location"]
    assert "weixin.qq.com" in location or "open.weixin.qq.com" in location, \
        f"Redirect 应指向微信域名: {location}"
