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

## 在项目中使用 Just

保留完整源码时，可在项目根目录使用以下命令，开发环境仍使用原来的 `just start`：

```bash
just build_prod   # 从源码构建应用、PostGIS 镜像，并补拉缺失的 Redis、Nginx 镜像
just start_prod   # 使用已有镜像启动或恢复生产服务，不拉取镜像、不执行构建
just deploy       # 拉取发布镜像，执行现有部署更新流程
```

首次使用前，同样需要将本目录的 `.env.example` 复制为 `.env` 并填写配置。`build_prod` 复用现有 Dockerfile 的 `prod` 阶段，包含管理端、H5 构建和静态文件收集；构建过程不会启动服务。构建后的应用镜像和数据库镜像分别使用 `.env` 中的 `APP_IMAGE`、`POSTGIS_IMAGE` 标签，随后执行 `just start_prod` 即可启动。需要使用本地标签时，可将它们分别设为 `linkcloud-space:prod`、`linkcloud-space-postgis:17`。

三个命令默认使用 `config/deploy/.env`，会清除 Just 从开发 `.env` 继承的同名变量，再由 Compose 加载生产配置。也可在命令后传入其他配置文件路径，路径相对于项目根目录：

```bash
just start_prod /path/to/production.env
```

仅复制部署目录的方式继续可用，`bash deploy.sh` 仍为拉取镜像并部署，直接运行原脚本时仍可通过 `DEPLOY_ENV_FILE` 指定配置文件。

## 创建管理员

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

## 通过 GitHub Actions 部署到宝塔

宝塔站点负责 HTTPS 和反向代理，将域名转发到服务器的 `127.0.0.1:8080`。服务器需安装 Python 3、Docker Engine、支持 `--wait` 和 `config --format json` 的 Docker Compose v2，并以部署用户登录 ACR（使用有拉取权限的凭据）。部署用户必须能创建部署目录及其相邻暂存目录并操作 Docker；Docker 权限相当于服务器的高权限访问。

在 GitHub 仓库创建 `production` Environment，配置以下 Secrets：

| Secret | 内容 |
| --- | --- |
| `SSH_HOST` | 服务器 IP 或域名 |
| `SSH_USER` | 可选，SSH 部署用户，默认 `root` |
| `SSH_PORT` | 可选，SSH 端口，默认 `22` |
| `SSH_PASSWORD` | SSH 部署用户的登录密码 |
| `PRODUCTION_ENV` | 完整生产 `.env` 内容，以本目录 `.env.example` 为模板填写 |

服务器 SSH 必须允许该用户使用密码登录；使用默认 `root` 用户时，还需允许 root 密码登录。CI 使用 `sshpass` 和 `SSH_PASSWORD` 认证，并在每次运行时自动获取 SSH 主机公钥。该公钥未经独立核验，无法防止首次获取时的中间人攻击。

在同一 Environment 的 Variables 中配置 `DEPLOY_DIR`（例如 `/srv/linkcloud-space/deploy`）。目录必须是绝对路径，只能包含字母、数字、下划线、点、斜杠和连字符。确保生产配置中的 `COMPOSE_PROJECT_NAME`、数据库数据目录和密码保持稳定；宝塔代理到本机 8080 时配置 `HTTP_BIND=127.0.0.1`、`HTTP_PORT=8080`、`SITE_SCHEME=https`，并填写真实域名及 `CSRF_TRUSTED_ORIGINS`。

`main` 的“构建、验证并发布容器镜像”成功后自动触发部署。该构建必须配置 ACR 推送凭据，否则服务器拉不到 ACR 镜像。部署使用同一提交的部署文件和两个 SHA 镜像；如果检查时 `main` 已有更新提交，自动部署会跳过旧版本。也可在 Actions 手动运行“部署到宝塔服务器”，选择 `main` 并填写成功的镜像流水线运行 ID，以部署指定版本。

CI 先上传到目标目录旁的受限暂存目录，检查 Compose 项目、数据挂载、数据库凭据和入口端口。未发现目标部署、冲突项目、持久卷或已有数据库数据时按首次部署处理；已有完整的本项目部署且关键配置一致时按更新处理。发现其他链云空间容器、不完整目录、冲突数据或配置不一致时停止，由人工核对；检测不能发现服务器上所有其他部署方式。检查通过并预拉取镜像后才覆盖目标目录文件，再执行部署脚本。公网健康检查暂时模拟通过，无法验证 HTTPS 入口；容器健康检查仍会执行。暂存目录权限仅限部署用户，成功或失败后都保留，请按服务器的安全维护流程处理。

部署目录及配置文件由 CI 管理，每次部署都会覆盖其中的 `.env`、`compose.yml`、`deploy.sh` 和 `nginx.conf.template`；不要在服务器上手动修改这些文件。配置调整应更新 GitHub Environment Secret。应用镜像包含管理端和 H5，不包含微信小程序发布。流水线不会删除持久数据，但现有脚本会短暂停止应用，并在 Web 启动时执行数据库迁移。回滚可选择先前成功的镜像流水线运行 ID；镜像回退不会撤销数据库迁移。部署失败时检查 Actions 输出和服务器日志，确认服务器上实际运行的版本后再操作。

## 更新与排查

部署配置更新时，整体同步本目录并保留服务器已有的 `.env`，再执行部署脚本。

默认应用镜像使用 `latest`。需要固定版本时，将 `APP_IMAGE` 改为 CI 生成的 `ghcr.io/ol0o0lo/linkcloud-space:sha-完整提交SHA`，再运行 `bash deploy.sh`。

```bash
docker compose --env-file .env -f compose.yml ps
docker compose --env-file .env -f compose.yml logs --tail 100 web worker beat proxy
```

脚本不会清理持久卷。数据库迁移失败时，Web 不会进入 Gunicorn 启动阶段，后台服务和入口服务也不会启动；查看 Web 日志修复错误后重新执行脚本。修改镜像版本不会自动撤销已执行的数据库迁移。
