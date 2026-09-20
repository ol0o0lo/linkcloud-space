# 小程序端分层组件化改造设计

- 状态：已确认（2026-09-13 修订目录归属规则）
- 日期：2026-09-12，2026-09-13 修订
- 适用目录：frontend_miniprogram/
- 目标平台：微信小程序、H5

## 1. 背景

当前小程序端已经存在 AppPage、AppLoading、AppErrorView、AppListState、AppBottomAction、HouseCard 等少量公共组件，但整体页面仍承担了大量重复的布局、状态处理和交互逻辑。

审计结果显示：

- 页面与组件 Vue 文件合计接近 2 万行。
- 约 20 个页面重复实现 record-card、card-topline、record-meta、card-footer 等列表卡片结构。
- 29 个页面弹层直接使用 wd-popup，并各自声明 padding、最大高度和滚动样式。
- 16 个页面手写分页状态，另有 8 个页面使用基础 usePagedQuery，但页面生命周期仍重复编排。
- 35 个页面重复组合 AppLoading 和 AppErrorView。
- 13 个页面重复实现详情加载、路由参数解析和错误状态。
- 5 个组织租赁表单页重复实现固定提交栏。
- frontend_miniprogram/src/pages-org-rental/houses/detail.vue 已达到 1616 行，混合房源详情、AI 分析、经营信息、带看、租约和房态管理。
- 页面 scoped CSS 中存在大量重复的页面背景、卡片、间距、标题、列表和弹层样式。

此次改造需要同时解决以下问题：

1. 页面文件过大，业务编排和视觉实现混杂。
2. 相同交互模式存在多套实现。
3. 重复 CSS 导致间距、字号、圆角和颜色逐渐不一致。
4. 组件与具体后端 DTO 耦合，难以跨身份和业务入口复用。
5. 过度抽象又可能产生难以理解的万能组件。

## 2. 目标

### 2.1 核心目标

- 建立全局公共组件、分包内部组件、行为 composable、领域模块和页面编排的清晰归属结构。
- 页面主要负责路由参数、页面级权限、业务入口和模块编排。
- 将分页、详情加载、确认操作、表单提交和实体选择等重复行为集中到可测试的模块中。
- 将房源、租约、带看、成员、任务等业务概念沉淀为领域组件。
- 使用 Wot UI 和 UnoCSS 统一视觉与交互，显著减少页面局部 CSS。
- 保持微信小程序和 H5 行为一致。
- 保持组件接口灵活，但不引入配置驱动的万能页面引擎。

### 2.2 成功标准

- 所有标准分页页面使用统一分页模块。
- 所有标准底部弹层使用统一 BottomSheet 模式。
- 所有标准详情页使用统一异步状态骨架。
- 所有组织租赁表单使用统一表单页和提交区域。
- 页面不再重复声明卡片、工具栏、列表、标题和弹层基础样式。
- 组织房源详情页控制在约 350 行以内。
- `src/components/app` 的纯 UI 组件不存在 house、member、team、lease 等业务类型判断；跨包领域组件只接收稳定展示模型。
- 常规布局主要由 UnoCSS utilities 和项目 shortcuts 表达。
- H5 与微信小程序构建、类型检查和主要流程验收通过。

## 3. 非目标

此次改造不包含：

- 不建立 JSON 或 Schema 驱动的通用列表、详情、表单页面引擎。
- 不修改后端接口和原始业务字段。
- 不修改自动生成的 OpenAPI client。
- 不顺带重构与组件化无关的业务模块。
- 不因为视觉相似就强行合并行为不同的业务组件。
- 不引入 Tailwind CSS 包；继续使用现有 UnoCSS 提供 Tailwind 风格 utilities。
- 初始阶段不引入 @wot-ui/unocss-preset，优先复用当前 UnoCSS、Wot UI themeVars 和项目主题变量。
- 不修改多语言文件、package.json 或锁文件，除非后续出现明确需求并单独确认。

## 4. 设计原则

### 4.1 深模块

一个值得抽取的模块应当通过较小的接口隐藏较多重复行为。

适合抽取的情况：

- 在多个页面重复出现结构和行为。
- 能统一加载、错误、安全区、滚动或交互规范。
- 单个复杂业务区块虽然只有一个调用点，但可以被独立理解和测试。
- 删除模块后，相同复杂度会重新散落到多个页面。

不适合抽取的情况：

- 仅包装一层 view。
- 只隐藏两三行无语义的 utility class。
- 需要二十多个业务字段才能正常工作。
- 共享组件内部需要根据业务类型执行大量条件分支。

### 4.2 稳定内核与灵活外壳

通用组件的扩展顺序为：

1. 插槽：替换内容和结构。
2. 语义化 props：控制稳定行为。
3. CSS 变量：控制视觉规格。
4. 安全的底层属性和事件透传。
5. 领域包装组件：承接业务差异。

通用组件不通过堆积大量 props 实现灵活性。

### 4.3 展示模型

同一个业务概念存在多种接口 DTO 时，先由领域适配函数转换成展示模型，再交给组件渲染。

组件不负责识别 DTO 类型，也不在内部兼容多个不稳定的接口结构。

### 4.4 状态归属

- 页面拥有路由参数、页面级权限和跨模块编排。
- 领域 composable 拥有业务请求和业务操作状态。
- 共享 composable 拥有分页、并发控制、确认操作等通用行为。
- 展示组件通过 props 接收状态，通过 emits 输出语义事件。
- 复杂领域区块可以通过自身 composable 独立加载，避免拖累整个页面。

### 4.5 按可见范围归属

目录归属首先由实际使用范围决定，不按组件外观或未来可能复用的猜测决定：

1. 仅一个页面或一个业务子模块使用：放到对应页面模块的 `components/`。
2. 同一分包的多个页面使用：提升到该分包根部的 `components/`。
3. 被主包内多个业务模块复用、跨主包与分包复用，或者被两个及以上分包复用：提升到 `src/components/`。
4. 分包专属的接口适配、领域规则和 composable 也放在该分包内部。
5. 跨主包或跨分包复用的非 Vue 业务能力才放在 `src/features/`。
6. 主包和全局模块不得依赖分包内部代码，分包之间不得互相依赖。

`Section` 是一种承担页面区块职责的 Vue 组件，不建立独立的 `sections/` 归属体系。区块组件放在相应层级的 `components/` 中，通过 `Section` 后缀表达职责，例如 `HouseBasicInfoSection.vue`。

## 5. 目标架构

    frontend_miniprogram/src/
    ├── components/                         # 主包及所有分包可用的公共组件
    │   ├── app/
    │   ├── house/
    │   └── utils/
    │       └── navigation.ts               # 只服务导航组件表现层的纯函数
    ├── features/
    │   └── houses/                         # 跨主包、跨分包的公共房源能力
    ├── hooks/                              # 与业务无关的公共组合式能力
    ├── style/
    │   └── theme/                          # 全局主题变量与 Wot UI themeVars
    ├── utils/
    │   └── pagination/                     # 跨层复用的无状态分页工具
    ├── pages/                              # 主包页面
    │   └── account/
    │       └── components/                 # 主包账号模块专属组件
    └── pages-org-rental/                   # 组织租赁分包
        ├── api/                            # 分包专属接口适配
        ├── domain/                         # 分包专属纯业务规则
        ├── composables/                    # 分包级复用行为
        ├── components/                     # 整个分包复用的组件
        ├── houses/
        │   └── components/                 # 组织房源模块专属组件
        ├── buildings/
        │   └── components/
        └── leases/
            └── components/

依赖方向：

    主包页面 / 分包页面
      ↓
    同范围 components、composables、domain
      ↓
    src/components 与跨包 features
      ↓
    hooks、utils、style/theme
      ↓
    Wot UI、UnoCSS、UniApp

### 5.1 依赖规则

- `src/components/app` 不依赖分包代码或具体后端 DTO。纯 UI 组件不得依赖 Store、业务路由和业务接口；确实跨模块复用的应用壳组件如 `AppLoginGuide` 可以依赖全局 Store 或路由，但必须通过小接口隐藏这些依赖。
- `src/components/house` 可以依赖跨包房源展示模型和纯格式化函数，但不得依赖任一分包。
- `src/hooks` 不依赖具体业务类型，请求函数由调用方注入。
- `src/components/utils` 只承载服务组件表现层的纯工具，不放业务规则；自定义导航布局、滚动阈值和透明度计算位于 `src/components/utils/navigation.ts`，响应式滚动状态放在 `src/hooks/useNavigationScrollState.ts`。
- `src/utils` 只承载真正跨组件、请求和业务模块复用的无状态通用工具，具体业务规则仍放在对应 `features`、`domain` 或分包内部；主题统一放在 `src/style/theme`。
- `src/features` 只承载已经跨主包或跨分包复用的业务能力。
- 分包内部可以依赖 `src/components`、`src/features`、`src/hooks`、`src/utils`、`src/style`、`core`、`infra` 和生成的 OpenAPI client。
- 主包和全局目录禁止依赖 `pages-*`，一个分包禁止依赖另一个分包。
- 领域组件不直接决定页面跳转，统一发送 open、edit、delete、select、action 等语义事件。
- 页面不能重新实现公共组件和公共 composable 已提供的分页、错误、弹层和安全区逻辑。

### 5.2 分包接口模块

自动生成的 `src/services/openapi/` 继续作为全项目基础代码保留在分包外部，不手工修改。

仅由组织租赁分包使用的手写请求适配进入：

    src/pages-org-rental/api/
    ├── organization-rental.ts    # 页面和组件使用的稳定接口
    └── client.ts                 # 内部 OpenAPI、HTTP 和上传适配

`organization-rental.ts` 是该分包 API 模块的外部接口，`client.ts` 是实现细节，负责隐藏 OpenAPI 调用参数、组织作用域、HTTP 补充接口和上传实现。页面不得直接依赖 `client.ts`。原 `features/organization-rental/service.ts` 不再以 feature service 形式存在。只有签约、配租等场景出现真正的多步骤业务编排时，才在对应业务模块内部增加 `service.ts`。

## 6. 全局公共组件

本节组件统一放在 `src/components/`。基础应用组件进入 `src/components/app/`，跨包房源组件进入 `src/components/house/`。

### 6.1 AppPage

用于统一 list-page、page-shell、detail-page 和 form-page。

主要接口：

- variant：list、detail、form、plain。
- gutter：none、compact、normal、loose。
- tabbar：是否为 TabBar 页面。
- safeAreaBottom：是否处理底部安全区。
- reserveFooterSpace：是否为固定操作栏预留空间。
- navigation、header、before、default、after、footer、overlay 插槽。

主要实现：

- 页面最小高度、背景、统一间距。
- 自定义导航栏、TabBar 和固定底栏的空间协调。
- H5 与小程序安全区差异。

AppPage 不处理请求状态。

### 6.2 AppEmpty、AppLoading、AppErrorView

保留现有三个反馈组件，迁入 `src/components/app/`。

改造要求：

- 使用 UnoCSS utilities 表达普通布局。
- 支持外部替换图标、标题、说明和操作区域。
- AppErrorView 继续支持可重试和不可重试错误。
- 错误输入优先接受 AppError，同时保留简单 message 接口。

### 6.3 AppRecordCard

统一记录列表卡片结构。

插槽：

- leading
- header
- title
- status
- default
- description
- meta
- footer
- actions

行为 props：

- clickable
- selected
- disabled
- variant：default、compact、prominent。

组件内部负责：

- 卡片间距、圆角和按压反馈。
- 标题溢出处理。
- 状态区和操作区布局。
- 操作区域点击不冒泡。
- 禁用和选中状态。

组件不接受具体业务字段。

### 6.4 AppStatusTag

统一状态标签的尺寸、variant 和语义色。

输入为稳定展示结构：

    interface StatusPresentation {
      text: string
      tone: 'default' | 'primary' | 'success' | 'warning' | 'danger'
    }

状态映射由领域函数完成，AppStatusTag 不理解业务状态码。

### 6.5 AppSection

统一 section-title、section-heading、section-card 等结构。

插槽：

- icon
- title
- caption
- badge
- action
- default
- footer

行为 props：

- variant：plain、card、notice、warning、private。
- collapsible
- defaultExpanded
- loading

组件负责标题、说明、操作区、卡片外观和可折叠行为。

## 7. 全局公共交互组件

### 7.1 AppAsyncContent

统一 loading、error、empty、default 四种状态。

接口：

- loading
- error
- empty
- retryable
- loadingText
- emptyText
- errorTitle
- keepContentOnRefresh
- retry 事件
- loading、error、empty、default 插槽

首次加载可以替换内容，后台刷新可以保留已有内容并显示轻量刷新状态。

### 7.2 AppPagedList

统一分页列表视图。

接口：

- items
- itemKey：字段名或函数。
- loading
- refreshing
- loadingMore
- finished
- error
- emptyText
- finishedText
- layout：stack、cell、grid、custom。
- retry 事件
- before、item、empty、error、loadmore、after 插槽

组件不假设列表项一定是卡片。

### 7.3 AppListToolbar

覆盖搜索加新增、搜索加筛选、分段切换加新增等场景。

接口：

- keyword 双向绑定。
- searchable
- searchPlaceholder
- actionText
- actionLoading
- actionDisabled
- search、clear、action 事件
- before、filters、actions、after 插槽

组件负责搜索框伸缩、小屏换行和工具栏外观。

### 7.4 AppBottomSheet

封装标准底部 wd-popup。

稳定约束：

- position 为 bottom。
- 默认启用 round、closable、safe-area-inset-bottom 和 root-portal。
- 统一内容 padding、滚动区域和固定 Footer。
- 统一键盘弹出时的可见区域处理。

接口：

- visible 双向绑定。
- title
- description
- height：compact、default、tall。
- scrollable
- closeOnClickModal
- lockScroll
- lazyRender
- header、default、footer 插槽
- open、opened、close、closed 事件

允许通过 CSS 变量覆盖最大高度，但不允许页面重新传入大段 custom-style。

### 7.5 AppEntityPickerSheet

用于楼栋、房东、租客、成员、负责人、角色等实体选择。

接口：

- visible、keyword、selected 双向绑定。
- items
- itemKey
- selection：single、multiple。
- searchable
- paged
- loading
- finished
- error
- item、before-list、empty、create、footer 插槽
- search、load-more、select、confirm 事件

具体数据加载由 useEntityPicker 或领域包装组件负责。

### 7.6 AppFormPage

统一新建和编辑表单页面。

接口：

- loading
- error
- submitting
- submitText
- submitDisabled
- reserveActionSpace
- retry、submit 事件
- header、default、before-actions、actions、overlay 插槽

默认实现一个主提交按钮；复杂表单可以完全替换 actions 插槽。

表单字段、校验 Schema、DTO 转换和创建更新判断保留在领域层。

### 7.7 AppDetailPage

统一详情页面骨架。

接口：

- resource
- loading
- refreshing
- error
- retry 事件
- header、default、actions、overlay 插槽

内部组合 AppPage、AppAsyncContent 和固定操作区域。

### 7.8 AppActionBar

作为统一的底部操作栏组件。现有 `AppBottomAction` 暂不直接删除，待调用关系和替代范围确认后再处理。

主要职责：

- 固定底部布局。
- 底部安全区。
- 页面内容占位。
- 主操作、次操作和更多操作区域。
- 禁用、加载和多按钮自适应。

接口以 slots 为主，避免通过 action 配置数组承载业务逻辑。

## 8. 公共行为模块

与具体业务无关、能够跨主包或分包复用的组合式能力放在 `src/hooks/`。如果 composable 只服务一个分包或分包内的一个业务模块，应下沉到对应分包的 `composables/`。

非 composable 的公共基础能力按职责归位：只服务组件表现层的导航纯函数放在 `src/components/utils/navigation.ts`，跨层复用的无状态分页工具放在 `src/utils/pagination/`，主题变量与 Wot UI `themeVars` 放在 `src/style/theme/`。项目不设置 `shared` 兜底目录。

### 8.1 usePagedPage

在现有 usePagedQuery 基础上提供完整页面生命周期。

状态：

- items
- total
- page
- loading
- refreshing
- loadingMore
- error
- finished

操作：

- refresh
- loadMore
- reset
- replace
- upsert
- remove

配置：

- loader
- pageSize
- enabled
- refreshOnShow
- pullDownRefresh
- reachBottom
- preserveOnRefresh
- initialData
- keyOf
- transform
- merge

统一处理：

- 请求竞态和过期响应。
- 首次加载、刷新、追加加载的独立状态。
- onShow、onPullDownRefresh、onReachBottom。
- uni.stopPullDownRefresh。
- AppError 标准化。

钱包、收藏和任务等双列表页面使用多个独立实例，不向模块加入业务分支。

### 8.2 useDetailPage

用于标准详情页：

- 解析路由参数。
- 加载详情。
- 可选 onShow 刷新。
- 请求竞态保护。
- AppError 标准化。
- refresh、replace 和 patch 操作。

resolveKey 和 loader 由领域调用方传入。

### 8.3 useFormSubmit

用于统一表单提交：

- 校验。
- 防止重复提交。
- 创建或更新请求。
- 成功反馈。
- 失败错误标准化。
- 成功后返回、刷新或替换数据。

业务校验和序列化函数由领域模块传入。

### 8.4 useEntityPicker

用于实体选择行为：

- 打开、关闭和清理。
- 搜索关键字。
- 防抖和竞态保护。
- 分页或一次性加载。
- 单选和多选。
- 已选项目回显。

领域包装组件负责提供 loader 和展示项。

### 8.5 useConfirmedAction

替代页面直接调用 uni.showModal 后再手写 pending、请求和提示。

每次 run 可以动态提供：

- confirm 文案。
- execute 操作。
- successText。
- onSuccess。
- onError。
- pendingKey。

底层初始阶段继续使用跨端稳定的 uni.showModal，调用方不依赖具体弹窗实现。

## 9. 现有组件调整

### 9.1 迁入全局公共组件目录

以下组件已被主包或多个分包使用，迁入 `src/components/`：

    src/components/app/
    ├── AppActionBar.vue
    ├── AppAsyncContent.vue
    ├── AppBottomSheet.vue
    ├── AppBottomAction.vue
    ├── AppCustomNavigation.vue
    ├── AppDetailPage.vue
    ├── AppEmpty.vue
    ├── AppEntityPickerOption.vue
    ├── AppErrorView.vue
    ├── AppListToolbar.vue
    ├── AppLoading.vue
    ├── AppLoginGuide.vue
    ├── AppListState.vue
    ├── AppPage.vue
    ├── AppPagedList.vue
    ├── AppRecordCard.vue
    ├── AppSection.vue
    ├── AppStateCard.vue
    └── AppStatusTag.vue

    src/components/house/
    ├── HouseCard.vue
    ├── HouseDetailNavigation.vue
    └── HouseMediaGallery.vue

`HouseCard` 后续改为接受统一展示模型，解除对 `PublicHouseListOut` 的直接依赖。`HouseMediaGallery` 和 `HouseDetailNavigation` 已被公开房源分包与组织租赁分包共同使用，因此属于全局公共房源组件。

### 9.2 迁入组织租赁分包

分包内多个模块使用：

    src/pages-org-rental/components/
    ├── AppActionSheetRow.vue
    ├── AppEntityPickerSheet.vue
    └── AppFormPage.vue

仅一个业务模块使用：

    src/pages-org-rental/buildings/components/BuildingCard.vue
    src/pages-org-rental/estates/components/EstateCard.vue
    src/pages-org-rental/houses/components/OrganizationHouseCard.vue
    src/pages-org-rental/leases/components/OrganizationLeaseCard.vue
    src/pages-org-rental/viewings/components/OrganizationViewingCard.vue

### 9.3 主包专属组件

主包单模块专属组件同样就近放置：

    src/pages/me/components/AppModeSwitcher.vue

### 9.4 未使用组件

`AppBottomAction.vue` 和 `AppListState.vue` 当前没有实际调用，但它们仍属于通用组件。为避免继续保留第二套组件目录，随其他公共组件迁入 `src/components/app/`，暂不删除或扩展。后续确认替代关系后再单独处理。

### 9.5 非组件业务代码

仅服务组织租赁分包的代码迁入分包：

    src/services/manual/organization-rental.ts
      → src/pages-org-rental/api/client.ts

    src/features/organization-rental/service.ts
      → 由新的分包 api 模块直接替代，不在分包外保留长期转发层

    src/domain/organization-rental.ts
      → src/pages-org-rental/domain/organization-rental.ts

新的 `pages-org-rental/api/organization-rental.ts` 提供页面需要的稳定请求名称和类型导出，内部调用同目录 `client.ts`，避免在分包外再保留一层 `service.ts`。自动生成的 `src/services/openapi/` 不移动。当前跨主包、房东分包和组织租赁分包使用的 `src/features/houses/` 继续保留在分包外部。

## 10. 领域组件设计

### 10.1 房源

建议目录：

    components/house/
    ├── HouseCard.vue
    ├── HouseMediaGallery.vue
    └── HouseDetailNavigation.vue

    features/houses/
    ├── composables/
    └── presentation/
        ├── house-card.ts
        └── house-detail.ts

只有被主包或多个分包共同使用的房源组件、composable 和展示模型才进入上述全局目录。组织房源经营、AI 分析、内部信息、房态管理等分包专属模块进入 `pages-org-rental/houses/`：

    pages-org-rental/houses/
    ├── components/
    │   ├── OrganizationHouseCard.vue
    │   ├── HouseMediaEditor.vue
    │   ├── HouseDetailSummary.vue
    │   ├── HouseInspectionAlert.vue
    │   ├── HousePublicInfoSection.vue
    │   ├── HouseInternalInfoSection.vue
    │   ├── HouseLocationSection.vue
    │   ├── HouseAIInsightSection.vue
    │   ├── HouseBusinessRecordsSection.vue
    │   ├── HouseManagementSheet.vue
    │   └── HouseStatusSheet.vue
    └── composables/
        ├── useHouseDetail.ts
        ├── useHouseAIInsight.ts
        ├── useHouseBusinessRecords.ts
        └── useHouseActions.ts

HouseCard 使用统一展示模型，覆盖公开房源、收藏房源、房东房源和组织房源。

    interface HouseCardViewModel {
      id: number
      title: string
      coverUrl?: string
      facts: string[]
      location?: string
      rentText?: string
      status?: StatusPresentation
      tags?: string[]
      publisherText?: string
      available?: boolean
    }

不同接口 DTO 通过 presentation 适配函数转换。

### 10.2 组织租赁

组织租赁模块仅由 `pages-org-rental` 分包使用，全部放在该分包内部，不再建立 `src/features/organization-rental/`。

列表和详情组件：

- EstateCard
- BuildingCard
- RentalHouseCard
- ContactCard
- ViewingCard
- LeaseCard
- AllocationRecordCard
- ViewingTimeline
- LeaseSummary
- RentalDataRows

选择组件：

- BuildingPickerSheet
- HousePickerSheet
- ContactPickerSheet
- LandlordPickerSheet
- TenantPickerSheet

ViewingCard 和 LeaseCard 使用领域展示模型，分别适配租客、房东和组织 DTO。

归属示例：

    pages-org-rental/components/                  # 多个组织租赁子模块使用
    pages-org-rental/houses/components/           # 仅组织房源使用
    pages-org-rental/viewings/components/         # 仅组织带看使用
    pages-org-rental/leases/components/           # 仅组织租约使用
    pages-org-rental/allocation/components/       # 仅配租使用

### 10.3 组织管理

组织管理组件放在 `pages-org-admin/` 内，并按使用范围进入分包根部或具体业务模块的 `components/`。

列表组件：

- MemberCard
- TeamCard
- RoleCard
- RoleBindingCard
- InvitationCard
- NotificationDispatchCard
- NotificationDeliveryCard

编辑和选择组件：

- MemberPickerSheet
- TeamMemberPickerSheet
- RoleMemberPickerSheet
- PermissionPickerSheet
- SettingItemCard
- SettingEditorSheet

订阅组件：

- SubscriptionPlanCard
- PaymentOrderCard
- InvoiceProfileCard
- InvoiceEditorSheet
- InvoiceRequestCard
- PaymentQrSheet

订阅页面按套餐、订单和开票三个领域区块拆分，不建立一个包含全部业务的 SubscriptionPanel。

### 10.4 组织协作

组织协作组件放在 `pages-org-work/` 内，并按任务、公告等业务模块就近归属。

- TaskCard
- TaskAssignmentCard
- TaskScopeToolbar
- TaskEditorSheet
- AssigneePickerSheet
- TaskProgressActions
- AnnouncementCard
- AnnouncementEditorSheet
- AnnouncementScopePicker
- AnnouncementAcknowledgement

TaskCard 和 TaskAssignmentCard 可以共享展示模型和内部展示模块，但保持不同的操作接口。

### 10.5 账号与安全

账号与安全目前属于主包页面，专属组件分别放在 `pages/account/components/`、`pages/auth/components/` 等页面模块内部。只有被多个主包模块或分包共同使用后才提升到 `src/components/`。

账号安全页面拆分为：

- SecuritySummaryCard
- ReauthenticationPanel
- TotpAuthenticatorPanel
- RecoveryCodesPanel
- PasskeyPanel
- PasskeyItem
- SecurityCapabilityNotice

其他账号领域组件：

- ProfileEditor
- RealNameStatusCard
- RealNameAuditRecord
- WalletSummaryCard
- WalletLedgerCard
- WithdrawalCard
- ReferralSummaryCard
- ReferralRecordCard

每一种安全认证方式独立维护自己的编辑、提交和错误状态。

### 10.6 首页与工作台

共享模式组件：

- AppHero
- AppActionGrid
- AppMetricGrid
- AppMetricCard
- AppNoticeCard

工作台领域组件：

- ModeSwitcher
- TenantHomeContent
- LandlordHomeContent
- OrganizationHomeContent
- OrganizationUrgentTasks
- OrganizationAnnouncementPreview

首页、收藏、房源和我的页面中的多身份分支分别拆入对应身份内容组件。

首页专属组件放在 `pages/index/components/`，我的页面专属组件放在 `pages/me/components/`。确实跨多个主包模块或分包复用的应用壳组件才进入 `src/components/app/`。

### 10.7 消息

消息专属组件放在 `pages/messages/components/`。

- NotificationCard
- NotificationFilter
- NotificationPreferenceGroup
- NotificationTargetLink

通知卡片负责已读状态、分类、时间和目标摘要；页面负责分页与批量操作。

## 11. 组织房源详情拆分

目标页面：

frontend_miniprogram/src/pages-org-rental/houses/detail.vue

改造后结构：

    <AppDetailPage>
      <HouseMediaGallery />
      <HouseDetailSummary />
      <HouseInspectionAlert />
      <HouseAIInsightSection />
      <HousePublicInfoSection />
      <HouseInternalInfoSection />
      <HouseLocationSection />
      <HouseBusinessRecordsSection />

      <template #actions>
        <HouseDetailActions />
      </template>

      <HouseManagementSheet />
      <HouseStatusSheet />
    </AppDetailPage>

上述组织经营专属区块统一放在 `pages-org-rental/houses/components/`。`HouseMediaGallery` 因同时被公开房源分包使用，继续从 `src/components/house/` 引用。

页面保留：

- 解析 houseId。
- 顶层房源详情加载。
- 页面级权限判断。
- 区块编排。
- 导航事件处理。

区块独立性：

- AI 分析由 useHouseAIInsight 独立加载和失败。
- 带看、租约由 useHouseBusinessRecords 独立加载和失败。
- 房态、发布和下架操作由 useHouseActions 管理。
- AI 或业务记录失败不能阻止房源基本信息展示。

## 12. UnoCSS 与样式规范

### 12.1 样式优先级

1. Wot UI 标准组件。
2. UnoCSS utility classes。
3. 项目级 UnoCSS shortcuts。
4. app-* 和 Wot UI 主题变量。
5. 必要的组件局部 CSS。

### 12.2 UnoCSS 主题

将 `src/style/theme/tokens.scss` 中的语义变量映射到 uno.config.ts：

- 品牌、成功、警告、危险、价格等语义色。
- 页面、卡片、弱背景。
- 主文字、次文字、弱文字。
- 页面间距。
- 圆角等级。
- 卡片、Hero 和底部操作栏阴影。

颜色真实值只在主题变量中维护，UnoCSS theme 引用 CSS 变量。

### 12.3 Shortcuts

只为稳定设计语言建立 shortcuts，例如：

- app-card
- app-page-shell
- app-row-between
- app-stack-list
- app-title
- app-muted
- app-section-gap

禁止为单个页面创建专用 shortcut。

### 12.4 Wot UI

- 按钮、输入框、选择器、标签、弹层和列表状态优先使用 wd-*。
- 外观优先通过 ConfigProvider themeVars 和组件主题变量调整。
- 禁止页面重复深度覆盖 Wot UI 内部类名。
- custom-style 不用于拼接大段弹层布局。
- 暂不引入 @wot-ui/unocss-preset。

### 12.5 局部 CSS 例外

仅以下情况允许保留 scoped CSS：

- env(safe-area-inset-bottom) 的复杂计算。
- 自定义导航栏胶囊位置。
- Swiper、视频、地图等媒体布局。
- 动画和 keyframes。
- 小程序平台条件样式。
- Wot UI 未开放变量的必要覆盖。
- utilities 无法稳定表达的复杂文本截断或伪元素。

普通 Flex、Grid、间距、字号、颜色、圆角和阴影不得继续手写 CSS。

### 12.6 动态类名

UnoCSS 不能稳定扫描任意字符串拼接，因此动态状态类使用静态映射。

真正动态的图标或变体加入 safelist。

## 13. 错误与状态处理

- 所有请求异常统一转换为 AppError。
- 页面和组件不使用空 catch 隐藏错误。
- AppAsyncContent 处理页面级加载和错误。
- 复杂详情区块拥有独立错误状态。
- usePagedPage 区分首次加载失败和追加加载失败。
- useFormSubmit 保留后端字段错误和通用错误。
- useConfirmedAction 统一确认、pending、成功反馈和失败处理。
- 无权限属于不可重试的明确状态，不与网络错误混用。

## 14. 改造批次

### 第一批：样式基础与共享模块

- 扩充 UnoCSS theme、shortcuts 和 safelist。
- 增强 AppPage。
- 新增 AppAsyncContent。
- 新增 AppSection。
- 新增 AppRecordCard。
- 新增 AppBottomSheet。
- 统一使用 AppActionBar；AppBottomAction 保留到替代关系确认。

先保持业务页面不大规模迁移，稳定共享接口。

### 第二批：分页列表试点

试点页面：

- 组织小区列表。
- 组织楼栋列表。
- 组织带看列表。
- 组织租约列表。
- 组织房源列表。

引入：

- usePagedPage。
- AppPagedList。
- AppListToolbar。
- 对应领域卡片。

试点稳定后迁移其余分页页面。

### 第三批：弹层与表单

- 将标准 wd-popup 迁移到 AppBottomSheet。
- 实现 AppEntityPickerSheet 和 useEntityPicker。
- 迁移楼栋、小区、房源、带看和租约表单。
- 抽取房源媒体编辑器和领域选择器。

### 第四批：详情页

- 引入 AppDetailPage 和 useDetailPage。
- 先迁移租约、带看和消息等简单详情。
- 最后拆分组织房源详情。

### 第五批：复杂业务

- 组织成员、团队、角色和权限。
- 任务与公告。
- 账号安全。
- 订阅和支付。
- 首页和多身份页面。

## 15. 验证策略

### 15.1 自动验证

所有 Node 命令前先执行 nvm use 22。

按改造范围执行：

- pnpm lint
- pnpm type-check
- pnpm test
- pnpm build:h5:prod
- pnpm build:mp:prod

行为模块优先测试：

- usePagedPage 的刷新、追加、竞态和错误。
- useConfirmedAction 的取消、成功和失败。
- useEntityPicker 的搜索竞态和多选。
- 展示模型适配函数。
- 房源户型“单间”规则继续复用共享格式化函数。

### 15.2 视觉验证

重点验证：

- 微信小程序与 H5 页面间距。
- 底部安全区。
- 固定操作栏占位。
- BottomSheet 高度、滚动和键盘避让。
- 列表首次加载、追加、完成和失败状态。
- Wot UI 主题一致性。
- 多身份页面切换。

临时截图保存到：

    .codex/audits/miniprogram-component-refactor/

截图不写入项目根目录，默认不提交。

## 16. 验收清单

- [ ] 公共模块和分包模块的依赖方向符合设计。
- [ ] 所有 Vue 组件均进入对应可见范围的 `components/`，没有独立 `sections/` 归属体系。
- [ ] 分包专属组件、接口适配、领域规则和 composable 均位于对应分包内部。
- [ ] 主包和全局模块没有依赖任一分包，分包之间没有互相依赖。
- [ ] 通用组件通过插槽扩展，不包含业务类型判断。
- [ ] 24 个分页页面统一使用分页模块。
- [ ] 标准底部弹层统一使用 AppBottomSheet。
- [ ] 13 个详情页使用统一异步状态骨架。
- [ ] 5 个组织租赁表单使用统一表单页面模式。
- [ ] 组织房源详情页不超过约 350 行。
- [ ] 页面普通布局主要使用 UnoCSS。
- [ ] 重复卡片、标题、工具栏和弹层 CSS 已收口。
- [ ] 动态 UnoCSS 类名使用静态映射或 safelist。
- [ ] 未引入配置驱动的万能页面组件。
- [ ] 未修改后端字段和自动生成 API client。
- [ ] H5 和微信小程序构建通过。
- [ ] 关键交互完成视觉验收。

## 17. 风险与控制

### 17.1 一次性迁移范围过大

控制方式：先建立全局公共目录和分包归属规则，再选择结构最一致的组织租赁列表试点，保持每一批都可独立运行和验收。

### 17.2 组件接口过于宽泛

控制方式：共享组件优先使用插槽；业务字段超过合理范围时创建领域包装组件。

### 17.3 UnoCSS 动态类未被构建扫描

控制方式：使用静态映射，必要时加入 safelist，并同时执行 H5 与微信小程序生产构建。

### 17.4 Wot UI 小程序样式隔离

控制方式：优先使用 themeVars、CSS 变量和 custom-class；确实需要内部覆盖时再明确配置 styleIsolation，并进行微信小程序验证。

### 17.5 组件化改变原有行为

控制方式：先保留现有请求和业务函数，只迁移结构与通用状态；完成行为等价验证后再收口领域逻辑。

### 17.6 页面拆分后请求耦合

控制方式：主资源、AI、带看和租约采用独立状态；局部失败不升级为整页失败。

## 18. 最终决策

本次采用分层组件化方案：

- `src/components/` 是主包与所有分包可使用的公共组件目录。
- 分包专属组件进入对应 `pages-*/components/` 或业务模块的 `components/`。
- `Section` 作为组件类型处理，通过名称表达职责，不建立独立目录体系。
- 分包专属接口适配、领域规则和 composable 一并放入分包。
- `src/features/` 只承载已经跨主包或跨分包复用的业务能力。
- 自动生成的 OpenAPI client 保留在 `src/services/openapi/`，分包专属手写请求适配进入分包 `api/`。
- 页面保持为路由、权限和模块编排层。
- 公共 composable 隐藏跨业务重复状态与生命周期，分包专属 composable 就近放置。
- Wot UI 与 UnoCSS 作为主要视觉实现方式。
- 通过插槽、语义 props、CSS 变量和领域包装组件保证灵活性。
- 不引入配置驱动页面引擎，不追求无差别组件化。
