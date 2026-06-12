# Ant Design Pro 替换前端方案设计

## 背景

当前仓库同时维护三个前端入口：

- `frontend/`：主站 Vue 3 SPA，挂载在 `/`
- `frontend_admin/`：Vben Admin 后台，挂载在 `/dashboard/`
- `frontend_miniprogram/`：小程序与 H5 端，挂载在 `/h5/`

本次目标不是继续并存迁移，而是直接停止旧 Web 主站和旧 Vben 后台，启用新的 `Ant Design Pro` 作为唯一后台前端。用户已经明确了以下约束：

- 旧 `frontend/` 与旧 `frontend_admin/` 不做物理删除，迁移到 `~/.trash`
- 新前端使用官方 `Ant Design Pro` 脚手架
- 新前端目录直接落在 `frontend_admin/`
- 新前端先接管 `/dashboard/`
- 站点根路径 `/` 先保留一个临时跳转页，未来再替换为官网地址
- 后台有独立登录页，但第一阶段只要求“最小可运行”，暂不接真实 Django 鉴权

## 目标

第一阶段仅完成“新后台壳子替换并可运行”的落地：

1. 旧 `frontend/` 与旧 `frontend_admin/` 安全迁移到 `~/.trash`
2. 在 `frontend_admin/` 生成并启动官方 `Ant Design Pro`
3. Django 继续保留 `/dashboard/` 作为后台入口，并切换为新前端构建产物
4. `/` 改为一个极简的临时跳转页，不再依赖旧 Vue 主站
5. 保持后端 API、认证、RBAC、组织上下文等能力不变，后续由新后台逐步接入

本阶段不包含：

- 接入 Django 真实登录接口
- 迁移任何旧业务页面
- 迁移旧主站用户侧流程
- 调整 `frontend_miniprogram/`

## 方案对比

### 方案 A：直接覆盖替换

先移走旧目录，再把官方脚手架直接放到 `frontend_admin/`，同步修改 Django 和本地命令。

优点：目录结构一步到位，后续所有集成都围绕最终路径进行。

缺点：旧后台无法继续在仓库内原地对照，只能通过 `~/.trash` 回看。

### 方案 B：临时目录验证后回填

先在临时目录初始化 `Ant Design Pro`，验证能启动后再移动到 `frontend_admin/`。

优点：初始化失败时回滚简单。

缺点：会多一次目录挪动，`just`、Django 静态目录和文档需要重复修改。

### 方案 C：先维持旧后台，再并存新后台

旧 `frontend_admin/` 保留，另起新目录逐步迁移。

优点：风险最低。

缺点：与本次“直接停止旧前端并切换到新后台”的目标不一致。

### 结论

采用方案 A。

原因：用户已经明确接受将旧目录迁移到 `~/.trash`，并且第一阶段目标只是让新前端占住正式位置、最小可运行。此时直接在 `frontend_admin/` 落官方脚手架，能够让后续 `/dashboard/` 挂载、`just` 命令和文档都一步对齐最终结构。

## 第一阶段架构设计

### 目录结构

替换后保留的前端入口为：

- `frontend_admin/`：新的官方 `Ant Design Pro` 工程
- `frontend_miniprogram/`：保持不变

旧目录处理方式：

- `frontend/` -> 移动到 `~/.trash`
- 旧 `frontend_admin/` -> 移动到 `~/.trash`

### 路由入口

- `/dashboard/`：继续作为后台入口，由 Django 返回新 `frontend_admin/` 的构建产物
- `/`：改为一个服务端渲染的极简跳转页或提示页
- `/h5/`：保持不变

第一阶段不要求 Django 在开发模式下反向代理前端 dev server。开发时允许：

- Django 独立运行后端
- `frontend_admin/` 独立运行 `Ant Design Pro` dev server

生产或本地构建验证时，再由 Django 提供 `/dashboard/` 的静态入口。

### 登录与鉴权边界

后台最终会有自己的登录页，但第一阶段只要求脚手架默认登录页和基础布局可运行。

因此第一阶段：

- 可以保留 `Ant Design Pro` 默认登录路由与默认假数据能力
- 不接 `/_allauth/`、`/api/`、当前用户接口
- 不做基于 Django Session 的登录态校验

这样做的目的，是先确认新工程在仓库中的启动、构建、静态挂载链路成立，再进入第二阶段真实鉴权接入。

## Django 与构建集成设计

### Django 根路径 `/`

当前根路径依赖旧 Vue SPA。替换后需要新增一个独立、极简的服务端页面来承接 `/`，页面职责仅限于：

- 显示“站点升级中”或“官网即将上线”的提示
- 提供一个前往 `/dashboard/` 的入口
- 未来可无缝替换为跳转到正式官网地址

该页面不需要单独的前端构建流程，优先采用 Django 模板或现有服务端 view 直接返回 HTML。

### `/dashboard/` 静态挂载

`/dashboard/` 仍由 Django SPA 壳视图返回构建后的后台入口 HTML。需要将现有构建产物来源从旧 Vben 目录切换到新 `Ant Design Pro` 的 `dist` 目录。

设计要求：

- 尽量复用现有后台 SPA 壳视图命名和 URL 位置
- 只修改其读取的静态产物来源，不额外新增 `/dashboard-next/`
- 让 `collectstatic` 继续承担后台构建结果拷贝职责

### `just` 命令

需要把当前偏向 Vben 的命令切换为新工程：

- `just admin_dev`：改为进入新的 `frontend_admin/` 并运行官方 dev 命令
- `just admin_build`：改为构建新的 `frontend_admin/`，再执行 `collectstatic`

如官方脚手架生成的命令名与项目习惯不同，可以在 `just` 层做适配，尽量保持仓库对外命令稳定。

## 迁移边界与后续阶段

第一阶段完成后，仓库状态应当是：

- 新后台已经接管正式目录与正式入口
- 旧前端代码已安全移出工作区
- Django 后端仍完整保留原有 API 与业务能力
- 仓库进入“从旧前端代码库向新后台手工迁移业务”的阶段

后续阶段建议拆分为两个独立子项目：

### 第二阶段：真实鉴权接入

- 将新后台登录页对接 Django 登录接口
- 打通当前用户、退出登录、最小后台首页
- 去掉默认假数据与演示态

### 第三阶段：业务页面迁移

- 先迁 1 个 CRUD 页面
- 再迁 1 个权限相关页面
- 逐步沉淀新的请求层、菜单模型、权限模型和页面模板

## 风险与应对

### 风险 1：旧前端移走后，根路径 `/` 暂时失去真实业务能力

这是本次策略的已知结果，不是事故。通过保留一个极简跳转页，可以让系统在替换期仍有明确落点。

### 风险 2：旧后台业务代码不再位于仓库工作区，迁移时查阅不便

通过将旧目录迁移到 `~/.trash` 而不是删除，可以在需要时人工恢复或只读查阅。若后续迁移周期较长，可再追加“旧后台只读备份分支”作为辅助措施。

### 风险 3：官方脚手架与当前 Django 静态挂载方式不完全一致

第一阶段只要求本地独立启动与构建链路成立，因此优先验证 dev server 和 build 产物，再最小化调整 Django 静态入口，而不是提前绑定真实 API 与复杂路由。

## 验收标准

第一阶段完成后，应满足以下条件：

1. 旧 `frontend/` 与旧 `frontend_admin/` 已移动到 `~/.trash`
2. 新的官方 `Ant Design Pro` 已落在 `frontend_admin/`
3. 在 `frontend_admin/` 内可以完成依赖安装并启动 dev server
4. Django 项目仍可正常启动
5. 访问 `/dashboard/` 时可加载新后台构建产物
6. 访问 `/` 时可看到临时跳转页
7. 仓库命令和文档已不再引用旧 Vue 主站和旧 Vben 后台作为当前主路径

## 涉及改动范围

本阶段预期会触及以下类型的文件或目录：

- 目录迁移：`frontend/`、旧 `frontend_admin/`
- 新建工程：新的 `frontend_admin/`
- Django URL 与视图：根路径 `/` 的占位页、`/dashboard/` 静态入口
- 构建与命令：`justfile`、`config/base.just`
- 文档：`README.md`、`docs/frontend-structure.md`

具体文件级实现将在 implementation plan 中展开。
