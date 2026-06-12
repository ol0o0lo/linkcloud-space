# Ant Design Pro 替换前端第一阶段 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将旧 `frontend/` 和旧 `frontend_admin/` 安全移出工作区，在原 `frontend_admin/` 位置启用官方 `Ant Design Pro`，让 Django 继续通过 `/dashboard/` 提供新后台构建产物，并为 `/` 提供一个临时跳转页。

**Architecture:** 先做目录替换和官方脚手架初始化，再切换仓库命令与 Django 静态入口，最后补上服务端根路径占位页和文档说明。第一阶段不接真实 Django 鉴权，不迁业务页面，只验证新后台壳子、构建链路和 URL 入口。

**Tech Stack:** Django 5、pytest、Just、pnpm、官方 Ant Design Pro（Umi/React）

---

### Task 1: 归档旧前端并生成新的官方 Ant Design Pro

**Files:**
- Move: `frontend/`
- Move: `frontend_admin/`
- Create: `frontend_admin/`（官方 Ant Design Pro 脚手架生成目录）
- Verify: `frontend_admin/package.json`

- [ ] **Step 1: 记录当前工作区和旧前端目录状态**

Run:

```bash
git status --short
ls -ld frontend frontend_admin
```

Expected: `frontend` 和 `frontend_admin` 目录存在，且没有意外的未跟踪新前端目录。

- [ ] **Step 2: 把旧前端目录移动到 `~/.trash` 并带时间戳备份名**

Run:

```bash
mkdir -p ~/.trash
stamp=$(date +%Y%m%d-%H%M%S)
mv frontend ~/.trash/frontend-legacy-$stamp
mv frontend_admin ~/.trash/frontend-admin-legacy-$stamp
```

Expected: 仓库根目录不再有 `frontend/` 和旧 `frontend_admin/`，`~/.trash` 下新增两个带时间戳的备份目录。

- [ ] **Step 3: 使用官方创建器在原位置生成新的后台工程**

Run:

```bash
pnpm create umi@latest frontend_admin --template ant-design-pro
```

Expected: 生成新的 `frontend_admin/` 目录，包含官方脚手架常见文件，例如 `package.json`、`config/`、`src/`。

- [ ] **Step 4: 安装依赖并确认新工程可以本地启动**

Run:

```bash
pnpm --dir frontend_admin install
cd frontend_admin && pnpm dev
```

Expected: 看到 Umi/Ant Design Pro 的开发服务启动日志，并出现本地访问地址；人工确认默认登录页或默认工作台可以打开后再停止进程。

- [ ] **Step 5: 提交脚手架替换结果**

```bash
git add frontend_admin
git commit -m "初始化 Ant Design Pro 后台脚手架"
```


### Task 2: 切换后台构建链路与仓库命令到新的 `frontend_admin/`

**Files:**
- Modify: `justfile`
- Modify: `config/base.just`
- Verify: `frontend_admin/dist/index.html`

- [ ] **Step 1: 先运行现有后台构建命令，确认旧路径依赖会失效**

Run:

```bash
just admin_build
```

Expected: 由于旧的 `frontend_admin/apps/web-antdv-next` 已不存在，命令失败，证明仓库构建链路仍指向 Vben 目录。

- [ ] **Step 2: 修改 `justfile` 里的后台开发命令，改为直接启动新的官方项目**

Update `justfile` to:

```just
# Start SaaS admin frontend dev server
@admin_dev:
    cd frontend_admin && pnpm dev

# Build SaaS admin frontend assets
@admin_build:
    just build_admin
```

- [ ] **Step 3: 修改 `config/base.just` 中的后台构建与静态复制路径**

Update `config/base.just` to:

```just
# Build admin frontend assets (Ant Design Pro)
@build_admin:
    cd frontend_admin && pnpm build
    just collectstatic

@collectstatic:
    just _start_msg "Collecting static files"
    if [ -d frontend_admin/dist ]; then mkdir -p public/static/dist/admin && cp -R frontend_admin/dist/. public/static/dist/admin/; fi
    if [ -d frontend_miniprogram/dist/build/h5 ]; then mkdir -p public/static/dist/h5 && cp -R frontend_miniprogram/dist/build/h5/. public/static/dist/h5/; fi
    {{ python_cmd_prefix }} ./manage.py collectstatic --no-input --no-default-ignore --clear
```

- [ ] **Step 4: 重新构建新的后台产物，确认 `dist` 和静态复制链路生效**

Run:

```bash
pnpm --dir frontend_admin build
test -f frontend_admin/dist/index.html
```

Expected: `frontend_admin/dist/index.html` 存在，说明新后台构建成功。

- [ ] **Step 5: 提交后台命令与静态路径切换**

```bash
git add justfile config/base.just
git commit -m "切换后台构建命令到 Ant Design Pro"
```


### Task 3: 为根路径 `/` 增加临时跳转页并保持 `/dashboard/` 入口可测

**Files:**
- Modify: `apps/base/views.py`
- Modify: `config/urls.py`
- Create: `apps/base/templates/root_landing.html`
- Modify: `tests/base/test_views.py`

- [ ] **Step 1: 先写失败测试，定义新的根路径行为**

Replace `tests/base/test_views.py` 中 `TestSPAShell` 的根路径断言为：

```python
class TestSPAShell(SimpleTestCase):
    def test_root_returns_landing_page(self):
        resp = self.client.get("/")
        self.assertEqual(resp.status_code, 200)
        self.assertContains(resp, "官网即将上线", html=False)
        self.assertContains(resp, "/dashboard/", html=False)

    def test_unknown_path_returns_404_after_spa_removal(self):
        resp = self.client.get("/some/random/path/")
        self.assertEqual(resp.status_code, 404)

    def test_legacy_invite_frontend_route_returns_404(self):
        resp = self.client.get("/organizations/invite/abc123/accept/")
        self.assertEqual(resp.status_code, 404)
```

- [ ] **Step 2: 运行测试，确认根路径新预期当前失败**

Run:

```bash
docker compose exec web pytest tests/base/test_views.py -v
```

Expected: `test_root_returns_landing_page` 失败，因为当前 `/` 不是 200 页面。

- [ ] **Step 3: 增加根路径 view、模板和 URL**

Update `apps/base/views.py` to add:

```python
class RootLandingView(generic.TemplateView):
    template_name = "root_landing.html"
```

Create `apps/base/templates/root_landing.html` with:

```html
<!DOCTYPE html>
{% load site %}
<html lang="zh-CN">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>{% get_site_name %}</title>
    <style>
      body { font-family: sans-serif; margin: 0; background: #f5f7fb; color: #1f2937; }
      main { max-width: 720px; margin: 12vh auto; padding: 32px; background: white; border-radius: 20px; box-shadow: 0 20px 60px rgba(15, 23, 42, 0.08); }
      a { display: inline-block; margin-top: 16px; color: white; background: #1677ff; padding: 12px 18px; border-radius: 999px; text-decoration: none; }
      p { line-height: 1.7; }
    </style>
  </head>
  <body>
    <main>
      <h1>官网即将上线</h1>
      <p>当前站点正在切换到新的后台前端。正式官网地址稍后会在这里接入。</p>
      <p>如需继续访问管理后台，请使用下面的入口。</p>
      <a href="/dashboard/">进入后台</a>
    </main>
  </body>
</html>
```

Update `config/urls.py` imports and patterns to:

```python
from apps.base.views import DashboardSPAView, H5SPAView, RootLandingView, http_404, http_500, qr_svg

urlpatterns: list[URLResolver | URLPattern] = [
    path("", RootLandingView.as_view(), name="root-landing"),
    path("_allauth/", include("allauth.headless.urls")),
    path("accounts/", include("allauth.socialaccount.providers.github.urls")),
    path("accounts/", include("allauth.socialaccount.providers.weixin.urls")),
    path("api/", ninja_api.urls),
    path("-/", include("django_alive.urls")),
    path("admin/", admin.site.urls),
    path("hijack/", include("hijack.urls")),
    path("500/", http_500),
    path("404/", http_404),
    path("qr/", qr_svg, name="qr-svg"),
    re_path(r"^dashboard/", DashboardSPAView.as_view(), name="dashboard-spa"),
    re_path(r"^h5/", H5SPAView.as_view(), name="h5-spa"),
]
```

- [ ] **Step 4: 重新运行测试，确认根路径和后台静态入口都通过**

Run:

```bash
docker compose exec web pytest tests/base/test_views.py -v
```

Expected: `TestSPAShell` 和 `TestDashboardAndH5Entrypoints` 全部通过。

- [ ] **Step 5: 提交根路径临时页与路由测试**

```bash
git add apps/base/views.py apps/base/templates/root_landing.html config/urls.py tests/base/test_views.py
git commit -m "新增站点根路径临时跳转页"
```


### Task 4: 更新项目文档，让仓库说明与新前端结构一致

**Files:**
- Modify: `README.md`
- Modify: `docs/frontend-structure.md`

- [ ] **Step 1: 更新 `README.md` 的项目定位和本地开发部分**

In `README.md`, replace the frontend-related bullets with:

```md
- 站点根路径 `/` 当前返回一个临时跳转页，后续会替换为正式官网地址
- 管理后台构建产物挂载在 `/dashboard/`
- 小程序 H5 构建产物挂载在 `/h5/`
```

Replace the tech stack frontend bullets with:

```md
- 前端后台：官方 Ant Design Pro，位于 `frontend_admin/`
- 小程序端：`frontend_miniprogram/` 中的 uni-app / unibest 工程
```

Replace the local frontend startup section with:

```md
管理后台是当前唯一的 Web 前端工程。

开发入口：`just admin_dev`

默认开发地址以 `frontend_admin/` 的 dev server 输出为准。
```

- [ ] **Step 2: 更新 `docs/frontend-structure.md`，去掉旧主站 `frontend/` 说明**

Rewrite the opening sections to:

```md
# 前端工程结构

本仓库当前采用“一个 Django 后端 + 两个前端入口”的同仓协作结构。它们共享同一套后端 API、认证体系、组织/权限模型和业务数据，但保持各自独立的依赖管理、构建流程和发布方式。

## 当前入口划分

### `frontend_admin/`

官方 Ant Design Pro 后台工程，构建产物由 Django 挂载到 `/dashboard/`。

- 技术栈：React、Ant Design Pro、pnpm
- 主要承载：后台登录、运营管理、审核类和系统管理类页面
- 开发入口：`just admin_dev`
- 构建入口：`just admin_build`

### `frontend_miniprogram/`

独立的小程序端工程，同时支持微信小程序构建与 H5 构建。
```

Also update the Django relationship bullets to:

```md
- `/` 当前由 Django 直接返回临时跳转页
- `/dashboard/` 由 `frontend_admin/` 构建产物接管
- `/h5/` 由 `frontend_miniprogram/` 的 H5 产物接管
```

- [ ] **Step 3: 运行一次文档与配置 diff 自检，确认不再把旧 Vue 主站写成当前入口**

Run:

```bash
rg -n "frontend/|Vue 3 SPA|bun run dev|web-antdv-next" README.md docs/frontend-structure.md justfile config/base.just
```

Expected: 搜索结果里不再把旧 `frontend/` 或 `web-antdv-next` 作为当前主路径描述；若仍出现引用，只保留历史背景或已失效说明。

- [ ] **Step 4: 提交文档对齐改动**

```bash
git add README.md docs/frontend-structure.md
git commit -m "更新前端结构文档为 Ant Design Pro"
```


### Task 5: 做第一阶段总体验证并整理交付说明

**Files:**
- Verify: `frontend_admin/package.json`
- Verify: `frontend_admin/dist/index.html`
- Verify: `public/static/dist/admin/index.html`
- Verify: `tests/base/test_views.py`

- [ ] **Step 1: 重新构建后台并收集静态文件**

Run:

```bash
just admin_build
test -f public/static/dist/admin/index.html
```

Expected: `just admin_build` 成功，且 Django 静态目录下已有新的后台入口文件。

- [ ] **Step 2: 运行基础 Django 视图测试**

Run:

```bash
docker compose exec web pytest tests/base/test_views.py -v
```

Expected: 根路径临时页、`/dashboard/`、`/h5/` 相关测试全部通过。

- [ ] **Step 3: 手动验证两个入口页面**

Run:

```bash
just admin_dev
```

Then manually verify:

```text
1. 打开 dev server 地址，确认官方 Ant Design Pro 默认页面可见。
2. 启动 Django 后访问 `/`，确认显示“官网即将上线”和“进入后台”。
3. 构建后访问 `/dashboard/`，确认能加载新的后台入口 HTML。
```

- [ ] **Step 4: 提交最终第一阶段集成结果**

```bash
git add justfile config/base.just apps/base/views.py apps/base/templates/root_landing.html config/urls.py tests/base/test_views.py README.md docs/frontend-structure.md
git commit -m "完成 Ant Design Pro 替换第一阶段"
```
