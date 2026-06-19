# frontend_admin 通用后端能力接入设计

## 背景

当前 `frontend_admin` 已具备登录、个人中心、个人设置以及右上角租户切换等基础能力，但大多数业务路由仍然是模板页面。与此同时，后端 Django + Ninja API 已经提供了较完整的通用后台能力，并且 `frontend_admin/src/services/openapi` 已生成对应 OpenAPI 客户端。

本次目标不是改造原有 `account/settings` 的 tab，而是在 `frontend_admin` 中通过新增页面与菜单，逐步接入后端通用能力，特别是租户管理相关流程。

## 当前状态

### 已有前端能力

- 登录与会话维持
- 当前用户信息初始化
- 租户切换器
- 个人中心
- 个人设置 tab
- OpenAPI 自动生成客户端

### 已有后端能力

后端已在 `config/api.py` 注册了以下业务域路由：

- `apps.organizations.api`：租户、成员、邀请、租户资料
- `apps.teams.api`：团队管理
- `apps.access.api`：权限点、角色、角色绑定
- `apps.settings.api`：租户/团队/个人设置
- `apps.accounts.api`：用户资料、后台用户管理、实名审核
- `apps.notifications.api`：通知与通知偏好
- `apps.wallet.api`：钱包、提现、调账、审核、对账
- `apps.referrals.api`：裂变与邀请审核
- `apps.base.api`：系统上下文、版本、测试通知

## 待接入能力清单

### 1. 租户管理

目标：接入多租户后台的核心主流程。

后端已提供：

- 创建租户
- 获取租户切换列表
- 选择当前租户
- 设置主租户
- 退出当前租户上下文
- 更新租户基础资料
- 租户归档/恢复
- 转移租户 owner
- 获取租户成员/团队用量

建议页面：

- `租户概览`
- `租户资料`

### 2. 租户成员与邀请

目标：完成租户成员生命周期和邀请流程的后台承接。

后端已提供：

- 成员列表
- 搜索可添加成员
- 添加成员
- 查看成员详情
- 修改成员 owner 状态
- 移除成员
- 邀请列表
- 创建邀请
- 查看邀请详情
- 重发邀请
- 取消邀请

建议页面：

- `成员管理`
- `邀请管理`

### 3. 团队管理

目标：承接当前租户下团队的 CRUD 与成员维护。

后端已提供：

- 团队列表
- 团队创建
- 团队详情
- 团队编辑
- 团队删除

建议页面：

- `团队管理`
- 如后续复杂度增加，可拆 `团队列表` / `团队详情`

### 4. 权限与角色

目标：让租户和团队级 RBAC 可以通过管理页配置。

后端已提供：

- 权限点清单
- 租户级角色列表/新增/编辑/停用
- 租户级角色绑定列表/创建/删除
- 团队级角色列表/新增/编辑/停用
- 团队级角色绑定列表/创建/删除

建议页面：

- `租户角色`
- `租户授权`
- `团队角色`
- `团队授权`

### 5. 设置中心

目标：承接动态设置项，而不挤占现有个人设置 tab。

后端已提供：

- 租户设置列表/单项读取/更新/恢复默认
- 团队设置列表/单项读取/更新/恢复默认
- 用户设置列表/单项读取/更新/删除

建议页面：

- `租户设置`
- `团队设置`
- 用户设置暂时可保留在后续阶段，避免与现有个人设置概念混淆

### 6. 平台管理能力

目标：逐步承接超级管理员或平台运营向能力。

后端已提供：

- 用户管理
- 实名审核管理
- 通知列表与通知偏好
- 测试通知发送
- 钱包账户/流水/提现审核/代付/重试/对账
- 裂变规则配置与邀请记录审核

建议页面：

- `用户管理`
- `实名审核`
- `通知中心`
- `钱包管理`
- `裂变管理`

## 前端信息架构建议

在不改动现有 `account/settings` tab 的前提下，建议新增以下菜单分组：

### 租户工作台

- `租户概览`
- `租户资料`
- `成员管理`
- `邀请管理`
- `团队管理`

### 权限管理

- `租户角色`
- `租户授权`
- `团队角色`
- `团队授权`

### 设置管理

- `租户设置`
- `团队设置`

### 平台管理

- `用户管理`
- `实名审核`
- `通知中心`
- `钱包管理`
- `裂变管理`

## 接入优先级建议

### 第一阶段：租户主流程

优先接入：

- `租户概览`
- `租户资料`
- `成员管理`
- `邀请管理`
- `团队管理`

原因：

- 直接覆盖“租户管理等等”的核心诉求
- 与右上角现有租户切换器形成闭环
- 页面之间依赖关系清晰，便于先跑通多租户后台主链路

### 第二阶段：权限管理

接入：

- `租户角色`
- `租户授权`
- `团队角色`
- `团队授权`

原因：

- 需要依赖第一阶段的成员和团队数据
- 适合在主链路稳定后补齐 RBAC 能力

### 第三阶段：平台运营能力

接入：

- `用户管理`
- `实名审核`
- `通知中心`
- `钱包管理`
- `裂变管理`

原因：

- 更偏平台/超管维度
- 与租户主流程相对独立，可后续并行推进

## 页面实现原则

- 保持原有 `account/settings` tab 不变
- 优先复用 `frontend_admin/src/services/openapi` 中已生成客户端，不手写重复请求层
- 以“列表页 + 抽屉/弹窗编辑 + 必要详情页”的轻量形态优先落地
- 所有租户相关页面默认基于当前已选择租户工作
- 权限不足时应展示明确的空状态或错误提示
- 对分页接口遵循当前后端统一分页契约：`page`、`page_size` 与 `{ items, total, page, page_size }`

## 推荐的第一批页面骨架

建议先在 `frontend_admin/src/pages` 新增：

- `tenant/overview`
- `tenant/settings`
- `tenant/members`
- `tenant/invites`
- `tenant/teams`

并在路由中新增对应菜单分组，先用真实接口把列表、查看、基础编辑接起来，再逐步完善复杂操作。

## 第一批页面与接口映射

### 1. `tenant/overview`

建议用途：

- 展示当前租户基础信息
- 展示当前租户成员/团队用量
- 展示当前用户所属租户列表与当前选中状态

建议使用接口：

- `appsOrganizationsApiSwitchList`
- `appsOrganizationsApiGetOrganizationUsage`
- 如需要展示更多基础信息，可配合当前初始化状态中的 `organizations` / `selectedOrgSlug`

关键操作：

- 选择当前租户
- 设为主租户
- 退出当前租户

对应接口：

- `appsOrganizationsApiSelectOrg`
- `appsOrganizationsApiSetPrimary`
- `appsOrganizationsApiSignout`

### 2. `tenant/settings`

建议用途：

- 编辑当前租户名称、slug、账单邮箱
- 编辑成员/团队上限
- 租户归档/恢复
- 转移 owner

建议使用接口：

- `appsOrganizationsApiPatchOrganization`
- `appsOrganizationsApiPatchOrganizationStatus`
- `appsOrganizationsApiTransferOwner`
- `appsOrganizationsApiListMembers`

关键操作：

- 基础资料保存
- 归档/恢复租户
- 从成员列表中选择新的 owner

### 3. `tenant/members`

建议用途：

- 成员分页列表
- 搜索成员
- 添加成员
- 设置/取消 owner
- 移除成员

建议使用接口：

- `appsOrganizationsApiListMembers`
- `appsOrganizationsApiSearchMembers`
- `appsOrganizationsApiCreateMember`
- `appsOrganizationsApiPatchMember`
- `appsOrganizationsApiDeleteMember`
- 如需成员详情抽屉，可使用 `appsOrganizationsApiGetMember`

关键操作：

- 搜索可添加用户并新增为成员
- owner 开关修改
- 删除成员时避免允许“删除自己”的误操作提示缺失

### 4. `tenant/invites`

建议用途：

- 邀请列表
- 创建邀请
- 查看单条邀请详情
- 重发邀请
- 取消邀请

建议使用接口：

- `appsOrganizationsApiListInvites`
- `appsOrganizationsApiCreateInvite`
- `appsOrganizationsApiGetInvite`
- `appsOrganizationsApiResendInvite`
- `appsOrganizationsApiDeleteInvite`

关键操作：

- 按邮箱或指定用户发邀请
- 展示邀请状态与发送人
- 待处理邀请支持重发与取消

### 5. `tenant/teams`

建议用途：

- 团队分页列表
- 创建团队
- 编辑团队名称
- 维护团队成员
- 删除团队

建议使用接口：

- `appsTeamsApiListTeams`
- `appsTeamsApiCreateTeam`
- `appsTeamsApiGetTeam`
- `appsTeamsApiPatchTeam`
- `appsTeamsApiDeleteTeam`
- 成员选择可复用 `appsOrganizationsApiListMembers`

关键操作：

- 新建团队时选择初始成员
- 编辑团队时同步维护成员列表
- 删除团队前展示清晰确认

## 第一批建议路由

建议在 `frontend_admin/config/routes.ts` 中新增类似结构：

- `/tenant/overview`
- `/tenant/settings`
- `/tenant/members`
- `/tenant/invites`
- `/tenant/teams`

建议菜单名称：

- `租户概览`
- `租户资料`
- `成员管理`
- `邀请管理`
- `团队管理`

## 第一批实现顺序建议

### 顺序一：先打通租户上下文

1. `tenant/overview`
2. `tenant/settings`

原因：

- 先把“当前租户是谁、租户状态如何、能做哪些租户级操作”建立起来

### 顺序二：再补成员与邀请

1. `tenant/members`
2. `tenant/invites`

原因：

- 这两页是租户协作流程的核心
- 后续团队页与权限页都依赖成员数据

### 顺序三：最后补团队页

1. `tenant/teams`

原因：

- 团队页依赖成员选择能力
- 团队管理的可用性会随着成员管理先完成而更顺畅

## 第一批页面验收清单

### `tenant/overview`

- 能读取当前租户切换列表
- 能识别当前选中租户与主租户
- 能切换当前租户
- 能设置主租户
- 能退出当前租户上下文
- 能展示当前租户成员数、团队数及上限

### `tenant/settings`

- 能展示当前租户基础资料
- 能保存名称、slug、账单邮箱、成员上限、团队上限
- 能执行归档/恢复
- 能从当前成员中选择新 owner 并完成转移
- 对危险操作有二次确认

### `tenant/members`

- 能分页展示成员列表
- 能按姓名、用户名、邮箱搜索成员
- 能搜索可添加成员并完成新增
- 能切换成员 owner 状态
- 能移除成员
- 对“不能移除自己”错误有明确提示

### `tenant/invites`

- 能分页展示邀请列表
- 能创建按邮箱或指定用户的邀请
- 能查看邀请详情
- 能重发待处理邀请
- 能取消待处理邀请

### `tenant/teams`

- 能分页展示团队列表
- 能创建团队并选择初始成员
- 能查看团队详情
- 能编辑团队名称与成员
- 能删除团队

## 第一批实现依赖

### 公共依赖

- 当前页面需要从 `initialState` 读取 `selectedOrgSlug`
- 需要统一的分页列表封装或在每页单独处理 `{ items, total, page, page_size }`
- 需要统一的失败提示与成功提示
- 需要统一的“未选择租户”空状态

### 页面间依赖

- `tenant/settings` 依赖成员列表用于 owner 转移
- `tenant/teams` 依赖成员列表用于成员选择
- 第二阶段权限页依赖第一阶段的成员与团队数据

## 不在第一批范围内的内容

以下能力虽然后端已具备，但本轮“先接入租户主流程”时不建议先做：

- 团队级角色与团队授权
- 租户级角色与租户授权
- 超级管理员用户管理
- 实名审核后台
- 通知中心
- 钱包与提现管理
- 裂变与邀请审核
- 用户设置独立页面

这样可以保证第一批页面尽快形成一条完整、可验证的多租户后台主链路。

## 风险与注意事项

- 现有 `frontend_admin` 路由仍以模板页为主，新增菜单时要避免和旧菜单命名冲突
- 部分页面是否展示应结合 `currentUser.is_staff` / `is_superuser` 与后端返回结果控制
- 团队级角色与绑定依赖先拿到团队列表或团队详情上下文
- 用户设置接口与现有个人设置页面存在语义重叠，需要后续明确边界

## 结论

当前最适合的推进方式，不是改已有 tab，而是围绕后端现成接口新增一组“租户工作台 + 权限管理 + 平台管理”页面。

其中第一批应优先完成租户主流程：

- 租户概览
- 租户资料
- 成员管理
- 邀请管理
- 团队管理

完成这一步后，`frontend_admin` 就能从“只有账号页和模板页”进入“可承载真实多租户后台流程”的状态。
