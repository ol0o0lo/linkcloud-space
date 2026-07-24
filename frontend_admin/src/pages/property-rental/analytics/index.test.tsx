import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import dayjs from 'dayjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AnalyticsPage from './index';

const { mockOverview, mockTrends, mockTargets } = vi.hoisted(() => ({
  mockOverview: vi.fn(),
  mockTrends: vi.fn(),
  mockTargets: vi.fn(),
}));

vi.mock('@ant-design/plots', () => ({
  Line: ({
    axis,
    data,
  }: {
    axis?: {
      x?: {
        labelAutoRotate?: boolean;
        labelFormatter?: (value: string) => string;
        tickFilter?: (
          value: unknown,
          index: number,
          values: unknown[],
        ) => boolean;
      };
    };
    data: unknown[];
  }) => (
    <div data-testid="analytics-line">
      {data.length}
      <span data-testid="analytics-x-tick-count">
        {
          Array.from({ length: 30 }).filter((value, index, values) =>
            axis?.x?.tickFilter
              ? axis.x.tickFilter(value, index, values)
              : true,
          ).length
        }
      </span>
      <span data-testid="analytics-x-label">
        {axis?.x?.labelFormatter?.('2026-07-19')}
      </span>
      <span data-testid="analytics-x-rotate">
        {String(axis?.x?.labelAutoRotate)}
      </span>
    </div>
  ),
}));

vi.mock('@umijs/max', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/components/EntityPreview', () => ({
  BuildingPreview: ({
    children,
    id,
  }: {
    children: React.ReactNode;
    id: number;
  }) => <span data-testid={`building-preview-${id}`}>{children}</span>,
  HousePreview: ({
    children,
    id,
  }: {
    children: React.ReactNode;
    id?: number;
  }) => <span data-testid={`house-preview-${id}`}>{children}</span>,
}));

vi.mock('@/pages/tenant/shared', () => ({
  TenantSelectionGuard: ({
    title,
    children,
  }: {
    title: string;
    children: React.ReactNode;
  }) => (
    <section>
      <h1>{title}</h1>
      {children}
    </section>
  ),
  useTenantWorkspace: () => ({ selectedOrgSlug: 'analytics-org' }),
}));

vi.mock('@/services/manual/analytics', () => ({
  getAnalyticsOverview: mockOverview,
  getAnalyticsTrends: mockTrends,
  getAnalyticsTargets: mockTargets,
}));

describe('经营分析页面', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOverview.mockResolvedValue({
      start_date: '2026-07-01',
      end_date: '2026-07-19',
      total_events: 12,
      unique_visitors: 5,
      metrics: [
        {
          event_name: 'house.view',
          label: '房源浏览',
          count: 8,
          unique_visitors: 5,
        },
        {
          event_name: 'house.phone_click',
          label: '电话咨询点击',
          count: 2,
          unique_visitors: 2,
        },
        {
          event_name: 'house.online_consult_click',
          label: '在线咨询点击',
          count: 1,
          unique_visitors: 1,
        },
        {
          event_name: 'viewing.requested',
          label: '预约带看',
          count: 1,
          unique_visitors: 1,
        },
        {
          event_name: 'lease.created',
          label: '生成租约',
          count: 1,
          unique_visitors: 1,
        },
      ],
    });
    mockTrends.mockResolvedValue([
      {
        date: '2026-07-19',
        event_name: 'house.view',
        count: 8,
        unique_visitors: 5,
      },
    ]);
    mockTargets.mockResolvedValue({
      items: [
        {
          target_id: '10',
          label: '云岸 / 1栋 / 101',
          display_items: [
            { target_type: 'building', target_id: '2', label: '1栋' },
            { target_type: 'house', target_id: '10', label: '101' },
          ],
          total: 12,
          unique_visitors: 5,
          metrics: {
            'house.view': 8,
            'house.phone_click': 2,
            'viewing.requested': 1,
            'lease.created': 1,
          },
        },
      ],
      total: 1,
      page: 1,
      page_size: 20,
    });
  });

  it('展示概览、趋势、转化漏斗和房源排行', async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <AnalyticsPage />
      </QueryClientProvider>,
    );

    expect(
      screen.getByRole('heading', { name: '经营分析' }),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByTestId('building-preview-2')).toHaveTextContent('1栋'),
    );
    expect(screen.getByText('转化漏斗')).toBeInTheDocument();
    expect(screen.getByText('房源行为排行')).toBeInTheDocument();
    expect(screen.getByTestId('analytics-line')).toBeInTheDocument();
    expect(screen.getByTestId('analytics-x-tick-count')).toHaveTextContent('7');
    expect(screen.getByTestId('analytics-x-label')).toHaveTextContent('07-19');
    expect(screen.getByTestId('analytics-x-rotate')).toHaveTextContent('false');
    expect(screen.getByTestId('building-preview-2')).toHaveTextContent('1栋');
    expect(screen.getByTestId('house-preview-10')).toHaveTextContent('101');
    expect(screen.queryByText('云岸 / 1栋 / 101')).not.toBeInTheDocument();
    expect(mockOverview).toHaveBeenCalled();
    expect(mockTargets).toHaveBeenCalledWith(
      expect.objectContaining({ target_type: 'house', page: 1, page_size: 20 }),
    );
  });

  it('可通过快捷日期范围刷新经营分析数据', async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <AnalyticsPage />
      </QueryClientProvider>,
    );

    await waitFor(() => expect(mockOverview).toHaveBeenCalled());
    mockOverview.mockClear();

    const startDateInput = screen.getAllByRole('textbox')[0];
    fireEvent.mouseDown(startDateInput, { button: 0 });
    fireEvent.click(startDateInput);
    fireEvent.click(await screen.findByText('近7天'));

    await waitFor(() =>
      expect(mockOverview).toHaveBeenCalledWith(
        expect.objectContaining({
          start_date: dayjs().subtract(6, 'day').format('YYYY-MM-DD'),
          end_date: dayjs().format('YYYY-MM-DD'),
        }),
      ),
    );
  });
});
