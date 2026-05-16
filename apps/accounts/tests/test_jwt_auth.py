"""
JWT 认证集成测试。

验证：
- 正确凭据可获取 access + refresh token
- access token 可访问受保护的 Ninja 接口
- 无效 token 返回 401
- session 认证仍然有效（Web 端回归）

注意：allauth backend 不支持 username 登录（只支持 email/phone），
故 token 端点的 username 字段应填写 email。
"""

import pytest


@pytest.fixture
def user_with_password(db):
    from django.contrib.auth import get_user_model
    User = get_user_model()
    user = User.objects.create_user(
        username="jwtuser",
        email="jwtuser@example.com",
        password="testpass123",
    )
    return user


@pytest.fixture
def jwt_client():
    """使用 localhost 作为 SERVER_NAME 的测试客户端（避免 AllowedHosts 检查）。"""
    from django.test import Client
    return Client(SERVER_NAME="localhost")


def test_obtain_token_success(jwt_client, user_with_password):
    """正确凭据（email）可获取 token。"""
    resp = jwt_client.post(
        "/api/v1/auth/token/",
        {"username": "jwtuser@example.com", "password": "testpass123"},
        content_type="application/json",
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "access" in data
    assert "refresh" in data


def test_obtain_token_wrong_password(jwt_client, user_with_password):
    """错误密码返回 401。"""
    resp = jwt_client.post(
        "/api/v1/auth/token/",
        {"username": "jwtuser@example.com", "password": "wrong"},
        content_type="application/json",
    )
    assert resp.status_code == 401


def test_access_ninja_endpoint_with_jwt(jwt_client, user_with_password):
    """用 JWT access token 可访问 Ninja 保护接口（认证通过即可，权限不足是 403 不是 401）。"""
    resp = jwt_client.post(
        "/api/v1/auth/token/",
        {"username": "jwtuser@example.com", "password": "testpass123"},
        content_type="application/json",
    )
    access = resp.json()["access"]

    resp = jwt_client.get(
        "/api/users/",
        HTTP_AUTHORIZATION=f"Bearer {access}",
    )
    # 认证通过：200 或 403（权限不足），不能是 401
    assert resp.status_code in (200, 403)


def test_invalid_jwt_returns_401(jwt_client):
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
    """refresh token 可换取新 access token。"""
    resp = jwt_client.post(
        "/api/v1/auth/token/",
        {"username": "jwtuser@example.com", "password": "testpass123"},
        content_type="application/json",
    )
    refresh = resp.json()["refresh"]

    resp = jwt_client.post(
        "/api/v1/auth/token/refresh/",
        {"refresh": refresh},
        content_type="application/json",
    )
    assert resp.status_code == 200
    assert "access" in resp.json()


def test_session_auth_still_works(client, user_with_password):
    """Web 端 session 认证不受影响（回归测试）。"""
    client.force_login(user_with_password)
    resp = client.get("/api/version/")
    assert resp.status_code == 200
