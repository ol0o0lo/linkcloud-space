# 小程序顶部导航组件 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Figma 状态写入必须串行执行，不使用并行子代理。

**Goal:** 在 Figma 中建立可复用的小程序顶部导航组件族，并将租客、房东、组织与共享空间的 23 个业务页面迁移为组件实例。

**Architecture:** 在 `00 · Base` 中创建胶囊基础组件、内部空间标签组件和导航栏组件集。导航栏提供 Standard、Workspace、Immersive 三种模式，并通过文本、布尔和实例交换属性承载页面差异。迁移采用“先创建实例、再隐藏旧导航”的可撤销方式，逐空间截图验收后再整理旧图层。

**Tech Stack:** Figma Plugin API、Figma Components/Component Sets、Component Properties、Auto Layout、现有 Noto Sans SC 字体与当前 Figma 本地样式。

---

### Task 1: 完成组件库发现与差异盘点

**Files:**
- Reference: `docs/superpowers/specs/2026-09-09-miniprogram-navigation-component-design.md`
- Modify: Figma `00 · Base`

- [ ] **Step 1: 检查现有页面、组件、变量和样式**

  使用只读 Figma Plugin API 分别加载五个页面，记录组件、组件集、变量集合、文本样式和效果样式。

- [ ] **Step 2: 检查可用设计库**

  调用 Figma 库发现接口；搜索 `navigation`、`status bar`、`capsule`。仅当本地现有组件不满足当前 390px 小程序规范时新建组件。

- [ ] **Step 3: 锁定迁移清单**

  确认 23 个页面对应的原导航节点、模式、标题、右侧操作、返回按钮、分割线和空间身份参数。输出 gap analysis 后再创建组件。

### Task 2: 创建胶囊基础组件

**Files:**
- Modify: Figma `00 · Base`

- [ ] **Step 1: 创建 Light 组件**

  创建 `MiniProgram / System Capsule` 的 Light 版本，尺寸 `84 × 32`，圆角 `16`，包含三点、分隔线和右侧圆环。

- [ ] **Step 2: 创建 Immersive 组件**

  克隆 Light 版本并调整为半透明白色沉浸样式，命名为 `Theme=Immersive`。

- [ ] **Step 3: 合并组件集并验收**

  合并为 `MiniProgram / System Capsule` 组件集，验证 `Theme=Light|Immersive`，并截图确认两个变体尺寸和内部位置一致。

### Task 3: 创建内部空间标签组件

**Files:**
- Modify: Figma `00 · Base`

- [ ] **Step 1: 创建三个角色变体**

  创建 `_Internal / Workspace Badge`，包含 `Role=Tenant|Landlord|Organization` 三个变体，分别使用现有蓝、绿、紫视觉。

- [ ] **Step 2: 暴露文本属性**

  添加 `Label` 文本属性，默认分别为“租客空间”“房东空间”“组织空间”。

- [ ] **Step 3: 结构与视觉验收**

  检查变体数量、文本属性和触控高度，截图确认三种颜色与现有页面一致。

### Task 4: 创建导航栏组件集

**Files:**
- Modify: Figma `00 · Base`

- [ ] **Step 1: 创建 Standard 变体**

  建立 `390 × 88` 导航栏，包含状态时间、返回、居中标题、可选右侧操作、Light 胶囊和底部分割线。

- [ ] **Step 2: 创建 Workspace 变体**

  使用 `_Internal / Workspace Badge` 实例、空间说明和 Light 胶囊，隐藏返回与右侧操作。

- [ ] **Step 3: 创建 Immersive 变体**

  设置透明背景，使用白色状态时间、返回按钮和 Immersive 胶囊，不显示分割线。

- [ ] **Step 4: 合并并添加组件属性**

  合并为 `MiniProgram / Navigation Bar`，添加 `Title`、`Action`、`Show Back`、`Show Action`、`Show Divider`、`Workspace Badge` 属性，并为每个变体连接对应子节点。

- [ ] **Step 5: 验收组件集**

  验证三个模式、组件属性定义、嵌套实例和字体；截图检查标题、短操作与胶囊无重叠。

### Task 5: 迁移租客空间

**Files:**
- Modify: Figma `02 · 租客空间`

- [ ] **Step 1: 迁移 Standard 页面**

  将首页、找房、收藏、进度、我的租约和详情状态页的顶部导航替换为匹配模式的组件实例。

- [ ] **Step 2: 迁移 Immersive 页面**

  将房源详情、预约弹层和时间选择页的顶部系统层替换为 Immersive 实例，保持蒙层层级关系。

- [ ] **Step 3: 验收租客空间**

  截图九个页面，检查蒙层压暗、标题、返回按钮和胶囊位置；旧导航改名为 `Legacy / Header` 并隐藏。

### Task 6: 迁移房东空间

**Files:**
- Modify: Figma `03 · 房东空间`

- [ ] **Step 1: 迁移四个页面**

  经营概览使用 Workspace；房源列表、房源详情、租约中心使用 Standard。保留“管理”“新建”等短操作。

- [ ] **Step 2: 验收房东空间**

  截图四个页面，检查绿色品牌内容不被组件覆盖，TabBar 与主体布局保持现状。

### Task 7: 迁移组织空间

**Files:**
- Modify: Figma `04 · 组织空间`

- [ ] **Step 1: 迁移七个页面**

  组织工作台使用 Workspace；业务中心、房源盘面、客户转化、带看排期、租约待办、组织管理使用 Standard。

- [ ] **Step 2: 验收组织空间**

  截图七个页面，检查紫色品牌、短操作和长标题间距。

### Task 8: 迁移共享页面并完成全局 QA

**Files:**
- Modify: Figma `05 · 共享页面`
- Modify: Figma `00 · Base`

- [ ] **Step 1: 迁移三个共享页面**

  空间切换底图使用 Workspace；消息中心与账号安全使用 Standard，保持弹层蒙层位于实例上方。

- [ ] **Step 2: 进行结构审计**

  检查 23 个业务页面均包含 `MiniProgram / Navigation Bar` 实例，且不存在可见的旧手绘胶囊和重复状态时间。

- [ ] **Step 3: 进行视觉审计**

  对四个业务空间分别保存截图，检查顶部 `0–88px` 区域、标题与操作碰撞、沉浸样式、底部分割线和字体一致性。

- [ ] **Step 4: 整理 Base 页面**

  为两个公开组件和内部空间标签添加说明、变体名称及使用规则，将组件区排列整齐并保留足够间距。

- [ ] **Step 5: 完成交付**

  在 Figma 中聚焦 `00 · Base` 的组件区，并向用户汇报组件 ID、已迁移页面数量、隐藏旧导航数量和验收截图位置。
