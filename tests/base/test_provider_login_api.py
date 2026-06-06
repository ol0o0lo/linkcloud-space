from django.http import HttpResponseRedirect

import pytest


@pytest.mark.django_db
def test_provider_login_redirect_returns_redirect_response(client, monkeypatch):
    class DummyProvider:
        def redirect(self, request, process, next_url, headless):
            assert process == "login"
            assert next_url == "http://localhost:5999/dashboard/overview"
            assert headless is True
            return HttpResponseRedirect("https://example.com/oauth/start")

    class DummyForm:
        def __init__(self, data):
            self.data = data
            self.cleaned_data = {
                "provider": DummyProvider(),
                "callback_url": data["callback_url"],
                "process": data["process"],
            }

        def is_valid(self):
            return True

    monkeypatch.setattr("apps.base.api.RedirectToProviderForm", DummyForm)

    response = client.get(
        "/api/auth/provider-login/",
        {
            "provider": "github",
            "callback_url": "http://localhost:5999/dashboard/overview",
            "process": "login",
        },
    )

    assert response.status_code == 302
    assert response["Location"] == "https://example.com/oauth/start"
