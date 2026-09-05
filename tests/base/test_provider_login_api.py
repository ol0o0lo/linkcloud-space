import pytest


@pytest.mark.django_db
def test_legacy_provider_login_endpoint_is_not_exposed(client):
    assert client.get("/api/auth/provider-login/").status_code == 404
