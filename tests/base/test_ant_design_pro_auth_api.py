import pytest

from apps.accounts.models import User


@pytest.mark.django_db
def test_users_me_requires_login(client):
    response = client.get("/api/users/me/")

    assert response.status_code == 401
    assert response.json()["detail"] == "Unauthorized"


@pytest.mark.django_db
def test_users_me_returns_current_user_for_existing_session(client):
    user = User.objects.create_user(
        username="admin",
        email="admin@example.com",
        password="secret123",  # noqa: S106
        first_name="Ada",
        last_name="Lovelace",
        is_staff=True,
    )
    client.force_login(user)

    current_response = client.get("/api/users/me/")

    assert current_response.status_code == 200
    payload = current_response.json()
    assert payload["username"] == "admin"
    assert payload["first_name"] == "Ada"
    assert payload["last_name"] == "Lovelace"
    assert payload["email"] == "admin@example.com"
    assert payload["is_staff"] is True


@pytest.mark.django_db
def test_allauth_headless_is_mounted_under_api(client):
    response = client.get("/api/allauth/browser/v1/config")

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == 200
    assert "account" in payload["data"]


@pytest.mark.django_db
def test_ant_design_pro_compat_endpoints_are_not_exposed(client):
    assert client.get("/api/currentUser").status_code == 404
    assert client.post("/api/login/account", {}, content_type="application/json").status_code == 404
    assert client.post("/api/login/outLogin").status_code == 404
