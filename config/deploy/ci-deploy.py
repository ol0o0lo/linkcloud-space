#!/usr/bin/env python3
"""Validate a staged CI release before changing a server deployment."""

import json
import os
from pathlib import Path
import shutil
import socket
import subprocess
import sys


def command(*args, env=None):
    return subprocess.check_output(args, env=env, text=True)


def fail(message):
    raise SystemExit(message)


def compose_config(directory):
    env = {"PATH": os.environ["PATH"], "HOME": os.environ["HOME"], "DEPLOY_ENV_FILE": str(directory / ".env")}
    output = command("docker", "compose", "--env-file", str(directory / ".env"), "-f", str(directory / "compose.yml"), "config", "--format", "json", env=env)
    return json.loads(output)


def state(config):
    services = config["services"]
    mounts = {}
    for service in ("db", "redis", "web", "worker", "beat"):
        mounts[service] = []
        for volume in services[service].get("volumes", []):
            source = volume["source"]
            if volume["type"] == "volume":
                source = config["volumes"][source]["name"]
            mounts[service].append((volume["type"], source, volume["target"]))
        mounts[service].sort()
    db = services["db"]["environment"]
    web = services["web"]["environment"]
    return {
        "project": config["name"],
        "mounts": mounts,
        "db": {key: db.get(key) for key in ("POSTGRES_USER", "POSTGRES_DB", "POSTGRES_PASSWORD")},
        "redis": services["redis"].get("command"),
        "secret_key": web.get("SECRET_KEY"),
        "ports": services["proxy"].get("ports", []),
    }


def main(stage, target):
    stage, target = Path(stage).absolute(), Path(target).absolute()
    if target.is_symlink() or (target.exists() and not target.is_dir()):
        fail("部署目录不是普通目录，请人工检查。")
    names = (".env", "compose.yml", "deploy.sh", "nginx.conf.template")
    if any(not (stage / name).is_file() or (stage / name).is_symlink() for name in names):
        fail("暂存目录缺少部署文件。")
    new_config = compose_config(stage)
    new = state(new_config)
    if len(new["ports"]) != 1 or new["ports"][0].get("protocol", "tcp") != "tcp":
        fail("无法识别入口端口，请人工检查。")

    ids = command("docker", "ps", "-aq").split()
    containers = json.loads(command("docker", "inspect", *ids)) if ids else []
    project_containers = []
    for container in containers:
        labels = container.get("Config", {}).get("Labels") or {}
        project = labels.get("com.docker.compose.project")
        image = container.get("Config", {}).get("Image", "").lower()
        name = container.get("Name", "").lower()
        if project == new["project"]:
            project_containers.append(container)
            if os.path.realpath(labels.get("com.docker.compose.project.working_dir", "")) != os.path.realpath(target):
                fail("同名 Compose 项目位于其他目录，请人工检查。")
        elif "linkcloud-space" in image or "linkcloud-space" in name:
            fail("检测到其他链云空间容器，请人工检查已有部署。")

    existing = target.exists() and any(target.iterdir())
    if existing:
        if any(not (target / name).is_file() or (target / name).is_symlink() for name in names):
            fail("部署目录已有文件但不是完整的已知部署，请人工检查。")
        old_config = compose_config(target)
        if state(old_config) != new:
            fail("现有部署的项目名、数据位置、关键凭据或端口与 CI 配置不一致，请人工检查。")
        allowed = set(new_config["services"])
        for container in project_containers:
            labels = container["Config"].get("Labels") or {}
            service = labels.get("com.docker.compose.service")
            if service not in allowed:
                fail("同名项目包含未知服务，请人工检查。")
            if service == "db":
                actual = dict(item.split("=", 1) for item in container["Config"].get("Env", []) if "=" in item)
                if any(actual.get(key) != value for key, value in new["db"].items()):
                    fail("数据库容器凭据与 CI 配置不一致，请人工检查。")
            if service == "redis" and container["Config"].get("Cmd") != new["redis"]:
                fail("Redis 容器配置与 CI 配置不一致，请人工检查。")
            if service in ("web", "worker", "beat"):
                actual = dict(item.split("=", 1) for item in container["Config"].get("Env", []) if "=" in item)
                if actual.get("SECRET_KEY") != new["secret_key"]:
                    fail("应用容器密钥与 CI 配置不一致，请人工检查。")
            if service == "proxy":
                port = new["ports"][0]
                expected_binding = [{"HostIp": port.get("host_ip") or "", "HostPort": str(port["published"])}]
                actual_binding = (container.get("HostConfig", {}).get("PortBindings") or {}).get(str(port["target"]) + "/tcp")
                if actual_binding != expected_binding:
                    fail("入口容器端口与 CI 配置不一致，请人工检查。")
            expected_mounts = {v[2]: (v[0], v[1]) for v in new["mounts"].get(service, [])}
            actual_mounts = {v["Destination"]: (v["Type"], v.get("Name") if v["Type"] == "volume" else v.get("Source")) for v in container.get("Mounts", [])}
            if any(actual_mounts.get(dest) != expected for dest, expected in expected_mounts.items()):
                fail("现有容器的数据挂载与 CI 配置不一致，请人工检查。")
        print("识别到兼容的已有部署，将保留持久数据并更新。", flush=True)
    else:
        if project_containers:
            fail("检测到同名 Compose 项目，但目标目录没有完整配置，请人工检查。")
        volume_names = set(command("docker", "volume", "ls", "-q").splitlines())
        if volume_names.intersection(volume["name"] for volume in new_config["volumes"].values()):
            fail("检测到同名持久卷，无法确认是否为首次部署。")
        for kind, source, _ in new["mounts"]["db"]:
            path = Path(source)
            if kind == "bind" and path.exists() and (not path.is_dir() or any(path.iterdir())):
                fail("数据库目录已有数据，无法确认是否为首次部署。")
        print("未发现已有部署，准备首次部署。", flush=True)

    proxy_running = any((c.get("State") or {}).get("Running") and (c["Config"].get("Labels") or {}).get("com.docker.compose.service") == "proxy" for c in project_containers)
    if not proxy_running:
        port = new["ports"][0]
        with socket.socket() as sock:
            try:
                sock.bind((port.get("host_ip") or "0.0.0.0", int(port["published"])))
            except OSError:
                fail("入口端口已被占用，请人工检查。")

    clean_env = {"PATH": os.environ["PATH"], "HOME": os.environ["HOME"], "DEPLOY_ENV_FILE": str(stage / ".env")}
    subprocess.run(["docker", "compose", "--env-file", str(stage / ".env"), "-f", str(stage / "compose.yml"), "pull"], env=clean_env, check=True)
    target.mkdir(parents=True, exist_ok=True)
    for name in names:
        shutil.copyfile(stage / name, target / name)
    os.chmod(target / ".env", 0o600)
    clean_env["DEPLOY_ENV_FILE"] = str(target / ".env")
    subprocess.run(["bash", str(target / "deploy.sh")], env=clean_env, check=True)


if __name__ == "__main__":
    if len(sys.argv) != 3:
        fail("用法：ci-deploy.py 暂存目录 部署目录")
    main(*sys.argv[1:])
