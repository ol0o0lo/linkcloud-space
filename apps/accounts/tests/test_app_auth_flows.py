"""
allauth headless app 端（移动端）认证流程测试。

使用 /_allauth/app/v1/ 路径，与浏览器端 /_allauth/browser/v1/ 区别在于：
- 无 CSRF 要求
- 认证状态通过 session cookie 维持
"""

import pytest
from allauth.account.models import EmailAddress

from apps.accounts.models import User


@pytest.fixture()
def verified_user(db):
    user = User.objects.create(email="app_user@example.com", username="app_user@example.com")
    user.set_password("testpw123!")
    user.save()
    EmailAddress.objects.create(user=user, email=user.email, verified=True, primary=True)
    return user


@pytest.fixture(autouse=True)
def _app_auth_settings(settings):
    settings.AUTHENTICATION_BACKENDS = ["allauth.account.auth_backends.AuthenticationBackend"]
    settings.ACCOUNT_SIGNUP_OPEN = True
    settings.ACCOUNT_LOGIN_METHODS = {"email"}
    settings.ACCOUNT_PHONE_VERIFICATION_ENABLED = False
    settings.ACCOUNT_SIGNUP_FIELDS = ["email*", "password1*"]


@pytest.mark.django_db
def test_app_login_returns_session_cookie(client, verified_user):
    """app 端登录成功后，响应中应包含 sessionid cookie。"""
    resp = client.post(
        "/_allauth/app/v1/auth/login",
        data={"email": verified_user.email, "password": "testpw123!"},
        content_type="application/json",
    )
    assert resp.status_code == 200, resp.content
    assert "sessionid" in resp.cookies


@pytest.mark.django_db
def test_app_login_session_authenticates_api(client, verified_user):
    """app 端登录后，携带 session cookie 可以访问需认证的 API。"""
    client.post(
        "/_allauth/app/v1/auth/login",
        data={"email": verified_user.email, "password": "testpw123!"},
        content_type="application/json",
    )
    resp = client.get("/api/users/me/")
    assert resp.status_code == 200, resp.content


@pytest.mark.django_db
def test_app_login_wrong_password_returns_400(client, verified_user):
    """错误密码登录应返回 400。"""
    resp = client.post(
        "/_allauth/app/v1/auth/login",
        data={"email": verified_user.email, "password": "wrongpassword"},
        content_type="application/json",
    )
    assert resp.status_code == 400, resp.content


@pytest.mark.django_db
def test_app_logout_clears_session(client, verified_user):
    """app 端登出后，session 应失效，无法再访问需认证的 API。"""
    client.post(
        "/_allauth/app/v1/auth/login",
        data={"email": verified_user.email, "password": "testpw123!"},
        content_type="application/json",
    )
    client.delete("/_allauth/app/v1/auth/session")
    resp = client.get("/api/users/me/")
    assert resp.status_code == 401, resp.content
