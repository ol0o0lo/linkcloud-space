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

printf '\n启动 Web，自动迁移数据库并等待就绪……\n'
"${compose[@]}" up -d --wait --wait-timeout 600 web

printf '\n启动后台任务和访问入口……\n'
"${compose[@]}" up -d --wait --wait-timeout 180 worker beat proxy
"${compose[@]}" ps
printf '\n部署完成。\n'
