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

脚本拉取应用和 PostGIS 镜像，启动数据库与 Redis，再启动 Web。Web 容器会先执行数据库迁移与存储初始化，成功后以 `exec` 启动 Gunicorn；Worker、Beat 和 Nginx 都等待 Web 健康后启动。整套部署只有这 6 个服务，迁移直接在 Web 容器内完成。

首次部署和后续更新使用同一条命令；更新会短暂停止应用服务，数据库和文件保存在持久卷中。同一版本重新启动 Web 时也会检查迁移，没有待执行的迁移时会快速通过。该启动流程用于当前单个 Web 容器的部署方式。

默认上传文件保存在媒体卷，由 Nginx 提供访问；迁移工作目录在 Web 与 Worker 间共享，Beat 调度状态也会保留。数据库和 Redis 不向服务器外部映射端口。

完成后访问 `http://服务器IP:8080/dashboard/` 或 `/h5/`。首次创建管理员：

```bash
docker compose --env-file .env -f compose.yml exec web python manage.py createsuperuser
```

## 2 核 4GB 的轻量默认配置

- Web：1 个 Gunicorn worker、8 个线程，保留流式请求的并发处理能力。
- Celery：1 个 prefork 子进程，任务串行执行，每次预取 1 个任务；保留进程隔离和任务时间限制。
- Beat：独立运行一个实例，保留定时任务和调度状态。
- Nginx：1 个 worker；PostGIS：最多 32 个数据库连接、128MB 共享缓冲区。
- 健康检查每 30 秒执行一次；每个容器日志最多保留 3 个 10MB 文件。

并发和数据库参数可在 `.env` 中调整。Redis 继续启用 AOF；会话、缓存和任务队列共用 Redis，因此不设置会主动淘汰任务或会话的缓存策略。

## 同步发布到阿里云 ACR

CI 构建一次，同时将待验证的 `sha-完整提交SHA` 镜像推送到 GHCR 和 ACR。AMD64、ARM64 部署验证都通过后，才更新应用的 `latest` 标签和 PostGIS 的 `17` 标签。

启用 ACR 同步时，构建证明采用传统清单格式，兼容当前 ACR 仓库；双架构镜像和构建证明仍保留。

ACR 目标仓库：

- `registry.cn-hangzhou.aliyuncs.com/link2cloud/linkcloud-space`
- `registry.cn-hangzhou.aliyuncs.com/link2cloud/linkcloud-space-postgis`

先在 ACR 创建这两个仓库，并让 CI 使用的账号拥有推送权限。在 GitHub 仓库 **Settings → Secrets and variables → Actions → Secrets** 中配置：

| Secret | 内容 |
| --- | --- |
| `ACR_USERNAME` | ACR 访问凭证中的登录用户名 |
| `ACR_PASSWORD` | ACR 访问凭证中的固定密码 |

未完整配置这两个 Secret 时，CI 会发出提示并仅发布到 GHCR。

服务器要从 ACR 拉取镜像时，先执行 `docker login registry.cn-hangzhou.aliyuncs.com`，再将部署 `.env` 的镜像地址改为：

```dotenv
APP_IMAGE=registry.cn-hangzhou.aliyuncs.com/link2cloud/linkcloud-space:latest
POSTGIS_IMAGE=registry.cn-hangzhou.aliyuncs.com/link2cloud/linkcloud-space-postgis:17
```

## 更新与排查

部署配置更新时，整体同步本目录并保留服务器已有的 `.env`，再执行部署脚本。

默认应用镜像使用 `latest`。需要固定版本时，将 `APP_IMAGE` 改为 CI 生成的 `ghcr.io/ol0o0lo/linkcloud-space:sha-完整提交SHA`，再运行 `bash deploy.sh`。

```bash
docker compose --env-file .env -f compose.yml ps
docker compose --env-file .env -f compose.yml logs --tail 100 web worker beat proxy
```

脚本不会清理持久卷。数据库迁移失败时，Web 不会进入 Gunicorn 启动阶段，后台服务和入口服务也不会启动；查看 Web 日志修复错误后重新执行脚本。修改镜像版本不会自动撤销已执行的数据库迁移。
