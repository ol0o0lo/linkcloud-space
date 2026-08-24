import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { BuildingResultPanel, EstateResultPanel } from './components';

vi.mock('@umijs/max', () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));

describe('地图结果面板', () => {
  it('展开的楼栋结果以地图内浮层呈现', () => {
    render(
      <BuildingResultPanel
        located={[]}
        unlocated={[]}
        unlocatedTotal={0}
        collapsed={false}
        loading={false}
        truncated={false}
        locatedError={false}
        unlocatedError={false}
        returnTo="/dashboard/rental/properties/map"
        pendingListHref="/rental/properties/estates"
        onSelect={vi.fn()}
        onToggleCollapsed={vi.fn()}
        onRetryLocated={vi.fn()}
        onRetryUnlocated={vi.fn()}
      />,
    );

    const panel = screen
      .getByRole('button', { name: '收起楼栋结果' })
      .closest<HTMLElement>('.ant-card');

    expect(panel?.style.position).toBe('absolute');
    expect(panel?.style.top).toBe('12px');
    expect(panel?.style.left).toBe('12px');
    expect(panel?.style.bottom).toBe('12px');
    expect(panel?.style.backdropFilter).toBe('blur(12px)');
  });

  it('收起楼栋结果时只保留展开图标', () => {
    render(
      <BuildingResultPanel
        located={[]}
        unlocated={[]}
        unlocatedTotal={1}
        collapsed
        loading={false}
        truncated={false}
        locatedError={false}
        unlocatedError={false}
        returnTo="/dashboard/rental/properties/map"
        pendingListHref="/rental/properties/estates"
        onSelect={vi.fn()}
        onToggleCollapsed={vi.fn()}
        onRetryLocated={vi.fn()}
        onRetryUnlocated={vi.fn()}
      />,
    );

    const panel = screen
      .getByRole('button', { name: '展开楼栋结果' })
      .closest<HTMLElement>('.ant-card');

    expect(panel?.style.width).toBe('40px');
    expect(panel?.style.height).toBe('40px');
    expect(screen.queryByLabelText('当前视野楼栋 0 栋')).toBeNull();
    expect(screen.queryByTitle('待定位楼栋 1')).toBeNull();
  });

  it('收起小区结果时同样只保留展开图标', () => {
    render(
      <EstateResultPanel
        points={[]}
        collapsed
        loading={false}
        error={false}
        truncated={false}
        onSelect={vi.fn()}
        onToggleCollapsed={vi.fn()}
        onRetry={vi.fn()}
      />,
    );

    const panel = screen
      .getByRole('button', { name: '展开小区结果' })
      .closest<HTMLElement>('.ant-card');

    expect(panel?.style.width).toBe('40px');
    expect(panel?.style.height).toBe('40px');
    expect(screen.queryByLabelText('当前视野项目 0 个')).toBeNull();
  });

  it('将待定位楼栋收为可展开的紧凑任务入口', () => {
    render(
      <BuildingResultPanel
        located={[]}
        unlocated={[
          {
            id: 8,
            estate: null,
            name: '待定位楼栋',
            address: '科技路 8 号',
            counts: {
              total: 1,
              vacant: 1,
              listed: 0,
              rented: 0,
              renovating: 0,
            },
          },
        ]}
        unlocatedTotal={1}
        collapsed={false}
        loading={false}
        truncated={false}
        locatedError={false}
        unlocatedError={false}
        returnTo="/dashboard/rental/properties/map"
        pendingListHref="/rental/properties/estates"
        onSelect={vi.fn()}
        onToggleCollapsed={vi.fn()}
        onRetryLocated={vi.fn()}
        onRetryUnlocated={vi.fn()}
      />,
    );

    expect(screen.queryByText('立即定位')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: '待定位楼栋 1' }));

    expect(screen.getByText('立即定位')).toBeInTheDocument();
  });
});
