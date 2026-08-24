import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { WorkbenchLayoutPreference } from '../layout/model';
import type { WorkbenchWidgetDefinition } from '../layout/model';
import { WorkbenchCustomizeDrawer } from './WorkbenchCustomizeDrawer';
import { WorkbenchLayout } from './WorkbenchLayout';
import { WorkbenchWidgetFrame } from './WorkbenchWidgetFrame';

const layout: WorkbenchLayoutPreference = [
  { id: 'summary', width: 3, visible: true },
  { id: 'hidden', width: 1, visible: false },
  { id: 'tasks', width: 2, visible: true },
];

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

describe('WorkbenchLayout', () => {
  it('renders visible widgets in preference order and exposes their width', () => {
    render(
      <WorkbenchLayout
        layout={layout}
        renderWidget={({ id }) => <div>{id}</div>}
      />,
    );

    const widgets = screen.getAllByTestId('workbench-widget');
    expect(widgets).toHaveLength(2);
    expect(widgets[0]).toHaveAttribute('data-widget-id', 'summary');
    expect(widgets[0]).toHaveAttribute('data-widget-width', '3');
    expect(widgets[1]).toHaveAttribute('data-widget-id', 'tasks');
    expect(screen.queryByText('hidden')).not.toBeInTheDocument();
  });

  it('shows width controls and drag handles only while editing', () => {
    const onWidthChange = vi.fn();
    const { rerender } = render(
      <WorkbenchLayout
        layout={layout}
        definitions={definitions}
        renderWidget={({ id }) => <div>{id}</div>}
        onWidthChange={onWidthChange}
      />,
    );

    expect(screen.queryByLabelText('拖动 概览')).not.toBeInTheDocument();
    rerender(
      <WorkbenchLayout
        layout={layout}
        definitions={definitions}
        editing
        renderWidget={({ id }) => <div>{id}</div>}
        onWidthChange={onWidthChange}
        onReorder={vi.fn()}
      />,
    );

    expect(screen.getByLabelText('拖动 概览')).toBeInTheDocument();
    expect(screen.getByTestId('workbench-editable-summary')).toBeInTheDocument();
    const summaryWidget = screen.getAllByTestId('workbench-widget').at(0);
    if (!summaryWidget) throw new Error('概览组件未渲染');
    fireEvent.click(within(summaryWidget).getByText('中'));
    expect(onWidthChange).toHaveBeenCalledWith('summary', 2);
  });

  it('does not enable drag or width editing on mobile', () => {
    render(
      <WorkbenchLayout
        layout={layout}
        definitions={definitions}
        editing
        mobile
        renderWidget={({ id }) => <div>{id}</div>}
        onWidthChange={vi.fn()}
        onReorder={vi.fn()}
      />,
    );

    expect(screen.queryByLabelText('拖动 概览')).not.toBeInTheDocument();
    expect(screen.queryByText('中')).not.toBeInTheDocument();
  });
});

describe('WorkbenchCustomizeDrawer', () => {
  it('lists only widths supported by each component', () => {
    render(
      <WorkbenchCustomizeDrawer
        open
        definitions={definitions}
        layout={layout}
        onClose={vi.fn()}
        onVisibilityChange={vi.fn()}
        onWidthChange={vi.fn()}
      />,
    );

    const summaryRow = screen.getByTestId('widget-setting-summary');
    expect(within(summaryRow).queryByText('窄')).not.toBeInTheDocument();
    expect(within(summaryRow).getByText('中')).toBeInTheDocument();
    expect(within(summaryRow).getByText('宽')).toBeInTheDocument();
  });

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

  it('shows visibility only on mobile', () => {
    render(
      <WorkbenchCustomizeDrawer
        open
        mobile
        definitions={definitions}
        layout={layout}
        onClose={vi.fn()}
        onVisibilityChange={vi.fn()}
        onWidthChange={vi.fn()}
      />,
    );

    expect(screen.getByText('移动端仅调整组件显示状态')).toBeInTheDocument();
    expect(screen.getByText('2 / 3 个组件显示')).toBeInTheDocument();
    expect(screen.getByTestId('workbench-customize-drawer')).toHaveAttribute(
      'data-mobile',
      'true',
    );
    expect(screen.queryByText('桌面宽度')).not.toBeInTheDocument();
  });
});

describe('WorkbenchWidgetFrame', () => {
  it('renders frame index and variant metadata', () => {
    render(
      <WorkbenchWidgetFrame variant="summary" title="待办概览">
        内容
      </WorkbenchWidgetFrame>,
    );

    expect(screen.getByTestId('workbench-widget-icon')).toBeInTheDocument();
    expect(screen.getByTestId('workbench-widget-frame')).toHaveAttribute(
      'data-variant',
      'summary',
    );
  });

  it('renders a loading skeleton instead of content', () => {
    render(
      <WorkbenchWidgetFrame title="任务" loading>
        loaded content
      </WorkbenchWidgetFrame>,
    );

    expect(screen.queryByText('loaded content')).not.toBeInTheDocument();
    expect(document.querySelector('.ant-skeleton')).toBeInTheDocument();
  });

  it('renders a local retry action for failed widgets', () => {
    const onRetry = vi.fn();
    render(
      <WorkbenchWidgetFrame title="任务" error onRetry={onRetry}>
        loaded content
      </WorkbenchWidgetFrame>,
    );

    fireEvent.click(screen.getByRole('button', { name: '重新加载' }));
    expect(onRetry).toHaveBeenCalledOnce();
    expect(screen.getByText('组件数据加载失败')).toBeInTheDocument();
  });
});
