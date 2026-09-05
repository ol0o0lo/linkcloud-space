from django.test import TestCase


class TestCsrfApi(TestCase):
    def test_allauth_config_sets_csrf_cookie(self):
        response = self.client.get("/api/allauth/browser/v1/config")

        self.assertEqual(response.status_code, 200)
        self.assertIn("csrftoken", response.cookies)
