import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import dayjs from 'dayjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AnalyticsPage from './index';

const { mockSources, mockOverview, mockTrends, mockTargets } = vi.hoisted(
  () => ({
    mockSources: vi.fn(),
    mockOverview: vi.fn(),
    mockTrends: vi.fn(),
    mockTargets: vi.fn(),
  }),
);

vi.mock('@ant-design/plots', () => ({
  Area: ({
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
    <div
      data-testid="analytics-area"
      data-event-name={
        (data[0] as { event_name?: string } | undefined)?.event_name
      }
    >
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

vi.mock('@/pages/space/shared', () => ({
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
  getAnalyticsSources: mockSources,
  getAnalyticsOverview: mockOverview,
  getAnalyticsTrends: mockTrends,
  getAnalyticsTargets: mockTargets,
}));

const overviewData = {
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
};

const trendData = [
  {
    date: '2026-07-19',
    event_name: 'house.view',
    count: 8,
    unique_visitors: 5,
  },
  {
    date: '2026-07-19',
    event_name: 'house.phone_click',
    count: 2,
    unique_visitors: 2,
  },
];

const targetData = {
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
};

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <AnalyticsPage />
    </QueryClientProvider>,
  );
}

describe('经营分析页面', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState({}, '', '/dashboard/rental/analytics');
    mockSources.mockResolvedValue([
      { value: 'h5', label: 'H5' },
      { value: 'miniprogram', label: '微信小程序' },
      { value: 'public', label: '公开页面' },
      { value: 'server', label: '服务端业务' },
    ]);
    mockOverview.mockResolvedValue(overviewData);
    mockTrends.mockResolvedValue(trendData);
    mockTargets.mockResolvedValue(targetData);
  });

  it('加载概览、趋势和房源排行数据', async () => {
    renderPage();

    await waitFor(() => expect(mockSources).toHaveBeenCalled());
    expect(mockOverview).toHaveBeenCalled();
    expect(mockTrends).toHaveBeenCalled();
    expect(mockTargets).toHaveBeenCalledWith(
      expect.objectContaining({ target_type: 'house', page: 1, page_size: 20 }),
    );
  });

  it('可切换趋势指标并聚焦展示单项数据', async () => {
    renderPage();

    const area = await screen.findByTestId('analytics-area');
    expect(area).toHaveAttribute('data-event-name', 'house.view');
    fireEvent.click(screen.getByText('电话咨询', { exact: true }));

    await waitFor(() =>
      expect(screen.getByTestId('analytics-area')).toHaveAttribute(
        'data-event-name',
        'house.phone_click',
      ),
    );
    expect(screen.getByText('2 次')).toBeInTheDocument();
  });

  it('从后端加载来源选项并用于筛选', async () => {
    renderPage();

    await waitFor(() => expect(mockSources).toHaveBeenCalled());
    fireEvent.mouseDown(screen.getByRole('combobox', { name: '访问来源' }));
    const miniprogramOption = await screen.findByText('微信小程序');
    expect(screen.queryByText('管理端')).not.toBeInTheDocument();
    fireEvent.click(miniprogramOption);

    await waitFor(() =>
      expect(mockOverview).toHaveBeenCalledWith(
        expect.objectContaining({ source: 'miniprogram' }),
      ),
    );
    expect(window.location.search).toContain('source=miniprogram');
  });

  it('可通过快捷日期范围刷新经营分析数据', async () => {
    renderPage();

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

  it('展示真实行为比例，且上一步为零时显示缺失值', async () => {
    mockOverview.mockResolvedValue({
      ...overviewData,
      metrics: overviewData.metrics.map((metric) => {
        if (metric.event_name === 'house.view') return { ...metric, count: 2 };
        if (metric.event_name === 'house.phone_click') {
          return { ...metric, count: 3 };
        }
        if (metric.event_name === 'house.online_consult_click') {
          return { ...metric, count: 0 };
        }
        if (metric.event_name === 'viewing.requested') {
          return { ...metric, count: 0 };
        }
        if (metric.event_name === 'lease.created') {
          return { ...metric, count: 1 };
        }
        return metric;
      }),
    });

    renderPage();

    expect(await screen.findByText('上一步 150%')).toBeInTheDocument();
    expect(screen.getByText('上一步 —')).toBeInTheDocument();
  });

  it('从 URL 恢复排行榜分页并显示跨页排名', async () => {
    window.history.replaceState(
      {},
      '',
      '/dashboard/rental/analytics?page=2&page_size=20',
    );
    mockTargets.mockResolvedValue({
      ...targetData,
      total: 21,
      page: 2,
    });

    renderPage();

    await waitFor(() =>
      expect(mockTargets).toHaveBeenCalledWith(
        expect.objectContaining({ page: 2, page_size: 20 }),
      ),
    );
    expect(await screen.findByRole('cell', { name: '21' })).toBeInTheDocument();
  });

  it('单个模块失败不影响其他数据，并可独立重试', async () => {
    mockTrends
      .mockRejectedValueOnce(new Error('trend failed'))
      .mockResolvedValueOnce(trendData);

    renderPage();

    expect(
      await screen.findByText('行为趋势加载失败，请稍后重试。'),
    ).toBeInTheDocument();
    expect(screen.getByText('业务行为路径')).toBeInTheDocument();
    expect(screen.getByTestId('building-preview-2')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '重新加载' }));

    await waitFor(() => expect(mockTrends).toHaveBeenCalledTimes(2));
    expect(await screen.findByTestId('analytics-area')).toBeInTheDocument();
  });

  it('手动刷新概览、趋势和排行，但不重复加载来源定义', async () => {
    renderPage();
    await screen.findByTestId('building-preview-2');
    mockOverview.mockClear();
    mockTrends.mockClear();
    mockTargets.mockClear();

    fireEvent.click(screen.getByRole('button', { name: /刷新数据/ }));

    await waitFor(() => {
      expect(mockOverview).toHaveBeenCalledTimes(1);
      expect(mockTrends).toHaveBeenCalledTimes(1);
      expect(mockTargets).toHaveBeenCalledTimes(1);
    });
    expect(mockSources).toHaveBeenCalledTimes(1);
  });

  it('来源定义加载失败时仍展示全部来源的分析数据', async () => {
    mockSources.mockRejectedValue(new Error('source failed'));

    renderPage();

    expect(await screen.findByText('来源加载失败')).toBeInTheDocument();
    expect(screen.getByTestId('building-preview-2')).toBeInTheDocument();
    expect(mockOverview).toHaveBeenCalledWith(
      expect.objectContaining({ source: undefined }),
    );
  });

  it('来源定义返回后清理 URL 中不存在的来源和过期页码', async () => {
    window.history.replaceState(
      {},
      '',
      '/dashboard/rental/analytics?source=unknown&page=2',
    );

    renderPage();

    await waitFor(() => {
      expect(window.location.search).not.toContain('source=unknown');
      expect(window.location.search).not.toContain('page=2');
    });
    expect(mockOverview).toHaveBeenCalledWith(
      expect.objectContaining({ source: undefined }),
    );
  });
});
