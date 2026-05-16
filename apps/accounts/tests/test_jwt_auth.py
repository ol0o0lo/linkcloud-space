"""
JWT 认证集成测试（使用 allauth headless JWT）。

验证：
- allauth 登录接口颁发 access_token + refresh_token
- access_token 可访问受保护的 Ninja 接口
- 无效 token 返回 401
- refresh_token 可换取新 access_token
- session 认证仍然有效（Web 端回归）
"""

import pytest
from django.test import override_settings

# 测试专用：关闭 phone 相关功能，只用 email 登录
# 避免 phone verification stage 因测试用户无 phone 而 abort 登录
JWT_TEST_SETTINGS = {
    "ACCOUNT_LOGIN_METHODS": {"email"},
    "ACCOUNT_PHONE_VERIFICATION_ENABLED": False,
    "ACCOUNT_SIGNUP_FIELDS": ["email*", "password1*"],
}


@pytest.fixture
def user_with_password(db):
    from django.contrib.auth import get_user_model
    User = get_user_model()
    return User.objects.create_user(
        username="jwtuser",
        email="jwtuser@example.com",
        password="testpass123",
    )


@pytest.fixture
def jwt_client():
    """使用 localhost SERVER_NAME 的测试客户端。"""
    from django.test import Client
    return Client(SERVER_NAME="localhost")


def _allauth_login(client, email, password):
    """通过 allauth headless 登录，返回 (access_token, refresh_token)。

    allauth JWT 响应结构：
    - data.user / data.methods — 用户信息
    - meta.access_token / meta.refresh_token — JWT tokens（由 JWTTokenStrategy 注入 meta）
    """
    resp = client.post(
        "/_allauth/app/v1/auth/login",
        {"email": email, "password": password},
        content_type="application/json",
    )
    assert resp.status_code == 200, f"Login failed: {resp.json()}"
    meta = resp.json()["meta"]
    return meta["access_token"], meta["refresh_token"]


@override_settings(**JWT_TEST_SETTINGS)
def test_login_returns_jwt(jwt_client, user_with_password):
    """allauth 登录接口颁发 access_token 和 refresh_token。"""
    access, refresh = _allauth_login(jwt_client, "jwtuser@example.com", "testpass123")
    assert access
    assert refresh


@override_settings(**JWT_TEST_SETTINGS)
def test_login_wrong_password(jwt_client, user_with_password):
    """错误密码返回 400（allauth 对凭据错误的标准响应）。"""
    resp = jwt_client.post(
        "/_allauth/app/v1/auth/login",
        {"email": "jwtuser@example.com", "password": "wrong"},
        content_type="application/json",
    )
    assert resp.status_code == 400


@override_settings(**JWT_TEST_SETTINGS)
def test_access_ninja_endpoint_with_jwt(jwt_client, user_with_password):
    """用 access_token 可访问 Ninja 保护接口（认证通过即可，权限不足是 403 不是 401）。"""
    access, _ = _allauth_login(jwt_client, "jwtuser@example.com", "testpass123")

    resp = jwt_client.get(
        "/api/users/",
        HTTP_AUTHORIZATION=f"Bearer {access}",
    )
    # 认证通过：200 或 403（权限不足），不能是 401
    assert resp.status_code in (200, 403)


def test_invalid_jwt_returns_401(jwt_client, db):
    """无效 JWT 返回 401。"""
    resp = jwt_client.get(
        "/api/users/",
        HTTP_AUTHORIZATION="Bearer invalidtoken",
    )
    assert resp.status_code == 401


def test_no_auth_returns_401(jwt_client, db):
    """无认证信息返回 401。"""
    resp = jwt_client.get("/api/users/")
    assert resp.status_code == 401


@override_settings(**JWT_TEST_SETTINGS)
def test_refresh_token(jwt_client, user_with_password):
    """refresh_token 可换取新 access_token。"""
    _, refresh = _allauth_login(jwt_client, "jwtuser@example.com", "testpass123")

    resp = jwt_client.post(
        "/_allauth/app/v1/tokens/refresh",
        {"refresh_token": refresh},
        content_type="application/json",
    )
    assert resp.status_code == 200
    # refresh 响应的 access_token 在 data 里（与登录响应的 meta 不同）
    data = resp.json()["data"]
    assert "access_token" in data


def test_session_auth_still_works(client, user_with_password):
    """Web 端 session 认证不受影响（回归测试）。"""
    client.force_login(user_with_password)
    resp = client.get("/api/version/")
    assert resp.status_code == 200
