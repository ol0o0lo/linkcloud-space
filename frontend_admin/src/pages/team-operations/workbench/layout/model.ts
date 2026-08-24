export type WorkbenchWidgetWidth = 1 | 2 | 3;

export type WorkbenchWidgetPreference = {
  id: string;
  width: WorkbenchWidgetWidth;
  visible: boolean;
};

export type WorkbenchLayoutPreference = WorkbenchWidgetPreference[];

export const WORKBENCH_WIDTH_LABELS = {
  1: '窄',
  2: '中',
  3: '宽',
} as const;

export type WorkbenchWidgetDefinition = {
  id: string;
  title: string;
  defaultWidth: WorkbenchWidgetWidth;
  allowedWidths: readonly WorkbenchWidgetWidth[];
  defaultVisible: boolean;
};

export const WORKBENCH_LAYOUT_KEYS = {
  mine: 'internal.workbench.mine.layout.v1',
  space: 'internal.workbench.space.layout.v1',
} as const;
