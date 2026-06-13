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
        phone="+8617688363534",
        phone_verified=True,
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
    assert payload["phone"] == "+8617688363534"
    assert payload["phone_country_code"] == "+86"
    assert payload["phone_national_number"] == "17688363534"
    assert payload["phone_verified"] is True
    assert payload["signature"] == "资料待补充"
    assert payload["country"] == "China"
    assert "province_name" not in payload
    assert "province_code" not in payload
    assert "city_name" not in payload
    assert "city_code" not in payload
    assert "address" not in payload
    assert payload["notify_count"] == 2
    assert payload["unread_count"] == 1
    assert payload["tags"] == [
        {"key": "verified-email", "label": "已验证邮箱"},
        {"key": "verified-phone", "label": "已绑定手机"},
    ]
    assert payload["notice"][0]["title"] == "资料完善"


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
