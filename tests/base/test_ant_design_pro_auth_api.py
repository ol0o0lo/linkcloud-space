import pytest

from apps.accounts.models import User


@pytest.mark.django_db
def test_current_user_requires_login(client):
    response = client.get("/api/currentUser")

    assert response.status_code == 401
    assert response.json()["data"]["isLogin"] is False


@pytest.mark.django_db
def test_account_login_creates_session_and_returns_current_user(client):
    User.objects.create_user(
        username="admin",
        email="admin@example.com",
        password="secret123",  # noqa: S106
        first_name="Ada",
        last_name="Lovelace",
        is_staff=True,
    )

    login_response = client.post(
        "/api/login/account",
        {"username": "admin", "password": "secret123", "type": "account"},
        content_type="application/json",
    )

    assert login_response.status_code == 200
    assert login_response.json() == {
        "status": "ok",
        "type": "account",
        "currentAuthority": "admin",
    }

    current_response = client.get("/api/currentUser")

    assert current_response.status_code == 200
    payload = current_response.json()
    assert payload["success"] is True
    assert payload["data"]["userid"] == "admin"
    assert payload["data"]["name"] == "Ada Lovelace"
    assert payload["data"]["email"] == "admin@example.com"
    assert payload["data"]["access"] == "admin"


@pytest.mark.django_db
def test_account_login_rejects_invalid_credentials(client):
    User.objects.create_user(
        username="member",
        email="member@example.com",
        password="secret123",  # noqa: S106
    )

    response = client.post(
        "/api/login/account",
        {"username": "member", "password": "wrong", "type": "account"},
        content_type="application/json",
    )

    assert response.status_code == 200
    assert response.json() == {
        "status": "error",
        "type": "account",
        "currentAuthority": "guest",
    }
    assert client.get("/api/currentUser").status_code == 401


@pytest.mark.django_db
def test_out_login_clears_session(client):
    user = User.objects.create_user(username="member", password="secret123")  # noqa: S106
    client.force_login(user)

    response = client.post("/api/login/outLogin")

    assert response.status_code == 200
    assert response.json() == {"success": True, "data": {}}
    assert client.get("/api/currentUser").status_code == 401
