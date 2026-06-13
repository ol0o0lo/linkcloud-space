"""
allauth headless app 端（移动端）认证流程测试。

使用 /api/allauth/app/v1/ 路径，与浏览器端 /api/allauth/browser/v1/ 区别在于：
- 无 CSRF 要求
- 登录响应 body 里返回 session token
- 后续请求用 X-Session-Token header 携带 token（不依赖 cookie）
"""

import pytest
from allauth.account.models import EmailAddress
from model_bakery import baker

from apps.accounts.models import User
from apps.organizations.models import OrganizationMember
from apps.settings.models import DefaultSetting


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
def test_app_login_returns_session_token(client, verified_user):
    """App 端登录成功后，响应 body 里应包含 session token。"""
    resp = client.post(
        "/api/allauth/app/v1/auth/login",
        data={"email": verified_user.email, "password": "testpw123!"},
        content_type="application/json",
    )
    assert resp.status_code == 200, resp.content
    data = resp.json()
    assert "meta" in data
    assert "session_token" in data["meta"], f"meta 里没有 session_token，实际: {data['meta']}"


@pytest.mark.django_db
def test_app_session_token_authenticates_allauth_endpoints(client, verified_user):
    """App 端登录后，用 X-Session-Token header 可以访问 allauth app 端点（如获取当前 session）。"""
    resp = client.post(
        "/api/allauth/app/v1/auth/login",
        data={"email": verified_user.email, "password": "testpw123!"},
        content_type="application/json",
    )
    assert resp.status_code == 200, resp.content
    session_token = resp.json()["meta"]["session_token"]

    # 用 session token 访问 allauth app 端点
    session_resp = client.get("/api/allauth/app/v1/auth/session", HTTP_X_SESSION_TOKEN=session_token)
    assert session_resp.status_code == 200, session_resp.content
    assert session_resp.json()["data"]["user"]["email"] == verified_user.email


@pytest.mark.django_db
def test_app_login_wrong_password_returns_400(client, verified_user):
    """错误密码登录应返回 400。"""
    resp = client.post(
        "/api/allauth/app/v1/auth/login",
        data={"email": verified_user.email, "password": "wrongpassword"},
        content_type="application/json",
    )
    assert resp.status_code == 400, resp.content


@pytest.mark.django_db
def test_app_logout_invalidates_session_token(client, verified_user):
    """App 端登出后，session token 应失效，无法再访问需认证的 API。"""
    resp = client.post(
        "/api/allauth/app/v1/auth/login",
        data={"email": verified_user.email, "password": "testpw123!"},
        content_type="application/json",
    )
    session_token = resp.json()["meta"]["session_token"]

    client.delete("/api/allauth/app/v1/auth/session", HTTP_X_SESSION_TOKEN=session_token)

    api_resp = client.get("/api/users/me/", HTTP_X_SESSION_TOKEN=session_token)
    assert api_resp.status_code == 401, api_resp.content


@pytest.mark.django_db
def test_app_request_uses_x_org_slug_without_session_org(client, verified_user):
    """App 端只带 X-Session-Token 和 X-Org-Slug 时，也能拿到当前租户上下文。"""
    org = baker.make("organizations.Organization")
    OrganizationMember.objects.create(organization=org, user=verified_user, is_owner=True)
    DefaultSetting.objects.create(key="site_name", value="My SaaS", value_type="text", description="站点名称")

    resp = client.post(
        "/api/allauth/app/v1/auth/login",
        data={"email": verified_user.email, "password": "testpw123!"},
        content_type="application/json",
    )
    assert resp.status_code == 200, resp.content
    session_token = resp.json()["meta"]["session_token"]

    api_resp = client.get("/api/settings/org/", HTTP_X_SESSION_TOKEN=session_token, HTTP_X_ORG_SLUG=org.slug)

    assert api_resp.status_code == 200, api_resp.content
    assert api_resp.json()[0]["key"] == "site_name"


@pytest.mark.django_db
def test_app_request_prefers_x_org_slug_over_session_org(client, verified_user):
    """请求同时带 session 选中租户和 X-Org-Slug 时，应优先使用 header 指定的租户。"""
    session_org = baker.make("organizations.Organization")
    header_org = baker.make("organizations.Organization")
    OrganizationMember.objects.create(organization=session_org, user=verified_user, is_owner=True)
    OrganizationMember.objects.create(organization=header_org, user=verified_user, is_owner=True)
    DefaultSetting.objects.create(key="site_name", value="My SaaS", value_type="text", description="站点名称")
    session = client.session
    session["organization_data"] = (
        f'{{"pk": {session_org.pk}, "id": {session_org.pk}, "name": "{session_org.name}", '
        f'"slug": "{session_org.slug}", "is_owner": true}}'
    )
    session.save()

    resp = client.post(
        "/api/allauth/app/v1/auth/login",
        data={"email": verified_user.email, "password": "testpw123!"},
        content_type="application/json",
    )
    assert resp.status_code == 200, resp.content
    session_token = resp.json()["meta"]["session_token"]

    api_resp = client.get("/api/organizations/switch-list/", HTTP_X_SESSION_TOKEN=session_token, HTTP_X_ORG_SLUG=header_org.slug)

    assert api_resp.status_code == 200, api_resp.content
    assert any(item["slug"] == header_org.slug and item["is_current"] is True for item in api_resp.json())
    assert any(item["slug"] == session_org.slug and item["is_current"] is False for item in api_resp.json())
