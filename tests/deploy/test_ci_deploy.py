"""Check CI deployment decisions without a Docker daemon."""

import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch


spec = importlib.util.spec_from_file_location("ci_deploy", Path(__file__).resolve().parents[2] / "config/deploy/ci-deploy.py")
ci_deploy = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ci_deploy)


class CiDeployTests(unittest.TestCase):
    def setUp(self):
        self.root = Path(tempfile.mkdtemp(prefix="ci-deploy-test-"))
        self.stage = self.root / "stage"
        self.target = self.root / "target"
        self.stage.mkdir()
        for name in (".env", "compose.yml", "deploy.sh", "nginx.conf.template"):
            (self.stage / name).write_text("test")
        self.config = {
            "name": "linkcloud-space-prod",
            "volumes": {"data": {"name": "linkcloud-space-prod_data"}},
            "services": {
                "db": {"environment": {"POSTGRES_USER": "user", "POSTGRES_DB": "db", "POSTGRES_PASSWORD": "password"}, "volumes": [{"type": "volume", "source": "data", "target": "/data"}]},
                "redis": {"command": ["redis-server", "secret"]},
                "web": {"environment": {"SECRET_KEY": "secret"}},
                "worker": {},
                "beat": {},
                "proxy": {"ports": [{"published": "0", "host_ip": "127.0.0.1", "protocol": "tcp"}]},
            },
        }

    def command(self, *args, **kwargs):
        if args == ("docker", "ps", "-aq") or args == ("docker", "volume", "ls", "-q"):
            return ""
        raise AssertionError(args)

    def run_deploy(self, config=None, command=None):
        with patch.object(ci_deploy, "compose_config", side_effect=config or (lambda _: self.config)), patch.object(ci_deploy, "command", side_effect=command or self.command), patch.object(ci_deploy.subprocess, "run") as run:
            ci_deploy.main(str(self.stage), str(self.target))
            return run.call_args_list

    def test_first_deploy_and_compatible_update(self):
        self.assertEqual(len(self.run_deploy()), 2)
        self.assertEqual((self.target / ".env").stat().st_mode & 0o777, 0o600)
        self.assertEqual(len(self.run_deploy()), 2)

    def test_existing_config_mismatch_stops_before_pull_or_overwrite(self):
        self.run_deploy()
        (self.target / ".env").write_text("original")
        old = json.loads(json.dumps(self.config))
        old["services"]["db"]["environment"]["POSTGRES_DB"] = "other"
        with patch.object(ci_deploy, "compose_config", side_effect=lambda path: old if path == self.target else self.config), patch.object(ci_deploy, "command", side_effect=self.command), patch.object(ci_deploy.subprocess, "run") as run:
            with self.assertRaises(SystemExit):
                ci_deploy.main(str(self.stage), str(self.target))
            run.assert_not_called()
        self.assertEqual((self.target / ".env").read_text(), "original")

    def test_existing_volume_blocks_first_deployment(self):
        def command(*args, **kwargs):
            return "linkcloud-space-prod_data\n" if args == ("docker", "volume", "ls", "-q") else self.command(*args, **kwargs)

        with self.assertRaises(SystemExit):
            self.run_deploy(command=command)
        self.assertFalse(self.target.exists())

    def test_existing_database_container_must_match_its_mount(self):
        self.run_deploy()
        container = {
            "Name": "/linkcloud-space-prod-db-1",
            "Config": {
                "Image": "linkcloud-space-postgis:17",
                "Labels": {"com.docker.compose.project": self.config["name"], "com.docker.compose.project.working_dir": str(self.target), "com.docker.compose.service": "db"},
                "Env": ["POSTGRES_USER=user", "POSTGRES_DB=db", "POSTGRES_PASSWORD=password"],
            },
            "Mounts": [{"Destination": "/data", "Type": "volume", "Name": "different_data"}],
            "State": {"Running": True},
        }

        def command(*args, **kwargs):
            if args == ("docker", "ps", "-aq"):
                return "container-id\n"
            if args == ("docker", "inspect", "container-id"):
                return json.dumps([container])
            return self.command(*args, **kwargs)

        with self.assertRaises(SystemExit):
            self.run_deploy(command=command)
        container["Mounts"][0]["Name"] = "linkcloud-space-prod_data"
        self.assertEqual(len(self.run_deploy(command=command)), 2)


if __name__ == "__main__":
    unittest.main()
