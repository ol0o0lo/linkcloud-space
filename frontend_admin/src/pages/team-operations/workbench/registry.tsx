import type { ComponentType } from 'react';
import type {
  WorkbenchWidgetDefinition,
  WorkbenchWidgetWidth,
} from './layout/model';
import { AnnouncementSummaryWidget } from './widgets/mine/AnnouncementSummaryWidget';
import { HouseInspectionWidget } from './widgets/mine/HouseInspectionWidget';
import { MineQuickActionsWidget } from './widgets/mine/MineQuickActionsWidget';
import { PriorityTasksWidget } from './widgets/mine/PriorityTasksWidget';
import { TaskProgressWidget } from './widgets/mine/TaskProgressWidget';
import { TaskSummaryWidget } from './widgets/mine/TaskSummaryWidget';
import { OperatingOverviewWidget } from './widgets/space/OperatingOverviewWidget';
import { PublishWorkspaceWidget } from './widgets/space/PublishWorkspaceWidget';
import { SpaceQuickActionsWidget } from './widgets/space/SpaceQuickActionsWidget';
import { SpaceRisksWidget } from './widgets/space/SpaceRisksWidget';
import { WorkflowWidget } from './widgets/space/WorkflowWidget';

export type WorkbenchWidgetRegistration = WorkbenchWidgetDefinition & {
  component: ComponentType<{ width: WorkbenchWidgetWidth }>;
};

export const mineWidgetDefinitions = [
  {
    id: 'mine-summary',
    title: '待办概览',
    component: TaskSummaryWidget,
    defaultWidth: 3,
    allowedWidths: [2, 3],
    defaultVisible: true,
  },
  {
    id: 'mine-priority',
    title: '优先处理',
    component: PriorityTasksWidget,
    defaultWidth: 2,
    allowedWidths: [2, 3],
    defaultVisible: true,
  },
  {
    id: 'mine-inspections',
    title: '待勘察房源',
    component: HouseInspectionWidget,
    defaultWidth: 2,
    allowedWidths: [1, 2, 3],
    defaultVisible: true,
  },
  {
    id: 'mine-progress',
    title: '任务进展',
    component: TaskProgressWidget,
    defaultWidth: 1,
    allowedWidths: [1, 2],
    defaultVisible: true,
  },
  {
    id: 'mine-announcements',
    title: '公告摘要',
    component: AnnouncementSummaryWidget,
    defaultWidth: 2,
    allowedWidths: [1, 2, 3],
    defaultVisible: true,
  },
  {
    id: 'mine-quick-actions',
    title: '快捷操作',
    component: MineQuickActionsWidget,
    defaultWidth: 1,
    allowedWidths: [1, 2],
    defaultVisible: true,
  },
] as const satisfies readonly WorkbenchWidgetRegistration[];

export const spaceWidgetDefinitions = [
  {
    id: 'space-overview',
    title: '经营总览',
    component: OperatingOverviewWidget,
    defaultWidth: 3,
    allowedWidths: [2, 3],
    defaultVisible: true,
  },
  {
    id: 'space-publish',
    title: '发布工作区',
    component: PublishWorkspaceWidget,
    defaultWidth: 2,
    allowedWidths: [2, 3],
    defaultVisible: true,
  },
  {
    id: 'space-risks',
    title: '关键风险',
    component: SpaceRisksWidget,
    defaultWidth: 1,
    allowedWidths: [1, 2],
    defaultVisible: true,
  },
  {
    id: 'space-workflow',
    title: '成交转签',
    component: WorkflowWidget,
    defaultWidth: 2,
    allowedWidths: [2, 3],
    defaultVisible: true,
  },
  {
    id: 'space-quick-actions',
    title: '空间快捷操作',
    component: SpaceQuickActionsWidget,
    defaultWidth: 1,
    allowedWidths: [1, 2],
    defaultVisible: true,
  },
] as const satisfies readonly WorkbenchWidgetRegistration[];
