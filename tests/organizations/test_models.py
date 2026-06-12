from django.test import SimpleTestCase, override_settings

from apps.organizations.models import OrganizationInvite

urlpatterns = []


class TestOrganizationInvite(SimpleTestCase):
    @override_settings(ROOT_URLCONF="tests.organizations.test_models")
    def test_accept_invite_url_does_not_depend_on_django_route(self):
        invite = OrganizationInvite(key="abc123")

        self.assertEqual(invite.accept_invite_url, "/organizations/invite/abc123/accept/")
