from unittest.mock import patch

import pytest
from allauth.account.models import EmailAddress

from apps.accounts.models import User


@pytest.fixture(autouse=True)
def _settings(settings):
    settings.AUTHENTICATION_BACKENDS = ["allauth.account.auth_backends.AuthenticationBackend"]
    settings.ACCOUNT_PHONE_VERIFICATION_ENABLED = True
    settings.ACCOUNT_PHONE_VERIFICATION_SUPPORTS_RESEND = True


@pytest.fixture()
def signed_in_client(client):
    user = User.objects.create(email="member@example.com", username="member@example.com")
    user.set_password("testpw123!")
    user.save()
    EmailAddress.objects.create(user=user, email=user.email, verified=True, primary=True)
    client.force_login(user)
    return client, user


@pytest.mark.django_db
def test_manage_phone_starts_verification_stage(signed_in_client):
    client, _user = signed_in_client

    with patch("apps.accounts.auth_adapter.AccountAdapter.send_verification_code_sms") as mock_send:
        response = client.post(
            "/api/allauth/browser/v1/account/phone",
            data={"phone": "+8613800138001"},
            content_type="application/json",
        )

    assert response.status_code == 202, response.content
    body = response.json()
    assert body["data"] == [{"phone": "+8613800138001", "verified": False}]
    mock_send.assert_called_once()
    assert mock_send.call_args.kwargs["phone"] == "+8613800138001"


@pytest.mark.django_db
def test_verify_phone_change_rejects_wrong_code(signed_in_client):
    client, _user = signed_in_client

    with patch("apps.accounts.auth_adapter.AccountAdapter.send_verification_code_sms"):
        client.post(
            "/api/allauth/browser/v1/account/phone",
            data={"phone": "+8613800138001"},
            content_type="application/json",
        )

    response = client.post(
        "/api/allauth/browser/v1/auth/phone/verify",
        data={"code": "000000"},
        content_type="application/json",
    )

    assert response.status_code == 400, response.content


@pytest.mark.django_db
def test_manage_phone_verify_updates_current_user(signed_in_client):
    client, user = signed_in_client
    captured = {}

    def capture_sms(*_args, **kwargs):
        captured["code"] = kwargs["code"]

    with patch("apps.accounts.auth_adapter.AccountAdapter.send_verification_code_sms", side_effect=capture_sms):
        start = client.post(
            "/api/allauth/browser/v1/account/phone",
            data={"phone": "+8613800138001"},
            content_type="application/json",
        )

    assert start.status_code == 202, start.content

    response = client.post(
        "/api/allauth/browser/v1/auth/phone/verify",
        data={"code": captured["code"]},
        content_type="application/json",
    )

    assert response.status_code == 200, response.content
    user.refresh_from_db()
    assert user.phone_country_code == "+86"
    assert user.phone_national_number == "13800138001"
    assert user.phone_verified is True
