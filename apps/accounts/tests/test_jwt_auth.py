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
    """通过 allauth headless 登录，返回 (access_token, refresh_token)。"""
    resp = client.post(
        "/_allauth/browser/v1/auth/login",
        {"email": email, "password": password},
        content_type="application/json",
    )
    assert resp.status_code == 200, f"Login failed: {resp.json()}"
    data = resp.json()["data"]
    return data["access_token"], data["refresh_token"]


def test_login_returns_jwt(jwt_client, user_with_password):
    """allauth 登录接口颁发 access_token 和 refresh_token。"""
    access, refresh = _allauth_login(jwt_client, "jwtuser@example.com", "testpass123")
    assert access
    assert refresh


def test_login_wrong_password(jwt_client, user_with_password):
    """错误密码返回 401。"""
    resp = jwt_client.post(
        "/_allauth/browser/v1/auth/login",
        {"email": "jwtuser@example.com", "password": "wrong"},
        content_type="application/json",
    )
    assert resp.status_code == 401


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


def test_refresh_token(jwt_client, user_with_password):
    """refresh_token 可换取新 access_token。"""
    _, refresh = _allauth_login(jwt_client, "jwtuser@example.com", "testpass123")

    resp = jwt_client.post(
        "/_allauth/browser/v1/auth/tokens/refresh",
        {"refresh_token": refresh},
        content_type="application/json",
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert "access_token" in data


def test_session_auth_still_works(client, user_with_password):
    """Web 端 session 认证不受影响（回归测试）。"""
    client.force_login(user_with_password)
    resp = client.get("/api/version/")
    assert resp.status_code == 200
