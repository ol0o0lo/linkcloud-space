# frontend_admin (vben-admin) 集成设计

**日期:** 2026-05-26

## 概述

在现有 Django 项目中集成 vben-admin（`web-antdv-next`）作为租户后台管理界面，挂载在 `/dashboard/` 路径下，与现有用户端 SPA（`frontend/`）并存，共用同一套 `/api/` 接口和 Django 认证。

## 目录结构

```
frontend_admin/
  apps/
    web-antdv-next/         ← 租户后台 SPA（vben-admin Vue 3 + Ant Design Vue）
      vite.config.ts        ← 新增 outDir 指向 public/static/dist/admin/
      .env.production       ← 修改 VITE_BASE 和 VITE_GLOB_API_URL
      .env.development      ← 修改 API proxy 指向本地 Django :8000

public/static/
  dist/
    js/                     ← 现有 frontend/ 产物（不变）
    admin/                  ← vben-admin 产物（新增，由 collectstatic 收集）
      index.html
      _app.config.js
      css/
      js/
      jse/
```

## URL 结构

| 路径 | 作用 |
|------|------|
| `/*` | 现有用户端 SPA（catch-all，不变） |
| `/dashboard/` | vben-admin 租户后台入口 |
| `/api/` | 共用 Ninja API |
| `/admin/` | Django 超级管理员后台（不变） |

`/dashboard/` 路由在 `config/urls.py` 中插在现有 catch-all **之前**，返回 `DashboardSPAView`（提供 `public/static/dist/admin/index.html`）。

vben-admin 使用 **hash 路由模式**（`VITE_ROUTER_HISTORY=hash`），Django 只需服务 `/dashboard/` 一个入口，内部路由如 `/#/settings` 全由前端处理。

## 配置变更

### `frontend_admin/apps/web-antdv-next/.env.production`

```
VITE_BASE=/public/static/dist/admin/
VITE_GLOB_API_URL=/api
VITE_ROUTER_HISTORY=hash
VITE_COMPRESS=none
VITE_PWA=false
VITE_INJECT_APP_LOADING=true
VITE_ARCHIVER=false
```

### `frontend_admin/apps/web-antdv-next/.env.development`

```
VITE_GLOB_API_URL=/api
```

proxy `/api` 改为指向 `http://localhost:8000`（本地 Django dev server）。

### `frontend_admin/apps/web-antdv-next/vite.config.ts`

在 `vite` 字段中新增 `build.outDir`：

```ts
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
```

## Django 改动

### `apps/base/views.py`

新增 `DashboardSPAView`，与现有 `SPAView` 模式一致，返回 `dist/admin/index.html`：

```python
class DashboardSPAView(TemplateView):
    template_name = "dist/admin/index.html"
```

### `config/urls.py`

在现有 catch-all 之前插入：

```python
re_path(r"^dashboard/.*$", DashboardSPAView.as_view(), name="dashboard-spa"),
```

## 构建命令

### `config/base.just` 新增

```just
# Build admin frontend assets (vben-admin web-antdv-next)
@build_admin:
    cd frontend_admin/apps/web-antdv-next && pnpm build
    just collectstatic
```

## 开发工作流

- **开发 vben-admin：** 在 `frontend_admin/apps/web-antdv-next/` 运行 `pnpm dev`，dev server 默认端口 `:5173`，API 代理到本地 Django `:8000`
- **生产构建：** `just build_admin` 打包并收集静态文件
- **两套前端独立：** `just build_frontend`（用户端）和 `just build_admin`（租户后台）互不影响

## 认证

vben-admin 调用 `/api/` 时使用 session cookie（同域），无需额外 CORS 配置。vben-admin 自身的登录页需对接 `/_allauth/browser/v1/auth/login`，或复用现有 SPA 的登录后跳转到 `/dashboard/`。
