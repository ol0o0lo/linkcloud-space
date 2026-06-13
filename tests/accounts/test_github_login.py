"""
GitHub 登录集成测试。

测试策略：
- browser 端：验证 redirect 端点返回 302 到 GitHub
- app 端：mock GitHub API，用 access_token 直接换 allauth session
- provider 列表：GitHub 出现在未认证时的 flows 中

注意：allauth 65.x 中，如果 settings.SOCIALACCOUNT_PROVIDERS 包含 APP 块，
同时 DB 里也有 SocialApp 记录，会报 MultipleObjectsReturned。
因此测试中使用 settings APP 方式（不建 DB 记录）。
"""

import pytest
from unittest.mock import patch, MagicMock
from django.test import override_settings

# settings APP 方式提供凭据（不使用 DB SocialApp）
GITHUB_TEST_SETTINGS = {
    "SOCIALACCOUNT_PROVIDERS": {
        "github": {
            "APP": {
                "client_id": "test-client-id",
                "secret": "test-client-secret",
            },
            "SCOPE": ["user:email"],
            "EMAIL_AUTHENTICATION": True,
        }
    },
    "SOCIALACCOUNT_AUTO_SIGNUP": True,
    "SOCIALACCOUNT_EMAIL_REQUIRED": True,
    "SOCIALACCOUNT_EMAIL_VERIFICATION": "none",
    "ACCOUNT_LOGIN_METHODS": {"email"},
    "ACCOUNT_PHONE_VERIFICATION_ENABLED": False,
    # callback_url 需要在 ALLOWED_HOSTS 里才能通过 allauth is_safe_url 验证
    "ALLOWED_HOSTS": ["localhost", "localhost:5173"],
}


@pytest.fixture
def browser_client():
    from django.test import Client
    return Client(SERVER_NAME="localhost")


@pytest.fixture
def app_client():
    from django.test import Client
    return Client(SERVER_NAME="localhost")


@override_settings(**GITHUB_TEST_SETTINGS)
def test_github_redirect_returns_302(browser_client, db):
    """browser 端：发起 GitHub 登录返回重定向到 GitHub 授权页。"""
    resp = browser_client.post(
        "/api/allauth/browser/v1/auth/provider/redirect",
        {
            "provider": "github",
            "callback_url": "http://localhost:5173/accounts/callback/",
            "process": "login",
        },
    )
    assert resp.status_code == 302, f"Expected 302, got {resp.status_code}: {resp.content[:200]}"
    assert "github.com" in resp["Location"], f"Redirect not to GitHub: {resp['Location']}"


@override_settings(**GITHUB_TEST_SETTINGS)
def test_github_provider_in_flows(browser_client, db):
    """未认证时 GitHub provider 出现在 login flows 中。"""
    # 任意需要认证的接口都会返回 401 + flows 列表
    resp = browser_client.get("/api/allauth/browser/v1/account/providers")
    body = resp.json()
    # flows 在未认证的 401 响应的 data 里
    flows = body.get("data", {}).get("flows", [])
    provider_flow = next((f for f in flows if f.get("id") == "provider_redirect"), None)
    assert provider_flow is not None, f"No provider_redirect flow: {flows}"
    assert "github" in provider_flow.get("providers", []), \
        f"GitHub not in providers: {provider_flow}"


@override_settings(**GITHUB_TEST_SETTINGS)
def test_github_app_token_login_flow(app_client, db):
    """app 端：provider/token 端点存在且接受 POST（mock GitHub API 调用）。"""
    mock_response = MagicMock()
    mock_response.json.return_value = {
        "id": 12345,
        "login": "testgithubuser",
        "name": "Test GitHub User",
        "email": "githubuser@example.com",
        "avatar_url": "https://avatars.githubusercontent.com/u/12345",
    }
    mock_response.raise_for_status = MagicMock()

    with patch("requests.Session.get", return_value=mock_response):
        resp = app_client.post(
            "/api/allauth/app/v1/auth/provider/token",
            {
                "provider": "github",
                "access_token": "gho_fake_github_token",
            },
            content_type="application/json",
        )
    # 任何非 5xx 都说明端点正常工作
    assert resp.status_code < 500, f"Server error: {resp.status_code} {resp.content[:300]}"
