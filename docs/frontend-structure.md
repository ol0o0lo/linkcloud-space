# 前端工程结构

当前是“一个 Django 后端 + 两个前端入口”，共享同一套 API、认证、组织/权限和业务数据。

## 1. 入口

### `frontend_admin/`

- React + Ant Design Pro + Umi Max + pnpm
- 挂载到 `/dashboard/`
- 用于后台、审核、运营、系统管理

### `frontend_miniprogram/`

- uni-app / unibest
- 微信小程序端
- H5 构建产物挂载到 `/h5/`

## 2. 边界

- 不做顶层前端 monorepo
- 不新增根级 `pnpm-workspace.yaml`
- 两个前端不共享根目录 `node_modules`
- 不互相直接引用源码
- 跨端复用优先通过 API 契约、OpenAPI、类型生成物、枚举和文档

## 3. 与 Django 的关系

- `/`：Django 临时跳转页
- `/dashboard/`：`frontend_admin` 产物
- `/h5/`：`frontend_miniprogram` H5 产物
- Django 负责 API、认证、静态文件收集、部署挂载和多入口路由壳

`collectstatic` 时自动复制：

- `frontend_admin/dist` -> `public/static/dist/admin`
- `frontend_miniprogram/dist/build/h5` -> `public/static/dist/h5`

## 4. 开发入口

- 后台开发：`just admin_dev`
- 后台构建：`just admin_build`
- 小程序开发：`just miniprogram_dev`
- 小程序构建：`just miniprogram_build`
- H5 构建：`just miniprogram_build_h5`

## 5. 放置原则

- 平台运营、审核、系统管理页面：放 `frontend_admin/`
- 小程序或移动端 H5 页面：放 `frontend_miniprogram/`

共享的应是后端接口、权限规则和状态定义，不是前端页面实现。
