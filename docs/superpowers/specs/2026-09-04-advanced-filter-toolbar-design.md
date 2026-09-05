# 管理端高级筛选头部组件设计

## 背景

房源列表当前关闭了 ProTable 自动查询表单，并在 `toolBarRender` 中手写房源范围、勘察筛选、关键词、房态、配房和新建等控件。所有控件长期平铺后，表格上方信息密度偏高，常用搜索和低频筛选的层级也不够清楚。

本次保留自定义工具栏路线，新增一个可复用的高级筛选头部组件。组件只提供布局、Drawer 和交互状态，不尝试替代业务表单或生成查询参数。房源列表作为首个接入页面。

## 目标

1. 常用筛选保持可见，低频筛选收进右侧 Drawer。
2. Drawer 内先编辑草稿，点击“确定筛选”后才让筛选生效。
3. 高级筛选已生效且 Drawer 关闭时，在入口上显示一个无数字的小圆点。
4. 支持默认打开、默认关闭和完全受控的打开状态，刷新后不记忆用户开关状态。
5. 形成可供 ProTable、普通表格和列表页复用的轻量组件。
6. 房源列表中“生成配房链接”只在已勾选可配房源时显示，并展示已选数量。

## 非目标

- 不恢复或封装 ProTable 的 Schema 查询表单。
- 不做字段 Schema、动态字段注册或通用表单生成器。
- 不让组件负责 URL、分页、接口请求或 React Query 状态。
- 不让组件判断哪些业务字段构成“有效筛选”。
- 不持久化 Drawer 打开状态，不读写 localStorage、sessionStorage 或个人设置。
- 第一期不支持行内展开、Popover 等其他高级筛选容器模式。
- 不提供任意 `drawerProps` 透传，避免公共 API 与 Ant Design Drawer 的全部能力耦合。
- 不在本次迁移其他列表页。

## 已确认的设计决策

- 使用右侧 Drawer 承载高级筛选。
- 房源页常驻筛选为“房源范围”和关键词搜索。
- 房源页高级筛选为“房态”和“勘察状态”。
- 打开 Drawer 时，以当前已生效值初始化草稿。
- Drawer 内的输入变化只更新草稿，不立即刷新列表。
- 点击“确定筛选”后统一应用草稿，并将分页重置为第一页。
- 点击关闭按钮、遮罩或 Esc 时关闭 Drawer，未确认的草稿不生效；再次打开时重新从已生效值初始化。
- “重置”只清空 Drawer 内草稿，不影响房源范围和关键词等常驻筛选，也不会立即提交；用户仍需点击“确定筛选”。
- 房源页默认关闭 Drawer。
- `defaultOpen` 只控制非受控初始状态；`open` 与 `onOpenChange` 支持受控使用。
- 高级条件已生效且 Drawer 关闭时，入口显示主色小圆点，不显示数量或条件摘要。
- “生成配房链接”未选择房源时不占据工具栏空间；选择后显示“生成配房链接（已选 N 套）”。

## 总体结构

新增目录：

```text
frontend_admin/src/components/AdvancedFilterToolbar/
├── index.tsx
└── index.test.tsx
```

组件包含三个区域：

1. **常驻筛选区**：由 `children` 提供，承载高频且需要随时可见的控件。
2. **高级筛选入口与 Drawer**：组件负责入口、状态圆点、Drawer、重置和确认按钮。
3. **操作区**：由 `actions` 提供，承载新增、导出、批量操作等页面行为。

组件复用现有 `AdminToolbar`、Ant Design `Drawer`、`Badge`、`Button`，Drawer 默认宽度复用 `drawerWidthSm`。布局和颜色使用 Ant Design Token 与现有管理端响应式约定，不新增一套视觉体系。

## 组件职责边界

### 组件负责

- 排列常驻筛选、高级筛选入口和页面操作。
- 管理非受控打开状态，或呈现调用方传入的受控打开状态。
- 将所有打开、关闭来源统一转换为 `onOpenChange(nextOpen)`。
- 渲染无数字的高级筛选生效圆点。
- 渲染 Drawer 标题、内容区和底部“重置 / 取消 / 确定筛选”操作。
- 等待异步 `onConfirm`；成功后请求关闭，失败时保持打开。
- 确认期间锁定重复提交，并为确认按钮显示加载状态。

### 页面负责

- 定义常驻筛选和高级筛选字段。
- 保存“已生效值”与“Drawer 草稿值”。
- 在 Drawer 每次打开时，将已生效值复制到草稿。
- 在 `onConfirm` 中校验和应用草稿、重置分页并触发列表查询。
- 在 `onReset` 中仅重置高级筛选草稿。
- 根据业务规则计算 `advancedActive`。
- 处理查询参数、URL 同步、请求失败提示和列表空状态。

这一边界保证组件不知道房态、日期、组织等业务字段，也不会因为不同页面的查询模型而膨胀。

## 建议 API

```ts
export type AdvancedFilterToolbarProps = {
  children?: React.ReactNode;
  advancedContent: React.ReactNode;
  actions?: React.ReactNode;
  advancedActive?: boolean;

  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;

  onConfirm: () => void | Promise<void>;
  onReset?: () => void;

  disabled?: boolean;
  confirmLoading?: boolean;

  triggerText?: React.ReactNode;
  title?: React.ReactNode;
  confirmText?: React.ReactNode;
  resetText?: React.ReactNode;
  width?: number | string;
};
```

默认值：

- `defaultOpen = false`
- `advancedActive = false`
- `triggerText = "高级筛选"`
- `title = "高级筛选"`
- `confirmText = "确定筛选"`
- `resetText = "重置"`
- `width = drawerWidthSm`

### 打开状态约定

- 未传 `open` 时，组件使用内部状态，初始值取 `defaultOpen`。
- 传入 `open` 时进入受控模式，实际显示状态只由 `open` 决定，`defaultOpen` 被忽略。
- 无论受控还是非受控，只要用户触发打开或关闭，均调用 `onOpenChange`。
- 受控调用方应在 `onOpenChange` 中更新 `open`；组件不自行覆盖受控值。
- 组件不保存上一次会话状态，页面刷新后重新采用 `open` 或 `defaultOpen`。

### 确认状态约定

- `onConfirm` 返回 Promise 时，组件等待其完成。
- Promise 成功后组件请求关闭 Drawer。
- Promise 抛错或拒绝时 Drawer 保持打开，错误展示由页面负责，方便页面使用已有消息或表单错误体系。
- 组件内部等待状态与外部 `confirmLoading` 取逻辑或，任一为真时都禁止重复确认。
- 确认中禁用重置、取消、关闭按钮、遮罩关闭和 Esc 关闭，避免提交结果与用户退出动作竞争。

## Drawer 交互流程

```text
点击高级筛选
  → 页面收到 onOpenChange(true)
  → 页面用已生效值初始化草稿
  → Drawer 打开
  → 用户编辑草稿
      ├─ 点击重置：仅清空高级草稿，Drawer 保持打开
      ├─ 点击取消 / 关闭 / 遮罩 / Esc：关闭，不应用草稿
      └─ 点击确定筛选：
            → 页面应用草稿并重置分页
            → 成功后关闭
            → 失败时保持打开并允许修正
```

再次打开时总是重新从已生效值初始化。因此取消后不要求页面立即清理草稿，也不会在下一次打开时看到已放弃的修改。

## 高级筛选状态提示

- `advancedActive && !open` 时显示主色小圆点。
- Drawer 打开时隐藏圆点，因为高级筛选内容已经可见。
- 圆点只表达“至少一个高级筛选已生效”，不显示字段数量、条件数量或摘要。
- 圆点使用 `Badge` 的 dot 形态和主题主色，不写死色值。
- 圆点本身视为装饰；入口需要提供屏幕阅读器可读取的“高级筛选已生效”隐藏文本或等价可访问名称，不能只依赖颜色。
- 草稿有值但尚未确认时不显示圆点；圆点只反映已生效值。

## 房源列表接入

### 状态拆分

房源页继续保留当前已生效状态：

- `status`
- `inspectionDue`
- `inspectionReason`

新增 Drawer 草稿状态，概念结构为：

```ts
type HouseAdvancedFilterDraft = {
  status?: HouseStatus;
  inspectionFilter?: HouseInspectionFilter;
};
```

页面打开 Drawer 时，从当前 `status`、`inspectionDue` 和 `inspectionReason` 生成草稿。确认时再将草稿转换回现有查询状态，因此无需修改后端接口或 URL 参数协议。

房源页的 `advancedActive` 按已生效状态计算：

```ts
Boolean(status || inspectionDue || inspectionReason)
```

勘察筛选仍保持现有语义：

- 未选择：`inspectionDue = false`、`inspectionReason = undefined`
- 待勘察：`inspectionDue = true`、`inspectionReason = undefined`
- 指定原因：`inspectionDue = true`、`inspectionReason = 对应原因`

### 工具栏顺序

桌面端从左到右：

1. 房源范围
2. 关键词搜索
3. 高级筛选入口
4. 已选择房源时出现的“生成配房链接（已选 N 套）”
5. “新建房源”主按钮

房态和勘察状态从工具栏移入 Drawer。窄屏沿用 `AdminToolbar` 的纵向或换行行为，控件保持可操作，不要求在一行内压缩。

### 筛选提交和清除

- 常驻的房源范围和关键词继续按现有时机立即生效。
- 高级筛选只在确认后生效，并清空当前跨页勾选，避免已选房源与新结果范围不一致。
- Drawer 重置不影响房源范围、关键词、项目或楼栋范围。
- 现有列表空状态中的“清除筛选”继续清除关键词和已生效高级筛选，并重置到第一页。
- 排序、分页、列设置、行内编辑和请求参数格式不变。

### 编辑态限制

房源行内编辑期间继续禁用筛选与页面级操作。高级筛选入口禁用时不能打开 Drawer；如果页面进入编辑态时 Drawer 已打开，页面应关闭 Drawer，并放弃未确认草稿，避免编辑锁定状态下继续改变查询范围。

## 可访问性与键盘行为

- 高级筛选入口是正常 Button，可通过 Tab 聚焦并用 Enter/Space 打开。
- 入口文案始终可见，不以纯图标代替。
- 生效圆点有非视觉说明。
- Drawer 使用 Ant Design 默认焦点管理；关闭后焦点返回触发入口。
- Esc 和遮罩关闭遵循“放弃未确认草稿”的规则。
- 确认中禁止关闭时，需要保持明确的 loading 状态。

## 错误与边界处理

- `onConfirm` 失败时保留用户草稿和 Drawer，避免重新填写。
- 组件捕获 `onConfirm` 的 Promise 拒绝只用于保持 Drawer 打开，不负责展示错误；页面应在 `onConfirm` 内使用现有表单或消息体系给出反馈。
- `advancedContent` 为空仍可渲染，但房源页必须提供实际筛选字段。
- `onReset` 未提供时不显示“重置”按钮，避免渲染无行为控件。
- `actions` 为空时不保留空白区域。
- 未选择房源时不渲染配房按钮；选择数归零后立即移除。

## 测试策略

### 通用组件测试

- 非受控模式遵循 `defaultOpen`，并可由入口打开、由取消关闭。
- 受控模式遵循 `open`，用户操作会触发 `onOpenChange`，但不会自行改变受控显示状态。
- `advancedActive` 为真且关闭时显示圆点，打开时隐藏；圆点不包含数字。
- 重置只调用 `onReset`，不会自动确认或关闭。
- 取消、关闭、遮罩和 Esc 都请求关闭，不调用 `onConfirm`。
- 同步和异步确认成功后请求关闭。
- 异步确认失败时保持打开。
- 确认期间按钮状态和关闭限制正确。
- 禁用状态下不能打开。
- 生效提示具有可访问文本。

### 房源页测试

- 工具栏只常驻显示房源范围、关键词、高级筛选和新建。
- 房态、勘察状态只出现在 Drawer。
- 修改高级草稿不会立即改变已生效查询。
- 确认后应用两个高级条件、回到第一页并清空房源勾选。
- 取消后再次打开恢复为当前已生效值。
- 重置高级草稿不影响房源范围和关键词，确认后才真正清除高级条件。
- 任一已生效高级条件存在时显示小圆点，条件全部清除后圆点消失。
- 配房按钮只在存在勾选时出现，并显示正确数量。
- 行内编辑时入口和相关操作保持禁用。

## 验收标准

1. 房源列表上方默认只展示高频筛选和当前可用操作，房态与勘察状态不再长期占位。
2. 高级筛选的修改在点击“确定筛选”前不会影响列表。
3. 关闭或取消 Drawer 后，再次打开看到当前已生效值，而不是已放弃的草稿。
4. 高级筛选生效时入口有一个无数字的小圆点，并提供非颜色的无障碍说明。
5. 默认打开、默认关闭、受控打开三种使用方式行为明确，刷新后不记忆上次状态。
6. 重置仅处理高级筛选草稿，常驻筛选不受影响。
7. 未勾选房源时不显示配房按钮；勾选后显示按钮及已选数量。
8. 现有房源查询参数、URL、排序、分页、列设置和行内编辑能力保持兼容。
9. 通用组件不包含房源业务知识，可直接被其他管理端列表复用。
