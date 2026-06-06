# linkcloud-space 项目说明

当前仓库基于 `Django Base Site` 启动模板演进，现阶段已经不是“只有脚手架”的空白模板仓库，而是一个包含账号体系、多租户、权限、通知、媒体、后台和小程序端的业务基础盘。代码里仍保留部分模板命名，例如 `Django Base Site`、`django-base-site`，这属于模板血缘的一部分；实际开发请以当前仓库结构和文档为准。

## 项目定位

- 后端基于 Django 5、django-ninja、django-allauth headless
- 主 Web 端为 Vue 3 SPA，挂载在 `/`
- 管理后台构建产物挂载在 `/dashboard/`
- 小程序 H5 构建产物挂载在 `/h5/`
- 认证、组织/团队、权限、通知、媒体、设置、实名认证等基础能力已经接好，可直接作为新业务的底座继续开发

## 当前已落地的能力

### 账号与认证

- 邮箱/密码登录、注册、邮箱验证、密码重置
- 手机号验证码流程与手机号绑定
- MFA：TOTP、恢复码、WebAuthn passkeys
- 第三方登录：GitHub、微信开放平台、微信小程序 token 登录
- 后台账号生命周期管理：创建用户、启停用、重置密码、重置 MFA、解绑手机号/微信
- 管理员 impersonate / hijack 能力

### 多租户与权限

- 组织创建、切换、设置主租户、归档/恢复、转移 owner
- 组织成员管理、邀请、重发、公开接受/拒绝邀请
- 团队创建、成员维护、团队级权限隔离
- RBAC：组织级角色、团队级角色、自定义角色、权限绑定

### 通知、设置与媒体

- 站内通知、邮件通知、未读统计、批量已读/删除
- 按通知类别维护个人偏好
- 用户/组织/团队三级设置覆盖
- 媒体文件直传凭证、服务端上传、文件登记、引用清理约定

### 扩展业务能力

- 实名认证：用户提交、日志时间线、后台审核、撤销与重试
- 后端统一 API 文档、错误处理和多鉴权方式
- Celery + Redis 后台任务
- WhiteNoise 静态资源服务与 S3/MinIO 兼容媒体存储支持

更完整的模块说明见 [docs/feature-overview.md](docs/feature-overview.md)。

## 技术栈

- 后端：Django 5、django-ninja、django-allauth、Celery、PostgreSQL 17、Redis 7
- 前端：Vue 3、Vue Router、Tailwind v4、Vite 8、Bun
- 管理后台：`frontend_admin/` 中的独立 `pnpm workspace`
- 小程序端：`frontend_miniprogram/` 中的 uni-app / unibest 工程
- 测试：pytest、pytest-django、model-bakery、Playwright
- 质量：Ruff、Ty、ESLint、djLint、coverage
- 部署：Docker Compose、gunicorn、WhiteNoise

## 仓库结构

```text
apps/                  Django 业务应用
config/                Django 配置、URL、API、Docker 与 MkDocs 配置
frontend/              主 Web SPA（Vue 3）
frontend_admin/        SaaS 管理后台前端
frontend_miniprogram/  小程序与 H5 前端
tests/                 后端测试
e2e/                   Playwright 端到端测试
docs/                  项目文档
```

其中核心 Django app 为：

- `apps/accounts`：用户、头像、手机号、MFA、微信手机号、实名认证
- `apps/organizations`：组织、成员、邀请、会话中的当前租户
- `apps/teams`：团队与成员范围
- `apps/access`：RBAC 角色、权限、绑定关系
- `apps/notifications`：站内/邮件通知与偏好设置
- `apps/media`：媒体文件记录、OSS/STS 上传能力
- `apps/settings`：用户/组织/团队三级设置
- `apps/base`：SPA 壳、应用上下文、CSRF、第三方登录跳转、通用工具

## 本地开发

### 前置依赖

- Docker / Docker Compose
- Just
- uv / uvx
- Bun
- pnpm（用于 `frontend_admin/` 和 `frontend_miniprogram/`）

### 1. 生成环境变量

```bash
just create_env
```

环境变量 schema 定义在 [pyproject.toml](pyproject.toml) 的 `[tool.epicenv.variables]` 中，详细说明见 [docs/environment.md](docs/environment.md)。

### 2. 启动后端基础服务

```bash
just start
```

当前 `compose.yml` 默认启动：`db`、`redis`、`web`、`worker`。

默认访问地址：

- 主站：http://localhost:18000/
- API 文档：http://localhost:18000/api/docs（`DEBUG=on` 时可见）
- PostgreSQL：`127.0.0.1:5432`
- Redis：`127.0.0.1:6380`

如果需要文档站：

```bash
just start_full
```

然后访问：http://localhost:4000/

### 3. 按需启动前端工程

主 Web SPA 当前通过根目录 `bun` 脚本维护；`compose.yml` 里的前端容器默认未启用，因此日常开发更推荐直接在宿主机运行：

```bash
bun install
bun run dev
```

默认 Vite 地址：`http://localhost:3000`

管理后台与小程序端是独立子工程：

```bash
just admin_dev
just miniprogram_dev
```

更多边界说明见 [docs/frontend-structure.md](docs/frontend-structure.md)。

## 常用命令

```bash
just start                 # 启动 db/redis/web/worker
just start_with_debugpy    # 启动远程调试模式
just start_full            # 启动 full profile（包含 docs）
just stop                  # 停止 docker compose
just build                 # 重建镜像并 collectstatic
just admin_build           # 构建管理后台并收集静态文件
just miniprogram_build     # 构建微信小程序产物
just miniprogram_build_h5  # 构建 H5 产物并收集静态文件
just test                  # 运行后端测试
just lint                  # 运行 lint / type check / migration check
just format                # 格式化代码
```

主 Web SPA 的本地命令：

```bash
bun run dev
bun run build
bun run lint-js
```

## 测试与质量约定

- 后端单元测试放在 `tests/<app>/...`，不要放到 `apps/<app>/tests/`
- 后端测试默认使用 `config.settings.test_runner`
- e2e 测试位于 `e2e/`
- 运行 pytest 时，优先使用容器内环境：`docker compose exec web pytest`

## 环境与接入说明

- 本地 WebAuthn / passkey 调试必须使用 `localhost`，不要用 `127.0.0.1`
- 当前项目支持 S3/MinIO 兼容媒体存储，但 `compose.yml` 中本地 MinIO 服务默认未开启；如需本地对象存储，请自行恢复或接入外部存储服务
- 支持 Django Session、allauth JWT Bearer、`X-Session-Token` 三种 API 鉴权方式

## 文档导航

- [docs/feature-overview.md](docs/feature-overview.md)：功能总览与模块边界
- [docs/environment.md](docs/environment.md)：环境变量说明
- [docs/frontend-structure.md](docs/frontend-structure.md)：前端工程结构与边界
- [docs/media-platform.md](docs/media-platform.md)：媒体平台接入约定
- [docs/real-name-verification.md](docs/real-name-verification.md)：实名认证流程与设计
- [docs/template-initialization.md](docs/template-initialization.md)：模板初始化与改名指南
- [docs/startup-branch.md](docs/startup-branch.md)：`startup` 模板分支使用约定

## 适合继续扩展的方向

- 在 `apps/` 下继续增加业务域 app，并复用现有认证、组织、权限和通知体系
- 在 `frontend/`、`frontend_admin/`、`frontend_miniprogram/` 中分别承接主站、后台和移动端业务
- 将项目专属业务与可复用基础能力分开提交，便于后续回灌到 `startup` 分支
