import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { WorkbenchWidgetDefinition } from '../layout/model';
import { WorkbenchCustomizeDrawer } from './WorkbenchCustomizeDrawer';
import { WorkbenchWidgetFrame } from './WorkbenchWidgetFrame';

const definitions: WorkbenchWidgetDefinition[] = [
  {
    id: 'summary',
    title: '概览',
    defaultWidth: 3,
    allowedWidths: [2, 3],
    defaultVisible: true,
  },
  {
    id: 'hidden',
    title: '隐藏组件',
    defaultWidth: 1,
    allowedWidths: [1, 2],
    defaultVisible: true,
  },
  {
    id: 'tasks',
    title: '任务',
    defaultWidth: 2,
    allowedWidths: [2, 3],
    defaultVisible: true,
  },
];

describe('WorkbenchCustomizeDrawer', () => {
  it('prevents hiding the last visible component', () => {
    const onVisibilityChange = vi.fn();
    render(
      <WorkbenchCustomizeDrawer
        open
        definitions={definitions.slice(0, 1)}
        layout={[{ id: 'summary', width: 3, visible: true }]}
        onClose={vi.fn()}
        onVisibilityChange={onVisibilityChange}
        onWidthChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('switch', { name: '显示 概览' }));
    expect(onVisibilityChange).not.toHaveBeenCalled();
    expect(screen.getByText('工作台至少需要保留一个组件')).toBeInTheDocument();
  });
});

describe('WorkbenchWidgetFrame', () => {
  it('renders a local retry action for failed widgets', () => {
    const onRetry = vi.fn();
    render(
      <WorkbenchWidgetFrame title="任务" error onRetry={onRetry}>
        loaded content
      </WorkbenchWidgetFrame>,
    );

    fireEvent.click(screen.getByRole('button', { name: '重新加载' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
