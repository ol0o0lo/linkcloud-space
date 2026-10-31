#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
operation="${1:?请指定 build、start 或 deploy}"
env_file="${2:-$script_dir/.env}"

case "$operation" in
  build|start|deploy) ;;
  *)
    printf '用法：bash production.sh build|start|deploy [生产配置文件]\n' >&2
    exit 1
    ;;
esac

# Just exports the development .env. Remove its keys so Compose can load
# production values and defaults without inheriting development settings.
dev_env_file="$script_dir/../../.env"
if [[ -f "$dev_env_file" ]]; then
  while IFS= read -r line || [[ -n "$line" ]]; do
    if [[ "$line" =~ ^[[:space:]]*(export[[:space:]]+)?([a-zA-Z_][a-zA-Z0-9_]*)[[:space:]]*= ]]; then
      unset "${BASH_REMATCH[2]}"
    fi
  done < "$dev_env_file"
fi

if [[ ! -f "$env_file" ]]; then
  printf '找不到生产配置 %s，请先复制 %s/.env.example 为 .env 并填写配置。\n' "$env_file" "$script_dir" >&2
  exit 1
fi

export DEPLOY_ENV_FILE="$(cd -- "$(dirname -- "$env_file")" && pwd)/$(basename -- "$env_file")"

if [[ "$operation" == "deploy" ]]; then
  exec bash "$script_dir/deploy.sh"
fi

compose=(docker compose --env-file "$DEPLOY_ENV_FILE" --file "$script_dir/compose.yml")
docker compose version
"${compose[@]}" config --quiet

if [[ "$operation" == "build" ]]; then
  printf '\n构建生产应用和 PostGIS 镜像……\n'
  "${compose[@]}" --file "$script_dir/compose.build.yml" build db web
  printf '\n准备 Redis 和 Nginx 镜像……\n'
  "${compose[@]}" pull --policy missing redis proxy
else
  printf '\n使用已有镜像启动生产服务……\n'
  "${compose[@]}" up -d --wait --wait-timeout 600 --no-build --pull never
  "${compose[@]}" ps
fi
