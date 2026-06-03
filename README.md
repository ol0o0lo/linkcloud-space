# Django Base Site 快速启动模板

这是一个面向新项目快速启动的 Django + Vue 全栈模板。它内置 Django 5、django-ninja、django-allauth headless 认证、多因素认证、组织/团队脚手架、通知系统、媒体对象存储、Celery、Redis、Docker Compose、pytest、Playwright e2e、Ruff、Ty、ESLint 和 djLint。

模板目标是让新项目尽快进入“可运行、可开发、可继续定制”的状态。

## 技术栈

- 后端：Django 5、django-ninja、django-allauth、Celery、PostgreSQL、Redis
- 前端：Vue 3、Vue Router、Tailwind v4、Vite、Bun
- 存储：MinIO / S3 兼容对象存储
- 测试：pytest、pytest-django、Playwright e2e、Model Bakery
- 质量：Ruff、Ty、ESLint、djLint、coverage
- 运维：Docker Compose、gunicorn、WhiteNoise、django-alive

## 前置依赖

本地需要准备：

- Docker 和 Docker Compose
- Just
- uv / uvx
- Bun

如果只通过 Docker 开发，Python、Node 依赖主要由容器处理。

## 快速开始

1. 生成本地环境变量：

```bash
just create_env
```

2. 启动服务：

```bash
just start
```

3. 访问本地服务：

- Web 应用：http://localhost:8000
- Vite dev server：http://localhost:3000
- MinIO 控制台：http://localhost:9001
- API 文档：http://localhost:8000/api/docs

注意：本地 WebAuthn / passkey 需要使用 `localhost`，不要用 `127.0.0.1` 作为站点域名。

## 初始化为新项目

从模板创建新项目后，先按清单替换项目身份，例如项目名、显示名、仓库地址、Docker 镜像名、数据库名、站点标题和首页文案。不要全仓库盲替换，也不要一开始就大规模删除模块。

初始化前建议先确认工作区干净：

```bash
git status --short
```

更多说明见 [docs/template-initialization.md](docs/template-initialization.md)。

## 环境变量

环境变量 schema 定义在 [pyproject.toml](pyproject.toml) 的 `[tool.epicenv.variables]` 中。可读说明见 [docs/environment.md](docs/environment.md)，示例文件见 [.env.example](.env.example)。

常用变量：

- `DEBUG`：本地开发开启
- `SECRET_KEY`：每个项目必须重新生成
- `DATABASE_URL`：Django 数据库连接
- `SITE_DOMAIN`：站点域名，本地默认 `localhost:8000`
- `ACCOUNT_SIGNUP_OPEN`：是否开放注册
- `MEDIA_S3_*`：MinIO / S3 媒体存储配置
- `EMAIL_URL`、`DEFAULT_FROM_EMAIL`：邮件配置

## 常用命令

```bash
just start              # 启动本地开发服务
just stop               # 停止服务
just build              # 构建镜像并收集静态文件
just test               # 运行后端测试
just test_e2e           # 构建前端后运行 e2e 测试
just lint               # 运行代码质量检查
just format             # 格式化代码
just pre_commit         # format + lint + test + e2e
```

前端工程采用同仓多工程、依赖隔离的方式组织。SaaS 管理后台在 `frontend_admin/`，小程序端在 `frontend_miniprogram/`，旧 `frontend/` 仅暂时保留。具体边界和入口命令见 [docs/frontend-structure.md](docs/frontend-structure.md)。

测试约定：

- 后端单元测试放在 `tests/<app>/...`
- e2e 测试放在 `e2e/`
- 后端测试默认使用 `config.settings.test_runner`

## 内置模块

- 账号认证：登录、注册、邮箱验证、密码重置、MFA、WebAuthn passkeys
- 多租户：组织、成员、邀请、团队
- 权限：角色、权限同步、访问控制骨架
- 通知：站内通知、邮件通知、偏好设置、定期清理
- 媒体：对象存储、上传记录、清理任务
- SPA：Vue 3 前端壳子、路由、布局、账户页面

## 模板维护建议

- 通用基础能力可以进入模板分支
- 当前项目专属业务、客户配置、品牌素材不要进入模板分支
- 新项目初始化后先完成项目名、域名、凭据、存储、邮件、短信配置隔离
- 每次提交尽量保持完整可用
