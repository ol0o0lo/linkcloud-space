# AGENTS.md

本文档是 `frontend_admin/` 子目录的补充说明；根目录 `AGENTS.md` 仍然适用。

## 必须遵守

- 永远用中文回答。
- 先执行 `nvm use 22`，再运行本目录下任何 Node / npm 命令。
- 管理端使用 npm 和 `package-lock.json`；不要改用 pnpm / yarn。
- 不要手改生成代码。`src/services/openapi` 和 `src/services/allauth` 只能通过 `npm run openapi` 重新生成。
- `npm run simple` 是模板清理脚本，有破坏性；除非用户明确要求，否则不要运行。
- 新增页面、明显改造布局或视觉样式前，必须先阅读 `docs/design-system.md`；其中 `【强制】` 必须遵守，`【当前实现】` 仅作为事实依据，`【建议】` 是没有更具体规则时的默认做法。

## 项目事实

- 管理端是 React 19 + Umi Max 4 + Ant Design 6 + ProComponents 3。
- 应用部署在 Django 的 `/dashboard/` 下；Umi `base` 为 `/dashboard/`，生产 `publicPath` 为 `/public/static/dist/admin/`。
- 源码主目录是 `src/`；入口和运行时配置在 `src/app.tsx`，路由在 `config/routes.ts`，Umi 配置在 `config/config.ts`。
- `cloudflare-worker/` 是独立 Hono / Wrangler 小项目，有自己的 `package.json`，不要当成主应用 workspace。

## 常用命令

- `npm run dev`：本地开发，端口 8080，`MOCK=none`。
- `npm run build`：构建管理端资源到 `dist/`。
- `npm run lint`：运行 Biome lint + TypeScript 检查。
- `npm run biome`：Biome 自动修复。
- `npm run tsc`：只运行 TypeScript 检查。
- `npm run test`：运行 Vitest。
- `npm exec -- vitest run <path>`：运行单个或少量测试文件。
- `npm run openapi`：重新生成 `src/services/openapi` 和 `src/services/allauth`。
- `npm exec -- antd lint ./src`：Ant Design 用法检查。

## Ant Design

- 项目级 `.codex/config.toml` 已配置 antd MCP；写 antd / ProComponents 代码前优先用 MCP 查组件信息。
- 需要命令行查询时用 `npm exec -- antd info <Component>`；不要凭记忆猜 props。
- 尽量复用 antd / ProComponents / Umi Max 能力，不重复造表格、表单、弹窗、请求状态。

## 结构约定

- `config/routes.ts`：声明式路由；`name` 对应 `src/locales/*/menu.ts` 中的 `menu.xxx`。
- `src/app.tsx`：`getInitialState()` 拉取当前用户和组织列表，非认证页未登录时跳到 `/user/login?redirect=...`。
- `src/access.ts`：权限判断。
- `src/requestErrorConfig.ts`：统一 request 行为，处理 `{ code, data, ... }` envelope、CSRF、`X-Org-Slug`、401 跳转。
- `src/utils/adminRouting.ts`：管理端路径常量和 `/dashboard` base 归一化。
- 页面代码放在 `src/pages/<domain>/<page>/`，测试尽量和页面靠近，页面私有请求可放同目录 `service.ts`。
- 手写跨页面服务放 `src/services/manual`；生成服务放 `src/services/openapi` 或 `src/services/allauth`。

## 认证现状

- 当前登录页路由是 `/user/login`，注册页路由是 `/user/register`，应用外部访问时挂在 `/dashboard/` 下。
- 登录页已接 allauth browser API，支持账号密码、MFA 继续流程等。
- 当前注册页仍是 Ant Design Pro 模板式 `/api/register` 流程；接真实注册时优先复用 allauth / 后端薄包装接口，并把兼容逻辑收敛到 `src/services/manual`。
- 改认证前同时检查后端 `HEADLESS_FRONTEND_URLS`、`SPA_URLS`、`config/routes.ts` 和 `src/utils/adminRouting.ts`。

## 样式与 UI

- 样式优先级：Tailwind CSS v4（布局）→ antd-style `createStyles`（主题 token）→ CSS Modules（局部样式）→ Less（遗留才用）。
- 不新增无必要自定义 CSS；优先用 antd 组件状态、表单校验、ProTable request、ProForm。
- 图标优先用 `@ant-design/icons`。

## 测试

- 测试框架是 Vitest + Testing Library。
- 新增交互逻辑时补最小可运行测试；优先测用户可见行为和请求参数。
- 提交前按改动范围运行 `npm run lint`、相关 `npm exec -- vitest run <path>`，必要时再跑 `npm run test`。
