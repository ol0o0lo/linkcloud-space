import pytest
from allauth.account.models import EmailAddress
from allauth.mfa.models import Authenticator
from allauth.mfa.totp.internal.auth import TOTP, generate_totp_secret

from apps.accounts.models import User
from tests.api_helpers import api_data


@pytest.mark.django_db
def test_delete_current_user_totp_authenticator(client):
    user = User.objects.create(email="totp@example.com", username="totp@example.com")
    user.set_password("testpw123!")
    user.save()
    EmailAddress.objects.create(user=user, email=user.email, verified=True, primary=True)
    TOTP.activate(user, generate_totp_secret())
    client.force_login(user)

    response = client.delete("/api/users/me/mfa/authenticators/totp/")

    assert response.status_code == 200, response.content
    assert api_data(response) == {}
    assert Authenticator.objects.filter(user=user, type=Authenticator.Type.TOTP).exists() is False


@pytest.mark.django_db
def test_delete_missing_authenticator_returns_404(client):
    user = User.objects.create(email="plain@example.com", username="plain@example.com")
    user.set_password("testpw123!")
    user.save()
    EmailAddress.objects.create(user=user, email=user.email, verified=True, primary=True)
    client.force_login(user)

    response = client.delete("/api/users/me/mfa/authenticators/totp/")

    assert response.status_code == 404
    assert b"Authenticator not found" in response.content
