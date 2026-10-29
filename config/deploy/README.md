# 服务端镜像部署

服务器安装 Docker Engine 和支持 `--wait` 的 Docker Compose v2。复制本目录到服务器即可部署，无需安装 Python、Node 或在服务器构建镜像。

## 首次部署

在本目录执行：

```bash
cp .env.example .env
```

编辑 `.env`：

- 分别用 `openssl rand -hex 32` 生成 `SECRET_KEY`、`POSTGRES_PASSWORD`、`REDIS_PASSWORD`，填入对应位置。
- 将 `ALLOWED_HOSTS` 改为访问域名或服务器 IP，不带协议和端口。
- 将 `SITE_DOMAIN` 改为访问域名或 `服务器IP:8080`，并对应修改 `CSRF_TRUSTED_ORIGINS`。
- 默认对外提供 HTTP 8080 端口。使用已有 HTTPS 反向代理时，将 `HTTP_BIND` 设为 `127.0.0.1`，将 `SITE_SCHEME` 设为 `https`，并将域名转发到本机 `HTTP_PORT`。

镜像为私有包时，先执行 `docker login ghcr.io -u 你的GitHub用户名`，密码使用具有 `read:packages` 权限的 GitHub Token。

```bash
bash deploy.sh
```

脚本拉取应用和 PostGIS 镜像，启动数据库与 Redis，执行迁移和存储初始化，然后启动 Web、Celery Worker、单独的 Beat 和 Nginx。首次部署和后续更新使用同一条命令；更新会短暂停止应用服务，数据库和文件保存在持久卷中。

默认上传文件保存在媒体卷，由 Nginx 提供访问；迁移工作目录在 Web 与 Worker 间共享，Beat 调度状态也会保留。数据库和 Redis 不向服务器外部映射端口。

完成后访问 `http://服务器IP:8080/dashboard/` 或 `/h5/`。首次创建管理员：

```bash
docker compose --env-file .env -f compose.yml exec web python manage.py createsuperuser
```

## 更新与排查

默认应用镜像使用 `latest`。需要固定版本时，将 `APP_IMAGE` 改为 CI 生成的 `ghcr.io/ol0o0lo/linkcloud-space:sha-完整提交SHA`，再运行 `bash deploy.sh`。

```bash
docker compose --env-file .env -f compose.yml ps
docker compose --env-file .env -f compose.yml logs --tail 100 web worker beat proxy
```

脚本不会清理持久卷。数据库迁移失败时会停止后续启动，修复错误后重新执行脚本；修改镜像版本不会自动撤销已执行的数据库迁移。
