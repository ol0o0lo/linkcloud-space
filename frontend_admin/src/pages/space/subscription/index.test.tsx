import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { Modal, message } from 'antd';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SubscriptionPage from './index';

const {
  mockCurrent,
  mockPlans,
  mockGetOrder,
  mockCreateOrder,
  mockCancelOrder,
} = vi.hoisted(() => ({
  mockCurrent: vi.fn(),
  mockPlans: vi.fn(),
  mockGetOrder: vi.fn(),
  mockCreateOrder: vi.fn(),
  mockCancelOrder: vi.fn(),
}));

vi.mock('../shared', () => ({
  TenantSelectionGuard: ({
    extra,
    children,
  }: {
    extra?: React.ReactNode;
    children: React.ReactNode;
  }) => (
    <>
      {extra}
      {children}
    </>
  ),
  useTenantWorkspace: () => ({
    selectedOrgSlug: 'acme',
    queryClient: { invalidateQueries: vi.fn() },
  }),
}));

vi.mock('@/services/openapi/subscriptions', () => ({
  appsSubscriptionsApiCurrentSubscription: mockCurrent,
  appsSubscriptionsApiListPlans: mockPlans,
  appsSubscriptionsApiGetOrder: mockGetOrder,
  appsSubscriptionsApiCreateOrder: mockCreateOrder,
}));

vi.mock('@/services/manual/subscriptions', () => ({
  cancelSubscriptionOrder: mockCancelOrder,
}));

describe('SubscriptionPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCurrent.mockResolvedValue({
      plan: { code: 'free', name: '免费版' },
      entitlement: {
        member_limit: 3,
        team_limit: 1,
        house_limit: 50,
        ends_at: null,
      },
      usage: { member: 2, team: 1, house: 4 },
      subscription: null,
      recommendation: {
        reason: 'usage_threshold_exceeded',
        threshold_percent: 60,
        target_plan_code: 'professional',
        target_plan_name: '专业版',
        triggered_resources: [
          { resource: 'team', current: 1, limit: 1, usage_percent: 100 },
        ],
      },
    });
    mockPlans.mockResolvedValue([
      {
        code: 'free',
        name: '免费版',
        description: '免费使用',
        display_order: 10,
        is_active: true,
        prices: [],
        entitlement: { member_limit: 3, team_limit: 1, house_limit: 50 },
      },
      {
        code: 'professional',
        name: '专业版',
        description: '适合团队',
        display_order: 30,
        is_active: true,
        prices: [{ billing_cycle: 'month', amount: 29900 }],
        entitlement: { member_limit: 30, team_limit: 10, house_limit: 3000 },
      },
    ]);
    mockGetOrder.mockResolvedValue({
      order_no: 'S001',
      status: 'pending_payment',
    });
    mockCreateOrder.mockResolvedValue({
      order_no: 'S001',
      status: 'pending_payment',
      payable_amount: 29900,
      payment: { checkout: { code_url: 'weixin://wxpay/bizpayurl?pr=test' } },
    });
    mockCancelOrder.mockResolvedValue({
      order_no: 'S001',
      status: 'closed',
      close_reason: 'user_cancelled',
    });
  });

  afterEach(() => {
    Modal.destroyAll();
  });

  it('shows entitlement usage and opens a native payment QR code after purchase', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <SubscriptionPage />
      </QueryClientProvider>,
    );

    expect(
      await screen.findByText(
        (_content, element) =>
          element?.tagName === 'DIV' &&
          element.textContent?.replace(/\s/g, '') === '2/3',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: '免费版' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /购买记录/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', {
        level: 4,
        name: '推荐升级到专业版',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('table', { name: '套餐版本权益对比' }),
    ).toBeInTheDocument();
    expect(screen.getByText('规模扩容')).toBeInTheDocument();
    expect(screen.getByText('批量提效')).toBeInTheDocument();
    expect(screen.getByText('权益自动生效')).toBeInTheDocument();
    expect(screen.queryByText('订单记录')).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: /开通 专业版（月付）/ }),
    );

    await waitFor(() => {
      expect(mockCreateOrder).toHaveBeenCalledWith({
        target_plan_code: 'professional',
        billing_cycle: 'month',
        payment_mode: 'native',
      });
    });
    expect(await screen.findByAltText('微信支付二维码')).toBeInTheDocument();
    expect(screen.getByText('专业版 · 月付')).toBeInTheDocument();
    expect(screen.getByText('¥299.00')).toBeInTheDocument();
    expect(screen.getByText('打开微信扫一扫')).toBeInTheDocument();
    expect(
      screen.getByText('支付完成后页面会自动同步，请勿重复创建订单。'),
    ).toBeInTheDocument();
  });

  it('确认取消待支付订单后关闭二维码并允许重新下单', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <SubscriptionPage />
      </QueryClientProvider>,
    );

    fireEvent.click(
      await screen.findByRole('button', { name: /开通 专业版（月付）/ }),
    );
    expect(await screen.findByAltText('微信支付二维码')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '取消订单' }));
    expect(
      (await screen.findAllByText('取消当前订单？')).length,
    ).toBeGreaterThan(0);
    const cancelButtons = screen.getAllByRole('button', { name: '取消订单' });
    fireEvent.click(cancelButtons[cancelButtons.length - 1]);

    await waitFor(() =>
      expect(mockCancelOrder.mock.calls[0]?.[0]).toBe('S001'),
    );

    fireEvent.click(
      screen.getByRole('button', { name: /开通 专业版（月付）/ }),
    );
    await waitFor(() => expect(mockCreateOrder).toHaveBeenCalledTimes(2));
  });

  it('轮询发现订单关闭时关闭失效二维码', async () => {
    const warning = vi.spyOn(message, 'warning');
    let resolveOrder: (value: Record<string, unknown>) => void = () => {};
    mockGetOrder.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveOrder = resolve;
      }),
    );
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <SubscriptionPage />
      </QueryClientProvider>,
    );

    fireEvent.click(
      await screen.findByRole('button', { name: /开通 专业版（月付）/ }),
    );
    expect(await screen.findByAltText('微信支付二维码')).toBeInTheDocument();
    await waitFor(() =>
      expect(mockGetOrder).toHaveBeenCalledWith({ order_no: 'S001' }),
    );

    await act(async () => {
      resolveOrder({ order_no: 'S001', status: 'closed' });
    });

    await waitFor(() => {
      expect(
        queryClient.getQueryData(['subscriptions', 'order', 'acme', 'S001']),
      ).toMatchObject({ status: 'closed' });
    });

    await waitFor(() => {
      expect(warning).toHaveBeenCalledWith('订单已关闭，请重新下单。');
    });
    warning.mockRestore();
  });

  it('hides upgrade recommendation when the current API does not recommend a plan', async () => {
    mockCurrent.mockResolvedValueOnce({
      plan: { code: 'free', name: '免费版' },
      entitlement: {
        member_limit: 3,
        team_limit: 1,
        house_limit: 50,
        ends_at: null,
      },
      usage: { member: 1, team: 0, house: 4 },
      subscription: null,
      recommendation: null,
    });
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <SubscriptionPage />
      </QueryClientProvider>,
    );

    expect(
      await screen.findByRole('heading', { level: 2, name: '免费版' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('升级建议')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: /推荐升级到/ }),
    ).not.toBeInTheDocument();
  });
});
