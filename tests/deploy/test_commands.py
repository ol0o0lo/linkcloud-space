"""Run with `python3 -m unittest tests.deploy.test_commands`; no Docker daemon needed."""

import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


@unittest.skipUnless(shutil.which("just"), "requires the Just CLI")
class ProductionCommandsTests(unittest.TestCase):
    def setUp(self):
        self.root = Path(tempfile.mkdtemp(prefix="linkcloud-production-commands-")).resolve()
        project = Path(__file__).resolve().parents[2]
        for name in ("justfile", "config/base.just", "config/deploy/deploy.sh", "config/deploy/production.sh"):
            target = self.root / name
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(project / name, target)
        (self.root / ".env").write_text("APP_IMAGE=development-only\nexport WEB_CONCURRENCY=99\nDEV_ONLY=development-only\n")
        self.production_env = self.root / "config/deploy/.env"
        self.production_env.write_text("APP_IMAGE=production-only\n")
        self.log = self.root / "commands.jsonl"
        mock_bin = self.root / "bin"
        mock_bin.mkdir()
        docker = mock_bin / "docker"
        docker.write_text(
            f"#!{sys.executable}\n"
            "import json, os, sys\n"
            "record = {'args': sys.argv[1:], 'env': {key: os.environ.get(key) for key in "
            "('APP_IMAGE', 'WEB_CONCURRENCY', 'DEV_ONLY', 'DEPLOY_ENV_FILE')}}\n"
            "with open(os.environ['COMMAND_LOG'], 'a') as stream:\n"
            "    stream.write(json.dumps(record) + '\\n')\n"
            "if os.environ.get('FAIL_WEB') and 'up' in sys.argv and sys.argv[-1] == 'web':\n"
            "    sys.exit(42)\n"
        )
        docker.chmod(0o755)
        self.env = {**os.environ, "PATH": str(mock_bin) + os.pathsep + os.environ["PATH"], "COMMAND_LOG": str(self.log)}

    def invoke(self, *args, extra_env=None):
        result = subprocess.run(  # noqa: S603 - commands and paths are controlled test fixtures
            args, cwd=self.root, env={**self.env, **(extra_env or {})}, capture_output=True, text=True, check=False
        )
        return result

    def records(self):
        return [json.loads(line) for line in self.log.read_text().splitlines()] if self.log.exists() else []

    def test_production_isolation_preserves_development_commands(self):
        custom_env = self.root / "production config $literal.env"
        custom_env.write_text(self.production_env.read_text())
        result = self.invoke("just", "start_prod", str(custom_env))
        self.assertEqual(result.returncode, 0, result.stderr)
        for record in self.records():
            self.assertIsNone(record["env"]["APP_IMAGE"])
            self.assertIsNone(record["env"]["WEB_CONCURRENCY"])
            self.assertIsNone(record["env"]["DEV_ONLY"])
            self.assertEqual(record["env"]["DEPLOY_ENV_FILE"], str(custom_env))
            self.assertFalse({"pull", "build", "stop"}.intersection(record["args"]))
        self.assertTrue(any("--no-build" in record["args"] and "never" in record["args"] for record in self.records()))

        result = self.invoke("just", "start")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self.records()[-1]["args"], ["compose", "up"])
        self.assertEqual(self.records()[-1]["env"]["APP_IMAGE"], "development-only")

    def test_build_does_not_start_services(self):
        result = self.invoke("just", "build_prod")
        self.assertEqual(result.returncode, 0, result.stderr)
        commands = [record["args"] for record in self.records()]
        self.assertTrue(any("build" in args and args[-2:] == ["db", "web"] for args in commands))
        self.assertTrue(any("pull" in args and args[-2:] == ["redis", "proxy"] for args in commands))
        self.assertFalse(any({"up", "stop"}.intersection(args) for args in commands))

    def test_failed_web_deployment_does_not_start_workers(self):
        result = self.invoke("just", "deploy", extra_env={"FAIL_WEB": "1"})
        self.assertNotEqual(result.returncode, 0)
        commands = [record["args"] for record in self.records()]
        self.assertTrue(any("pull" in args for args in commands))
        self.assertFalse(any("up" in args and "worker" in args for args in commands))
        self.assertFalse(any("ps" in args for args in commands))

    def test_original_script_keeps_default_deployment_and_env_overrides(self):
        result = self.invoke("bash", "config/deploy/deploy.sh", extra_env={"APP_IMAGE": "explicit-override", "DEPLOY_ENV_FILE": str(self.production_env)})
        self.assertEqual(result.returncode, 0, result.stderr)
        records = self.records()
        self.assertTrue(any("pull" in record["args"] for record in records))
        self.assertTrue(any("up" in record["args"] and "worker" in record["args"] for record in records))
        self.assertTrue(all(record["env"]["APP_IMAGE"] == "explicit-override" for record in records))

    def test_missing_production_config_stops_before_docker(self):
        result = self.invoke("just", "start_prod", "missing.env")
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(self.records(), [])


if __name__ == "__main__":
    unittest.main()
