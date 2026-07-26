from django.test import RequestFactory

import pytest

from apps.organizations.hooks import post_create_organization, pre_create_organization


@pytest.fixture
def request_with_user(db):
    from model_bakery import baker

    factory = RequestFactory()
    request = factory.post("/")
    request.user = baker.make("accounts.User", phone_verified=True)
    return request


def test_pre_create_organization_allows_verified_user_below_global_limit(request_with_user):
    """手机号已验证且未达到全局创建上限时可以创建组织。"""
    result = pre_create_organization(request_with_user)
    assert result is None


def test_post_create_organization_skips_trial_before_plan_catalog_is_initialized(db, request_with_user):
    from model_bakery import baker

    org = baker.make("organizations.Organization")
    result = post_create_organization(request_with_user, org)
    assert result is None
