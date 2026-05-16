import pytest
from django.test import RequestFactory

from apps.organizations.hooks import post_create_organization, pre_create_organization


@pytest.fixture
def request_with_user(db):
    from model_bakery import baker

    factory = RequestFactory()
    request = factory.post("/")
    request.user = baker.make("accounts.User")
    return request


def test_pre_create_organization_is_noop(request_with_user):
    """当前为空实现，不应抛出任何异常。"""
    result = pre_create_organization(request_with_user)
    assert result is None


def test_post_create_organization_is_noop(db, request_with_user):
    from model_bakery import baker

    org = baker.make("organizations.Organization")
    result = post_create_organization(request_with_user, org)
    assert result is None
