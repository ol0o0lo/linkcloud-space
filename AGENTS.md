# AGENTS.md

本文档是 Codex 在本仓库中工作的项目级说明。

## 必须遵守

- 永远用中文回答。
- git commit message 使用 `<type>: <中文动作对象>`，例如 `docs: 更新项目说明`。
- 尽量保证每次提交都是完整可用的。
- 修改代码前先理解现有结构，优先复用项目已有模式，避免无关重构。
- 子目录存在更近的 `AGENTS.md` 时，以更近的说明为准；`frontend_admin/AGENTS.md` 维护管理端补充规则。

## 禁止操作

1. **禁止物理删除：** 无论任何情况下，绝对禁止执行带删除、销毁性质的命令，包括但不限于 `rm`、`rm -rf`、`docker rm`、`docker rmi`、`drop database`。
2. **禁止危险覆盖：** 禁止使用 `>` 或强制覆盖命令清空核心配置文件或日志文件。
3. **需要清理或重置时：** 必须先停止并请求人工授权；或优先移动到本地 `~/.trash` / 备份目录，绝不直接销毁。
4. **Git 限制：** 禁止执行 `git push --force` 或任何破坏远程仓库历史的命令。

## 项目概览

链云空间基于 Django 5、django-ninja、django-allauth headless 模式构建，内置 MFA 与 WebAuthn passkeys。当前前端只有 `frontend_admin/` 管理端和 `frontend_miniprogram/` 小程序/H5 端，没有旧的 `frontend/` 主站目录。项目内置多租户基础能力（组织、团队、邀请）和通知系统（站内信、邮件、用户分类偏好、GenericForeignKey 目标清理、保留期清理）。后台任务使用 Celery + Redis，本地媒体存储可对接 MinIO / S3，生产环境使用 gunicorn。

## 目录与架构

- **应用目录**：业务应用位于 `apps/`。
- **`accounts/`**：自定义用户，包含 timezone、avatar 等字段。
- **`base/`**：通用工具、ninja 错误处理、存储后端、根页、dashboard/H5 静态 shell view、`qr_svg` view 等。
- **`media/`**：媒体文件记录、OSS/S3 上传辅助、孤儿文件清理。
- **`organizations/`**：`Organization`、`OrganizationMember`、`OrganizationInvite`，以及公开邀请 ninja API。
- **`teams/`**：Team 模型与 ninja API。
- **`access/`**：RBAC 权限目录、组织/团队角色、组织/团队绑定。
- **`notifications/`**：`Notification`、`NotificationPreference`、`/api/notifications/` ninja API、`notify()` 生产函数、celery beat 保留期清理、由 `settings.NOTIFICATIONS_TARGET_MODELS` 驱动的 GenericForeignKey `post_delete` 清理、由 `settings.NOTIFICATIONS_CATEGORIES` 声明的用户分类偏好。
- **`settings/`**：默认设置，以及用户/组织/团队覆盖 API。
- **设置文件**：`config/settings/_base.py` 是主配置，使用 epicenv 读取环境变量；`config/settings/__init__.py` 重新导出 `_base`；`config/settings/test_runner.py` 用于 pytest；`config/settings/e2e.py` 用于 Playwright，并使用预构建的前端资源。
- **API**：唯一的 `NinjaAPI` 实例在 `config/api.py`，挂载到 `/api/`。各应用的 `api.py` 提供 router，包括 `apps.base.api`、`apps.access.api`、`apps.accounts.api`、`apps.media.api`、`apps.organizations.api`、`apps.teams.api`、`apps.notifications.api`、`apps.settings.api`。API 认证支持 Django session、allauth JWT Bearer、`X-Session-Token`。
- **URL**：`config/urls.py` 中，根路径返回 `RootLandingView`，`/accounts/` 挂载 allauth 社交 provider 回调，`/api/allauth/` 挂载 allauth headless API，`/api/` 挂载 ninja API，`/admin/` 是 Django admin，`/hijack/` 挂载 django-hijack，`/dashboard/` 返回构建后的管理端 SPA，`/h5/` 返回构建后的 H5 应用。

## 前端约定

- **管理端**：React / Umi Max / Ant Design Pro 管理端位于 `frontend_admin/`，构建产物服务于 `/dashboard/`。源码主要位于 `frontend_admin/src/`。
- **小程序/H5 端**：uni-app / unibest 前端位于 `frontend_miniprogram/`，支持微信小程序与 H5。H5 构建产物服务于 `/h5/`。
- **静态资源收集**：`config/base.just` 会在 Django `collectstatic` 前将 `frontend_admin/dist` 复制到 `public/static/dist/admin`，将 `frontend_miniprogram/dist/build/h5` 复制到 `public/static/dist/h5`。
- **`frontend_admin` API 参考**：对接真实后端 API 时，使用本地 schema `http://localhost:18000/api/openapi.json` 和交互文档 `http://localhost:18000/api/docs`。
- **`frontend_admin` 包管理器**：管理端使用 npm 和 `package-lock.json`；不要改用 pnpm / yarn。
- **`frontend_admin` 服务分层**：自动生成的 API client 放在 `frontend_admin/src/services/openapi` 和 `frontend_admin/src/services/allauth`；手写适配器放在 `frontend_admin/src/services/manual`。重新生成时运行 `npm --prefix frontend_admin run openapi`，不要手改生成文件。
- **`frontend_admin` Ant Design**：项目级 `.codex/config.toml` 已配置 antd MCP；写 antd 代码前优先通过 MCP 或 `npm --prefix frontend_admin exec -- antd info <Component>` 查询组件 API，不凭记忆猜。
- **`frontend_admin` Node 版本**：在 `frontend_admin/` 下运行单测或任何 Node 命令前，必须先执行 `nvm use 22`。
- **`frontend_admin` 样式优先级**：Tailwind CSS v4（优先用于布局）→ antd-style v4 / `createStyles`（主题 token）→ CSS Modules（备选）→ Less（仅遗留代码）。尽量复用 antd / ProComponents 现有组件，不重复造轮子；非必要不写自定义 CSS。
- **`frontend_miniprogram` Node 版本**：在 `frontend_miniprogram/` 下运行 Node 命令前，优先执行 `nvm use 22`。
- **`frontend_miniprogram` 约定**：优先沿用 uni-app / unibest / wot-ui-v2 的目录、路由、请求与组件模式；接口生成代码位于 `frontend_miniprogram/src/services/openapi`，不要手写覆盖生成文件。

## 业务展示规则

- **房源户型**：所有前端房源展示位置中，当 `bedrooms === 1` 且 `living_rooms === 0` 时必须统一显示为“单间”，不得显示为“一房零厅”、“一室零厅”、“1房0厅”或“1室0厅”；`bedrooms === 1` 且 `living_rooms === 1` 时应正常显示为“一室一厅”或当前界面约定的等价格式，不得显示为“单间”。该规则仅用于前端展示，不修改后端字段和原始数据；新增房源展示位置时应复用共享户型格式化逻辑。

## API 约定

- 所有分页 Ninja API 必须使用 query params：`page`、`page_size`。
- 分页响应必须使用最小结构：`{ items, total, page, page_size }`。
- 分页路由应使用 `response=list[xxx]` 并配合项目 paginator 声明。

## Docker、静态文件与媒体

- **Docker**：`compose.yml` 当前启用 `db`（Postgres 17）、`redis`（7）、`web`、`worker`（celery），以及 `full` / `docs` profile 下可选的 `docs` 服务。前端开发服务不在 compose 中常驻，分别通过 `just admin_dev` 和 `just miniprogram_dev` 启动。
- **健康检查**：当前启用的 healthcheck 主要在 `db` 和 `redis`。
- **Web 启动**：`web` 容器启动时会运行 `migrate` 和 `ensure_s3_bucket`。
- **生产镜像**：多阶段 Dockerfile 位于 `config/docker/Dockerfile.web`，阶段包括 python-requirements、base、dev、js_assets、prod，生产阶段使用 gunicorn。
- **静态文件**：WhiteNoise 在生产环境服务 hash 静态资源，并通过设置中的正则使用 `Cache-Control: max-age=31536000, immutable`。
- **媒体文件**：上传使用 `apps/base/storage.py:S3MediaStorage`，它处理 Docker 内部 S3/MinIO endpoint 与浏览器访问 endpoint 的差异。

## 常用命令

所有开发任务优先使用 Just。

**启动与管理**

- `just start`：运行 `docker compose up`。
- `just start_with_debugpy`：启动服务，并让 debugpy 监听 `:5678`。
- `just start_full`：使用 `full` profile 启动 docker compose，例如启动 docs 服务。
- `just stop`：停止 compose 服务。
- `just build`：重建 Docker 镜像、清理 node_modules volume、执行 collectstatic。包含 `docker volume rm`，Codex 不得主动执行，除非用户明确授权。
- `just admin_dev`：启动 `frontend_admin/` 管理端开发服务。
- `just admin_build` / `just build_admin`：构建 `frontend_admin/` 管理端并 collectstatic。
- `just miniprogram_dev`：启动 `frontend_miniprogram/` 微信小程序开发构建。
- `just miniprogram_build`：构建 `frontend_miniprogram/` 微信小程序产物。
- `just miniprogram_build_h5` / `just build_h5`：构建 `frontend_miniprogram/` H5 产物并 collectstatic。
- `just build_frontend`：旧兼容别名，当前等同于 `just build_admin`。
- `just clean` / `just clean_extra_files` / `just clean_docker_*`：包含删除文件、容器、镜像或 volume 的操作，Codex 不得主动执行，除非用户明确授权并确认风险。
- `just create_env`：根据 `pyproject.toml` 中的 schema 生成 `.env`。
- `just upgrade_all_packages`：停止/移除容器，升级 Python 和 Node 依赖，重建后运行 pre-commit 检查。该命令包含容器删除操作，Codex 不得主动执行，除非用户明确授权并确认风险。

**代码质量**

- `just format`：格式化 Python（ruff）、JS（eslint）、HTML（djlint）和 justfile。
- `just lint`：运行所有 lint、ty 类型检查、缺失 migration 检查。
- `just pre_commit`：运行 format、lint、test、test_e2e。

**测试**

- `just test`：运行 pytest（Django + ninja API 测试）。
- `just test_with_coverage`：运行 pytest coverage，并打开 HTML 报告。
- `just test_e2e [args]`：先构建管理端，再用 `--ds=config.settings.e2e` 执行 `e2e/` 下测试。`pyproject.toml` 中通过 `--ignore=e2e` 将 e2e 排除在 `just test` 外。

**数据库**

- `just db_dump`：使用 pg_dump 导出到 `~/Downloads/`。
- `just db_restore [dump_file]`：从指定 dump 或最新 dump 恢复。该命令包含 `DROP DATABASE`，Codex 不得主动执行，除非用户明确授权。

**依赖**

- `just upgrade_python_packages`：运行 `uv sync --all-packages --all-extras`。
- `just upgrade_node_packages`：在 `frontend_admin/` 下运行 `npm update`。

## 测试规则

- 使用 pytest + pytest-django。
- 后端测试使用 `docker compose exec web pytest`。依赖变更后，容器镜像可能过旧，需要重建。
- 后端单测统一放在项目根目录的 `tests/` 包下，并按 app 结构镜像组织。例如 `apps/accounts/...` 对应 `tests/accounts/...`，`apps/base/...` 对应 `tests/base/...`。
- 新增或移动后端单测时，不要创建 `apps/<app>/tests/`；应使用 `tests/<app>/...`，共享测试工具从 `tests.*` 导入，例如 `tests.access.helpers`。
- 测试设置使用 `config.settings.test_runner`；e2e 设置使用 `config.settings.e2e`。
- fixture 使用 Model Bakery。
- 需要额外测试辅助时使用 Django Test Plus。
- TOTP / MFA 测试位于 `tests/accounts/test_mfa_flows.py`，使用 pyotp。
- Playwright e2e 测试位于 `e2e/`，覆盖认证流程和邀请流程。
- `just test_e2e` 会预构建 `frontend_admin/` 管理端；如果修改 `/h5/`，需要显式运行 `just build_h5`。
- coverage 配置位于 `config/coverage.ini`。

## 代码规范

- **Python**：使用 Ruff 做格式化和 lint（替代 Black/isort），使用 Ty 做类型检查。遵循 Django 约定。Ruff 启用 Bandit（S）规则集。
- **Ninja**：`[tool.ruff.lint.flake8-bugbear] extend-immutable-calls` 包含 `ninja.Query/File/Form/Body/Path`，避免这些默认参数调用触发 B008。
- **JavaScript / TypeScript**：`frontend_admin/` 使用 Biome + TypeScript；`frontend_miniprogram/` 使用自身的 ESLint / vue-tsc / uni-app 工具链。两个前端目录都使用各自的包管理器和 lint 配置。行宽 180 字符。
- **HTML / Django templates**：使用 djLint 格式化和 lint。
- **CSS**：`frontend_admin/` 优先使用 Tailwind v4 utilities，其次 antd-style `createStyles` 主题 token，自定义 CSS 尽量减少。`frontend_miniprogram/` 沿用 uni-app / wot-ui-v2 样式约定。
- **行宽**：Python 和 HTML 使用 180 字符。

## 调试

**快速开始**

1. 运行 `just start_with_debugpy`。
2. 等待输出 `Debugger listening on 0.0.0.0:5678`。
3. 使用编辑器附加调试器。

**重要说明**

- 调试时会禁用自动重载。代码变更后需要手动重启服务。
- 普通开发需要自动重载时，使用 `just start`。

**VS Code**

1. 运行 `just start_with_debugpy`。
2. 按 F5，或在调试下拉中选择 `Django: Attach Debugger`。
3. 设置断点并调试。

**PyCharm**

1. 配置 Docker Compose Python interpreter（Settings → Python Interpreter）。
2. 创建 Django Server run configuration。
3. 点击 Debug；PyCharm 会自动处理。
4. 详细设置见 `docs/debugging.md`。

**LazyVim / Neovim**

- 配置 nvim-dap 连接 `localhost:5678`。
- 调试器使用标准 Debug Adapter Protocol（DAP）。
- 详细设置见 `docs/debugging.md`。

## 环境配置

本地开发使用 `.env`。schema 定义在 `pyproject.toml` 的 `[tool.epicenv.variables]`。可以通过 `just create_env` 或 `uvx epicenv create` 生成新的 `.env`。

关键变量：

- `DEBUG=on`：开发环境开启调试。
- `SECRET_KEY`：由 epicenv 的 `url_safe_password` initializer 自动生成。
- `DATABASE_URL`：Postgres 连接字符串。
- `SITE_DOMAIN`：默认 `localhost:8000`。必须使用 `localhost`，不要使用 `127.0.0.1`；WebAuthn / passkey enrollment 会拒绝裸 IP 作为 Relying Party ID。
- `ALLOWED_HOSTS`：默认 `localhost,127.0.0.1`。
- `INTERNAL_IPS`：用于 Django Debug Toolbar。
- `USE_DEBUGPY=true`：启用远程调试。
- `MEDIA_S3_*`：S3 / MinIO 媒体存储凭据。`MEDIA_S3_ENDPOINT_URL` 是服务端访问地址，`MEDIA_S3_URL_ENDPOINT_URL` 是浏览器访问地址，二者差异由 `apps.base.storage.S3MediaStorage` 处理。
- `ALIYUN_STS_*`：`apps.media.api` 签发 OSS 直传 token 时使用的 STS 凭据。
- `SMS_BACKEND`、`ALIYUN_SMS_*`、`TENCENT_SMS_*`：手机验证 / 验证码登录短信后端。
- `GITHUB_CLIENT_*`、`WECHAT_APP_*`、`WECHAT_MINIPROGRAM_APP_*`：浏览器端与小程序端社交登录 provider。
- `ACCOUNT_SIGNUP_OPEN`：是否开放新用户注册。

## 认证流程

`HEADLESS_ONLY = True` 且 `HEADLESS_CLIENTS = ["browser", "app"]`，因此 allauth 不渲染模板。浏览器流程通过 `/api/allauth/browser/v1/...` 返回 JSON；app/mobile 客户端使用 `/api/allauth/app/v1/...` 与 JWT。当前浏览器端主要由 `frontend_admin/` 的登录、安全设置等页面承接；改认证前必须同时核对 `config/settings/_base.py` 的 `HEADLESS_FRONTEND_URLS`、`SPA_URLS` 和 `frontend_admin/config/routes.ts`。

- **登录**：管理端登录页处理密码登录、验证码登录、passkey 登录、GitHub 登录。密码登录仍支持 `?next=` / redirect 透传；也可能根据 allauth 返回的 `flows` 状态进入手机验证或 MFA。
- **注册**：管理端当前注册页仍保留 Ant Design Pro 模板式 `/api/register` 流程；接真实注册时应优先复用 allauth / `apps.accounts.api` 的现有接口和 `frontend_admin/src/services/manual` 适配层。
- **邮箱验证**：邮件中的链接按 `HEADLESS_FRONTEND_URLS` 配置跳转到前端页面处理。
- **手机验证**：后端支持 allauth phone verify flow；前端是否已接入以当前 `frontend_admin/config/routes.ts` 和页面实现为准。
- **密码重置**：由管理端认证页面和 `/api/allauth/browser/v1/auth/password/*` 接口承接。
- **MFA**：支持 TOTP、恢复码、WebAuthn passkeys。TOTP enrollment QR 在本地 `/qr/?data=<otpauth-url>` 渲染，使用 `qrcode` 包并要求 login_required，不使用第三方图片服务。
- **组织邀请**：公开邀请查询、接受、拒绝端点位于 `/api/invite-by-key/<key>/` 前缀下；管理端和小程序端都通过生成的 openapi service 调用这些接口。

## 多租户基础能力

- `Organization` 包含 name、slug、billing_email。
- `OrganizationMember` 包含 `is_owner`、`is_primary` 标记。
- `OrganizationInvite` 使用 key，7 天过期。
- `OrganizationMiddleware` 通过 `apps.organizations.session` 从 session 懒加载 `request.org`。session 缓存最小序列化 org dict；只有访问 `org.instance` 时才查询完整模型实例。
- `apps/organizations/signals.py` 会在 login、hijack-start、hijack-end 时切换到用户 primary org。
- 管理端中的组织切换、组织设置、成员与团队管理由 `frontend_admin/` 页面驱动；小程序端按自身页面与 service 调用后端租户接口。

## 关键依赖

- **后端**：Django 5、django-allauth[mfa]（含 fido2 / WebAuthn）、django-ninja、django-hijack、Pillow、Celery、Redis、PostgreSQL 17、gunicorn、WhiteNoise、django-storages + boto3、django-ses、django-alive、django-maintenance-mode、Aliyun SMS/STS SDK、Tencent SMS SDK。
- **管理端前端**：React、Umi Max、Ant Design / ProComponents、Tailwind v4、antd-style、React Query、Vitest、npm。
- **小程序/H5 前端**：uni-app、unibest、Vue 3、wot-ui-v2、alova、pnpm。
- **开发**：Docker、pytest、pytest-playwright、pyotp、Ruff、Ty、ESLint、djLint、model-bakery。

<!-- open-wot agent instructions start -->
## Wot UI Agent Instructions

Before generating or modifying wot-ui component code, read the project Skill at `.agents/skills/wot-ui-v2/SKILL.md` and query the configured `wot-ui` MCP server for version-accurate APIs and examples.

<!-- open-wot agent instructions end -->
