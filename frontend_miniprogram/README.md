# 链云空间移动端

`frontend_miniprogram/` 是链云空间面向微信小程序与 H5 的统一客户端，基于 uni-app、Vue 3、TypeScript、Pinia、Wot UI v2 和 UnoCSS。

当前正式支持：

- 微信小程序
- H5（由 Django `/h5/` 提供生产入口）

未来扩展 App 时，应新增 `src/platform/app/` 适配器和对应编译依赖，不在业务页面中散落平台条件分支。

## 环境要求

- Node.js 22
- pnpm 10
- 本地 Django API 默认运行在 `http://localhost:18000`

```bash
source /Users/lan/.nvm/nvm.sh
nvm use 22
pnpm install
```

## 常用命令

```bash
pnpm dev:h5          # H5 开发服务
pnpm dev:mp          # 微信小程序开发构建
pnpm build:h5:prod   # H5 生产构建
pnpm build:mp:prod   # 微信小程序生产构建
pnpm openapi         # 重新生成 OpenAPI 客户端
pnpm verify          # 完整质量门禁
```

兼容项目根目录的 Just 命令，保留了 `dev:mp-weixin` 与 `build:mp-weixin` 别名。

## 架构边界

- `src/app/`：应用 Provider、启动边界和全局装配。
- `src/core/`：配置、错误、生命周期等与框架弱耦合的核心能力。
- `src/platform/`：H5、微信的平台能力适配。
- `src/infra/`：HTTP、认证、持久化、上传和埋点基础设施。
- `src/domain/`：纯 TypeScript 领域结构与规则。
- `src/modules/`：导航、路由、TabBar、分包和平台支持的唯一模块目录。
- `src/features/`：按业务能力组织的页面逻辑与组件。
- `src/pages*/`：uni-app 路由入口，只负责页面元数据和 feature 组合。
- `src/shared/`：主题、通用组件和组合函数。
- `src/services/openapi/`：生成代码，禁止手工修改。

业务页面和 feature 不应直接调用 `uni.request`、`uni.uploadFile`、`uni.login`，也不应直接依赖 OpenAPI 生成目录；统一通过平台层、基础设施或手写 service 访问。

## API 配置

H5 生产环境默认使用同源 `/api`。微信小程序必须按 `envVersion` 配置绝对 API 地址：

```dotenv
VITE_API_BASE_URL__WEIXIN_DEVELOP='http://localhost:18000'
VITE_API_BASE_URL__WEIXIN_TRIAL='https://trial-api.example.com'
VITE_API_BASE_URL__WEIXIN_RELEASE='https://api.example.com'
```

微信体验版与正式版必须使用已加入小程序合法域名的 HTTPS 地址。仓库不提供虚假默认生产域名，未配置时应用会在启动阶段明确失败。

## 构建产物

- H5：`dist/build/h5`
- 微信小程序：`dist/build/mp-weixin`

H5 产物由项目 `collectstatic` 流程复制到 `public/static/dist/h5`。
