#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
env_file="${DEPLOY_ENV_FILE:-$script_dir/.env}"

if [[ ! -f "$env_file" ]]; then
  printf '请先复制 %s/.env.example 为 .env，并填写部署配置。\n' "$script_dir" >&2
  exit 1
fi

export DEPLOY_ENV_FILE="$(cd -- "$(dirname -- "$env_file")" && pwd)/$(basename -- "$env_file")"
compose=(docker compose --env-file "$DEPLOY_ENV_FILE" --file "$script_dir/compose.yml")

docker compose version
"${compose[@]}" config --quiet

printf '\n拉取部署镜像……\n'
"${compose[@]}" pull

printf '\n停止应用服务，准备数据库迁移……\n'
"${compose[@]}" stop proxy web worker beat

printf '\n启动数据库和 Redis……\n'
"${compose[@]}" up -d --wait --wait-timeout 180 db redis

printf '\n执行数据库迁移与存储初始化……\n'
"${compose[@]}" up --no-deps --abort-on-container-exit --exit-code-from migrate migrate

printf '\n启动应用并等待健康检查……\n'
"${compose[@]}" up -d --wait --wait-timeout 180 web worker beat proxy
"${compose[@]}" ps
printf '\n部署完成。\n'
