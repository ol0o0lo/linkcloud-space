# 前端工程结构

本仓库不是单一前端工程，而是“一个 Django 后端 + 三个前端入口”的同仓协作结构。它们共享同一套后端 API、认证体系、组织/权限模型和业务数据，但保持各自独立的依赖管理、构建流程和发布方式。

## 当前入口划分

### `frontend/`

主 Web 端 Vue 3 SPA，服务于站点根路径 `/`。

- 技术栈：Vue 3、Vue Router、Tailwind v4、Vite、Bun
- 主要承载：登录注册、账户中心、组织切换、组织设置、通知中心、邀请接受等用户侧页面
- 开发入口：根目录执行 `bun run dev`
- 构建入口：根目录执行 `bun run build`

### `frontend_admin/`

独立的 SaaS 管理后台工程，构建产物由 Django 挂载到 `/dashboard/`。

- 目录内部是自己的 `pnpm workspace`
- 用于承接后台管理、运营配置、审核类和系统管理类页面
- 开发入口：`just admin_dev`
- 构建入口：`just admin_build`

### `frontend_miniprogram/`

独立的小程序端工程，同时支持微信小程序构建与 H5 构建。

- 技术体系：uni-app / unibest
- 构建产物中的 H5 版本由 Django 挂载到 `/h5/`
- 开发入口：`just miniprogram_dev`
- 构建入口：`just miniprogram_build`、`just miniprogram_build_h5`

## 为什么不做顶层前端 monorepo

当前仓库选择“同仓协作、依赖隔离”，而不是把所有前端工程揉成一个顶层 workspace，原因是：

- 主站、后台、小程序的依赖生态和发布节奏并不相同
- 小程序端与 Web/后台端的工程约束差异很大
- 强行统一依赖会增加升级成本和工程耦合
- 当前更稳定的跨端共享对象其实是后端 API、权限枚举和业务状态模型，而不是前端源码本身

## 边界约定

- 不在仓库根目录新增统一管理所有前端依赖的 `pnpm-workspace.yaml`
- 不让 `frontend_admin/`、`frontend_miniprogram/` 共享根目录 `node_modules`
- 不从一个前端工程直接 import 另一个前端工程的源码
- 跨端复用优先通过 API 契约、OpenAPI、类型生成物、枚举和文档完成
- 只有当共享内容已经稳定到可以抽象为“公共产物”时，才考虑拆出单独包

## 与 Django 的关系

- `/` 由 `frontend/` 构建后的主 SPA 接管
- `/dashboard/` 由 `frontend_admin/` 构建产物接管
- `/h5/` 由 `frontend_miniprogram/` 的 H5 产物接管
- Django 负责 API、认证、静态文件收集、部署挂载和多入口路由壳

根目录 `config/base.just` 在 `collectstatic` 时会自动复制：

- `frontend_admin/apps/web-antdv-next/dist` -> `public/static/dist/admin`
- `frontend_miniprogram/dist/build/h5` -> `public/static/dist/h5`

## 当前开发现实

主 Web SPA 虽然仍使用根目录 `package.json` 和 `bun` 维护，但 `compose.yml` 中的 `frontend` 容器当前默认处于注释状态。因此：

- 日常开发主站时，优先直接在宿主机执行 `bun run dev`
- 若要继续走容器化前端构建，需要先恢复或自定义 `frontend` 服务
- `frontend_admin/` 与 `frontend_miniprogram/` 则继续按各自子工程的方式安装和运行依赖

## 适合放在哪个前端

- 面向终端用户的 Web 页面：优先放 `frontend/`
- 面向平台运营、审核、系统管理的页面：优先放 `frontend_admin/`
- 面向微信小程序或移动端 H5 的页面：优先放 `frontend_miniprogram/`

如果某个功能同时涉及这三个入口，应该共享的是后端接口、权限规则和状态定义，而不是直接拷贝或互相引用前端页面实现。
