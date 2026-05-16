"""
X-Org-Slug header 测试（使用 allauth headless JWT）。

验证小程序通过 JWT + X-Org-Slug header 可正确解析 request.org。
"""

import pytest
from django.test import override_settings

# 测试专用：关闭 phone 相关功能，只用 email 登录
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
        username="orgtest",
        email="orgtest@example.com",
        password="testpass123",
    )


@pytest.fixture
def org_with_member(db, user_with_password):
    from model_bakery import baker
    from apps.organizations.models import OrganizationMember
    org = baker.make("organizations.Organization", name="Test Org", slug="test-org")
    OrganizationMember.objects.create(organization=org, user=user_with_password, is_owner=True)
    return org


@pytest.fixture
def jwt_client():
    from django.test import Client
    return Client(SERVER_NAME="localhost")


def _get_access_token(client, email="orgtest@example.com", password="testpass123"):
    """allauth JWT tokens 在 meta 中，不在 data 中。"""
    resp = client.post(
        "/_allauth/app/v1/auth/login",
        {"email": email, "password": password},
        content_type="application/json",
    )
    assert resp.status_code == 200, f"Login failed: {resp.json()}"
    return resp.json()["meta"]["access_token"]


@override_settings(**JWT_TEST_SETTINGS)
def test_org_resolved_from_header(jwt_client, org_with_member, user_with_password):
    """JWT + X-Org-Slug header 可正确访问需要 org 的接口。"""
    token = _get_access_token(jwt_client)
    resp = jwt_client.get(
        "/api/teams/",
        HTTP_AUTHORIZATION=f"Bearer {token}",
        HTTP_X_ORG_SLUG="test-org",
    )
    assert resp.status_code == 200


@override_settings(**JWT_TEST_SETTINGS)
def test_wrong_org_slug_returns_403(jwt_client, org_with_member, user_with_password):
    """不存在的 org slug 应返回 403。"""
    token = _get_access_token(jwt_client)
    resp = jwt_client.get(
        "/api/teams/",
        HTTP_AUTHORIZATION=f"Bearer {token}",
        HTTP_X_ORG_SLUG="nonexistent-org",
    )
    assert resp.status_code == 403


@override_settings(**JWT_TEST_SETTINGS)
def test_not_member_org_returns_403(jwt_client, db, user_with_password):
    """不是成员的 org 应返回 403。"""
    from model_bakery import baker
    baker.make("organizations.Organization", slug="other-org")
    token = _get_access_token(jwt_client)
    resp = jwt_client.get(
        "/api/teams/",
        HTTP_AUTHORIZATION=f"Bearer {token}",
        HTTP_X_ORG_SLUG="other-org",
    )
    assert resp.status_code == 403


@override_settings(**JWT_TEST_SETTINGS)
def test_no_org_header_returns_403(jwt_client, org_with_member, user_with_password):
    """JWT 认证通过但无 X-Org-Slug header，需要 org 的接口返回 403。"""
    token = _get_access_token(jwt_client)
    resp = jwt_client.get(
        "/api/teams/",
        HTTP_AUTHORIZATION=f"Bearer {token}",
    )
    assert resp.status_code == 403
