# 工作台视觉重设计 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在不改变工作台数据、路由、布局配置和业务操作的前提下，为“我的工作台”和“空间工作台”的全部已注册组件实现经过确认的冷静指挥台视觉系统。

**Architecture:** 保持 `registry.tsx`、`layout/`、两套数据 Provider 和现有事件回调不变。`WorkbenchWidgetFrame` 只扩展有限的展示元数据（编号与外观变体），各 widget 负责自己的信息结构；`styles.ts` 集中声明设计 token、公共框架和每类 widget 的响应式样式，避免把业务条件移入公共组件。

**Tech Stack:** React 19、Umi Max 4、Ant Design 6、antd-style 4、TanStack React Query 5、dnd-kit、Vitest、Testing Library、TypeScript 6。

**Repository constraints:** 所有 Node 命令均在 `frontend_admin/` 中先通过 `source /Users/lan/.nvm/nvm.sh && nvm use 22` 切换到 Node 22；使用 npm；不修改 OpenAPI 生成文件、`package.json`、`package-lock.json` 或多语言文件；不执行任何 Git 操作。

---

## 文件结构

### 修改文件

```text
frontend_admin/src/pages/team-operations/workbench/
├── index.tsx
├── index.page.test.tsx
├── styles.ts
├── MineWorkbenchContent.test.tsx
├── SpaceWorkbenchContent.test.tsx
├── components/
│   ├── SortableWorkbenchWidget.tsx
│   ├── WorkbenchCustomizeDrawer.tsx
│   ├── WorkbenchEditToolbar.tsx
│   ├── WorkbenchLayout.test.tsx
│   └── WorkbenchWidgetFrame.tsx
└── widgets/
    ├── mine/
    │   ├── AnnouncementSummaryWidget.tsx
    │   ├── MineQuickActionsWidget.tsx
    │   ├── PriorityTasksWidget.tsx
    │   ├── TaskProgressWidget.tsx
    │   └── TaskSummaryWidget.tsx
    └── space/
        ├── OperatingOverviewWidget.tsx
        ├── PublishWorkspaceWidget.tsx
        ├── SpaceQuickActionsWidget.tsx
        ├── SpaceRisksWidget.tsx
        └── WorkflowWidget.tsx
```

### 不修改文件

```text
frontend_admin/src/pages/team-operations/workbench/
├── data/
├── hooks/
├── layout/
├── registry.tsx
├── view.ts
└── widgets/space/model.ts
```

这些文件承载查询、URL 筛选、布局存储和注册表协议；本次只消费其已有接口。

## 任务 1：为公共框架和页头建立可测试的视觉语义

**Files:**

- Modify: `frontend_admin/src/pages/team-operations/workbench/index.tsx`
- Modify: `frontend_admin/src/pages/team-operations/workbench/index.page.test.tsx`
- Modify: `frontend_admin/src/pages/team-operations/workbench/components/WorkbenchWidgetFrame.tsx`
- Modify: `frontend_admin/src/pages/team-operations/workbench/components/WorkbenchLayout.test.tsx`
- Modify: `frontend_admin/src/pages/team-operations/workbench/styles.ts`

- [ ] **Step 1: 先写页头和公共框架的失败测试**

在 `index.page.test.tsx` 的 `TeamOperationsWorkbenchPage` 用例中加入指挥栏和视角标题断言；在 `WorkbenchLayout.test.tsx` 的 `WorkbenchWidgetFrame` describe 中加入编号与变体断言：

```tsx
it('renders the command header while preserving the view switcher', () => {
  renderPage();

  expect(screen.getByTestId('workbench-command-header')).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: '我的工作台' })).toBeInTheDocument();
  expect(screen.getByRole('radio', { name: '我的工作台' })).toBeChecked();
});

it('renders frame index and variant metadata', () => {
  render(
    <WorkbenchWidgetFrame index="01" variant="summary" title="待办概览">
      内容
    </WorkbenchWidgetFrame>,
  );

  expect(screen.getByText('01')).toBeInTheDocument();
  expect(screen.getByTestId('workbench-widget-frame')).toHaveAttribute(
    'data-variant',
    'summary',
  );
});
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```bash
source /Users/lan/.nvm/nvm.sh && nvm use 22 && npm exec -- vitest run src/pages/team-operations/workbench/index.page.test.tsx src/pages/team-operations/workbench/components/WorkbenchLayout.test.tsx
```

Expected: FAIL，提示 `workbench-command-header`、`index` 或 `variant` 尚不存在。

- [ ] **Step 3: 扩展 `WorkbenchWidgetFrame`，但不承载业务布局**

在 `WorkbenchWidgetFrame.tsx` 定义有限的变体并保持现有加载、错误与重试分支：

```tsx
export type WorkbenchWidgetVariant =
  | 'summary'
  | 'priority'
  | 'progress'
  | 'announcement'
  | 'quick-actions'
  | 'overview'
  | 'publish'
  | 'risks'
  | 'workflow';

type WorkbenchWidgetFrameProps = {
  index?: string;
  variant?: WorkbenchWidgetVariant;
  title: ReactNode;
  subtitle?: ReactNode;
  extra?: ReactNode;
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
  children: ReactNode;
};
```

用一个固定的 `<section data-testid="workbench-widget-frame" data-variant={variant}>` 包裹三种渲染分支；正常态将 `Card.title` 改为以下节点，继续将 `extra` 透传给 `Card`：

```tsx
<div className={styles.widgetFrameHeading}>
  {index ? (
    <span className={styles.widgetFrameIndex} aria-hidden="true">
      {index}
    </span>
  ) : null}
  <div className={styles.widgetFrameTitle}>{title}</div>
</div>
```

`loading`、`error` 的外层也使用相同 `data-variant`，并把 Skeleton/Result 放在 `styles.widgetCard` 中，确保高度与边框稳定。不要在 frame 内判断房源、任务或公告数据。

- [ ] **Step 4: 将页头重组为指挥栏，保留全部现有逻辑**

在 `index.tsx` 内保留 `organizationName`、日期、刷新文本、视角切换、`openCustomization`、禁用状态和 `customizationLabel`。将当前 `pageHeader` 内容替换为下列结构，`activeView` 只用于选择静态眉标和标题：

```tsx
<header className={styles.commandHeader} data-testid="workbench-command-header">
  <div className={styles.commandHeaderCopy}>
    <span className={styles.commandEyebrow}>
      <span className={styles.commandLiveDot} aria-hidden="true" />
      {activeView === 'space' ? 'SPACE OPERATIONS · LIVE' : 'PERSONAL OPERATIONS · LIVE'}
    </span>
    <Typography.Title level={1} className={styles.commandTitle}>
      {activeView === 'space' ? '空间运营中心' : '我的工作台'}
    </Typography.Title>
    <div className={styles.commandMeta}>
      <Typography.Text strong>{organizationName}</Typography.Text>
      <span className={styles.metaDivider} aria-hidden="true" />
      <Typography.Text>{dayjs().format('YYYY年M月D日')}</Typography.Text>
      {activeDataStatus.isFetching || activeDataStatus.updatedAt ? (
        <>
          <span className={styles.metaDivider} aria-hidden="true" />
          <Typography.Text className={styles.metaDataStatus} aria-live="polite">
            {activeDataStatus.isFetching ? <><Spin size="small" />数据更新中</> : `数据更新于 ${activeDataStatus.updatedAt}`}
          </Typography.Text>
        </>
      ) : null}
    </div>
  </div>
  <div className={styles.commandActions}>
    {canViewSpaceWorkbench ? (
      <Segmented aria-label="切换工作台视角" className={styles.workbenchSwitcher} disabled={layout.isEditing} value={activeView} onChange={changeView} options={[
        { value: 'mine', label: '我的工作台', icon: <UserOutlined aria-hidden="true" /> },
        { value: 'space', label: '空间工作台', icon: <ApartmentOutlined aria-hidden="true" /> },
      ]} />
    ) : (
      <div className={styles.singleWorkbenchIndicator}>
        <span className={styles.singleWorkbenchIndicatorIcon} aria-hidden="true"><UserOutlined /></span>
        <span>我的工作台</span>
      </div>
    )}
    <Tooltip title={customizationLabel}>
      <Button aria-label={customizationLabel} className={styles.customizeButton} type="text" icon={<EllipsisOutlined aria-hidden="true" />} disabled={!layout.isReady || layout.loadError} onClick={openCustomization} />
    </Tooltip>
  </div>
</header>
```

不改 `changeView`、权限回退 effect、保存、重试、编辑状态或数据状态的任何回调。

- [ ] **Step 5: 在 `styles.ts` 添加基础 token 和公共框架样式**

在 `createStyles` 内新增工作台专属常量和类名。颜色必须通过 `token` 派生或仅作为本次确认的深蓝/辅助蓝常量使用：

```ts
const commandNavy = '#182338';
const commandBlue = '#4f7cff';

commandHeader: css`
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  overflow: hidden;
  padding: 20px 22px 19px 26px;
  border-radius: ${token.borderRadiusLG + 4}px;
  background: ${commandNavy};
  color: ${token.colorTextLightSolid};

  &::before {
    position: absolute;
    top: 0;
    bottom: 0;
    left: 0;
    width: 6px;
    background: linear-gradient(${commandBlue} 0 62%, #66c8bb 62%);
    content: '';
  }

  &::after {
    position: absolute;
    top: -64px;
    right: 248px;
    width: 180px;
    height: 124px;
    border: 1px solid rgb(142 171 255 / 16%);
    border-radius: 50%;
    content: '';
  }

  @media (max-width: 767px) {
    align-items: stretch;
    flex-direction: column;
    gap: 14px;
    padding: 18px;
  }
`,
widgetFrameHeading: css`display:flex; align-items:center; gap:8px; min-width:0;`,
widgetFrameIndex: css`
  display: inline-flex;
  width: 24px;
  height: 24px;
  flex: 0 0 24px;
  align-items: center;
  justify-content: center;
  border-radius: ${token.borderRadius}px;
  background: ${token.colorPrimaryBg};
  color: ${token.colorPrimary};
  font-size: ${token.fontSizeSM}px;
  font-weight: 700;
`,
widgetCard: css`
  height: 100%;
  overflow: hidden;
  border-color: ${token.colorBorderSecondary};
  border-radius: ${token.borderRadiusLG + 2}px;
  box-shadow: none;

  &::before {
    position: absolute;
    top: 0;
    left: 0;
    width: 18px;
    height: 18px;
    border-top: 2px solid ${commandBlue};
    border-left: 2px solid ${commandBlue};
    border-radius: ${token.borderRadiusLG + 2}px 0 0;
    content: '';
    opacity: 0.55;
  }
  &:hover { border-color: ${token.colorPrimaryBorder}; box-shadow: 0 8px 20px rgb(15 23 42 / 6%); }
`,
```

为 `commandActions` 的 Segmented 和 `customizeButton` 写暗色栏上下文样式；窄屏时两个 segmented item 等宽。不要影响非工作台页面的 Ant Design 全局样式。

- [ ] **Step 6: 运行测试确认通过**

Run:

```bash
source /Users/lan/.nvm/nvm.sh && nvm use 22 && npm exec -- vitest run src/pages/team-operations/workbench/index.page.test.tsx src/pages/team-operations/workbench/components/WorkbenchLayout.test.tsx
```

Expected: PASS。

## 任务 2：实现“我的工作台”的状态轨道、任务队列和进展环

**Files:**

- Modify: `frontend_admin/src/pages/team-operations/workbench/widgets/mine/TaskSummaryWidget.tsx`
- Modify: `frontend_admin/src/pages/team-operations/workbench/widgets/mine/PriorityTasksWidget.tsx`
- Modify: `frontend_admin/src/pages/team-operations/workbench/widgets/mine/TaskProgressWidget.tsx`
- Modify: `frontend_admin/src/pages/team-operations/workbench/MineWorkbenchContent.test.tsx`
- Modify: `frontend_admin/src/pages/team-operations/workbench/styles.ts`

- [ ] **Step 1: 为三个组件补充失败断言**

在 `MineWorkbenchContent.test.tsx` 的默认渲染测试中加入：

```tsx
expect(screen.getByTestId('mine-summary-rail')).toBeInTheDocument();
expect(screen.getByTestId('mine-priority-queue')).toBeInTheDocument();
expect(screen.getByTestId('mine-progress-ring')).toHaveTextContent('今日完成率');
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```bash
source /Users/lan/.nvm/nvm.sh && nvm use 22 && npm exec -- vitest run src/pages/team-operations/workbench/MineWorkbenchContent.test.tsx
```

Expected: FAIL，提示三个 test id 尚未渲染。

- [ ] **Step 3: 重写待办概览的呈现结构，不改变筛选路径**

保留 `items` 数组的 `key`、`label`、`value`、`path`，并为每项添加已有 Ant Design 图标节点；继续让每项持有显式的 `className`（例如 `styles.summaryMetricDanger`），不要通过字符串拼接读取 styles。调用公共框架时传入 `index="01" variant="summary"`，将当前 `Statistic` 按钮改为：

```tsx
<div
  className={cx(styles.summaryMetricGrid, width === 2 && styles.summaryMetricGridCompact)}
  data-testid="mine-summary-rail"
>
  {items.map((item) => (
    <button
      key={item.key}
      type="button"
      className={cx(styles.summaryMetric, item.className)}
      onClick={() => history.push(item.path)}
    >
      <span className={styles.summaryMetricHeader}>
        <span>{item.label}</span>
        <span className={styles.summaryMetricIcon} aria-hidden="true">{item.icon}</span>
      </span>
      <Statistic value={item.value} />
    </button>
  ))}
</div>
```

`summaryMetricGrid` 在手机端固定两列；每个状态通过顶部 3px 色带、图标和文本共同表达，不能只显示颜色。

- [ ] **Step 4: 重写优先处理和任务进展的局部层级**

给 `PriorityTasksWidget` 传入 `index="02" variant="priority"`。`PriorityTaskRow` 保留接受、完成、查看按钮和 `formatDueTimeDisplay`，仅改为以下三栏队列节点：

```tsx
<div className={styles.priorityTaskRow} data-tone={due.tone}>
  <div className={styles.priorityTaskDue}>
    <strong>{due.label}</strong>
    <span>{due.detail}</span>
  </div>
  <div className={styles.priorityTaskMain}>
    <button type="button" className={styles.priorityTaskTitle} onClick={() => history.push(taskPath)}>{assignment.task_title}</button>
    <Space size={[4, 4]} wrap>
      <Tag color={priorityColor(assignment.priority)}>{assignment.priority__mapping}</Tag>
      <Tag color={assignmentStatusColor(assignment.status)}>{assignment.status__mapping}</Tag>
      <Typography.Text type="secondary">{assignment.team_name || '组织级任务'}</Typography.Text>
    </Space>
  </div>
  <Space className={styles.priorityTaskActions}>
    {assignment.status === 'pending' ? <Button type="primary" size="small" loading={acceptingId === assignment.id} onClick={() => void accept(assignment.id)}>接受</Button> : null}
    {assignment.status === 'in_progress' ? <Button type="primary" size="small" loading={completingId === assignment.id} onClick={() => void complete(assignment.id)}>完成</Button> : null}
    <Button size="small" type="link" onClick={() => history.push(taskPath)}>查看</Button>
  </Space>
</div>
```

`TaskProgressWidget` 传入 `index="03" variant="progress"`，继续使用当前 `active`、`completed`、`total` 和 `percent` 计算式。将线形进度替换为可访问的 Ant Design `Progress type="circle"`，并把统计值放入 `taskProgressStats`：

```tsx
<div className={styles.taskProgressBody} data-testid="mine-progress-ring">
  <Progress type="circle" percent={percent} size={112} format={() => `${percent}%`} />
  <span className={styles.taskProgressCaption}>{`今日完成率 ${percent}%`}</span>
  <div className={styles.taskProgressStats}>
    <Statistic title="进行中" value={dashboard?.in_progress || 0} />
    <Statistic title="今日完成" value={completed} />
  </div>
</div>
```

先用 `source /Users/lan/.nvm/nvm.sh && nvm use 22 && npm exec -- antd info Progress` 核对 `Progress` 的 `type`、`size` 和 `format` 属性，再写组件代码。

- [ ] **Step 5: 添加 mine 专属样式并运行测试**

在 `styles.ts` 添加：`summaryMetricHeader`、`summaryMetricIcon`、四种 `summaryMetric*` 色带、`priorityTaskDue` 左色条、`priorityTaskActions`、`taskProgressBody`、`taskProgressCaption`。为窄屏把任务动作移动到第二列下方，保留最小 40px 点击区域。

Run:

```bash
source /Users/lan/.nvm/nvm.sh && nvm use 22 && npm exec -- vitest run src/pages/team-operations/workbench/MineWorkbenchContent.test.tsx
```

Expected: PASS，且现有“接受 / 完成”断言仍通过。

## 任务 3：完成公告便笺和个人快捷入口

**Files:**

- Modify: `frontend_admin/src/pages/team-operations/workbench/widgets/mine/AnnouncementSummaryWidget.tsx`
- Modify: `frontend_admin/src/pages/team-operations/workbench/widgets/mine/MineQuickActionsWidget.tsx`
- Modify: `frontend_admin/src/pages/team-operations/workbench/MineWorkbenchContent.test.tsx`
- Modify: `frontend_admin/src/pages/team-operations/workbench/styles.ts`

- [ ] **Step 1: 写公告与快捷入口的失败测试**

在默认渲染测试后新增：

```tsx
expect(screen.getByTestId('mine-announcement-note')).toHaveTextContent('房源发布规则调整通知');
expect(screen.getByTestId('mine-quick-actions')).toBeInTheDocument();
expect(screen.getByRole('button', { name: /全部任务/ })).toBeInTheDocument();
expect(screen.getByRole('button', { name: /团队公告/ })).toBeInTheDocument();
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```bash
source /Users/lan/.nvm/nvm.sh && nvm use 22 && npm exec -- vitest run src/pages/team-operations/workbench/MineWorkbenchContent.test.tsx
```

Expected: FAIL，提示公告便笺和快捷入口容器缺失。

- [ ] **Step 3: 实现公告便笺，不改变公告跳转**

给 `AnnouncementSummaryWidget` 传入 `index="04" variant="announcement"`。有公告时维持每条公告的 button 和 `history.push`，但首条/待确认公告使用便笺容器：

```tsx
<div className={styles.announcementSummaryList} data-testid="mine-announcement-note">
  {announcements.map((announcement) => (
    <button key={announcement.id} type="button" className={styles.announcementSummaryItem}>
      <span className={styles.announcementSummaryLabel}>需要关注</span>
      <strong>{announcement.title}</strong>
      {width > 1 && announcement.published_at ? (
        <Typography.Text type="secondary">{dayjs(announcement.published_at).format('M月D日 HH:mm')}</Typography.Text>
      ) : null}
      {!announcement.is_acknowledged && announcement.require_acknowledgement ? <Tag color="blue">待确认</Tag> : null}
    </button>
  ))}
</div>
```

在样式中用琥珀色左边条和右上折角伪元素表达便笺；`Tag` 仍保留“待确认”文本。空状态继续使用当前 `Empty` 与“暂无公告”。

- [ ] **Step 4: 实现两列快捷入口**

给 `MineQuickActionsWidget` 传入 `index="05" variant="quick-actions"`，保留 `links`、图标和 `history.push`。只给容器添加 `data-testid="mine-quick-actions"`，并使按钮保持可读名称：

```tsx
<div className={styles.widgetQuickActions} data-testid="mine-quick-actions">
  {links.map((link) => (
    <button key={link.key} type="button" className={styles.widgetQuickAction} onClick={() => history.push(link.path)}>
      <span className={styles.widgetQuickActionIcon} aria-hidden="true">{link.icon}</span>
      <span className={styles.widgetQuickActionCopy}>
        <strong>{link.label}</strong>
        <small>{link.description}</small>
      </span>
      <span className={styles.widgetQuickActionArrow} aria-hidden="true">↗</span>
    </button>
  ))}
</div>
```

`widgetQuickActions` 在宽度 2、3 时为两列，在单列 widget 或 767px 以下为单列。

- [ ] **Step 5: 运行 mine 测试**

Run:

```bash
source /Users/lan/.nvm/nvm.sh && nvm use 22 && npm exec -- vitest run src/pages/team-operations/workbench/MineWorkbenchContent.test.tsx
```

Expected: PASS，公告标题、任务操作与两个快捷入口均可访问。

## 任务 4：实现空间经营指标甲板与发布操作队列

**Files:**

- Modify: `frontend_admin/src/pages/team-operations/workbench/widgets/space/OperatingOverviewWidget.tsx`
- Modify: `frontend_admin/src/pages/team-operations/workbench/widgets/space/PublishWorkspaceWidget.tsx`
- Modify: `frontend_admin/src/pages/team-operations/workbench/SpaceWorkbenchContent.test.tsx`
- Modify: `frontend_admin/src/pages/team-operations/workbench/styles.ts`

- [ ] **Step 1: 写空间概览和发布队列的失败断言**

在 `SpaceWorkbenchContent.test.tsx` 的默认渲染测试中增加：

```tsx
expect(screen.getByTestId('space-metric-deck')).toHaveTextContent('在管房源');
expect(screen.getByTestId('space-publish-queue')).toHaveTextContent('星河湾 / 1 栋 / 103');
expect(screen.getByRole('button', { name: /^发\s*布$/ })).toBeInTheDocument();
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```bash
source /Users/lan/.nvm/nvm.sh && nvm use 22 && npm exec -- vitest run src/pages/team-operations/workbench/SpaceWorkbenchContent.test.tsx
```

Expected: FAIL，提示经营甲板和发布队列容器不存在。

- [ ] **Step 3: 实现五段经营指标甲板**

给 `OperatingOverviewWidget` 传入 `index="01" variant="overview"`，保留现有 `items` 数据。为每一项增加图标、说明和显式 `className`，不新增计算字段：

```tsx
<div className={cx(styles.spaceOverviewGrid, width === 2 && styles.spaceOverviewGridCompact)} data-testid="space-metric-deck">
  {items.map((item) => (
    <div key={item.key} className={cx(styles.spaceOverviewMetric, item.className)}>
      <span className={styles.spaceOverviewMetricHeader}>
        <span>{item.label}</span>
        <span className={styles.spaceOverviewMetricIcon} aria-hidden="true">{item.icon}</span>
      </span>
      <Statistic value={item.value} />
      <small>{item.hint}</small>
    </div>
  ))}
</div>
```

完整宽度时五列；宽度 2 时按三列/两列换行；手机端两列。每个状态同时显示名称、图标和数值。

- [ ] **Step 4: 用同一套队列结构替换发布工作区的 Table 分支**

删除 `Table` import 和 `width === 3` 的表格分支，保留 `Segmented`、URL 同步 effect、筛选 Alert、`Modal` 确认发布与 `actions` 的行为。新的列表在所有宽度下渲染，宽度只影响辅助信息显隐：

```tsx
<div className={styles.spacePublishQueue} data-testid="space-publish-queue" data-compact={width === 2 || undefined}>
  {rows.length ? rows.map((record) => (
    <div key={record.key} className={styles.spacePublishQueueItem} data-stage={record.stage}>
      <span className={styles.spacePublishStatusBar} aria-hidden="true" />
      <div className={styles.spacePublishQueueCopy}>
        <strong>{houseLabel(record.house)}</strong>
        <Typography.Text type="secondary">{record.actionHint}</Typography.Text>
        <Space size={[4, 4]} wrap>
          <Tag color={record.stage === 'blocked' ? 'orange' : 'blue'}>{record.stage === 'blocked' ? '阻断发布' : '待发布'}</Tag>
          {record.issues.map((issue) => <Tag key={issue}>{issue}</Tag>)}
        </Space>
      </div>
      <div className={styles.spacePublishQueueActions}>{actions(record)}</div>
    </div>
  )) : <Typography.Text type="secondary">当前筛选下暂无房源</Typography.Text>}
</div>
```

`data-stage="blocked"` 使用红色/琥珀状态条，`ready` 使用绿色状态条；行动链接和“发布”按钮的名称、确认弹窗与回调保持不变。

- [ ] **Step 5: 添加响应式样式并运行测试**

在 `styles.ts` 添加 `spaceOverviewMetricHeader`、五种概览状态变体、`spacePublishQueue*`。小于 767px 时发布队列的操作移动到内容下方，描述文本可折行，不使用横向滚动表格。

Run:

```bash
source /Users/lan/.nvm/nvm.sh && nvm use 22 && npm exec -- vitest run src/pages/team-operations/workbench/SpaceWorkbenchContent.test.tsx
```

Expected: PASS，已有确认发布测试继续验证 `publishHouse(3)`。

## 任务 5：实现关键风险警报栈、成交转签轨道和空间入口矩阵

**Files:**

- Modify: `frontend_admin/src/pages/team-operations/workbench/widgets/space/SpaceRisksWidget.tsx`
- Modify: `frontend_admin/src/pages/team-operations/workbench/widgets/space/WorkflowWidget.tsx`
- Modify: `frontend_admin/src/pages/team-operations/workbench/widgets/space/SpaceQuickActionsWidget.tsx`
- Modify: `frontend_admin/src/pages/team-operations/workbench/SpaceWorkbenchContent.test.tsx`
- Modify: `frontend_admin/src/pages/team-operations/workbench/styles.ts`

- [ ] **Step 1: 写三个空间组件的失败断言**

在 `SpaceWorkbenchContent.test.tsx` 中增加：

```tsx
expect(screen.getByTestId('space-risk-stack')).toHaveTextContent('4');
expect(screen.getByTestId('space-workflow-rail')).toHaveTextContent('王客户 待签约');
expect(screen.getByTestId('space-quick-actions')).toHaveTextContent('房源管理');
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```bash
source /Users/lan/.nvm/nvm.sh && nvm use 22 && npm exec -- vitest run src/pages/team-operations/workbench/SpaceWorkbenchContent.test.tsx
```

Expected: FAIL，提示三个新容器尚未渲染。

- [ ] **Step 3: 以警报块呈现关键风险，保留跳转映射**

给 `SpaceRisksWidget` 传入 `index="03" variant="risks"`，保持 `riskPaths` 不变：

```tsx
<div className={styles.spaceRiskList} data-testid="space-risk-stack">
  {data.risks.map((risk) => (
    <button key={risk.key} type="button" className={styles.spaceRiskItem} data-level={risk.level} onClick={() => history.push(riskPaths[risk.key])}>
      <span className={styles.spaceRiskCount}>{risk.count}</span>
      <span className={styles.spaceRiskCopy}><strong>{risk.label}</strong><small>查看处理项</small></span>
      <RightOutlined aria-hidden="true" />
    </button>
  ))}
</div>
```

空状态继续使用当前 `Empty`。风险级别映射到左侧 4px 状态条，不得删除 `risk.label`。

- [ ] **Step 4: 为成交转签增加只读流程轨道并保留列表和筛选**

给 `WorkflowWidget` 传入 `index="04" variant="workflow"`。保留 `Segmented`、`filter`、URL 同步和 `rows` 计算，删除只为宽度 3 服务的 `Table` 分支；在列表前添加不会虚构历史统计的轨道：

```tsx
<div className={styles.spaceWorkflowRail} aria-label="成交转签流程">
  {['确认成交', '补全租客资料', '创建租约', '完成签约'].map((label, index) => (
    <div key={label} className={styles.spaceWorkflowStage} data-active={index === 1 || index === 2 || undefined}>
      <span aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
      <strong>{label}</strong>
    </div>
  ))}
</div>
<div className={styles.spaceWorkList} data-testid="space-workflow-rail">
  {rows.length ? rows.map((record) => (
    <div className={styles.spaceWorkRow} key={record.key}>
      <div className={styles.spaceWorkMain}>
        <Space size={6} wrap>
          <Tag color={record.queueKey === 'contact-missing' ? 'gold' : 'purple'}>{record.queue}</Tag>
          <strong>{record.title}</strong>
        </Space>
        <span>{record.house.label}</span>
        <Typography.Text type="secondary">{record.nextStep}</Typography.Text>
      </div>
      <a href={dashboardHref(record.actionPath)} onClick={(event) => openPath(record, event)}>{record.actionLabel}</a>
    </div>
  )) : <Typography.Text type="secondary">{filter === 'all' ? '暂无成交转签待办' : '当前筛选下暂无待办'}</Typography.Text>}
</div>
```

轨道仅表明业务阶段，不展示不存在于现有 Provider 的累计数量。`rows` 仍是待补租客/待签约的唯一数据来源。

- [ ] **Step 5: 将空间快捷操作改为三列矩阵**

给 `SpaceQuickActionsWidget` 传入 `index="05" variant="quick-actions"`，保留三条 link 的图标、文案和 `history.push`。添加 `data-testid="space-quick-actions"`，并采用和个人入口不同的网格结构：

```tsx
<div className={styles.spaceQuickActions} data-testid="space-quick-actions">
  {links.map((link) => (
    <button key={link.key} type="button" className={styles.spaceQuickAction} onClick={() => history.push(link.path)}>
      <span className={styles.spaceQuickActionIcon} aria-hidden="true">{link.icon}</span>
      <strong>{link.label}</strong>
      <small>{link.description}</small>
      <span className={styles.spaceQuickActionArrow} aria-hidden="true">↗</span>
    </button>
  ))}
</div>
```

宽度 1/手机端为单列，宽度 2 及以上为三列；保证每个按钮高度至少 40px。

- [ ] **Step 6: 添加样式并运行测试**

在 `styles.ts` 添加 `spaceRisk*`、`spaceWorkflow*` 和 `spaceQuickAction*`。窄屏将流程轨道压缩为可换行的四个阶段标签，不能产生水平滚动。

Run:

```bash
source /Users/lan/.nvm/nvm.sh && nvm use 22 && npm exec -- vitest run src/pages/team-operations/workbench/SpaceWorkbenchContent.test.tsx
```

Expected: PASS，风险、转签待办和三个入口均可见，确认发布回归仍通过。

## 任务 6：实现编辑工具栏、拖动组件与组件管理抽屉的平衡版视觉

**Files:**

- Modify: `frontend_admin/src/pages/team-operations/workbench/components/WorkbenchEditToolbar.tsx`
- Modify: `frontend_admin/src/pages/team-operations/workbench/components/SortableWorkbenchWidget.tsx`
- Modify: `frontend_admin/src/pages/team-operations/workbench/components/WorkbenchCustomizeDrawer.tsx`
- Modify: `frontend_admin/src/pages/team-operations/workbench/components/WorkbenchLayout.test.tsx`
- Modify: `frontend_admin/src/pages/team-operations/workbench/styles.ts`

- [ ] **Step 1: 扩展编辑态失败测试**

在 `WorkbenchLayout.test.tsx` 中补充：

```tsx
it('uses the bottom drawer and hides width options on mobile', () => {
  render(
    <WorkbenchCustomizeDrawer open mobile definitions={definitions} layout={layout} onClose={vi.fn()} onVisibilityChange={vi.fn()} onWidthChange={vi.fn()} />,
  );

  expect(screen.getByTestId('workbench-customize-drawer')).toHaveAttribute('data-mobile', 'true');
  expect(screen.getByText('2 / 3 个组件显示')).toBeInTheDocument();
  expect(screen.queryByText('桌面宽度')).not.toBeInTheDocument();
});

it('marks a focused editable widget without enabling controls outside edit mode', () => {
  const renderWidget = ({ id }: { id: string }) => <div>{id}</div>;
  const props = { layout, definitions, renderWidget, onWidthChange: vi.fn(), onReorder: vi.fn() };
  const { rerender } = render(<WorkbenchLayout {...props} />);
  expect(screen.queryByTestId('workbench-editable-summary')).not.toBeInTheDocument();
  rerender(<WorkbenchLayout {...props} editing />);
  expect(screen.getByTestId('workbench-editable-summary')).toBeInTheDocument();
});
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```bash
source /Users/lan/.nvm/nvm.sh && nvm use 22 && npm exec -- vitest run src/pages/team-operations/workbench/components/WorkbenchLayout.test.tsx
```

Expected: FAIL，提示抽屉 test id、可见数量和 editable widget test id 缺失。

- [ ] **Step 3: 调整编辑工具栏与拖动组件的语义包装**

在 `WorkbenchEditToolbar.tsx` 保留 `Modal.confirm`、按钮文本和回调；仅把文案包在眉标与状态节点中：

```tsx
<div className={styles.editToolbar}>
  <div>
    <span className={styles.editToolbarEyebrow}>LAYOUT EDITOR</span>
    <div className={styles.editToolbarTitle}>
      <Typography.Text strong>{`正在自定义${viewLabel}`}</Typography.Text>
      <Typography.Text type="secondary" className={styles.editToolbarStatus} aria-live="polite">
        {isSaving ? '保存中' : isDirty ? '尚未保存' : '没有未保存修改'}
      </Typography.Text>
    </div>
  </div>
  <Space wrap>
    <Button danger onClick={onRestore}>恢复默认</Button>
    <Button onClick={cancel}>取消</Button>
    <Button type="primary" loading={isSaving} disabled={!canSave} onClick={onSave}>保存布局</Button>
  </Space>
</div>
```

在 `SortableWorkbenchWidget.tsx` 的外层 section 增加：

```tsx
data-testid={`workbench-editable-${preference.id}`}
data-dragging={isDragging || undefined}
```

拖动手柄、`useSortable` 的 attributes/listeners、宽度 `Segmented` 与回调不得更改。

- [ ] **Step 4: 实现抽屉的桌面/移动端配置**

先运行 `source /Users/lan/.nvm/nvm.sh && nvm use 22 && npm exec -- antd info Drawer`；确认 `placement`、`width`、`height` 均可用后，将 Drawer 配置为：

```tsx
<Drawer
  open={open}
  placement={mobile ? 'bottom' : 'right'}
  width={mobile ? undefined : 380}
  height={mobile ? 360 : undefined}
  title="组件管理"
  mask={false}
  className={styles.widgetCustomizeDrawer}
  onClose={onClose}
>
  <div data-testid="workbench-customize-drawer" data-mobile={mobile || undefined}>
    <Typography.Paragraph type="secondary">
      {mobile ? '移动端仅调整组件显示状态' : '控制组件显隐与桌面宽度，排序请在工作台中直接拖动。'}
    </Typography.Paragraph>
    <Typography.Text className={styles.widgetSettingsCount}>{`${visibleCount} / ${definitions.length} 个组件显示`}</Typography.Text>
    <div className={styles.widgetSettingsList}>
      {definitions.map((definition, index) => {
        const preference = preferences.get(definition.id) || { id: definition.id, width: definition.defaultWidth, visible: definition.defaultVisible };
        return (
          <div key={definition.id} data-testid={`widget-setting-${definition.id}`} className={styles.widgetSettingItem}>
            <div className={styles.widgetSettingHeader}>
              <Typography.Text strong><span className={styles.widgetSettingIndex} aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>{definition.title}</Typography.Text>
              <Switch aria-label={`显示 ${definition.title}`} checked={preference.visible} onChange={(visible) => {
                if (!visible && visibleCount <= 1) { setValidationError('工作台至少需要保留一个组件'); return; }
                setValidationError(undefined);
                onVisibilityChange(definition.id, visible);
              }} />
            </div>
            {!mobile ? <div className={styles.widgetSettingWidth}>
              <Typography.Text type="secondary">桌面宽度</Typography.Text>
              <Segmented size="small" value={preference.width} disabled={!preference.visible} options={definition.allowedWidths.map((width) => ({ value: width, label: WORKBENCH_WIDTH_LABELS[width] }))} onChange={(value) => onWidthChange(definition.id, value as WorkbenchWidgetWidth)} />
            </div> : null}
          </div>
        );
      })}
    </div>
  </div>
</Drawer>
```

移动端仅渲染开关；桌面保留每项的 `Segmented` 宽度控制。最后一个可见组件的阻止逻辑、`validationError` 和回调完全保留。

- [ ] **Step 5: 写编辑态样式并运行测试**

在 `styles.ts` 将 `editToolbar` 改为深蓝粘性指挥条；`editableWidget` 使用主蓝细虚线与左上角短角标；`[data-dragging='true']` 降低透明度；`:focus-within` 和 `[data-dragging='true']` 使用蓝色实边框及轻光圈。抽屉的移动端样式只改变内边距和列表密度，不能覆盖全局 Drawer。

Run:

```bash
source /Users/lan/.nvm/nvm.sh && nvm use 22 && npm exec -- vitest run src/pages/team-operations/workbench/components/WorkbenchLayout.test.tsx src/pages/team-operations/workbench/index.page.test.tsx
```

Expected: PASS，桌面宽度控制与拖动手柄仅在编辑态存在；移动端抽屉只显示开关。

## 任务 7：收敛样式、检查可访问性并执行完整自动化验证

**Files:**

- Modify: `frontend_admin/src/pages/team-operations/workbench/styles.ts`
- Modify: `frontend_admin/src/pages/team-operations/workbench/MineWorkbenchContent.test.tsx`
- Modify: `frontend_admin/src/pages/team-operations/workbench/SpaceWorkbenchContent.test.tsx`
- Modify: `frontend_admin/src/pages/team-operations/workbench/components/WorkbenchLayout.test.tsx`
- Modify: `frontend_admin/src/pages/team-operations/workbench/index.page.test.tsx`

- [ ] **Step 1: 完成样式收敛检查**

确保 `styles.ts` 中只使用工作台类名，且每一类 widget 都有明确边界：

```text
共享：command*、widgetFrame*、widgetCard、widgetGrid
个人：summaryMetric*、priorityTask*、taskProgress*、announcementSummary*、widgetQuickAction*
空间：spaceOverview*、spacePublish*、spaceRisk*、spaceWorkflow*、spaceQuickAction*
编辑：editToolbar*、editableWidget、widgetEditorControls、widgetSettings*
```

删除本次不再被任何工作台组件引用的旧样式定义，但不使用物理删除命令；仅通过 `apply_patch` 精确移除无引用的样式块。不得移除仍被其他页面或测试引用的类。

- [ ] **Step 2: 为可访问性补齐回归断言**

在测试中验证至少以下元素仍有可访问名称：

```tsx
expect(screen.getByRole('button', { name: /全部任务/ })).toBeVisible();
expect(screen.getByRole('button', { name: /房源管理/ })).toBeVisible();
expect(screen.getByLabelText('拖动 概览')).toBeVisible();
expect(screen.getByRole('switch', { name: '显示 概览' })).toBeVisible();
```

装饰性图标必须添加 `aria-hidden="true"`；不能移除原有链接 `href`、按钮文本、`aria-label` 或 `aria-live`。

- [ ] **Step 3: 运行工作台范围测试**

Run:

```bash
source /Users/lan/.nvm/nvm.sh && nvm use 22 && npm exec -- vitest run src/pages/team-operations/workbench/MineWorkbenchContent.test.tsx src/pages/team-operations/workbench/SpaceWorkbenchContent.test.tsx src/pages/team-operations/workbench/components/WorkbenchLayout.test.tsx src/pages/team-operations/workbench/index.page.test.tsx src/pages/team-operations/workbench/layout/layout.test.ts src/pages/team-operations/workbench/hooks/useWorkbenchLayoutPreference.test.tsx src/pages/team-operations/workbench/hooks/useUnsavedWorkbenchGuard.test.tsx
```

Expected: PASS。

- [ ] **Step 4: 运行静态检查**

Run:

```bash
source /Users/lan/.nvm/nvm.sh && nvm use 22 && npm run lint
```

Expected: PASS，Biome 与 TypeScript 不报告错误。

- [ ] **Step 5: 进行浏览器响应式验收**

在已登录的本地管理端依次打开以下地址，分别检查 1440px、1024px、768px 与 390px 宽度：

```text
http://localhost:8080/dashboard/rental/workbench/overview
http://localhost:8080/dashboard/rental/workbench/overview?view=space
```

验收清单：

- 深蓝页头不遮挡组织、日期、刷新状态、视角切换和自定义入口。
- 我的五个组件与空间五个组件均有不同的信息结构，但边框、编号与焦点态一致。
- 任务接受/完成、公告跳转、发布确认、风险跳转、转签跳转和快捷入口正常工作。
- 1440px 为三列、1024px 为两列、768px/390px 为单列；指标按规范折叠，发布队列没有横向滚动。
- 编辑态仅桌面显示拖动和宽度控件；移动端从底部打开组件管理，仅能改变显隐。
- 错误、空状态和加载状态仍可独立显示；保存、取消与恢复默认的既有行为未回归。

## 计划自检

- 设计说明中的共享页头、十个 widget、公共状态、编辑态、移动端、可访问性和验证要求均映射到任务 1–7。
- 布局存储、Provider、注册表、URL 筛选、业务 API、生成代码、多语言与依赖锁文件均明确排除，避免越界重构。
- 计划没有占位任务；新增 test id、变体类型、样式类、组件结构、命令和预期结果都在对应任务中定义。
- `WorkbenchWidgetFrame` 的 `index`/`variant`、移动端 `Drawer` 的 `placement`、所有 test id 与每个后续任务保持同名。
