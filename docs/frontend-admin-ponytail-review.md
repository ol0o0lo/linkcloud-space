# frontend_admin Ponytail 页面精简记录

目标：记录管理端页面里多余、模板残留、重复实现和可收缩的区域，后续逐页处理时更新状态，避免重复优化。

状态约定：

- `待优化`：已确认值得处理。
- `已优化`：已经完成精简，后续不重复扫，除非功能变化。
- `暂不动`：看起来重，但目前承载真实业务或风险较高，先不动。
- `待确认`：需要产品/业务确认是否仍要保留。
- `待清理`：已确认不在当前主路由中，清理前只需要处理引用/备份方式。

## 第一批：模板残留，优先干掉

这些页面不在 `config/routes.ts` 当前主路由里，且多为 Ant Design Pro 示例页、假接口或 mock 数据。不要运行 `npm run simple`，它会执行删除类操作；后续按人工确认后的文件清单迁移到备份目录或逐个移除引用。

| 状态 | 页面/目录 | 依据 | 建议 |
| --- | --- | --- | --- |
| 待清理 | `src/pages/dashboard/analysis` | 未在当前主路由中；依赖 `/api/fake_analysis_chart_data` 和 `@ant-design/plots`。 | 整目录移走/清理。 |
| 待清理 | `src/pages/dashboard/workplace` | 未在当前主路由中；依赖 `/api/activities`、`/api/fake_workplace_chart_data` 和图表。 | 整目录移走/清理。 |
| 待清理 | `src/pages/dashboard/monitor` | 未在当前主路由中；示例监控大屏、mock 地图/图表。 | 整目录移走/清理，收益最大。 |
| 待清理 | `src/pages/form/*` | 未在当前主路由中；`basic-form`、`step-form`、`advanced-form` 都是模板表单。 | 整个 `form` 目录移走/清理。 |
| 待清理 | `src/pages/list/*` | 未在当前主路由中；`basic-list`、`card-list`、`search` 走 fake list/mock。 | 整个 `list` 目录移走/清理。 |
| 待清理 | `src/pages/profile/*` | 未在当前主路由中；请求 `/api/profile/basic`、`/api/profile/advanced`。 | 整个 `profile` 目录移走/清理。 |
| 待清理 | `src/pages/table-list` | 未在当前主路由中；模板 CRUD 表格和 fake rule service。 | 整目录移走/清理。 |
| 待清理 | `src/pages/chatbot` | 未在当前主路由中；`menu.chatbot` 文案残留但无路由入口。 | 如无近期 AI 助手计划，整目录移走/清理。 |
| 待清理 | `src/pages/geo/map` | 未在当前主路由中；依赖地图 mock。 | 整目录移走/清理。 |
| 待清理 | `src/pages/Welcome.tsx`、`Welcome*.css`、`Admin.tsx` | 当前根路由跳到 `/property-rental/workbench`，这些入口无主路由引用。 | 清理模板首页残留。 |
| 待清理 | `src/pages/account/center` 旧模板子文件 | 路由入口只导出 `PersonalCenterPage`；旧 `Applications/Articles/Projects/mock-data/service` 没有业务引用。 | 保留 `index.tsx`，移走/清理旧模板子文件。 |
| 待清理 | `src/pages/account/settings` 地理 mock 与尾部模板 service | 当前个人中心只用真实用户、安全、绑定、实名、通知；`queryProvince/queryCity/query()` 已清理，`_mock.ts` 和 `geographic/*.json` 尚待移走。 | 清理 `_mock.ts`、`geographic/*.json`。 |
| 待清理 | `src/locales/*/menu.ts` 模板菜单文案 | 多语言菜单仍保留 `welcome/dashboard/form/list/profile/editor/chatbot/geo` 等未路由 key。 | 第一批页面清理后同步删对应 locale key，避免误判仍有入口。 |
| 待确认 | `src/pages/result/*`、`src/pages/user/register-result` | 仅注册模板流相关；当前注册本身仍是模板式。 | 接真实注册后一起清理或替换。 |

可能跟随删除的依赖，需在页面清掉后再确认：

- `@ant-design/plots`：当前只被未路由的 dashboard 示例页引用。
- `mockjs`：主要支撑模板 mock，页面清理后再查引用。
- `@types/react-helmet`：当前源码未见 `react-helmet` 使用。

### 第一批审查证据

- 当前主路由 `config/routes.ts` 没有引用 `dashboard/*`、`form/*`、`list/*`、`profile/*`、`table-list`、`chatbot`、`geo/map`、`Welcome`、`Admin`。
- 旧 `config/routes.simple.ts` 仍引用 `Welcome`、`Admin`、`table-list`，但它只服务破坏性的 `npm run simple` 模板清理脚本；项目说明已要求不要运行。
- 第一批未路由目录共 109 个源码/样式文件，约 59233 行。`dashboard/monitor/mock/map-grid.ts` 41411 行、`dashboard/monitor/mock/map-geo.ts` 7383 行，是最大可移除块。
- 除目录内自引用外，源码没有发现其它业务页 import 第一批未路由页面。
- `account/center/index.tsx` 与 `account/settings/index.tsx` 都只转发到 `PersonalCenterPage`；旧账号中心模板子文件约 607 行，账号设置地理 mock/JSON 约 1922 行。
- 多语言 `menu.ts` 仍保留 `dashboard/form/list/profile/result/welcome/chatbot` 等模板菜单文案；页面清理后应同步收缩 locale，避免后续误判“还有入口”。

### Ponytail 审查发现

delete: 未路由 Ant Design Pro 模板页。替换：无，当前业务入口都在租房、租户、权限、设置、平台/钱包页面。`src/pages/dashboard`、`src/pages/form`、`src/pages/list`、`src/pages/profile`、`src/pages/table-list`

delete: 未路由监控地图 mock 大文件。替换：无；没有主路由入口，`d3/topojson/geojson` 只被这块拖住。`src/pages/dashboard/monitor/mock/map-grid.ts`、`src/pages/dashboard/monitor/mock/map-geo.ts`

delete: 未路由聊天页。替换：无；`@ant-design/x*`、`highlight.js` 目前只服务这块和模板展示。`src/pages/chatbot`

delete: 模板首页和精简脚本遗留入口。替换：当前根路由 `/property-rental/workbench`。`src/pages/Welcome.tsx`、`src/pages/Admin.tsx`、`config/routes.simple.ts`、`scripts/simple.js`

shrink: 模板 locale 文案。替换：只保留当前 `config/routes.ts` 真实菜单 key。`src/locales/*/menu.ts`

delete: 账号中心旧模板列表卡片。替换：当前 `PersonalCenterPage`。`src/pages/account/center/components`、`src/pages/account/center/mock-data.ts`、`src/pages/account/center/service.ts`

delete: 账号设置地理 mock 查询。替换：无；当前基础资料页没有省市级联。`src/pages/account/settings/geographic`、`src/pages/account/settings/_mock.ts`、`queryProvince/queryCity/query`

shrink: 模板 locale 文案散落在 7 个语言文件里。替换：仅保留当前 `config/routes.ts` 使用的菜单 key；跟第一批页面一起动。`src/locales/*/menu.ts`

net: 第一批页面约 -59233 行，后续依赖最多 -6 个左右；先移页面，再跑类型检查确认依赖是否可动。

## 第二批：真实业务页，优先瘦身

这些页面在主路由里，不能直接删；目标是减少重复表单、重复概览卡、重复抽屉逻辑。

| 状态 | 页面/目录 | 当前体量 | 建议 |
| --- | --- | ---: | --- |
| 已优化 | `src/pages/property-rental/leases/index.tsx` | 1542 行 | 概览统计卡、固定分页、状态流按钮、表格区 header 已收敛；“资料队列”说明提示、抽屉摘要提示、合同说明、分区说明和概览副文案已删。 |
| 已优化 | `src/pages/property-rental/viewings/index.tsx` | 1345 行 | 固定分页、状态流按钮、表格区 header 已收敛；抽屉摘要提示和概览副文案已删。 |
| 已优化 | `src/pages/property-rental/houses/index.tsx` | 1016 行 | 概览统计卡、固定分页、表格区 header 已收敛；本轮已删除概览卡重复副文案和对应 loading 文案测试。 |
| 待优化 | `src/pages/personal-business/overview/index.tsx` | 899 行 | 已删 7 条展示型说明提示并补齐页面测试隔离；后续再看概览卡片和资金/实名区块是否还能数组化。 |
| 已优化 | `src/pages/property-rental/estates/index.tsx` | 695 行 | 固定分页、表格区 header 已收敛；项目/楼栋台账的解释型提示和概览副文案已删。 |
| 已优化 | `src/pages/property-rental/contacts/index.tsx` | 656 行 | 概览统计卡、固定分页、表格区 header 已收敛；本轮已删除联系人概览卡重复副文案和旧 loading 文案测试。 |
| 待优化 | `src/pages/property-rental/workbench.tsx` | 525 行 | 工作台已有真实入口，先保留；经营总览概览卡副文案和页面副标题已删，后续只看表格列说明是否还能收缩。 |

### 第二批审查结论

shrink: 重复概览卡。替换：数组 map；`viewings`、`contacts`、`leases`、`houses` 已处理，后续不要重复审查这类概览卡。

shrink: 重复状态动作按钮。替换：`StatusFlowButtons`；`leases/viewings` 已处理，后续不要做万能工作流框架。

shrink: 重复表格容器头部。替换：`SectionHeader`；`estates/leases/viewings/contacts/houses` 已处理。

delete: 多余解释型提示。替换：保留标题、按钮、表格列即可；已删 `leases` 资料队列说明，以及 `estates` 项目/楼栋台账说明。`src/pages/property-rental/leases/index.tsx`、`src/pages/property-rental/estates/index.tsx`

shrink: 重复分页配置。替换：`fixedPagePagination`；`contacts/estates/houses/leases/viewings` 已处理，后续不要重复审查固定分页对象。

delete: 房源列表概览卡重复副文案。替换：统计卡标题和数字。`src/pages/property-rental/houses/index.tsx`

delete: 联系人概览卡重复副文案。替换：统计卡标题和数字。`src/pages/property-rental/contacts/index.tsx`

delete: 带看/租约/项目楼栋概览卡重复副文案。替换：统计卡标题和数字，表格列保留具体行动文本。`src/pages/property-rental/viewings/index.tsx`、`src/pages/property-rental/leases/index.tsx`、`src/pages/property-rental/estates/index.tsx`

yagni: `personal-business/overview` 卡片过多、静态说明偏重。替换：保留账户/钱包/实名/推荐/通知的真实入口；已删 7 条展示型提示，后续只看可复用卡片结构。`src/pages/personal-business/overview/index.tsx`

delete: `property-rental/workbench` 经营总览概览卡副文案。替换：只保留 `Statistic` 标题和值，筛选区已有相同计数。`src/pages/property-rental/workbench.tsx`

delete: 平台管理页重复 `PageContainer subTitle`。替换：页面标题和表格/Card 标题已经足够。`src/pages/platform-management/users`、`real-name`、`referrals`、`notifications`、`notification-dispatches`

delete: 权限/设置页重复 `TenantSelectionGuard subtitle`。替换：页面标题、表格标题和设置分区已经说明上下文。`src/pages/access/*`、`src/pages/settings-management/organization`、`src/pages/settings-management/team`

delete: 租房域重复 `TenantSelectionGuard subtitle`。替换：页面标题、概览区、表格/Card 标题已经说明上下文。已删 `workbench/contacts/estates/houses/houses/detail/leases/viewings`，保留 `houses/new` 的建档流程提示。`src/pages/property-rental/*`

delete: 个人业务/系统运维重复 `PageContainer subTitle`。替换：页面标题和内容区标题已经说明上下文。`src/pages/personal-business/overview`、`src/pages/system-tools/operations`

delete: 钱包管理页重复 `PageContainer subTitle`。替换：页面标题、表格标题和操作按钮已经说明上下文。`src/pages/wallet-management/accounts`、`src/pages/wallet-management/withdrawals`

暂不抽：`constants.ts`、`loading.tsx` 已经承担最小共享；继续往上抽 CRUD/资源模型会变成新复杂度。

## 第三批：真实业务页下一轮候选

这一批只记录下一轮可小步处理的点；不要一次性抽大框架，删提示优先于新增组件。

| 状态 | 页面/目录 | 发现 | 建议 |
| --- | --- | --- | --- |
| 已优化 | `src/pages/property-rental/houses/detail.tsx` | 房源详情发布卡片已删发布规则长说明、阻断/提醒/已满足三段解释文本；保留发布规则入口、阻断/提醒标签和“去维护/补资料”按钮。 | 后续只保留状态和动作，不再加段落式运营建议。 |
| 已优化 | `src/pages/property-rental/houses/new.tsx` | 建档向导的顶层 subtitle、视频说明段落、重复步骤 intro、每步静态说明和默认楼栋静态提示已删。 | 保留步骤 `Alert`、来源带入提示和每步内部标题。 |
| 已优化 | `src/pages/property-rental/viewings/index.tsx` | 抽屉摘要 `Alert` 和概览副文案已删。 | 保留来源带入、租客缺失警告和状态动作。 |
| 已优化 | `src/pages/property-rental/leases/index.tsx` | 抽屉摘要 `Alert`、合同上传说明、表单分区说明和概览副文案已删。 | 保留成交带看未绑定租客、重复签约、合同缺失等风险提示。 |
| 待优化 | `src/pages/personal-business/overview/index.tsx` | 个人业务概览仍把提现申请、失败提醒、邀请、实名、个人设置塞在一个 800+ 行页面里；提现说明段落已删。 | 后续只在需要真实复用时拆小组件，不做“个人业务框架”。 |
| 已优化 | `src/pages/settings-management/shared.tsx` | 设置编辑弹窗的“当前类型 / 组件”调试文案已删。 | 后续不要重复审查这条。 |
| 已优化 | `src/pages/tenant/shared.tsx:TenantSectionHint` | 运行时代码引用已归零，组件和测试 mock 里的旧导出已删除；权限团队上下文保留标题和团队选择框。 | 后续不要再新增段落式页面说明组件。 |
| 暂不动 | `src/pages/property-rental/loading.tsx`、`src/pages/property-rental/components/MediaRefsUpload.tsx` | loading/上传空态文案承担真实状态反馈。 | 暂保留，等页面提示删完再看是否还显啰嗦。 |
| 暂不动 | `src/pages/account/settings/components/real-name.tsx` | `InlineRealNameHelper.description` 是实名审核状态、失败原因和复核说明的安全/审核反馈，不是死 prop。 | 保留；不要为少字删除实名状态解释。 |
| 待清理 | `src/pages/dashboard/analysis/components/NumberInfo/index.tsx`、`src/pages/geo/map/data.d.ts` | 本轮 `description?:/subTitle?:` 复查只剩模板目录命中。 | 跟第一批未路由模板页一起清理，不单独优化。 |

### 第三批 Ponytail 审查发现

delete: 房源详情媒体上传营销式说明。替换：上传区标题和发布检查标签。`src/pages/property-rental/houses/detail.tsx`

delete: 房源详情发布卡片里的运营建议文案。替换：发布状态标签、阻断/提醒标签、设置入口和动作按钮。`src/pages/property-rental/houses/detail.tsx`

delete: 新建房源的重复流程说明。替换：`Steps` 当前步骤和校验提示。`src/pages/property-rental/houses/new.tsx`

delete: 新建房源每步静态说明和默认楼栋静态提示。替换：字段标签、来源带入提示和“设为默认/新建楼栋”按钮。`src/pages/property-rental/houses/new.tsx`

delete: 带看/租约抽屉摘要里的“当前可直接保存/当前仍有待补项”。替换：必填校验、摘要字段和保存按钮状态。`src/pages/property-rental/viewings/index.tsx`、`src/pages/property-rental/leases/index.tsx`

delete: 个人业务提现区长段解释。替换：表单标题、待审核标签和提交按钮。`src/pages/personal-business/overview/index.tsx`

delete: 设置弹窗里的 schema 调试文案。替换：表单控件本身。`src/pages/settings-management/shared.tsx`

## 已优化/避免重复优化

| 状态 | 页面/目录 | 记录 |
| --- | --- | --- |
| 已优化 | `src/pages/account/center/index.tsx`、`src/pages/account/settings/index.tsx` | 两个路由已经统一导出 `PersonalCenterPage`，不要再分别做两套页面。下一步只清理旧 `account/center`、`account/settings` 里未被共享页引用的模板残留。 |
| 已优化 | `src/pages/account/settings/service.ts`、`src/pages/account/settings/data.d.ts` | 已移除未调用的 `queryProvince/queryCity/query()`、省市 JSON import、模板类型；后续不要再按这几个函数重复审查。 |
| 已优化 | `src/pages/_shared/adminLayout.tsx:fixedPagePagination` | 已收敛租房列表页重复固定分页对象；不要再抽 Table wrapper。 |
| 已优化 | `src/pages/_shared/adminLayout.tsx:StatusFlowButtons` | 已收敛租约/带看状态流按钮渲染；状态流常量仍保留在各业务页。 |
| 已优化 | `src/pages/_shared/adminLayout.tsx:SectionHeader` | 已收敛租房列表页重复标题/操作区；后续不要再手写同款 flex header。 |
| 已优化 | `src/pages/personal-business/overview/index.tsx` 展示型提示 | 已删除概览卡、失败提现、实名、个人设置中的重复解释文案；保留真实操作入口。`index.test.tsx` 已补 `PageContainer` mock，后续不要再因 ProComponents ESM/CJS 问题重复处理。 |
| 已优化 | `src/pages/property-rental/workbench.tsx` 经营总览副文案 | 已删除 6 条重复计数说明；保留指标标题和值，以及表格筛选计数。 |
| 已优化 | `src/pages/property-rental/houses/index.tsx` 房源概览副文案 | 已删除“X 套房源在当前组织内管理 / 被规则卡住 / 已具备上线条件 / 正在承接带看”四条重复说明及旧 loading 文案测试；保留统计标题和值。 |
| 已优化 | `src/pages/property-rental/contacts/index.tsx` 联系人概览副文案 | 已删除房东/租客/双角色/停用联系人四条说明及旧 loading 文案测试；保留统计标题和值。 |
| 已优化 | `src/pages/property-rental/viewings/index.tsx`、`src/pages/property-rental/leases/index.tsx`、`src/pages/property-rental/estates/index.tsx` 概览副文案 | 已删除概览卡 hint/loadingHint 和渲染；保留统计标题和值，表格/抽屉里的风险与行动提示不动。 |
| 已优化 | `src/pages/platform-management/*` 页面副标题 | 已删除用户管理、实名审核、邀请奖励、通知管理、通知分发管理的重复 `PageContainer subTitle`；`notifications/index.test.tsx` 已补 `PageContainer` mock，后续不要重复处理同类测试隔离。 |
| 已优化 | `src/pages/access/*`、`src/pages/settings-management/*` 页面副标题 | 已删除权限管理、角色、授权、空间设置、团队设置的重复 `TenantSelectionGuard subtitle`；保留页面标题和内容区标题。 |
| 已优化 | `src/pages/property-rental/*` 页面副标题 | 已删除租房工作台、联系人、项目楼栋、房源列表、房源详情、租约、带看的重复 `TenantSelectionGuard subtitle`；`houses/new` 的建档流程提示暂保留。 |
| 已优化 | `src/pages/personal-business/overview`、`src/pages/system-tools/operations` 页面副标题 | 已删除重复 `PageContainer subTitle`；`system-tools/operations/index.test.tsx` 已补 `PageContainer` mock，后续不要重复处理同类测试隔离。 |
| 已优化 | `src/pages/wallet-management/*` 页面副标题 | 已删除钱包账户、提现审核的重复 `PageContainer subTitle`；`withdrawals/index.test.tsx` 已补 ProComponents mock 和状态映射 fixture。 |
| 已优化 | `src/pages/property-rental/houses/detail.tsx` 媒体上传说明 | 已删除图片/视频上传区的营销式说明；保留上传区标题和媒体状态。 |
| 已优化 | `src/pages/property-rental/houses/detail.tsx` 发布卡片说明 | 已删除发布规则长说明、阻断处理建议、提醒项建议和无缺口建议；保留状态标签、规则入口和操作按钮。 |
| 已优化 | `src/pages/property-rental/houses/detail.tsx` 编辑抽屉分区说明 | 已删除“归属与发布基础 / 户型与面积 / 展示与内部说明”下的解释句；保留分区标题和字段校验。 |
| 已优化 | `src/pages/property-rental/components/MediaRefsUpload.tsx` 未用说明 prop | 已删除无调用方的 `description` prop 和内部说明渲染；保留标题、空态和媒体摘要。 |
| 已优化 | `src/pages/_shared/adminLayout.tsx:SectionHeader` 未用说明 prop | 已删除无调用方的 `description` prop；表格区标题只保留标题和操作区。 |
| 已优化 | `src/pages/platform-management/shared.tsx:NoteModal` 未用说明 prop | 已删除无调用方的 `description` prop；实名审核弹窗只保留备注表单。 |
| 已优化 | `src/pages/tenant/shared.tsx:TenantSelectionGuard` 未用副标题 prop | 已删除无调用方的 `subtitle` prop 和 `PageContainer subTitle` 透传；页面副标题已在各业务页收敛。 |
| 已优化 | `src/pages/property-rental/houses/new.tsx` 顶层提示与视频说明 | 已删除建档页重复 `subtitle` 和视频说明段落；保留步骤 `Alert`。 |
| 已优化 | `src/pages/property-rental/houses/new.tsx` 重复步骤 intro | 已删除外层 `STEP_INTRO` 和当前步骤标题块；每步内容里已有标题和说明。 |
| 已优化 | `src/pages/property-rental/houses/new.tsx` 每步静态说明 | 已删除“草稿最低要求 / 这一页优先 / 先看阻断项 / 保存后进入详情”和默认楼栋提示；保留来源带入和动态步骤 `Alert`。 |
| 已优化 | `src/pages/property-rental/viewings/index.tsx` 抽屉摘要提示 | 已删除抽屉摘要里的“当前可直接保存/当前仍有待补项” `Alert` 和对应 helper；保留字段摘要与必填校验。 |
| 已优化 | `src/pages/property-rental/leases/index.tsx` 抽屉/合同说明 | 已删除租约抽屉摘要 `Alert`、`getLeaseDrawerWarning` 和合同上传说明；保留风险队列提示。 |
| 已优化 | `src/pages/property-rental/leases/index.tsx` 表单分区说明 | 已删除“签约主体 / 租期与金额”下的解释句；保留分区标题和必填校验。 |
| 已优化 | `src/pages/personal-business/overview/index.tsx` 提现说明段落 | 已删除“把提现作为资金推进动作”解释段落；表单标题、状态标签和按钮足够。 |
| 已优化 | `src/pages/settings-management/shared.tsx` 设置编辑调试文案 | 已删除“当前类型 / 组件”段落；表单控件本身已表达输入方式。 |
| 已优化 | `src/pages/settings-management/shared.tsx` 旧设置表格壳 | 已删除未调用的 `SettingsTableCard`、`buildSettingColumns` 和关联 import；当前设置页走 Tabs 行内编辑流。 |
| 已优化 | `src/pages/settings-management/shared.tsx` 旧设置弹窗流 | 已删除未调用的 `SettingEditModal`、`SettingValue`、`settingFormValue`、`PrimaryActionButton` 和关联类型/import；当前设置页只保留行内编辑控件。 |
| 已优化 | `src/pages/tenant/shared.tsx:TenantSectionHint` | 已删除运行时唯一调用、组件本身和测试 mock 旧导出；`TeamContextCard` 的标题、选择框和空团队状态已足够说明上下文。 |
| 暂不动 | `src/pages/tenant/*` | 都在主路由中，且走真实组织/成员/团队 API；暂不按模板残留处理。 |
| 暂不动 | `src/pages/access/*` | 都在主路由中，且走真实 RBAC API；可后续做小幅共享，但不是第一批。 |
| 暂不动 | `src/pages/settings-management/*` | 都在主路由中，且设置页已有共享模块 `shared.tsx`；先不重复优化。 |
| 暂不动 | `src/pages/platform-management/*`、`src/pages/wallet-management/*`、`src/pages/system-tools/*` | 都在主路由中，已有真实 API 和测试；副标题类提示已处理，后续只做局部代码 review。 |

## 验证记录

- 2026-07-04：`frontend_admin` 下 `npm exec -- vitest run src/pages/personal-business/overview/index.test.tsx` 通过。
- 2026-07-04：`frontend_admin` 下 `npm exec -- vitest run src/pages/property-rental/workbench.test.tsx` 通过。
- 2026-07-04：`frontend_admin` 下 `npm exec -- vitest run src/pages/platform-management/users/index.test.tsx src/pages/platform-management/real-name/index.test.tsx src/pages/platform-management/referrals/index.test.tsx src/pages/platform-management/notifications/index.test.tsx src/pages/platform-management/notification-dispatches/index.test.tsx` 通过。
- 2026-07-04：`frontend_admin` 下 `npm exec -- vitest run src/pages/access/index.test.tsx src/pages/access/organization-roles/index.test.tsx src/pages/access/organization-bindings/index.test.tsx src/pages/access/team-roles/index.test.tsx src/pages/access/team-bindings/index.test.tsx src/pages/settings-management/organization/index.test.tsx src/pages/settings-management/team/index.test.tsx` 通过。
- 2026-07-04：`frontend_admin` 下 `npm exec -- vitest run src/pages/property-rental/houses/__tests__/detail.test.tsx` 通过。
- 2026-07-04：`frontend_admin` 下 `npm exec -- vitest run src/pages/property-rental/__tests__/domain-list-pages.test.tsx src/pages/property-rental/workbench.test.tsx` 通过。
- 2026-07-04：`frontend_admin` 下 `npm exec -- vitest run src/pages/personal-business/overview/index.test.tsx src/pages/system-tools/operations/index.test.tsx` 通过。
- 2026-07-04：`frontend_admin` 下 `npm exec -- vitest run src/pages/wallet-management/accounts/index.test.tsx src/pages/wallet-management/withdrawals/index.test.tsx` 通过。
- 2026-07-04：`frontend_admin` 下 `npm run tsc` 通过。
- 2026-07-04：`frontend_admin` 下 `npm exec -- vitest run src/pages/personal-business/overview/index.test.tsx src/pages/settings-management/organization/index.test.tsx src/pages/settings-management/team/index.test.tsx src/pages/property-rental/houses/__tests__/detail.test.tsx src/pages/property-rental/houses/__tests__/new.test.tsx src/pages/property-rental/__tests__/domain-list-pages.test.tsx` 通过（6 个文件，159 个用例）。
- 2026-07-04：`frontend_admin` 下 `npm run tsc` 通过。
- 2026-07-04：`frontend_admin` 下 `npm exec -- vitest run src/pages/settings-management/organization/index.test.tsx src/pages/settings-management/team/index.test.tsx` 通过（2 个文件，10 个用例）。
- 2026-07-04：`frontend_admin` 下 `npm run tsc` 通过。
- 2026-07-04：`frontend_admin` 下 `npm exec -- vitest run src/pages/access/index.test.tsx src/pages/access/organization-roles/index.test.tsx src/pages/access/organization-bindings/index.test.tsx src/pages/access/team-roles/index.test.tsx src/pages/access/team-bindings/index.test.tsx src/pages/tenant/shared.test.tsx` 通过（6 个文件，7 个用例）。
- 2026-07-04：`frontend_admin` 下 `npm run tsc` 通过。
- 2026-07-04：`frontend_admin` 下 `npm exec -- vitest run src/pages/property-rental/houses/__tests__/new.test.tsx` 通过（1 个文件，16 个用例）。
- 2026-07-04：`frontend_admin` 下 `npm run tsc` 通过。
- 2026-07-04：`frontend_admin` 下 `npm exec -- vitest run src/pages/property-rental/houses/__tests__/detail.test.tsx` 通过（1 个文件，27 个用例）。
- 2026-07-04：`frontend_admin` 下 `npm run tsc` 通过。
- 2026-07-04：`frontend_admin` 下 `npm exec -- vitest run src/pages/property-rental/houses/__tests__/new.test.tsx` 通过（1 个文件，16 个用例）。
- 2026-07-04：`frontend_admin` 下 `npm run tsc` 通过。
- 2026-07-04：`frontend_admin` 下 `npm exec -- vitest run src/pages/settings-management/organization/index.test.tsx src/pages/settings-management/team/index.test.tsx src/pages/access/index.test.tsx src/pages/access/organization-roles/index.test.tsx src/pages/access/organization-bindings/index.test.tsx src/pages/access/team-roles/index.test.tsx src/pages/access/team-bindings/index.test.tsx src/pages/tenant/shared.test.tsx src/pages/tenant/invites/index.test.tsx src/pages/tenant/members/index.test.tsx src/pages/tenant/settings/index.test.tsx src/pages/tenant/teams/index.test.tsx src/pages/property-rental/workbench.test.tsx` 通过（13 个文件，38 个用例）。
- 2026-07-04：`frontend_admin` 下 `npm run tsc` 通过。
- 2026-07-04：`frontend_admin` 下 `npm exec -- vitest run src/pages/property-rental/__tests__/domain-list-pages.test.tsx` 通过（1 个文件，105 个用例）。
- 2026-07-04：`frontend_admin` 下 `npm run tsc` 通过。
- 2026-07-04：`frontend_admin` 下 `npm exec -- vitest run src/pages/property-rental/components/__tests__/media-refs-upload.test.tsx` 通过（1 个文件，6 个用例）。
- 2026-07-04：`frontend_admin` 下 `npm run tsc` 通过。
- 2026-07-04：`frontend_admin` 下 `npm exec -- vitest run src/pages/property-rental/__tests__/domain-list-pages.test.tsx src/pages/platform-management/real-name/index.test.tsx` 通过（2 个文件，106 个用例）。
- 2026-07-04：`frontend_admin` 下 `npm run tsc` 通过。
- 2026-07-04：`frontend_admin` 下 `npm exec -- vitest run src/pages/tenant/shared.test.tsx src/pages/settings-management/organization/index.test.tsx src/pages/property-rental/workbench.test.tsx` 通过（3 个文件，25 个用例）。
- 2026-07-04：`frontend_admin` 下 `npm run tsc` 通过。
- 2026-07-04：`frontend_admin` 下 `npm exec -- vitest run src/pages/settings-management/organization/index.test.tsx src/pages/settings-management/team/index.test.tsx` 通过（2 个文件，10 个用例）。
- 2026-07-04：`frontend_admin` 下 `npm run tsc` 通过。
- 2026-07-04：项目根目录 `git diff --check` 通过。
- 2026-07-04：`frontend_admin` 下 `npm exec -- vitest run src/pages/property-rental/houses/__tests__/detail.test.tsx` 通过（1 个文件，27 个用例）。
- 2026-07-04：`frontend_admin` 下 `npm run tsc` 通过。
- 2026-07-04：`frontend_admin` 下 `npm exec -- vitest run src/pages/property-rental/houses/__tests__/new.test.tsx` 通过（1 个文件，16 个用例）。
- 2026-07-04：`frontend_admin` 下 `npm run tsc` 通过。
- 2026-07-04：项目根目录 `git diff --check` 通过。
- 2026-07-04：`frontend_admin` 下 `npm exec -- vitest run src/pages/property-rental/__tests__/domain-list-pages.test.tsx` 通过（1 个文件，104 个用例）。
- 2026-07-04：`frontend_admin` 下 `npm run tsc` 通过。
- 2026-07-04：项目根目录 `git diff --check` 通过。
- 2026-07-04：`frontend_admin` 下 `npm exec -- vitest run src/pages/property-rental/__tests__/domain-list-pages.test.tsx` 通过（1 个文件，103 个用例）。
- 2026-07-04：`frontend_admin` 下 `npm run tsc` 通过。
- 2026-07-04：`frontend_admin` 下 `npm exec -- vitest run src/pages/property-rental/__tests__/domain-list-pages.test.tsx` 通过（1 个文件，103 个用例）。
- 2026-07-04：`frontend_admin` 下 `npm run tsc` 通过。

## 下一步顺序

1. 人工确认第一批未路由模板页是否全部废弃。
2. 先断开文案、测试和依赖引用，再移动/清理第一批目录。
3. 跑 `nvm use 22 && npm run tsc`，再按影响范围跑相关 Vitest。
4. 第二批每次只瘦一个页面，改完就在本文件把状态更新为 `已优化`。
