# 链云空间多身份租赁小程序 Figma Design Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在现有链云空间 Figma 文件中建立统一组件系统，并完成租客、个人房东和组织管理三个工作空间的首批 24 个移动端高保真主画板。

**Architecture:** 以一个共享移动端设计系统支撑三种身份，通过身份上下文切换导航、数据范围和页面内容。先建立变量、组件和全局壳层，再按租客、房东、组织三个业务闭环分批绘制；所有批次完成后统一补齐状态、原型连线和视觉验收。

**Tech Stack:** Figma Desktop、Figma Plugin API、gethopp/figma-mcp-bridge、390×844 移动画板、现有 Figma 文件 `wofwjh89UjZXcJFJyYPKh8`、本地 PNG 视觉验收。

---

## 交付物与位置

**Figma 文件：**

- 文件：`链云空间｜小程序找房首页`
- URL：`https://www.figma.com/design/wofwjh89UjZXcJFJyYPKh8/`
- 新增页面：`00 · 产品架构与业务闭环`
- 新增页面：`01 · Foundations & Components`
- 新增页面：`02 · 租客空间`
- 新增页面：`03 · 房东空间`
- 新增页面：`04 · 组织空间`
- 新增页面：`05 · 共享页面`
- 新增页面：`06 · 交互状态与原型流程`
- 原有页面：保留节点内容，确认结构后仅允许重命名为 `Archive · 原设计参考`

**本地文档与验收产物：**

- 设计规格：`docs/superpowers/specs/2026-09-08-multi-role-rental-miniprogram-design.md`
- 执行计划：`docs/superpowers/plans/2026-09-08-multi-role-rental-figma-design.md`
- 验收截图目录：`.codex/audits/multi-role-rental-figma/`

## 调用预算

- 主要写入使用 `figma-mcp-bridge`，避免消耗 Figma Starter 的每日 MCP 调用额度。
- 每个业务页面按一至两个批次写入，禁止逐个图层发送远程调用。
- 目标调用量：文档预检 2 次、基础系统 2 次、共享页面 1 次、租客 2 次、房东 2 次、组织 2 次、状态与原型 1 次、截图与复核 4 次，总计控制在 16 次左右。
- 每次批量写入后先读取一次结果或截图，不进行无间隔重复重试。
- Bridge 断开时停止当前批次，重新运行 Figma 中的 `Figma MCP Bridge` 插件后继续；不得产生重试风暴。
- 原生 Figma MCP 仅作为 Bridge 不支持某项能力时的后备，并将写入操作合并到页面级调用。

### Task 1: 连接预检与原稿保护

**Files and artifacts:**

- Read: `docs/superpowers/specs/2026-09-08-multi-role-rental-miniprogram-design.md`
- Inspect: Figma 文件 `wofwjh89UjZXcJFJyYPKh8`
- Create directory: `.codex/audits/multi-role-rental-figma/`
- Create screenshot: `.codex/audits/multi-role-rental-figma/00-original-overview.png`

- [ ] **Step 1: 检查 Bridge 会话**

  向现有 Bridge 会话发送一次只读连接检查。成功结果必须包含当前打开的 Figma 文件；失败时停止后续写入，并提示在 Figma 中重新运行 `Figma MCP Bridge`。

- [ ] **Step 2: 一次性读取页面与顶层节点**

  获取当前文件的页面名称、页面 ID、顶层 Frame 名称和节点 ID。重点确认现有 `02 · C端找房重设计`、首页画板 `15:33` 和房源详情画板 `15:34` 是否仍存在。

- [ ] **Step 3: 建立验收目录**

  Run: `mkdir -p .codex/audits/multi-role-rental-figma`

  Expected: 目录存在，项目根目录不产生临时截图。

- [ ] **Step 4: 导出原稿总览**

  将现有租客首页和详情所在区域导出到 `00-original-overview.png`，作为后续视觉差异参考。

- [ ] **Step 5: 建立保护边界**

  后续只在新页面中创建内容。原稿页面只能整体重命名，禁止删除、覆盖或移动其内部节点。

### Task 2: 文件结构、基础变量与视觉规范

**Figma targets:**

- Create page: `00 · 产品架构与业务闭环`
- Create page: `01 · Foundations & Components`
- Create page: `02 · 租客空间`
- Create page: `03 · 房东空间`
- Create page: `04 · 组织空间`
- Create page: `05 · 共享页面`
- Create page: `06 · 交互状态与原型流程`
- Rename original page: `Archive · 原设计参考`

- [ ] **Step 1: 创建并排序页面**

  按 `00` 到 `06` 的顺序创建页面，将原稿页面放在末尾并重命名为 `Archive · 原设计参考`。不得更改原稿页面中的现有节点。

- [ ] **Step 2: 创建颜色变量**

  在 `01 · Foundations & Components` 建立以下语义变量：

  - `color/brand/primary = #0A84FF`
  - `color/text/primary = #14213D`
  - `color/text/secondary = #66758C`
  - `color/text/tertiary = #8E9AAF`
  - `color/surface/page = #F4F7FB`
  - `color/surface/card = #FFFFFF`
  - `color/surface/ai = #EAF5FF`
  - `color/amount = #EF5B35`
  - `color/success = #159B62`
  - `color/warning = #D99016`
  - `color/danger = #D94B4B`
  - `color/role/tenant = #0A84FF`
  - `color/role/landlord = #159B72`
  - `color/role/organization = #6B5CE7`

- [ ] **Step 3: 创建尺寸变量**

  建立 `space/4`、`space/8`、`space/12`、`space/16`、`space/20`、`space/24`、`space/32`，以及 `radius/10`、`radius/16`、`radius/20`、`radius/full`。

- [ ] **Step 4: 创建文本样式**

  使用苹方或系统中文字体建立：

  - `Display/28/Semibold`
  - `Title/22/Semibold`
  - `Heading/18/Semibold`
  - `Body/16/Medium`
  - `Body/15/Regular`
  - `Meta/13/Regular`
  - `Amount/26/Semibold`

- [ ] **Step 5: 建立规范展示板**

  创建 `Foundation Preview` Frame，展示所有颜色、字号、间距、圆角和三种空间标识。画板使用白底，模块间距 32px，所有命名与变量一致。

- [ ] **Step 6: 导出基础系统截图**

  输出 `.codex/audits/multi-role-rental-figma/01-foundations.png`。

  Expected: 颜色、文字和圆角均可清晰识别，没有文本截断。

### Task 3: 共享组件库

**Figma target:** `01 · Foundations & Components`

- [ ] **Step 1: 创建空间壳层组件**

  建立 `Shell/Mobile`，包含状态栏占位、顶部栏、内容区和五槽 TabBar 安全区。组件宽 390px，高度支持 844px 及内容延伸。

- [ ] **Step 2: 创建身份切换器**

  建立 `Switcher/Workspace` 的 `tenant`、`landlord`、`organization` 三个变体；建立 `Sheet/Workspace Switcher`，显示可用身份、当前身份、组织列表和新增组织入口。

- [ ] **Step 3: 创建动态 TabBar**

  建立租客、房东、组织三个导航变体，每个变体包含五个槽位及 `default`、`selected`、`badge` 状态。

- [ ] **Step 4: 创建房源组件**

  建立：

  - `House/Card/Masonry`
  - `House/Card/List`
  - `House/Card/Management`
  - `House/Status Chip`
  - `House/AI Match`

  户型示例必须包含“单间”和“两室一厅”，不得出现“一室零厅”。

- [ ] **Step 5: 创建业务与管理组件**

  建立 `KPI/Card`、`Insight/AI`、`Alert/Business`、`Task/Card`、`Viewing/Schedule Card`、`Timeline/Business`、`Filter/Bar`、`Filter/Bottom Sheet`、`Detail/Status Header` 和 `Action/Sticky Footer`。

- [ ] **Step 6: 创建表单与反馈组件**

  建立 `Form/Stepper`、`Form/Draft Banner`、`Batch/Toolbar`、`State/Loading`、`State/Empty`、`State/Error`、`State/No Permission` 和 `State/AI Unavailable`。

- [ ] **Step 7: 验证组件约束**

  将每个组件放入 390px 宽的测试容器，验证 Auto Layout、Hug、Fill、文本换行和 44px 最小点击区域。

### Task 4: 共享页面与身份切换原型

**Figma target:** `05 · 共享页面`

**Main frames:**

- `S01 · 身份与组织切换`
- `S02 · 消息中心`
- `S03 · 我的与账号安全`

- [ ] **Step 1: 绘制身份切换页面**

  展示同一用户拥有租客、房东和两个组织的状态。当前身份使用选中标识，组织项显示用户角色；切换确认后返回目标空间首页。

- [ ] **Step 2: 绘制消息中心**

  提供“全部、租客、房东、组织”筛选，消息卡明确显示所属空间、业务类型、时间和已读状态。

- [ ] **Step 3: 绘制我的与安全入口**

  展示个人资料、实名认证、通知偏好、账号安全、MFA、Passkey、钱包、推广和订阅入口。组织专属设置不混入全局账号安全。

- [ ] **Step 4: 建立身份切换交互**

  从三种空间首页的身份按钮连到 `S01`，再分别连回租客首页、房东概览和组织工作台。

### Task 5: 租客空间高保真闭环

**Figma target:** `02 · 租客空间`

**Main frames:**

- `T01 · 租客首页`
- `T02 · AI 自然语言找房`
- `T03 · 搜索结果与筛选`
- `T04 · 房源详情`
- `T05 · AI 分析与房源对比`
- `T06 · 收藏列表`
- `T07 · 预约与带看进度`
- `T08 · 我的租约`

- [ ] **Step 1: 绘制租客首页**

  沿用原稿的深海军蓝标题、品牌蓝和暖橙金额。顶部加入身份切换、城市和消息；首屏包含 AI 搜索、快捷筛选和找房进度；下方使用双列房源瀑布流，卡片显示实拍图、租金、户型、面积、AI 推荐理由或关键标签。

- [ ] **Step 2: 绘制 AI 找房页面**

  页面包含自然语言输入、历史需求、可编辑的结构化条件、匹配房源预览和“依据当前条件生成”的说明。示例输入为“预算 6000，静安寺 30 分钟，有电梯”。

- [ ] **Step 3: 绘制搜索与筛选页面**

  顶部固定搜索框和条件标签；结果支持推荐、价格、面积等现有筛选排序。底部筛选面板展示预算、区域、户型、面积、入住条件及房屋配置。

- [ ] **Step 4: 绘制房源详情**

  保留原稿的大图首屏和底部固定操作栏。内容顺序为价格与标题、核心参数、AI 匹配解读、通勤与同类租金、关键信息与核验、房屋配置和相似房源。底部操作为收藏、AI 帮我判断、预约看房。

- [ ] **Step 5: 绘制 AI 分析与对比**

  以同一画板中的两个状态展示单套房源分析和两至三套房源对比。对比维度固定为租金、通勤、户型、面积、楼层、配置、入住条件和风险提示。

- [ ] **Step 6: 绘制收藏列表**

  支持普通浏览和批量选择两个状态；批量操作只包含取消收藏和加入对比。

- [ ] **Step 7: 绘制预约与带看进度**

  使用阶段标签和时间线展示已预约、带看中、已取消；预约详情保留取消预约入口，并明确取消后的状态反馈。

- [ ] **Step 8: 绘制本人租约**

  使用租约卡展示房源、租期、租约状态和合同编号；详情页展示现有后端提供的租约字段，不添加缴费、报修、续租或退租操作。

- [ ] **Step 9: 导出租客批次截图**

  输出 `.codex/audits/multi-role-rental-figma/02-tenant-overview.png`。

  Expected: 八个主画板层级一致，瀑布流无不规则文本断层，底部导航均处于租客变体。

### Task 6: 房东空间高保真闭环

**Figma target:** `03 · 房东空间`

**Main frames:**

- `L01 · 经营概览`
- `L02 · 房源列表与房态`
- `L03 · 房源详情与编辑`
- `L04 · 客户与带看管理`
- `L05 · 租约中心`
- `L06 · 收益与经营分析`

- [ ] **Step 1: 绘制经营概览**

  首屏展示本月收益摘要、在租、空置、待发布和今日待处理；AI 经营建议只汇总现有房源、带看、租约和分析数据；快捷操作包含发布房源、录入客户、安排带看和创建租约。

- [ ] **Step 2: 绘制房源列表与房态**

  使用管理卡展示房态、上下架、租金、带看和租约摘要；支持搜索、房态筛选及批量上下架模式。

- [ ] **Step 3: 绘制房源详情与编辑**

  详情页使用状态摘要头，内容包含基础资料、展示信息、客户与带看、租约和经营数据。编辑状态使用步骤表单，并显示草稿保存反馈。

- [ ] **Step 4: 绘制客户与带看管理**

  客户列表展示需求、来源、阶段和最后跟进时间；客户详情连接带看记录和时间线；带看排期使用日期分组，不使用桌面表格。

- [ ] **Step 5: 绘制租约中心**

  提供全部、待签、履约中、即将到期等现有状态筛选；租约详情展示合同信息、关联房源、关联租客和状态时间线。

- [ ] **Step 6: 绘制收益与经营分析**

  顶部先展示核心金额和环比摘要，下方展示房源去化、带看转化和租约趋势；AI 只解释数据变化，不提供自动调价或自动收款。

- [ ] **Step 7: 导出房东批次截图**

  输出 `.codex/audits/multi-role-rental-figma/03-landlord-overview.png`。

  Expected: 六个主画板均使用房东绿色空间标识，金额颜色保持全局暖橙语义。

### Task 7: 组织空间高保真闭环

**Figma target:** `04 · 组织空间`

**Main frames:**

- `O01 · 组织工作台`
- `O02 · 业务中心`
- `O03 · 房源盘面`
- `O04 · 客户转化漏斗`
- `O05 · 带看排期`
- `O06 · 租约与待办中心`
- `O07 · 成员团队与权限`

- [ ] **Step 1: 绘制组织工作台**

  顶部同时显示组织身份和当前组织；首屏提供 AI 今日经营简报、待办、待审批、今日带看、待签约和异常摘要；指标按当前用户权限裁剪。

- [ ] **Step 2: 绘制业务中心**

  使用模块化入口展示房源、小区楼栋、客户联系人、带看、租约签约、收益分配和经营分析；每项显示待处理数量或摘要，不使用九宫格装饰性图标堆叠。

- [ ] **Step 3: 绘制房源盘面**

  展示在租、空置、待发布和异常房源指标；支持小区、楼栋、团队和房态筛选；房源卡展示负责人和关键经营状态。

- [ ] **Step 4: 绘制客户转化漏斗**

  展示新增客户、已匹配、已带看、待签约和已成交阶段；列表支持负责人、团队和阶段筛选；客户分配进入明确的批量模式并显示影响人数。

- [ ] **Step 5: 绘制带看排期**

  以日期和团队成员分组展示排期；详情包含房源、客户、负责人、时间和跟进记录。

- [ ] **Step 6: 绘制租约与待办中心**

  同一主画板展示租约筛选状态与任务中心两个页面状态；任务卡展示负责人、截止时间、关联业务对象和处理时间线。

- [ ] **Step 7: 绘制成员、团队与权限**

  通过分段导航展示成员、团队、邀请、角色和权限。角色详情按权限目录分组；无管理权限用户使用只读状态或无权限状态。

- [ ] **Step 8: 导出组织批次截图**

  输出 `.codex/audits/multi-role-rental-figma/04-organization-overview.png`。

  Expected: 七个主画板在手机宽度内可理解经营层级，未出现横向压缩的桌面表格。

### Task 8: 产品架构页、状态矩阵与原型连线

**Figma targets:**

- `00 · 产品架构与业务闭环`
- `06 · 交互状态与原型流程`

- [ ] **Step 1: 绘制产品架构总览**

  用三个并列工作空间展示共享账号、独立数据范围、动态导航和共享消息；下方展示“房源—客户/收藏—带看—租约—收益/分析”的对象关系。

- [ ] **Step 2: 绘制状态矩阵**

  对房源列表、带看、租约、任务和 AI 卡片分别展示加载、空、错误、无权限及状态变化。

- [ ] **Step 3: 建立租客原型主链路**

  `T01 → T02/T03 → T04 → T05/T07 → T08`，同时连通收藏和返回路径。

- [ ] **Step 4: 建立房东原型主链路**

  `L01 → L02 → L03`、`L01 → L04`、`L01 → L05`、`L01 → L06`。

- [ ] **Step 5: 建立组织原型主链路**

  `O01 → O02 → O03/O04/O05/O06/O07`，并连接组织切换面板。

- [ ] **Step 6: 验证返回和底部导航**

  所有详情页返回原列表状态；底部导航只连接当前身份的根页面；身份切换后返回目标空间首页。

### Task 9: 视觉验收与修正

**Audit outputs:**

- `.codex/audits/multi-role-rental-figma/05-all-spaces-overview.png`
- `.codex/audits/multi-role-rental-figma/06-key-flows.png`

- [ ] **Step 1: 导出全局总览**

  分别导出共享、租客、房东和组织页面，并组合检查整体一致性。

- [ ] **Step 2: 检查视觉层级**

  验证每个首屏只有一个最强主要操作；金额、状态、AI 建议和普通说明不存在层级冲突。

- [ ] **Step 3: 检查版式与组件**

  验证 20px 页面边距、8px 节奏、16–20px 卡片圆角、44px 点击区域、底部安全区、文字换行和图片裁切。

- [ ] **Step 4: 检查业务一致性**

  搜索所有户型文本，确认 `1 室 0 厅` 类房源均显示“单间”；检查租客租约页没有缴费、报修、续租或退租操作；检查 AI 没有自动执行敏感业务的入口。

- [ ] **Step 5: 检查权限与状态**

  验证组织页面包含无权限状态；列表、表单和 AI 均有加载、空、错误或不可用状态。

- [ ] **Step 6: 修复并复导关键流程**

  修复发现的间距、溢出、对比度、状态或原型问题后，输出 `06-key-flows.png`。

  Expected: 三种空间具有统一品牌感和清晰差异，24 个主画板无明显截断、错位或空白断层。

### Task 10: 交付与回顾

**Files and artifacts:**

- Review: `docs/superpowers/specs/2026-09-08-multi-role-rental-miniprogram-design.md`
- Review: `.codex/audits/multi-role-rental-figma/`
- Deliver: Figma 文件与关键节点链接

- [ ] **Step 1: 对照规格逐项复核**

  对照规格第 13 节的九项验收标准，确认每项均可指向具体页面或组件。

- [ ] **Step 2: 汇总 Figma 节点链接**

  提供 Foundations、租客首页、房源详情、房东概览和组织工作台五个直接节点链接。

- [ ] **Step 3: 汇总设计说明**

  向用户说明完成范围、AI 唯一新增能力、未纳入功能、调用次数和需要进一步调整的视觉问题。

- [ ] **Step 4: 保持 Git 不变**

  本任务不执行 `git add`、`git commit` 或其他 Git 操作；设计文档和计划文件留在工作区，由用户决定是否纳入版本管理。

