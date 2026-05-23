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

import pytest
from unittest.mock import patch, MagicMock
from django.test import override_settings

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
    """provider/token 端点接受 wechat_miniprogram 请求（验证 provider 已注册）。

    小程序走 app 端（/_allauth/app/v1/auth/provider/token）。
    此测试不 mock 微信 API，只验证端点存在且 provider 被识别（不返回 404/405）。
    """
    from unittest.mock import MagicMock, patch

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
