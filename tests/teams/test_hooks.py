from django.test import RequestFactory

import pytest

from apps.teams.hooks import post_create_team, pre_create_team


@pytest.fixture
def request_with_user(db):
    from model_bakery import baker

    factory = RequestFactory()
    request = factory.post("/")
    request.user = baker.make("accounts.User")
    return request


def test_pre_create_team_is_noop(request_with_user):
    """当前为空实现，不应抛出任何异常。"""
    result = pre_create_team(request_with_user)
    assert result is None


def test_post_create_team_is_noop(db, request_with_user):
    from model_bakery import baker

    org = baker.make("organizations.Organization")
    team = baker.make("teams.Team", organization=org)
    result = post_create_team(request_with_user, team)
    assert result is None
