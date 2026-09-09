import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SubscriptionOrdersPage from './index';

const {
  mockPlans,
  mockOrders,
  mockHistoryPush,
  mockGetInvoiceProfile,
  mockListInvoiceRequests,
  mockCheckoutOrder,
  mockRefreshOrder,
  mockCancelOrder,
  mockAccess,
} = vi.hoisted(() => ({
  mockPlans: vi.fn(),
  mockOrders: vi.fn(),
  mockHistoryPush: vi.fn(),
  mockGetInvoiceProfile: vi.fn(),
  mockListInvoiceRequests: vi.fn(),
  mockCheckoutOrder: vi.fn(),
  mockRefreshOrder: vi.fn(),
  mockCancelOrder: vi.fn(),
  mockAccess: { canManageSubscriptions: true },
}));

vi.mock('@umijs/max', () => ({
  history: { push: mockHistoryPush },
  useAccess: () => mockAccess,
}));

vi.mock('../../shared', () => ({
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
  useTenantWorkspace: () => ({ selectedOrgSlug: 'acme' }),
}));

vi.mock('@/services/openapi/subscriptions', () => ({
  appsSubscriptionsApiCreateInvoiceRequest: vi.fn(),
  appsSubscriptionsApiGetInvoiceProfile: mockGetInvoiceProfile,
  appsSubscriptionsApiListInvoiceRequests: mockListInvoiceRequests,
  appsSubscriptionsApiListPlans: mockPlans,
  appsSubscriptionsApiListOrders: mockOrders,
  appsSubscriptionsApiCheckoutOrder: mockCheckoutOrder,
  appsSubscriptionsApiRefreshOrderPayment: mockRefreshOrder,
  appsSubscriptionsApiPutInvoiceProfile: vi.fn(),
}));

vi.mock('@/services/manual/subscriptions', () => ({
  cancelSubscriptionOrder: mockCancelOrder,
}));

describe('SubscriptionOrdersPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAccess.canManageSubscriptions = true;
    mockPlans.mockResolvedValue([
      {
        code: 'professional',
        name: '专业版',
        display_order: 30,
        is_active: true,
        prices: [],
        entitlement: {},
      },
    ]);
    mockGetInvoiceProfile.mockResolvedValue(null);
    mockListInvoiceRequests.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      page_size: 500,
    });
    mockCheckoutOrder.mockResolvedValue({});
    mockRefreshOrder.mockResolvedValue({});
    mockCancelOrder.mockResolvedValue({});
    mockOrders.mockImplementation(({ page }: { page: number }) =>
      Promise.resolve({
        items: [
          {
            id: page,
            order_no: `S000${page}`,
            order_type: 'initial_purchase',
            status: 'paid',
            close_reason: '',
            target_plan_code: 'professional',
            billing_cycle: 'month',
            list_amount: 29900,
            credit_amount: 0,
            payable_amount: 29900,
            expires_at: '2026-08-16T15:00:00+08:00',
            paid_at: '2026-08-16T14:01:00+08:00',
            refund_status: 'none',
            refunded_amount: 0,
            created_at: '2026-08-16T14:00:00+08:00',
            payment: null,
          },
        ],
        total: 21,
        page,
        page_size: 10,
      }),
    );
  });

  it('展示套餐名称、支付状态并使用服务端分页', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <SubscriptionOrdersPage />
      </QueryClientProvider>,
    );

    expect(await screen.findByText('套餐订单中心')).toBeInTheDocument();
    expect(screen.getAllByText('专业版')).not.toHaveLength(0);
    expect(screen.getAllByText('首次购买')).not.toHaveLength(0);
    expect(screen.getAllByText('已支付')).not.toHaveLength(0);
    expect(
      screen.getByText('查看全部购买状态，继续未完成支付，并管理开票申请。'),
    ).toBeInTheDocument();
    expect(screen.getAllByText('¥299.00')).not.toHaveLength(0);
    expect(mockOrders).toHaveBeenCalledWith({ page: 1, page_size: 10 });

    fireEvent.click(screen.getAllByTitle('2')[0]);

    await waitFor(() => {
      expect(mockOrders).toHaveBeenCalledWith({ page: 2, page_size: 10 });
    });
  });

  it('可继续待支付订单、主动查单并取消订单', async () => {
    const pendingOrder = {
      id: 8,
      order_no: 'S0008',
      order_type: 'renewal',
      status: 'pending_payment',
      close_reason: '',
      target_plan_code: 'professional',
      billing_cycle: 'month',
      list_amount: 29900,
      credit_amount: 0,
      payable_amount: 29900,
      expires_at: '2026-09-06T11:30:00+08:00',
      paid_at: null,
      refund_status: 'none',
      refunded_amount: 0,
      created_at: '2026-09-06T11:00:00+08:00',
      payment: {
        status: 'pending',
        transaction_no: 'P0008',
        expires_at: '2026-09-06T11:30:00+08:00',
      },
    };
    mockOrders.mockResolvedValueOnce({
      items: [pendingOrder],
      total: 1,
      page: 1,
      page_size: 10,
    });
    mockCheckoutOrder.mockResolvedValue({
      ...pendingOrder,
      payment: {
        ...pendingOrder.payment,
        checkout: { code_url: 'weixin://wxpay/bizpayurl?pr=continued' },
      },
    });
    mockRefreshOrder.mockResolvedValue({ ...pendingOrder, status: 'paid' });
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <SubscriptionOrdersPage />
      </QueryClientProvider>,
    );

    fireEvent.click((await screen.findAllByText('继续支付'))[0]);
    await waitFor(() => {
      expect(mockCheckoutOrder).toHaveBeenCalledWith({ order_no: 'S0008' });
    });
    expect(await screen.findByAltText('微信支付二维码')).toHaveAttribute(
      'src',
      expect.stringContaining('weixin%3A%2F%2Fwxpay'),
    );
    expect(screen.getByText(/二维码有效期至/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /我已支付，刷新状态/ }));
    await waitFor(() => {
      expect(mockRefreshOrder).toHaveBeenCalledWith({ order_no: 'S0008' });
    });
  });

  it('仅查看权限可看订单和发票进度但不显示资金操作', async () => {
    mockAccess.canManageSubscriptions = false;
    mockOrders.mockResolvedValueOnce({
      items: [
        {
          id: 9,
          order_no: 'S0009',
          order_type: 'renewal',
          status: 'pending_payment',
          close_reason: '',
          target_plan_code: 'professional',
          billing_cycle: 'month',
          list_amount: 29900,
          credit_amount: 0,
          payable_amount: 29900,
          expires_at: '2026-09-06T11:30:00+08:00',
          paid_at: null,
          refund_status: 'none',
          refunded_amount: 0,
          created_at: '2026-09-06T11:00:00+08:00',
          payment: { status: 'pending', transaction_no: 'P0009' },
        },
      ],
      total: 1,
      page: 1,
      page_size: 10,
    });
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <SubscriptionOrdersPage />
      </QueryClientProvider>,
    );

    expect(await screen.findAllByText('待支付')).not.toHaveLength(0);
    expect(
      screen.getByText('查看全部购买状态、支付凭据和开票进度。'),
    ).toBeInTheDocument();
    expect(
      screen.queryByText('查看全部购买状态，继续未完成支付，并管理开票申请。'),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('继续支付')).not.toBeInTheDocument();
    expect(screen.queryByText('取消订单')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: '申请开票' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /开票资料/ }),
    ).not.toBeInTheDocument();
  });
});
