import pytest

from allauth.socialaccount.models import SocialAccount

from apps.accounts.models import User


@pytest.mark.django_db
def test_social_bindings_requires_login(client):
    response = client.get("/api/users/me/social-bindings/")

    assert response.status_code == 401
    assert response.json()["detail"] == "Unauthorized"


@pytest.mark.django_db
def test_social_bindings_returns_all_false_when_user_has_no_accounts(client):
    user = User.objects.create_user(
        username="plain",
        email="plain@example.com",
        password="secret123",  # noqa: S106
    )
    client.force_login(user)

    response = client.get("/api/users/me/social-bindings/")

    assert response.status_code == 200
    assert response.json() == {
        "items": [
            {"provider": "github", "label": "GitHub", "connected": False},
            {"provider": "weixin", "label": "微信", "connected": False},
        ]
    }


@pytest.mark.django_db
def test_social_bindings_marks_github_when_social_account_exists(client):
    user = User.objects.create_user(
        username="gh",
        email="gh@example.com",
        password="secret123",  # noqa: S106
    )
    SocialAccount.objects.create(user=user, provider="github", uid="gh-001")
    client.force_login(user)

    payload = client.get("/api/users/me/social-bindings/").json()

    assert payload["items"] == [
        {"provider": "github", "label": "GitHub", "connected": True},
        {"provider": "weixin", "label": "微信", "connected": False},
    ]


@pytest.mark.django_db
def test_social_bindings_marks_weixin_when_social_account_exists(client):
    user = User.objects.create_user(
        username="wx",
        email="wx@example.com",
        password="secret123",  # noqa: S106
    )
    SocialAccount.objects.create(user=user, provider="weixin", uid="wx-001")
    client.force_login(user)

    payload = client.get("/api/users/me/social-bindings/").json()

    assert payload["items"] == [
        {"provider": "github", "label": "GitHub", "connected": False},
        {"provider": "weixin", "label": "微信", "connected": True},
    ]


@pytest.mark.django_db
def test_social_bindings_does_not_treat_wechat_miniprogram_as_weixin(client):
    user = User.objects.create_user(
        username="mini",
        email="mini@example.com",
        password="secret123",  # noqa: S106
    )
    SocialAccount.objects.create(user=user, provider="wechat_miniprogram", uid="mini-001")
    client.force_login(user)

    payload = client.get("/api/users/me/social-bindings/").json()

    assert payload["items"] == [
        {"provider": "github", "label": "GitHub", "connected": False},
        {"provider": "weixin", "label": "微信", "connected": False},
    ]
