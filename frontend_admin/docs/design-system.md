# 链云空间管理端设计系统

> 面向 `frontend_admin` 的项目级设计规范，供设计、开发和 AI 编码助手共同使用。
>
> 版本：`0.5`　最近核对：`2026-08-22`
>
> 本文描述界面规则，不替代运行时主题配置。代码仍应使用 Ant Design token 和项目共享组件。

## 0. AI 快速规则

### 0.1 规范标签

| 标签 | 含义 | 执行方式 |
| --- | --- | --- |
| `【强制】` | 项目规则或本设计系统确定的约束 | 新增和改造界面必须遵守 |
| `【当前实现】` | 源码中正在生效的事实 | 可作为依据，但不自动等于长期标准 |
| `【建议】` | 没有更具体规则时的默认做法 | 优先采用；偏离时说明原因 |
| `【待定】` | 尚未形成项目结论 | AI 不得自行补全为品牌或全局规则 |

### 0.2 决策优先级

冲突时按以下顺序判断：

1. 根目录及更近目录的 `AGENTS.md`；
2. 本文的 `【强制】`；
3. 同业务域的活跃页面和共享组件；
4. 本文的 `【建议】`；
5. Ant Design / ProComponents 官方默认模式；
6. 本文记录的 `【当前实现】`。

`src/pages/dashboard/*`、`src/pages/form/*`、`src/pages/list/*`、`src/pages/profile/*`、`src/pages/Welcome*` 等模板页面，以及 `docs/cheatsheet.*.md`，不作为业务设计依据。

### 0.3 AI 输出要求

`【强制】`

- 开始前检查同业务域页面、共享组件、格式化函数和当前组件 API。
- 优先延续已有信息架构；没有产品依据时，不创造新品牌色、术语、Logo 或复杂动效。
- 新增 UI 必须覆盖加载、空、错误、无权限和窄屏状态中与任务相关的部分。
- 只修改任务范围内的文件，不借单页任务进行无关的全局重构。

## 1. 产品与实现基础

### 1.1 产品定位

`【当前实现】` 链云空间是面向组织、团队与个人业务的多租户管理端，主要承载租赁管理、团队协作、空间设置、订阅支付和平台管理。

`【强制】` 界面优先服务于高频操作、批量处理、状态判断和数据核对，并明确当前组织或空间上下文。

### 1.2 技术基础

`【当前实现】`

- React 19、Umi Max 4、Ant Design 6、ProComponents 3。
- Ant Design 全局变体为 `outlined`。
- 主应用挂载于 `/dashboard/`。
- 主题与布局入口：`config/config.ts`、`config/defaultSettings.ts`、`src/app.tsx`。

### 1.3 样式实现顺序

`【强制】`

1. Tailwind CSS v4：布局、尺寸、间距和简单响应式；
2. `antd-style` / `createStyles`：需要读取主题 token 的组件样式；
3. CSS Modules：复杂且完全局部的样式；
4. Less：仅维护遗留全局样式。

同时遵守：

- token 能表达的颜色、圆角、字体、边框、阴影和动效，不写死局部值。
- 优先复用 Ant Design、ProComponents 和项目共享组件。
- 图标优先使用 `@ant-design/icons`。
- 不在 `src/services/openapi` 或 `src/services/allauth` 中承载 UI 逻辑。

## 2. 视觉基础

### 2.1 颜色

#### 当前主题

`【当前实现】` `colorPrimary = #1677FF` 由项目明确配置，其余色阶由 Ant Design 当前浅色主题算法生成。

| 角色 | Token | 当前值 |
| --- | --- | --- |
| 主色 | `colorPrimary` | `#1677FF` |
| 主色浅背景 | `colorPrimaryBg` | `#E6F4FF` |
| 主色边框 | `colorPrimaryBorder` | `#91CAFF` |
| 成功 | `colorSuccess` | `#52C41A` |
| 警告 | `colorWarning` | `#FAAD14` |
| 错误 | `colorError` | `#FF4D4F` |
| 主要文字 | `colorText` | `rgba(0,0,0,0.88)` |
| 次要文字 | `colorTextSecondary` | `rgba(0,0,0,0.65)` |
| 页面背景 | `colorBgLayout` | `#F5F5F5` |
| 容器背景 | `colorBgContainer` | `#FFFFFF` |

`【强制】`

- 代码使用 token，不重复写入表中的当前色值。
- 成功、警告、错误和信息状态使用对应语义 token 或组件 `status`。
- 状态不能只依赖颜色，必须同时提供文字、图标或形状线索。
- 局部强调色必须有稳定业务含义，不得替代系统语义色。

`【当前实现】` 工作台、订阅和图表存在蓝、紫、橙、青等局部色，它们不是全局品牌 token。

### 2.2 字体

`【当前实现】`

- 主字体：`AlibabaSans`，回退到系统无衬线字体。
- 已加载字重：300、400、500、600、700。
- 常用字号：`12 / 14 / 16 / 20px`。
- 普通正文和控件以 `14px` 为基准。

`【建议】`

| 层级 | Token / 常用值 | 用途 |
| --- | --- | --- |
| 辅助 | `fontSizeSM / 12px` | 标签、说明、次要元数据 |
| 正文 | `fontSize / 14px` | 表单、表格、正文、按钮 |
| 强调 | `fontSizeLG / 16px` | 区块标题、关键字段 |
| 页面级 | `20px` 附近 | 独立详情标题、核心数字 |

强调优先通过信息层级、字重和留白完成，不随意放大字号。

### 2.3 尺寸与形态

`【当前实现】`

| 类别 | 当前常用值 |
| --- | --- |
| 间距 | `4 / 8 / 12 / 16 / 24 / 32px` |
| 圆角 | `4 / 6 / 8px` |
| 控件高度 | `24 / 32 / 40px`（small / middle / large） |
| 动效时长 | `0.1 / 0.2 / 0.3s` |

`【强制】`

- 页面内容区桌面左右内边距为 `24px`，`≤768px` 时为 `16px`。
- 常规表单、筛选器和按钮默认使用 `middle`。
- `small` 仅用于表格行内次级操作或明确受限区域。
- `large` 主要用于登录、注册等聚焦流程。
- 圆角、边框和阴影使用主题 token；阴影只表达浮层、悬浮或层级。
- 优先使用组件默认动效，自定义动效不得阻塞高频操作。

### 2.4 图标、状态与媒体

`【强制】`

- `@/components/AppIcon` 是唯一的图标渲染入口：`name` 用于业务对象图标，`name + state` 用于业务状态图标；页面不使用第二个状态图标组件。
- `@/components/AppStatus` 只维护业务状态到图标、语义色和说明的规则，并提供 `AppStatusTag`；页面不得自行重复映射。
- 语义色 `default / secondary / primary / info / success / warning / error / disabled` 及其 Ant Design token 映射属于 `AppStatus` 的内部状态展示规则，不作为页面需要直接调用的组件。
- 业务对象图标使用 `<AppIcon name="house" />`；业务状态图标使用 `<AppIcon name="house" state={house.status} />`。`AppIcon` 只消费状态解析结果，不在图标注册表中定义领域状态、颜色或说明。
- 对象状态可以同时改变图标和颜色，但不能只依赖颜色；状态文字、图标或形状线索至少还需保留一种。
- 当前业务状态的展示必须同时包含状态文字、状态图标和语义色；Tag 形式优先使用 `AppStatusTag`，筛选项、表单选项等尚未形成状态结果的选择入口可以只显示文字。
- 状态颜色统一由 `AppStatus` 的内部语义色规则通过 Ant Design token 解析；普通对象图标如需装饰色，由调用场景使用主题 token 设置。禁止在注册表中写十六进制、RGB 等固定色值，也不允许页面覆盖既定状态色。
- 通用操作或一次性装饰图标可以使用 `@ant-design/icons`，或直接使用 `<Icon icon="solar:..." />`；不得把本应跨页面统一的业务对象图标散落在页面中。
- Iconify 名称必须是可被构建脚本扫描的静态字符串，不得使用模板字符串或运行时拼接图标名。图标通过离线子集打包，浏览器不得回退到公共 Iconify API。
- 仅图标按钮提供 `aria-label`；含义不明确时增加 `Tooltip`。
- 头像、房源图片和附件必须有加载失败、空值或占位表现。
- 表格缩略图不挤占主要文字；大图通过 Preview、Modal 或详情区域查看。
- 不使用 emoji 代替项目图标。

#### 状态色语义约定

`【强制】` 业务状态先归类为项目语义，再由组件映射到 Ant Design token。页面和插件不得根据个人偏好选择颜色，也不得直接复用后端枚举名称作为 Ant Design 颜色值。

下表中的十六进制颜色是当前浅色主题的设计与验收参考。实现代码必须使用对应 token；暗色主题或主题算法调整时，实际颜色允许随 token 改变，不能将表中的十六进制值复制到组件样式或插件注册表。

| 语义色 | 主色 | 浅背景 | 边框色 | Ant Design token | 表达的业务含义 |
| --- | --- | --- | --- | --- | --- |
| `default` | `#262626` | `#FAFAFA` | `#D9D9D9` | `colorText` | 正常、中性、无需强调，没有明确的正负结果 |
| `secondary` | `#8C8C8C` | `#FAFAFA` | `#D9D9D9` | `colorTextSecondary` | 历史、已过期、空闲、低优先级，仍然可读但弱化展示 |
| `primary` | `#1677FF` | `#E6F4FF` | `#91CAFF` | `colorPrimary` | 当前选中、主对象、品牌主动作，不用于表达业务结果 |
| `info` | `#1677FF` | `#E6F4FF` | `#91CAFF` | `colorInfo` | 已发布、进行中、等待外部流程，当前正常且无需预警 |
| `success` | `#52C41A` | `#F6FFED` | `#B7EB8F` | `colorSuccess` | 已生效、已完成、健康、已成交，表示明确的正向结果 |
| `warning` | `#FAAD14` | `#FFFBE6` | `#FFE58F` | `colorWarning` | 待处理、临期、装修中或需要关注，但尚未失败 |
| `error` | `#FF4D4F` | `#FFF2F0` | `#FFCCC7` | `colorError` | 失败、终止、取消、逾期或异常，需要识别或处理 |
| `disabled` | `#BFBFBF` | `#F5F5F5` | `#D9D9D9` | `colorTextDisabled` | 停用、归档、不可操作，不代表系统错误或风险 |

状态色选择优先级：

1. 已在下方业务对象表中明确的状态，必须使用表中语义；
2. 插件新增状态时，按上表的业务含义归类，并在插件设计说明中记录；
3. 无法确定含义时使用 `default` 或 `secondary`，不得擅自用绿色、黄色或红色制造业务判断；
4. 同一状态在图标、Tag、Badge、时间线和统计卡中必须保持相同语义，具体组件外观可以不同；
5. 状态必须同时显示可读文字，不能只显示颜色或只显示一个无说明图标。

当前核心对象状态映射：

| 对象 | API 状态 | 中文含义 | 语义色 | 浅色主题主色 | 图标语义 |
| --- | --- | --- | --- | --- | --- |
| 房源 `house` | `vacant` | 空置 | `error` | `#FF4D4F` | 房屋提醒；表示当前没有租约且尚未招租，收益中断并需要优先处理 |
| 房源 `house` | `listed` | 招租 | `info` | `#1677FF` | 房屋价格；表示正在正常对外展示 |
| 房源 `house` | `rented` | 已出租 | `success` | `#52C41A` | 房屋确认；表示已完成出租并处于有效占用状态 |
| 房源 `house` | `renovating` | 装修 | `warning` | `#FAAD14` | 房屋维护；表示暂不可出租且需要关注进度 |
| 房源 `house` | `inactive` | 已停用 | `disabled` | `#BFBFBF` | 房屋停用；表示已退出日常操作范围 |
| 合同 `lease` | `pending` | 待生效 | `warning` | `#FAAD14` | 时钟；表示合同已建立但仍等待生效 |
| 合同 `lease` | `active` | 生效中 | `success` | `#52C41A` | 验证通过；表示合同当前有效且正常履行 |
| 合同 `lease` | `expired` | 已到期 | `secondary` | `#8C8C8C` | 到期日历；表示合同自然结束并进入历史状态 |
| 合同 `lease` | `terminated` | 已终止 | `error` | `#FF4D4F` | 终止标记；表示合同被主动提前终止 |
| 带看 `viewing` | `scheduled` | 已预约 | `info` | `#1677FF` | 日历搜索；表示未来仍有待执行流程 |
| 带看 `viewing` | `viewed` | 已带看 | `default` | `#262626` | 查看；表示动作完成但尚无转化结果 |
| 带看 `viewing` | `converted` | 已转合同 | `success` | `#52C41A` | 清单完成；表示带看已产生正向业务结果 |
| 带看 `viewing` | `canceled` | 已取消 | `error` | `#FF4D4F` | 取消标记；表示计划未继续执行 |
| 带看 `viewing` | `no_show` | 已爽约 | `error` | `#FF4D4F` | 用户缺席；表示预约对象未按计划到场 |
| 带看 `viewing` | `signed` | 已签约（派生） | `success` | `#52C41A` | 合同文件；表示带看已关联正式合同 |
| 带看 `viewing` | `unsigned` | 未签约（派生） | `secondary` | `#8C8C8C` | 合同文件；表示尚未关联正式合同 |

`【强制】` 修改核心状态的颜色、图标或管理说明时，必须同时更新本表和 `APP_STATUS_DEFINITIONS`；状态引用的新图标必须在 `APP_ICON_DEFINITIONS` 中注册。新增尚未进入本表的业务域时，不得照搬其他对象的状态色，必须先根据真实业务结果判断其语义。

#### 业务插件注册图标与状态

`【强制】` 插件新增业务对象时，必须在插件初始化模块中分别注册图标和状态，不得让页面自行选择图标或状态颜色。插件标识 `source` 必须稳定且唯一；插件对象名称建议使用 `<插件名>.<对象名>`，状态图标建议使用 `<插件名>.<对象名>.<状态>`，避免与核心对象或其他插件冲突。两个注册表都拒绝不同来源覆盖同名对象。

```tsx
import {
  defineAppIconDefinitions,
  registerAppIconDefinitions,
} from '@/components/AppIcon';
import {
  defineAppStatusDefinitions,
  registerAppStatusDefinitions,
} from '@/components/AppStatus';

const inspectionIcons = defineAppIconDefinitions({
  'inspection.order': { icon: 'solar:clipboard-outline' },
  'inspection.order.pending': { icon: 'solar:clock-circle-outline' },
  'inspection.order.completed': {
    icon: 'solar:clipboard-check-outline',
  },
  'inspection.order.canceled': { icon: 'solar:close-circle-outline' },
});

const inspectionStatuses = defineAppStatusDefinitions({
  'inspection.order': {
    states: {
      pending: { icon: 'inspection.order.pending', tone: 'warning' },
      completed: { icon: 'inspection.order.completed', tone: 'success' },
      canceled: { icon: 'inspection.order.canceled', tone: 'error' },
    },
  },
});

registerAppIconDefinitions('inspection-plugin', inspectionIcons);
registerAppStatusDefinitions('inspection-plugin', inspectionStatuses);
```

Tag 形式的状态展示统一使用 `AppStatusTag`，它会同时输出文字、图标和颜色：

```tsx
<AppStatusTag name="inspection.order" state={inspection.status}>
  {inspection.statusLabel}
</AppStatusTag>
```

非 Tag 形式的时间线、统计卡或详情标题使用 `<AppIcon name="inspection.order" state={inspection.status} />`，但旁边仍须有可读状态文字。

`【强制】`

- 对象及状态图标在 `APP_ICON_DEFINITIONS` 中维护；业务状态映射在 `APP_STATUS_DEFINITIONS` 中维护。
- 页面层只使用 `AppIcon` 与 `AppStatusTag` 两个状态相关 UI 组件；不得新增第二个状态图标组件。
- 插件图标通过 `defineAppIconDefinitions()` 和 `registerAppIconDefinitions()` 注册；插件状态通过 `defineAppStatusDefinitions()` 和 `registerAppStatusDefinitions()` 注册。
- 状态名直接使用领域模型或 API 的稳定枚举值，不在组件内部创建第二套状态命名。
- 每个状态条目必须同时引用已注册的语义图标名并声明 `tone`，不允许把 Iconify 名称直接写入状态注册表。
- 未声明的状态自动回退到同名对象图标和默认语义色；未注册的图标回退到 `unknown`，不能依赖这些兜底作为正常实现。
- 插件需要新的 Iconify 图标集时，必须同时安装对应 `@iconify-json/*` 包并扩展离线生成脚本；仅写新的前缀不会在浏览器端在线加载。

## 3. 页面框架与响应式

### 3.1 应用框架

`【当前实现】`

| 项目 | 配置 |
| --- | --- |
| 导航主题 | `light` |
| ProLayout | `mix` |
| 内容宽度 | `Fluid` |
| Header / Sider | 固定 |
| 菜单拆分 | 关闭 |

Header 已提供组织切换、界面设置、语言入口和用户头像菜单。业务页面不重复创建第二套全局入口。

### 3.2 页面容器

`【强制】`

- 业务页面使用 `@/components/PageContainer`。
- 默认由面包屑表达页面位置，不重复显示同名标题。
- 详情页或需要独立上下文时使用 `showTitle`，标题应包含实体名称、单号等识别信息。
- 页面主操作放在 `extra` 或稳定工具栏中；同一区域通常只有一个主按钮。
- 完整详情页适合复杂编辑和深链接；Drawer 保留列表上下文；Modal 处理短任务和确认。

### 3.3 响应式

`【当前实现】` 项目主要跟随 Ant Design Grid，现有页面常见 `575 / 767～768 / 991 / 1199px` 附近的断点。

`【强制】`

- React 优先使用 `Grid.useBreakpoint()`，样式优先使用 `screen*` token。
- 窄屏下工具栏纵向排列并占满宽度，表单采用单列。
- 中等宽度允许筛选项和工具栏换行，避免固定宽度溢出。
- 表格保留关键列，通过 `scroll.x` 横向滚动，不靠隐藏关键数据实现响应式。
- Drawer 使用共享宽度常量，保留至少 `12px` 视口边距。

共享布局值：

| 用途 | 当前值 |
| --- | --- |
| 小 Drawer | `min(460px, calc(100vw - 24px))` |
| 中 Drawer | `min(560px, calc(100vw - 24px))` |
| 大 Drawer | `min(720px, calc(100vw - 24px))` |
| 超大 Drawer | `min(960px, calc(100vw - 24px))` |
| 常规详情列 | `xs: 1, md: 2, xl: 4` |
| 双列详情 | `xs: 1, md: 2` |

## 4. 组件与页面模式

### 4.1 组件选择

`【建议】`

| 场景 | 首选 | 适用说明 |
| --- | --- | --- |
| 远程数据列表 | `ProTable` | 统一请求、分页、排序和筛选 |
| 简单静态表格 | `Table` | 数据少且无复杂查询 |
| 标准筛选 | ProTable search | 与表格请求状态一致 |
| 自定义工具栏 | `AdminToolbar` | 响应式排列筛选与操作 |
| 快速实体核对 | `EntityPreview` / Drawer | 保留列表上下文 |
| 短表单或确认 | Modal + Form | 任务短、无需并行参照 |
| 中等长度编辑 | Drawer + Form | 需要保留当前页面 |
| 复杂编辑 | 独立页面 | 字段多、有关联内容或需要深链接 |
| 字段详情 | `Descriptions` | 稳定的标签—值结构 |
| 标准表单 | `ProForm` / `Form` | 使用组件校验与字段依赖 |

### 4.2 列表、表格和筛选

`【强制】`

- 项目分页参数为 `page`、`page_size`，响应为 `items / total / page / page_size`。
- 宽表格使用 `adminTableScroll = { x: 'max-content' }`。
- 当前共享分页关闭 `showSizeChanger`；需要页容量切换时先形成统一策略。
- 第一列优先展示实体识别信息，最后一列放操作。
- 表头与该列内容必须使用相同对齐方式：名称、标题、地址和说明等文本列左对齐；状态、类型、日期时间、开关和操作等紧凑列居中；金额、数量、面积和比例等数值列右对齐。
- 行内只保留少量高频操作，低频动作收入 `Dropdown`。
- 搜索、筛选或排序改变后通常回到第一页。
- “重置”恢复默认条件；“清空”只清除用户输入。
- 编辑表格明确区分展示、编辑、保存中和失败状态，并防止重复提交。
- 空值不得直接显示 `undefined`、`null` 或空字符串。

`【当前实现】` 租赁房源列表已将部分高频字段做成行内编辑；这不是所有表格的默认要求。

### 4.3 表单

`【强制】`

- 标签说明要填写什么；placeholder 只提供示例或格式，不重复标签。
- 使用对应控件处理日期、金额、手机号等结构化值。
- 长表单按业务任务分组；折叠区不能隐藏阻塞提交的错误。
- 提交中锁定重复动作；失败时保留用户输入。
- 按钮使用明确动作词，如“保存设置”“创建房源”，避免无上下文的“确定”。
- 关闭存在明显数据损失风险的未保存表单前，应提醒用户。

### 4.4 Card、详情与操作层级

`【强制】`

- Card 聚合一个明确主题，不为每行内容额外套 Card。
- 可点击 Card 必须有悬浮和焦点反馈，且不能与内部按钮竞争。
- 统计值应包含单位、时间范围或上下文。
- 快速核对实体优先复用 `@/components/EntityPreview`。
- 实体名称、编号、状态和关键操作应出现在详情首屏。
- 关联实体以用户可识别名称为主，技术 ID 为辅。
- 长文本、代码和 ID 使用共享换行样式，避免撑破容器。

操作层级：

| 层级 | 表现 | 示例 |
| --- | --- | --- |
| 主要 | `Button type="primary"` | 创建、保存、提交、升级 |
| 次要 | 默认 Button | 取消、返回、导出 |
| 轻量 | `text` / `link` | 查看、切换、行内动作 |
| 危险 | `danger` + 确认 | 删除、停用、取消订阅 |

破坏性动作的确认文案必须说明对象、结果和是否可恢复。

### 4.5 页面状态

`【强制】`

| 状态 | 要求 |
| --- | --- |
| 加载 | 首次加载使用结构化 loading；局部请求只锁定相关区域 |
| 空数据 | 说明数据价值，有权限时提供创建入口 |
| 筛选无结果 | 提供清除或调整筛选的动作 |
| 请求失败 | 显示可理解原因和重试动作 |
| 无权限 | 说明缺少的权限或应联系的角色 |
| 离线 / 分包失败 | 使用项目离线感知反馈，不伪装成空数据 |
| 提交成功 | 简短说明结果和下一状态 |
| 提交失败 | 保留输入，并说明用户可以如何处理 |

应用级异常使用项目 `ErrorBoundary`，不得直接暴露框架堆栈。

### 4.6 工作台与图表

`【建议】`

- 工作台先展示当前最需要关注或处理的事项，再展示完整统计。
- 指标标注统计范围、单位和更新时间。
- 优先展示可操作的异常、临期和待办，不使用纯装饰图表。
- 图表提供标题、图例、单位、空状态和可读 Tooltip。
- 正负趋势按业务含义判断，不能默认“上升就是正向”。
- 小屏可以滚动、简化刻度或转为摘要，但不能裁掉关键数据。

## 5. 内容与业务规则

### 5.1 中文文案

`【强制】`

- 默认使用简洁、直接的简体中文。
- 按钮使用动词或动宾短语；标题使用对象或任务名称。
- 菜单、列表、表单和详情中的实体名称保持一致。
- 不直接展示内部技术词、接口字段名或无解释的英文枚举。
- 确认文案说明对象和影响，例如“删除房源后不可恢复，是否继续？”。

### 5.2 数据格式

`【强制】`

- 同一区域使用一致的日期和时间格式；机器时间戳不直接展示。
- 相对时间适合近期动态，关键业务记录应能看到绝对时间。
- 金额带币种或明确的人民币符号，并统一小数位和千分位。
- 百分比、面积、时长等数值必须带单位。
- `0` 为有效值时不能替换为缺失符号。
- 未提供、不可用和无权限查看必须能被区分。

`【待定】` 日期格式、日期时间格式、缺失值符号、默认币种、时区优先级和大数字缩写尚未形成全局标准。AI 应沿用同业务域现有格式，不自行建立新标准。

### 5.3 房源户型

`【强制】`

- `bedrooms === 1` 且 `living_rooms === 0` 时统一显示“单间”。
- `bedrooms === 1` 且 `living_rooms === 1` 时正常显示“一室一厅”或当前界面的等价格式。
- 不得显示为“一房零厅”“一室零厅”“1房0厅”或“1室0厅”。
- 只改变前端展示，不修改后端字段和原始数据。
- 新增展示位置必须复用共享户型格式化逻辑。

## 6. 可访问性与主题

### 6.1 可访问性

`【强制】`

- 交互可通过键盘到达，并保留可见焦点。
- 表单控件具有关联标签；仅图标按钮提供可访问名称。
- 状态不能只依赖颜色。
- 内容图片提供替代文本，纯装饰图从辅助技术中隐藏。
- 不破坏 Modal / Drawer 的默认焦点管理和 Esc 行为。
- 文本缩放和窄屏下不能遮挡核心操作。

### 6.2 明暗主题

`【当前实现】` 界面设置已开放暗色主题切换，但业务页面仍存在硬编码浅色背景、文字、阴影和图表色，因此尚未完整适配。

`【强制】`

- 新增组件使用主题 token，不能假设背景始终为白色。
- 自定义 hover、selected、disabled 和 border 状态需要检查明暗主题。
- 在正式完成适配前，不得宣称“所有页面支持暗色主题”。

## 7. AI 实施与检查

### 7.1 实施顺序

`【强制】`

1. 明确用户角色、租户上下文、核心任务、关键数据和页面状态；
2. 检查当前路由、相邻活跃页面和共享组件；
3. 先确定信息层级和交互路径，再处理视觉样式；
4. 使用 `PageContainer`、Ant Design / ProComponents 和共享布局；
5. 只为业务差异增加局部组件和 `createStyles`；
6. 补齐必要的加载、空、错误、权限和响应式状态；
7. 检查 token、文案、数据格式、键盘操作和主题；
8. 按范围执行类型检查、测试或浏览器视觉检查。

### 7.2 交付检查

- [ ] 核心任务和主要动作是否清楚；
- [ ] 是否复用了正确的共享组件；
- [ ] 是否遵守页面标题和面包屑规则；
- [ ] 是否避免新增硬编码颜色、圆角和阴影；
- [ ] 列表、筛选、分页和空值是否一致；
- [ ] 加载、空、失败和无权限状态是否完整；
- [ ] `≤768px` 时是否仍能完成核心任务；
- [ ] 图标按钮、键盘焦点和非颜色状态线索是否完整；
- [ ] 中文文案、日期、金额、单位和业务术语是否一致；
- [ ] 房源户型是否遵守“单间”规则；
- [ ] 明暗主题下是否存在明显不可读区域；
- [ ] 是否只修改了任务需要的文件。

## 8. 设计债务与待定事项

### 8.1 已知设计债务

`【当前实现】`

1. 工作台、订阅和图表存在多套硬编码局部颜色；
2. 暗色主题入口已开放，但业务页面适配不完整；
3. 非图标场景中的业务状态颜色仍缺少跨业务域的统一映射；
4. 图表色板、单位、Tooltip 和空状态尚未系统化；
5. 日期、金额和缺失值存在多种格式；
6. 局部 Card 的圆角、边框和阴影不统一；
7. `src/global.style.ts` 当前未发现有效引用，不属于生效规范；
8. 模板页面与真实业务页面并存，搜索参考实现时容易误用。

AI 不得为追求全局统一而在单页任务中顺带重构这些问题。

### 8.2 待定事项

`【待定】` 以下内容需要产品或设计决策，AI 只能记录候选方案：

- 品牌关键词、辅助色、Logo 和插画规范；
- 项目级业务状态、图表、表面、圆角、阴影和动效 token；
- 日期、金额、缺失值、时区和大数字格式；
- 表格页容量、密度、列偏好和批量选择；
- 工作台栅格、指标卡模板、图表库和图表色板；
- 暗色主题正式支持范围及偏好持久化；
- WCAG 目标等级和视觉回归基准视口；
- 标准列表、详情、设置、工作台和订阅页面模板。

在项目级 token 正式落地前，继续使用 Ant Design token，不在多个页面散落同名常量。

## 9. 源码依据

| 路径 | 依据 |
| --- | --- |
| `config/defaultSettings.ts` | 主色和 ProLayout 配置 |
| `config/config.ts` | Ant Design 变体、字体和 Umi 配置 |
| `src/global.less` | 字体、内容边距、侧栏和移动表格 |
| `src/app.tsx` | 运行时 Layout、Header、主题入口和 ErrorBoundary |
| `src/components/PageContainer/` | 页面标题与面包屑 |
| `src/components/EntityPreview/` | 实体快速预览 |
| `src/components/AppIcon/` | 业务对象、对象状态、插件图标注册及语义色 |
| `src/pages/_shared/adminLayout.tsx` | Drawer、分页、工具栏和详情布局 |
| `src/pages/space/shared.tsx` | 空间设置的加载、错误和权限状态 |
| `src/pages/rental/constants.ts` | 租赁展示和状态映射 |
| `src/pages/rental/houses/` | 列表、详情和行内编辑 |
| `src/pages/team-operations/workbench/` | 工作台与可配置组件 |
| `src/pages/team-operations/tasks/` | 任务列表和响应式布局 |
| `src/pages/space/subscription/` | 套餐、支付和订阅状态 |
| `src/pages/platform-management/notification-dispatches/` | 通知创建与 Modal 表单 |

规范变化时同步更新标签、源码依据、版本和核对日期。
