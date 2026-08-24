import { describe, expect, it } from 'vitest';
import type { WorkbenchWidgetDefinition } from './model';
import {
  defaultWorkbenchLayout,
  hasVisibleWorkbenchWidget,
  isSameWorkbenchLayout,
  normalizeWorkbenchLayout,
  setWidgetVisibility,
  updateWidgetWidth,
} from './normalize';
import { reorderWorkbenchWidgets } from './reorder';

const definitions: WorkbenchWidgetDefinition[] = [
  {
    id: 'summary',
    title: '概览',
    defaultWidth: 3,
    allowedWidths: [2, 3],
    defaultVisible: true,
  },
  {
    id: 'tasks',
    title: '任务',
    defaultWidth: 2,
    allowedWidths: [2, 3],
    defaultVisible: true,
  },
  {
    id: 'quick',
    title: '快捷入口',
    defaultWidth: 1,
    allowedWidths: [1, 2],
    defaultVisible: true,
  },
];

describe('workbench layout model', () => {
  it('builds defaults from definitions', () => {
    expect(defaultWorkbenchLayout(definitions)).toEqual([
      { id: 'summary', width: 3, visible: true },
      { id: 'tasks', width: 2, visible: true },
      { id: 'quick', width: 1, visible: true },
    ]);
  });

  it('sanitizes saved values and appends new widgets', () => {
    expect(
      normalizeWorkbenchLayout(
        [
          { id: 'tasks', width: 1, visible: true },
          { id: 'unknown', width: 1, visible: true },
          { id: 'tasks', width: 3, visible: false },
        ],
        definitions,
      ),
    ).toEqual([
      { id: 'tasks', width: 2, visible: true },
      { id: 'summary', width: 3, visible: true },
      { id: 'quick', width: 1, visible: true },
    ]);
  });

  it('falls back to defaults for malformed values', () => {
    expect(normalizeWorkbenchLayout({ widgets: [] }, definitions)).toEqual(
      defaultWorkbenchLayout(definitions),
    );
  });

  it('moves a restored widget to the visible tail', () => {
    const hidden = [
      { id: 'summary', width: 3 as const, visible: false },
      { id: 'tasks', width: 2 as const, visible: true },
      { id: 'quick', width: 1 as const, visible: true },
    ];

    expect(setWidgetVisibility(hidden, 'summary', true)).toEqual([
      { id: 'tasks', width: 2, visible: true },
      { id: 'quick', width: 1, visible: true },
      { id: 'summary', width: 3, visible: true },
    ]);
  });

  it('keeps a hidden widget in the array with its width', () => {
    expect(
      setWidgetVisibility(defaultWorkbenchLayout(definitions), 'quick', false),
    ).toEqual([
      { id: 'summary', width: 3, visible: true },
      { id: 'tasks', width: 2, visible: true },
      { id: 'quick', width: 1, visible: false },
    ]);
  });

  it('rejects widths not supported by the widget', () => {
    expect(
      updateWidgetWidth(
        defaultWorkbenchLayout(definitions),
        'quick',
        3,
        definitions,
      ),
    ).toEqual(defaultWorkbenchLayout(definitions));
  });

  it('updates supported widget widths', () => {
    expect(
      updateWidgetWidth(
        defaultWorkbenchLayout(definitions),
        'quick',
        2,
        definitions,
      ),
    ).toEqual([
      { id: 'summary', width: 3, visible: true },
      { id: 'tasks', width: 2, visible: true },
      { id: 'quick', width: 2, visible: true },
    ]);
  });

  it('reorders by widget id', () => {
    expect(
      reorderWorkbenchWidgets(
        defaultWorkbenchLayout(definitions),
        'quick',
        'summary',
      ),
    ).toEqual([
      { id: 'quick', width: 1, visible: true },
      { id: 'summary', width: 3, visible: true },
      { id: 'tasks', width: 2, visible: true },
    ]);
  });

  it('reports whether layouts are equal and have visible widgets', () => {
    const value = defaultWorkbenchLayout(definitions);
    expect(isSameWorkbenchLayout(value, [...value])).toBe(true);
    expect(hasVisibleWorkbenchWidget(value)).toBe(true);
    expect(
      hasVisibleWorkbenchWidget(
        value.map((item) => ({ ...item, visible: false })),
      ),
    ).toBe(false);
  });
});
