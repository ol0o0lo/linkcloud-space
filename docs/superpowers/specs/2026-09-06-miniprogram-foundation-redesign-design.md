# 小程序工程底座成熟化重构设计

## 1. 文档定位

本文定义 `frontend_miniprogram/` 从当前“可运行产品外壳”收口为项目专用、可长期演进的跨端工程底座的目标架构。

本设计建立在以下现有产品与契约文档之上，不重新定义租客、房东和组织管理业务边界：

- [小程序完整产品外壳与公开找房链路设计](./2026-09-05-miniprogram-product-shell-public-house-design.md)
- [小程序上下文与 API 契约](../../miniprogram-context-api-contract.md)
- [小程序三端能力矩阵](../../miniprogram-capability-matrix.md)

前一份产品外壳设计解决“先形成真实业务闭环”的问题；本文解决“底座是否足够统一、成熟、可验证和可扩展”的问题。若工程组织方式发生冲突，以本文为准；业务角色、数据归属和后端权限事实仍以上述契约文档为准。

## 2. 背景与现状

当前小程序端已经具备以下真实能力：

- uni-app、Vue 3、TypeScript、Vite、Pinia、Wot UI v2 和 UnoCSS；
- H5 与微信小程序构建入口；
- allauth app 会话、微信登录、手机号验证码登录和邮箱密码登录；
- 游客、个人、房东和组织模式识别；
- `X-Session-Token` 与 `X-Org-Slug` 请求上下文；
- 固定五槽位自定义 TabBar、路由拦截和业务分包；
- OpenAPI 生成客户端；
- 公开房源、详情、筛选、收藏和埋点链路；
- 基础领域测试和类型检查。

当前工程仍然保留较多模板时代的平行实现和不完整边界：

- `app-context` Store 同时承担启动、用户、工作空间、能力和导航派生；
- 模块注册、TabBar profile、路由和分包由多个清单分别维护；
- 活跃请求链路之外仍保留 alova、旧 token/user Store、模板 API 和重复上传工具；
- 页面可以直接导入 OpenAPI 生成代码，请求作用域依赖调用者自觉；
- 网络错误、权限错误和业务错误没有统一稳定的领域错误类型；
- Wot UI 主题未通过根级 Provider 和语义变量统一；
- 工程元数据、README、脚本、平台依赖和 lint 范围仍带有 unibest 模板痕迹；
- 全目录 lint、双端生产构建和持续质量门禁尚未形成一个统一入口。

## 3. 已确认决策

- 当前正式支持微信小程序和 H5。
- 现阶段不宣称支持 App、支付宝、抖音或其他小程序平台。
- 保留扩展到 App 等平台的架构路径，但不为未来平台长期携带当前未使用依赖和条件分支。
- 本次允许重构 `frontend_miniprogram/` 的目录、状态、请求、认证、上传、主题、导航和构建配置。
- 现有 Django API 契约默认保持不变；发现确有价值的契约优化时，先单独征询意见。
- 现有公开找房、登录、收藏和模式切换行为需要迁移到新底座，不以重构为理由降低现有能力。
- 不新增房东、组织、消息等业务功能；这些模块只获得更稳定的后续接入边界。
- 不操作 Git，不提交、不暂存、不创建分支。
- 清理无引用模板文件时不执行物理删除；先移动到带时间戳的本地备份目录，确保可恢复。

## 4. 目标与非目标

### 4.1 目标

1. 建立唯一的运行时启动与状态恢复模型。
2. 建立唯一的认证、请求、上传、错误和持久化实现。
3. 建立一个模块注册表作为导航、路由、TabBar、分包、权限和平台支持的事实来源。
4. 让业务模块不直接依赖 uni-app 平台细节和 OpenAPI 生成文件。
5. 建立项目级 Wot UI 主题和稳定公共页面状态组件。
6. 只保留当前 H5、微信小程序运行依赖，同时让未来 App 通过新增适配器接入。
7. 让全量 lint、类型检查、测试和双端构建通过统一质量命令执行。
8. 用目录边界和静态规则阻止工程重新出现第二套请求、认证和导航体系。

### 4.2 非目标

- 不重新设计租客、房东和组织的产品职责。
- 不在本次实现新的业务分包页面。
- 不新增重量级状态管理、请求缓存或微前端框架。
- 不为了抽象而实现运行时插件市场、远程模块或通用 IOC 容器。
- 不在没有真实需求时实现 App 平台代码、支付渠道和兼容补丁。
- 不修改 OpenAPI 生成文件内容。

## 5. 目标目录结构

```text
frontend_miniprogram/src/
├── app/
│   ├── AppProviders.vue
│   ├── AppStartupBoundary.vue
│   └── bootstrap.ts
├── core/
│   ├── config/
│   ├── errors/
│   ├── lifecycle/
│   └── logging/
├── platform/
│   ├── contracts/
│   ├── h5/
│   ├── weixin/
│   └── index.ts
├── infra/
│   ├── analytics/
│   ├── auth/
│   ├── http/
│   ├── storage/
│   └── upload/
├── domain/
├── modules/
├── shared/
│   ├── components/
│   ├── composables/
│   ├── theme/
│   └── utils/
├── features/
│   ├── auth/
│   ├── favorites/
│   ├── houses/
│   └── me/
├── pages/           主包路由入口，仅组合 feature view 和页面元数据
├── pages-housing/   已启用业务分包路由入口
└── services/
    ├── manual/
    └── openapi/
```

目录表达依赖方向，而不是把所有代码机械搬家。uni-app 的 `pages/` 和各业务分包目录继续作为构建可识别的路由入口，页面入口保持薄层，只声明页面元数据并组合对应 feature view。迁移过程中优先移动已形成稳定职责的代码；过小且只被一个 feature 使用的模块留在 feature 内，不为追求目录完整度创建空文件。

## 6. 依赖规则

允许的主要依赖方向：

```text
app
  -> modules / features / shared / infra / platform / core

features
  -> domain / shared / infra public API / feature service

modules
  -> domain / core config

infra
  -> platform contracts / core / generated services

platform implementations
  -> platform contracts / core

domain
  -> no Vue / Pinia / uni-app / Wot UI dependency
```

强制约束：

- `features/**` 禁止直接调用 `uni.request`、`uni.uploadFile`、`uni.login` 和平台支付 API。
- `features/**` 和页面禁止直接导入 `services/openapi/**`。
- OpenAPI 生成代码只能由 `infra` 或对应 feature service 的适配器访问。
- `domain/**` 只包含纯 TypeScript 数据结构和规则。
- `platform/**` 不读取房源、组织、租约等具体业务状态。
- feature 之间不得通过内部文件互相调用；确需复用时通过公开出口或下沉为明确的 domain/shared 能力。
- `shared/**` 不反向依赖具体 feature。

以上边界通过 ESLint `no-restricted-imports`、目录公开出口和架构测试共同保护。

## 7. 应用启动与状态边界

### 7.1 Store 拆分

全局状态拆成三个职责明确的 Store：

#### `runtimeStore`

- 当前启动状态；
- 公开应用配置；
- 当前平台与能力；
- 可恢复和不可恢复启动错误；
- 触发应用 bootstrap 和重试。

#### `sessionStore`

- 当前 allauth session token；
- 登录流程 token；
- 会话校验、登录和退出命令；
- 会话失效事件；
- 登录后一次性待执行动作。

#### `workspaceStore`

- 当前用户；
- 可用组织和房东关系；
- 当前选择模式与上下文键；
- 当前组织导航能力；
- 模式恢复、模式切换和上下文刷新。

导航清单不作为第四份可变状态保存，而是从模块注册表、当前模式、认证状态和能力实时派生。

### 7.2 启动状态机

```text
idle -> loading -> ready
                -> recoverable-error
                -> fatal-error
```

- 没有会话：进入游客模式并完成启动。
- 会话返回 `401/410`：清除失效会话，进入游客模式，不显示启动错误。
- 会话有效但用户/组织上下文暂时加载失败：进入 `recoverable-error`，保留会话并允许重试。
- 公开配置、环境配置或服务完全不可用：进入 `fatal-error`。
- bootstrap 同一时间只能运行一个任务；重复生命周期事件复用进行中的 Promise。
- 从后台回到前台时执行轻量刷新，不默认重复完整 bootstrap；只有会话、账号或模式发生变化时重新加载完整上下文。

### 7.3 持久化

只持久化：

- session token；
- 上次选择的业务模式；
- 上次组织 slug 或房东关系 ID；
- 一次性待执行动作。

持久化记录包含 schema version。读取时经过迁移函数，无法迁移的数据安全回退为默认状态，不让旧缓存导致白屏。

微信小程序使用平台持久存储；H5 的会话 token 默认使用 `sessionStorage`。模式选择可以使用持久存储，但不得包含权限快照和业务列表数据。

## 8. 平台适配层

### 8.1 设计原则

业务代码依赖稳定的平台契约，不直接散落条件编译。条件编译集中在平台选择器和少量平台实现入口。

当前实现：

- `platform/h5`
- `platform/weixin`

未来增加 App 时新增 `platform/app` 并在平台选择器注册，不修改现有 feature 页面。

### 8.2 平台契约

平台层至少提供：

- `storage`：读取、写入、移除和命名空间管理；
- `auth`：获取当前平台登录凭证；
- `share`：注册或执行平台分享；
- `payment`：执行支付或返回明确的不支持结果；
- `filePicker`：选择图片或文件；
- `network`：读取网络状态和订阅变化；
- `lifecycle`：前后台与页面可见性事件。

平台不支持某能力时返回结构化 `unsupported` 结果，不通过空函数、假成功或运行时未定义表达。

## 9. 认证设计

### 9.1 统一认证入口

保留 allauth app API 作为唯一认证后端。旧模板单 token、双 token、刷新 token 和模板 `/auth/login` 链路退出活跃代码。

认证模块负责：

- 微信登录凭证换取 allauth session；
- H5 手机验证码流程；
- H5 邮箱密码流程；
- session 校验与退出；
- allauth 错误数组、字段错误和后续 flow 解析；
- 保存 `meta.session_token`；
- 通知 runtime/workspace 刷新上下文。

### 9.2 登录结果

认证命令返回稳定结果：

```ts
type AuthResult =
  | { status: 'authenticated' }
  | { status: 'code-required'; flowToken: string }
  | { status: 'verification-required'; flow: string }
  | { status: 'mfa-required'; methods: string[] }
```

本次不实现完整 MFA 页面，但必须正确识别并明确提示，不把需要后续验证的响应误判为登录成功。若后端当前响应不足以稳定区分 flow，再单独提出契约调整建议。

### 9.3 待执行动作

待执行动作从写死的收藏类型调整为注册机制：

```ts
type PendingAction = {
  type: string
  payload: unknown
  redirect: string
  createdAt: number
  version: number
}
```

每种动作由 feature 注册校验和执行函数。动作有有效期、最多消费一次；无法识别的旧版本动作直接丢弃，不执行不可信载荷。

## 10. 请求与错误体系

### 10.1 唯一请求客户端

活跃业务只保留一个请求实现。OpenAPI 的 request adapter、手写 API 和上传复用相同的配置、会话与错误规则。

请求职责：

- 解析 H5 和微信环境下的 API base URL；
- 防止重复拼接代理前缀；
- 根据请求作用域添加认证和组织上下文；
- 解析 Django Ninja 成功信封；
- 处理超时、取消和请求任务；
- 将错误转换为 `AppError`；
- 广播会话失效事件。

请求客户端不直接显示 Toast，不直接执行页面导航。

### 10.2 请求作用域

继续采用显式作用域：

```ts
type RequestScope =
  | { kind: 'public' }
  | { kind: 'personal' }
  | { kind: 'landlord'; landlordContactId: number }
  | { kind: 'organization'; organizationSlug: string }
```

不变量：

- `public` 可以携带 session token，但禁止组织头；
- `personal` 必须登录，禁止组织头；
- `landlord` 必须登录，组织由后端根据关系推导，禁止组织头；
- `organization` 必须登录且必须具有 organization slug；
- 业务 service 必须明确选择作用域，不根据当前页面默默猜测。

### 10.3 错误模型

```ts
type AppErrorKind =
  | 'network'
  | 'timeout'
  | 'cancelled'
  | 'unauthenticated'
  | 'forbidden'
  | 'not-found'
  | 'validation'
  | 'conflict'
  | 'business'
  | 'unexpected'
```

`AppError` 包含用户可读消息、HTTP 状态、后端业务码、字段错误、是否可重试和原始原因。生产环境不向界面暴露内部堆栈、权限键和请求凭证。

### 10.4 通用请求状态

不引入新的重量级请求库。提供两个组合函数：

- `useAsyncTask`：加载、错误、取消、重试和只接收最后一次结果；
- `usePagedQuery`：分页、刷新、追加、筛选重置、重复请求保护和旧响应淘汰。

服务端数据默认留在 feature 页面或组合函数中；用户、工作空间和会话等真正全局数据才进入 Store。

## 11. 模块注册、路由与分包

### 11.1 单一注册结构

```ts
interface AppModuleDefinition {
  key: string
  title: string
  status: 'active' | 'planned' | 'development'
  modes: AppMode[]
  platforms: AppPlatform[]
  tabSlot?: TabbarSlot
  mainRoute: string
  routePrefixes: string[]
  subpackage?: SubpackageDefinition
  requiresAuth: boolean
  capabilities?: string[]
  order: number
}
```

模块注册表统一驱动：

- 当前模式 TabBar profile；
- 首页和业务中心入口；
- 路由归属和访问决策；
- 业务能力过滤；
- 分包源目录和生产构建清单；
- 当前平台是否支持；
- active/planned/development 状态。

固定五个微信 TabBar 槽位仍然存在，这是微信构建限制；槽位的标题、图标、可见性和业务语义从注册表派生，不再维护另一份独立 profile 事实。

### 11.2 路由决策

路由守卫只返回决策，不直接混合多次导航：

```ts
type RouteDecision =
  | { kind: 'allow' }
  | { kind: 'login'; redirect: string }
  | { kind: 'forbidden' }
  | { kind: 'not-found' }
  | { kind: 'fallback'; route: string }
```

统一导航协调器根据决策调用 `navigateTo`、`switchTab`、`redirectTo` 或 `reLaunch`。H5 router 守卫和 uni API 拦截器共同使用同一个纯决策函数。

### 11.3 构建状态

- `active` 模块进入生产构建；
- `planned` 只保留元数据，不生成空分包和可导航路由；
- `development` 仅进入明确的开发构建；
- 模板和 demo 页面不进入产品构建；
- 生成的 `pages.json` 必须经过确定性测试，避免跨平台增量构建残留旧分包。

## 12. 公共 UI 与主题

### 12.1 根级 Provider

应用根节点统一挂载 Wot UI `ConfigProvider` 及必要的反馈组件实例。主题优先通过组件库变量和 CSS 变量实现，不深度覆盖内部类名。

### 12.2 语义主题

主题至少定义：

- 品牌、成功、警告、危险和信息色；
- 页面、卡片、浮层和遮罩背景；
- 主文字、次文字、弱文字和禁用文字；
- 边框、分割线和焦点状态；
- 字号、行高、圆角、间距和阴影；
- 安全区、TabBar、底部操作栏和页面水平留白。

活跃业务页面不得继续散落品牌色十六进制值。业务特有视觉可以使用 feature token，但必须建立在全局语义 token 上。

### 12.3 公共组件

只建立重复、稳定且无业务归属的组件：

- `AppPage`：统一页面背景、安全区和底部留白；
- `AppLoading`：页面级和局部加载状态；
- `AppEmpty`：空业务状态及可选动作；
- `AppError`：结构化错误展示与重试；
- `AppStartupBoundary`：启动状态切换；
- `AppListState`：列表加载、空、失败和到底状态；
- `AppBottomAction`：安全区底部操作栏；
- `AppModeSwitcher`：身份与工作空间切换。

`HouseCard` 等业务组件迁入对应 feature，不放入全局 shared。

## 13. 上传与文件能力

现有两套上传工具退出活跃代码，由唯一上传模块统一：

1. 通过平台 `filePicker` 选择文件；
2. 校验类型、数量和大小；
3. 通过统一上传客户端添加会话和作用域；
4. 提供进度、取消和错误归一化；
5. 解析项目媒体 API 的统一信封；
6. 返回 OpenAPI `MediaFileOut` 或明确业务类型。

上传地址不能再使用模板 `/upload` 或 `/user/avatar`。优先使用当前 `/api/media/upload/`；若后续需要 OSS 直传，由新的上传策略接口承载，不在页面判断上传后端。

## 14. 环境、构建与依赖

### 14.1 环境配置

建立单一 `appConfig` 解析器，对环境变量做类型化读取和启动/构建期校验：

- 应用标题；
- API base URL；
- API 使用同源相对地址还是绝对地址；
- H5 public base；
- H5 proxy 设置；
- 微信 AppID；
- 当前环境标识；
- 日志级别和是否移除调试输出。

生产配置必须显式声明 API 地址模式：H5 可以选择同源相对 `/api`，也可以提供绝对地址；微信 develop/trial/release 必须解析得到合法的绝对 HTTPS 地址，本地开发例外。禁止用未声明的空字符串同时表达“同源”和“漏配”。

### 14.2 当前平台依赖

依赖只保留 H5、微信小程序以及跨平台核心所需包。支付宝、抖音、百度、快应用、Harmony 和原生 App 的当前编译依赖退出活跃依赖清单。

未来增加 App 时按平台适配文档安装对应 uni-app 编译包，并实现 `platform/app`，而不是提前维护未验证依赖。

### 14.3 工程脚本

- 包名、描述和 README 改为链云空间项目语义；
- `prepare` 不再执行 `git init`；
- 移除不会生效的 `vite.config.js` 重启监听；
- Wot UI 使用明确版本，不使用 `latest`；
- OpenAPI、lint、type-check、test、H5 build、微信 build 形成清晰脚本；
- 增加统一 `verify` 脚本，不隐藏失败、不自动修改文件。

## 15. 模板与旧实现迁移

迁移遵循“先替换引用，再验证，再退出构建”的顺序：

1. 建立新 core/platform/infra/shared 边界；
2. 迁移现有公开找房、登录、收藏和工作空间能力；
3. 使用静态搜索确认旧实现无活跃引用；
4. 从 Store 出口、Vite 扫描、页面生成、TypeScript 和 ESLint 中移除旧路径；
5. 将确认无引用的模板文件移动到项目外的时间戳备份目录；
6. 从 `package.json` 移除仅由旧实现使用的依赖并同步锁文件；
7. 完成全量验证后保留备份位置记录。

重点退出项：

- 旧 `token` / `user` Store；
- `src/api` 模板认证和示例；
- alova 请求实现与示例；
- `src/service` 模板生成示例；
- 两套模板上传工具；
- demo 页面和未使用图表运行依赖；
- 未支持平台的当前编译配置与依赖；
- 通用 unibest README、包信息和无效脚本。

## 16. 测试与质量门禁

### 16.1 测试层次

#### 纯领域测试

- 模式恢复与失效回退；
- 模块过滤与默认入口；
- 路由决策；
- 请求作用域到请求头映射；
- 错误归一化；
- 持久化 schema 迁移；
- 待执行动作版本、有效期和一次性消费；
- 房源查询归一化及户型展示规则。

#### 基础设施测试

- H5 与微信 storage 行为；
- API URL 和代理前缀解析；
- session 失效事件；
- 请求取消和旧响应淘汰；
- 上传校验与错误映射；
- 生产配置缺失时失败。

#### 构建验证

- H5 生产构建；
- 微信小程序生产构建；
- 生产 `pages.json` 不包含 demo、planned 分包和旧模板页；
- Wot UI 组件解析和样式进入双端产物。

#### 交互验收

- H5 启动、公开找房、详情、登录、收藏和模式切换；
- 微信开发者工具启动、微信登录、房源详情分享和收藏恢复；
- 网络失败、会话失效、无权限和内容不存在状态。

### 16.2 统一命令

`pnpm verify` 按确定顺序执行：

1. `pnpm lint`
2. `pnpm type-check`
3. `pnpm test`
4. `pnpm build:h5:prod`
5. `pnpm build:mp:prod`

开发者可以单独执行每项，但完成声明必须基于统一命令的最新结果。微信环境登录和真机能力单独记录，不以构建成功替代运行验证。

## 17. 后端契约优化边界

本次默认不修改后端。实施中若遇到以下情况，需要先向用户提出独立建议并获得确认：

- allauth 响应无法稳定区分 MFA、额外验证和登录成功；
- 多个启动接口造成已测量的明显延迟或一致性问题，需要聚合 bootstrap 读取接口；
- 上传 API 无法表达移动端所需进度、直传或媒体登记结果；
- 移动端业务必须重复拼接网页端专用响应才能使用；
- 当前权限能力接口无法表达真实模块可见性。

不得仅为了让前端代码更短而修改后端契约。

## 18. 风险与控制

### 18.1 大范围迁移风险

通过垂直切片迁移控制风险：先迁移启动和 HTTP，再迁移认证与工作空间，最后迁移页面、主题和构建。任何阶段都必须保持公开找房主链路可运行。

### 18.2 跨端差异风险

平台差异只在适配层处理；H5 验证不能替代微信验证。每个使用微信专有能力的 feature 都必须有明确的平台能力判断。

### 18.3 过度抽象风险

只为当前真实存在的 storage、auth、share、payment、filePicker、network 和 lifecycle 建立平台契约。未来平台未提出的能力不提前建模。

### 18.4 生成代码漂移风险

OpenAPI 生成目录继续由工具拥有。手写适配器对外暴露稳定业务接口，生成代码变化只影响适配层和类型检查。

## 19. 完成标准

满足以下条件才视为底座成熟化完成：

- 活跃源码只有一套 allauth 会话体系；
- 活跃源码只有一个 HTTP 客户端和一个上传实现；
- 页面不直接调用 OpenAPI 生成代码和底层平台网络 API；
- 模块注册表统一驱动 TabBar、路由、权限、分包和平台支持；
- runtime、session、workspace 状态职责清晰且持久化可迁移；
- H5 与微信实现通过同一平台契约供业务调用；
- Wot UI 根级 Provider、语义主题和公共页面状态组件投入使用；
- 未支持平台和模板实现不参与依赖安装、扫描和生产构建；
- 生产配置缺失时能够尽早失败；
- 全目录 lint、类型检查、测试、H5 生产构建和微信生产构建全部通过；
- H5 关键链路完成浏览器验收；
- 微信专有能力完成开发者工具验收，未验证项目明确标注；
- 没有通过新增大框架或泛化插件系统换取表面上的“成熟”。
