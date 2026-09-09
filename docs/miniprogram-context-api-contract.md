# 小程序上下文与 API 契约

## 1. 文档定位

本文定义 `frontend_miniprogram/` 在游客、租客、房东和组织管理模式下如何解析上下文、选择请求作用域、生成导航和隔离数据。

本文是前后端协作契约，不代表所有列出的个人或房东业务接口当前都已经存在。现有接口与规划接口会明确区分。

相关文档：

- [小程序三端能力矩阵](./miniprogram-capability-matrix.md)
- [小程序完整产品外壳与公开找房链路设计](./superpowers/specs/2026-09-05-miniprogram-product-shell-public-house-design.md)
- [前端工程结构](./frontend-structure.md)

## 2. 上下文类型

应用只向业务页面暴露一个小接口，隐藏登录恢复、关系校验、组织能力加载和模式回退的实现细节。

```ts
type AppMode =
  | 'visitor'
  | 'personal'
  | 'landlord'
  | 'organization'

type AppContext =
  | { mode: 'visitor' }
  | { mode: 'personal'; userId: number }
  | {
      mode: 'landlord'
      userId: number
      landlordContactId: number
    }
  | {
      mode: 'organization'
      userId: number
      organizationSlug: string
    }
```

约束：

- `landlordContactId` 是当前房东账号关系的上下文键，对应已绑定平台用户的组织内房东联系人，不等同于组织 ID。
- 房东上下文不向普通业务请求暴露可任意替换的组织 slug。
- 只有组织管理模式包含 `organizationSlug`。
- `userId` 只用于前端状态一致性，后端始终从认证会话确定用户。

## 3. 启动上下文来源

第一阶段不要求新增统一后端启动接口，继续组合已有接口：

1. `/api/app-context/`：公开站点配置；
2. `/api/allauth/app/v1/auth/session`：allauth app 会话；
3. `/api/users/me/`：当前用户；
4. `/api/organizations/switch-list/`：当前用户可进入的组织；
5. `/api/house/landlord/relationships/`：当前用户有效房东关系；
6. `/api/access/navigation/`：当前组织的导航能力。

后续只有在启动请求数量、延迟或一致性成为实际问题时，才考虑增加统一 bootstrap 读取接口。统一接口只是聚合优化，不能成为新的权限事实来源。

## 4. 启动状态

```ts
type BootstrapState =
  | 'booting'
  | 'anonymous'
  | 'authenticated'
  | 'ready'
  | 'failed'
```

恢复顺序：

1. 识别当前入口是否为公开深链；
2. 读取本地会话 Token、上次模式和上次选择；
3. 校验会话；
4. 会话有效时并行读取用户、组织列表和房东关系列表；
5. 校验上次模式与上下文是否仍然有效；
6. 组织模式下加载组织导航能力；
7. 根据当前模式选择 TabBar profile，再根据模块注册表生成槽位内业务入口；
8. 恢复目标路由和一次性待执行动作。

回退规则：

- 无会话进入 `visitor`；
- 登录后无有效持久化模式进入 `personal`；
- 房东关系失效回退 `personal`；
- 组织成员资格失效回退 `personal`；
- 公开深链临时按 `visitor/personal` 渲染，但不覆盖上次有效模式。

## 5. 请求作用域

请求层使用显式作用域，不根据当前 Pinia 状态为所有请求自动添加组织头。

```ts
type RequestScope =
  | { kind: 'public' }
  | { kind: 'personal' }
  | { kind: 'landlord'; landlordContactId: number }
  | { kind: 'organization'; organizationSlug: string }
```

推荐只向调用方提供一个请求接口：

```ts
requestWithScope<T>(scope: RequestScope, request: BusinessRequest): Promise<T>
```

请求适配器负责认证头、组织头、信封解析和错误归一化，业务页面不自行拼接上下文请求头。

## 6. 请求头矩阵

| 作用域 | `X-Session-Token` | `X-Org-Slug` | 资源关系参数 | 后端鉴权依据 |
| --- | --- | --- | --- | --- |
| `public` | 可携带 | 禁止 | 公开资源 ID | 公开可见性 |
| `personal` | 必须 | 禁止 | 本人资源 ID | 认证用户与对象关系 |
| `landlord` | 必须 | 禁止 | 房东关系或联系人 ID | 认证用户拥有该房东关系 |
| `organization` | 必须 | 必须 | 组织内资源 ID | 组织成员资格与 RBAC |

不变量：

- 公开找房永远不携带 `X-Org-Slug`。
- 租客个人请求永远不携带 `X-Org-Slug`。
- 房东请求由后端从房东关系推导组织，不能相信客户端自报组织。
- 组织请求中的请求体不使用客户端自报的 `organization_id` 作为授权依据。

## 7. 认证适配器与业务请求适配器

### 7.1 allauth 认证适配器

allauth app API 保留自身 `{ data, meta, status }` 结构，认证适配器负责：

- 保存和更新 `meta.session_token`；
- 解析登录流程、验证码、表单错误和 MFA 状态；
- 对 `401` 清除失效会话；
- 登录成功后触发应用上下文重新加载；
- 恢复目标路由和一次性待执行动作。

### 7.2 Django Ninja 业务适配器

业务接口继续解析项目统一成功信封 `{ code, message, data }`，并负责：

- 根据 `RequestScope` 决定是否附加认证头和组织头；
- 公开请求显式移除组织头；
- 网络错误不清除会话；
- 将 `401/403/404/409/422` 转换为稳定的前端错误类型；
- 保留后端返回的业务消息，但不向用户暴露权限键、堆栈和内部字段。

生成的 OpenAPI 文件只负责端点与类型适配，不承载当前模式和组织选择逻辑，也不得手工修改。

## 8. API 作用域与命名

### 8.1 当前已有接口

| 作用域 | 示例 | 约束 |
| --- | --- | --- |
| 公开 | `/api/public/houses/` | 不需要登录，不带组织头 |
| 公开房东店铺 | `/api/public/landlords/{public_key}/` | 不需要登录，不带组织头 |
| 个人收藏 | `/api/users/me/favorite/` | 登录用户本人，不带组织头 |
| 房东关系 | `/api/house/landlord/relationships/` | 登录用户本人，不带组织头 |
| 房东房源 | `/api/house/landlord/contacts/{contact_id}/houses/` | 后端校验联系人属于当前用户 |
| 房东租约 | `/api/house/landlord/contacts/{contact_id}/leases/` | 后端校验联系人属于当前用户 |
| 组织切换 | `/api/organizations/switch-list/` | 返回有效组织列表 |
| 组织业务 | `/api/house/`、`/api/team-operations/` 等 | 必须使用当前组织和 RBAC |

房东小程序应优先使用显式房东关系端点。需要组织选择的旧 `/api/house/landlord/my-houses/` 和 `/my-leases/` 不作为未来房东模式的主接口。

### 8.2 租客个人接口

租客个人作用域已经使用独立的 `/api/house/tenant/` 路由，不依赖当前组织上下文：

```text
GET  /api/house/tenant/viewing-records/
POST /api/house/tenant/viewing-records/
GET  /api/house/tenant/viewing-records/{id}/
POST /api/house/tenant/viewing-records/{id}/cancel/
GET  /api/house/tenant/leases/
GET  /api/house/tenant/leases/{id}/
```

约束：

- 个人列表跨组织聚合本人可见记录，响应中携带必要的组织展示摘要；
- 客户端不循环切换组织来拼接“我的租约”；
- 咨询或预约根据房源确定承接组织，客户端不得提交任意组织 ID；
- 预约要求当前用户已验证手机号，并由后端绑定或创建对应组织下的租客联系人；
- 个人租约当前只读，不提供确认、异议或直接修改租约字段的接口。

## 9. TabBar 与模块注册表契约

TabBar 外壳和业务模块使用两个职责不同的清单：

- TabBar profile 固定映射五个主包槽位，负责不同模式下的标题、图标和槽位顺序；
- 模块注册表负责真实业务入口、路由权限、能力开关和分包归属。

微信构建清单始终只有以下五个槽位，不再收集各模式页面并集：

```text
pages/index/index
pages/houses/index
pages/favorites/index
pages/messages/index
pages/me/me
```

模块注册表结构：

```ts
type ModuleDefinition = {
  key: string
  title: string
  route: string
  modes: AppMode[]
  requiresAuth: boolean
  capability?: string
  featureFlag?: string
  mainRoutePrefixes: string[]
  subpackageKeys: string[]
  enabled: boolean
  order: number
}
```

规则：

- `enabled=false` 的模块不进入生产导航。
- `capability` 只控制前端可见性，后端仍执行最终权限校验。
- 只有组织模式读取组织导航能力。
- 房东模块以有效房东关系作为可用条件，不复用组织角色名称。
- 公开详情可以在任意保存模式下打开，但临时采用公开上下文。
- 模式切换统一回到第一个稳定槽位，由该槽位渲染新模式首页。
- 未启用分包不参与路由归属，也不能构造可导航路由。

## 10. 状态与缓存隔离

全局持久化只保存：

- `session_token`；
- 上次有效模式；
- 上次组织 slug；
- 上次房东联系人 ID；
- 登录后待恢复动作。

不持久化：

- 组织权限能力；
- 房东关系详情；
- 房源、租约和带看列表；
- 未读数量；
- 服务端业务状态。

查询缓存键必须包含作用域标识：

```ts
type ContextCacheKey =
  | 'public'
  | `personal:${number}`
  | `landlord:${number}`
  | `organization:${string}`
```

模式或组织切换时取消旧作用域中的进行中请求。旧请求晚到时不得覆盖新上下文页面。

## 11. 路由和深链契约

路由元数据至少包含：

- `moduleKey`；
- `modes`；
- `requiresAuth`；
- `publicContext`；
- 可选 `capability`。

公开深链包括公开房源、公开房东店铺、房东邀请和组织邀请。处理规则：

- 先解析深链，再决定是否需要恢复业务模式；
- 公开内容不得因为当前用户是组织成员而附加组织头；
- 邀请页面可以匿名查看摘要，接受动作需要登录；
- 登录完成后恢复原深链和待执行动作；
- 公开深链结束后可以返回用户之前保存的业务模式。

## 12. 错误契约

| 场景 | 前端行为 |
| --- | --- |
| `401` 会话失效 | 清除会话，保存可恢复目标，进入登录或游客模式 |
| `403` 无权限 | 保留会话，显示无权限，并提供切换模式/组织 |
| `404` 不存在或不可见 | 显示内容不存在，不推断为未登录 |
| `409` 状态冲突 | 刷新目标对象并提示当前状态已变化 |
| `422` 业务校验失败 | 展示可操作的字段或业务错误 |
| 网络错误 | 保留会话和当前页面数据，允许重试 |

权限变化、关系失效和资源下架不能统一处理成退出登录。

## 13. 跨角色闭环时序

```text
公开房源请求
  -> public scope，无组织头
租客提交预约
  -> personal scope，后端根据 house_id 确定组织
组织员工处理待办
  -> organization scope，显式 X-Org-Slug + RBAC
创建租约草稿
  -> 租约归组织，关联租客联系人和房东联系人
租客确认信息
  -> personal scope，后端校验租客关系
房东查看相关租约
  -> landlord scope，后端从 landlordContactId 校验账号关系并推导组织
组织完成签约登记
  -> organization scope，后端推进最终业务状态
```

任何一步都不能通过前端切换模式绕过后端对象关系和权限校验。

## 14. 最小验证清单

- 同一账号同时具备租客、房东和组织成员身份时，可以独立进入三种模式。
- 租客公开找房请求不带 `X-Org-Slug`。
- 房东请求不能通过替换组织 slug 查看其他房东数据。
- 组织请求缺少或使用无效 `X-Org-Slug` 时被后端拒绝。
- 公开深链不会覆盖用户保存的上次业务模式。
- 房东关系或组织成员资格失效后自动回退个人模式。
- 模式切换后旧上下文请求不能覆盖新页面。
- 前端隐藏模块不能替代后端权限校验。
- 租客确认动作不能直接修改租约核心字段。
