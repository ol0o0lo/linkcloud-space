# frontend_admin Dashboard 集成实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 vben-admin（web-antdv-next）集成到 Django 项目，挂载在 `/dashboard/` 路径，作为租户后台管理界面，共用 `/api/` 接口和 Django 认证。

**Architecture:** vben-admin 构建产物输出到 `public/static/dist/admin/`，Django 通过 `DashboardSPAView` 在 `/dashboard/` 路径提供服务，WhiteNoise 处理静态资源。Hash 路由模式，Django 只需服务单一入口。

**Tech Stack:** Vue 3, Ant Design Vue, vben-admin (web-antdv-next), pnpm, Django, WhiteNoise, django-ninja

---

## 涉及文件

| 操作 | 文件 |
|------|------|
| 修改 | `frontend_admin/apps/web-antdv-next/.env.production` |
| 修改 | `frontend_admin/apps/web-antdv-next/.env.development` |
| 修改 | `frontend_admin/apps/web-antdv-next/vite.config.ts` |
| 修改 | `apps/base/views.py` |
| 修改 | `config/urls.py` |
| 修改 | `config/base.just` |

---

## Task 1: 配置 vben-admin 生产环境变量

**Files:**
- Modify: `frontend_admin/apps/web-antdv-next/.env.production`

- [ ] **Step 1: 修改 `.env.production`**

将文件内容替换为：

```
VITE_BASE=/public/static/dist/admin/

# 接口地址（指向本 Django 项目的 API）
VITE_GLOB_API_URL=/api

# 是否开启压缩
VITE_COMPRESS=none

# 是否开启 PWA
VITE_PWA=false

# vue-router 的模式（hash 模式，Django 只需服务单一入口）
VITE_ROUTER_HISTORY=hash

# 是否注入全局loading
VITE_INJECT_APP_LOADING=true

# 不生成 dist.zip
VITE_ARCHIVER=false
```

- [ ] **Step 2: Commit**

```bash
git add frontend_admin/apps/web-antdv-next/.env.production
git commit -m "chore(admin): 配置 vben-admin 生产环境变量指向本地 Django API"
```

---

## Task 2: 配置 vben-admin 开发环境代理

**Files:**
- Modify: `frontend_admin/apps/web-antdv-next/.env.development`
- Modify: `frontend_admin/apps/web-antdv-next/vite.config.ts`

- [ ] **Step 1: 修改 `.env.development`**

在现有内容基础上，确认 `VITE_NITRO_MOCK` 改为 `false`（使用真实 Django API 而非 mock）：

```
# 端口号
VITE_PORT=5999

VITE_BASE=/

# 接口地址
VITE_GLOB_API_URL=/api

# 关闭 Nitro Mock，使用真实 Django API
VITE_NITRO_MOCK=false

# 是否打开 devtools
VITE_DEVTOOLS=false

# 是否注入全局loading
VITE_INJECT_APP_LOADING=true
```

- [ ] **Step 2: 修改 `vite.config.ts`，将 API proxy 指向本地 Django**

```ts
import { defineConfig } from '@vben/vite-config';

export default defineConfig(async () => {
  return {
    application: {},
    vite: {
      build: {
        outDir: '../../../../public/static/dist/admin',
        emptyOutDir: true,
      },
      server: {
        proxy: {
          '/api': {
            changeOrigin: true,
            target: 'http://localhost:8000',
            ws: true,
          },
        },
      },
    },
  };
});
```

- [ ] **Step 3: Commit**

```bash
git add frontend_admin/apps/web-antdv-next/.env.development frontend_admin/apps/web-antdv-next/vite.config.ts
git commit -m "chore(admin): 配置开发环境 API 代理到本地 Django :8000，生产 outDir 指向 public/static/dist/admin"
```

---

## Task 3: 新增 Django DashboardSPAView

**Files:**
- Modify: `apps/base/views.py`

- [ ] **Step 1: 在 `apps/base/views.py` 新增 `DashboardSPAView`**

在 `SPAView` 类定义之后（约第19行之后）插入：

```python
class DashboardSPAView(generic.TemplateView):
    template_name = "dist/admin/index.html"

    @classmethod
    def as_view(cls, **initkwargs):
        view = super().as_view(**initkwargs)
        return ensure_csrf_cookie(view)
```

`template_name` 使用 `dist/admin/index.html`，因为 Django 的 `STATICFILES_DIRS` 包含 `public/static/`，collectstatic 后 `index.html` 会位于 `public/static/dist/admin/index.html`，Django 模板引擎从 `APP_DIRS` 查找，但 vben-admin 的 `index.html` 是纯 HTML 不走模板引擎——需要用 `TemplateView` 直接 serve。

> **注意：** Django 的 `APP_DIRS=True` 只在各 app 的 `templates/` 目录查找。`dist/admin/index.html` 位于 `public/static/dist/admin/`，不在任何 `templates/` 目录下。需要在 settings 的 `TEMPLATES[0]['DIRS']` 中添加 `public/static/` 目录，或者改用直接读取文件的方式返回。

**推荐方案**：用 `django.views.static.serve` 思路，改为直接返回文件内容，避免修改 TEMPLATES 配置。将 `DashboardSPAView` 改为：

```python
class DashboardSPAView(generic.View):
    def get(self, request, *args, **kwargs):
        from django.conf import settings
        import os

        index_path = os.path.join(settings.BASE_DIR, "public", "static", "dist", "admin", "index.html")
        with open(index_path, "rb") as f:
            content = f.read()
        response = HttpResponse(content, content_type="text/html; charset=utf-8")
        from django.middleware.csrf import get_token
        get_token(request)
        return response
```

- [ ] **Step 2: Commit**

```bash
git add apps/base/views.py
git commit -m "feat(base): 新增 DashboardSPAView 用于提供 vben-admin 入口 HTML"
```

---

## Task 4: 注册 Django URL 路由

**Files:**
- Modify: `config/urls.py`

- [ ] **Step 1: 在 `config/urls.py` 中导入 `DashboardSPAView` 并添加路由**

修改 import 行：

```python
from apps.base.views import DashboardSPAView, SPAView, http_404, http_500, qr_svg
```

在 `re_path(r"^public/", ...)` 之前、现有 catch-all 之前插入：

```python
re_path(r"^dashboard/", DashboardSPAView.as_view(), name="dashboard-spa"),
```

完整 urlpatterns 末尾部分应为：

```python
    re_path(
        r"^organizations/invite/(?P<key>[0-9a-z]+)/accept/$",
        SPAView.as_view(),
        name="accept_invite",
    ),
    re_path(r"^dashboard/", DashboardSPAView.as_view(), name="dashboard-spa"),
    re_path(r"^public/", _public_not_found, name="public-not-found"),
    re_path(r"^(?!public/).*$", SPAView.as_view(), name="spa"),
```

- [ ] **Step 2: 验证 Django 路由不冲突**

```bash
docker compose exec web python manage.py show_urls | grep dashboard
```

期望输出包含：
```
/dashboard/    apps.base.views.DashboardSPAView    dashboard-spa
```

- [ ] **Step 3: Commit**

```bash
git add config/urls.py
git commit -m "feat(urls): 注册 /dashboard/ 路由，指向 DashboardSPAView"
```

---

## Task 5: 新增 just build_admin 命令

**Files:**
- Modify: `config/base.just`

- [ ] **Step 1: 在 `build_frontend` 命令之后添加 `build_admin`**

在 `config/base.just` 中，`build_frontend` 定义（约第32行）之后插入：

```just
# Build admin frontend assets (vben-admin web-antdv-next)
@build_admin:
    cd frontend_admin/apps/web-antdv-next && pnpm build
    just collectstatic
```

- [ ] **Step 2: 验证命令可以被 just 识别**

```bash
just --list | grep build_admin
```

期望输出：
```
build_admin   Build admin frontend assets (vben-admin web-antdv-next)
```

- [ ] **Step 3: Commit**

```bash
git add config/base.just
git commit -m "chore(just): 新增 build_admin 命令，打包 vben-admin 并收集静态文件"
```

---

## Task 6: 验证完整集成

- [ ] **Step 1: 执行 vben-admin 打包**

```bash
just build_admin
```

期望：
- `public/static/dist/admin/index.html` 文件存在
- `public/static/dist/admin/css/`、`js/`、`jse/` 目录存在
- `collectstatic` 成功运行

- [ ] **Step 2: 启动 Django 开发服务器，访问 `/dashboard/`**

```bash
docker compose exec web python manage.py runserver
```

浏览器访问 `http://localhost:8000/dashboard/`，期望：
- 返回 vben-admin 的 HTML（状态码 200）
- 页面正常加载 vben-admin 登录界面
- 浏览器控制台无 404 资源错误

- [ ] **Step 3: 验证现有 SPA 不受影响**

访问 `http://localhost:8000/`，期望现有用户端 Vue SPA 正常显示，不受影响。

- [ ] **Step 4: 验证 API 可达**

在 vben-admin 页面登录时，Network 面板确认 `/api/` 请求正常响应（无 CORS 错误）。
