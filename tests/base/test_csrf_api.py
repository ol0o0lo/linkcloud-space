from django.test import TestCase


class TestCsrfApi(TestCase):
    def test_get_csrf_sets_cookie_and_returns_token(self):
        response = self.client.get("/api/csrf/")

        self.assertEqual(response.status_code, 200)
        self.assertIn("csrfToken", response.json())
        self.assertIn("csrftoken", response.cookies)
