from pathlib import Path
from tempfile import TemporaryDirectory

from django.test import SimpleTestCase, override_settings


class TestSPAShell(SimpleTestCase):
    def test_root_returns_spa_shell(self):
        resp = self.client.get("/")
        self.assertEqual(resp.status_code, 200)
        self.assertTemplateUsed(resp, "layouts/spa_shell.html")

    def test_unknown_path_returns_spa_shell(self):
        resp = self.client.get("/some/random/path/")
        self.assertEqual(resp.status_code, 200)
        self.assertTemplateUsed(resp, "layouts/spa_shell.html")

    def test_public_static_404_does_not_return_spa_shell(self):
        resp = self.client.get("/public/static/dist/js/missing-chunk.js")
        self.assertEqual(resp.status_code, 404)


class TestDashboardAndH5Entrypoints(SimpleTestCase):
    def _assert_static_index_route(self, url: str, relative_index_path: str, expected_body: str) -> None:
        with TemporaryDirectory() as tmp_dir:
            base_dir = Path(tmp_dir)
            index_path = base_dir / relative_index_path
            index_path.parent.mkdir(parents=True, exist_ok=True)
            index_path.write_text(expected_body, encoding="utf-8")

            with override_settings(BASE_DIR=base_dir):
                resp = self.client.get(url)

        self.assertEqual(resp.status_code, 200)
        self.assertContains(resp, expected_body, html=False)

    def test_dashboard_returns_admin_index(self):
        self._assert_static_index_route(
            "/dashboard/",
            "public/static/dist/admin/index.html",
            "<html>admin</html>",
        )

    def test_h5_returns_h5_index(self):
        self._assert_static_index_route(
            "/h5/",
            "public/static/dist/h5/index.html",
            "<html>h5</html>",
        )
