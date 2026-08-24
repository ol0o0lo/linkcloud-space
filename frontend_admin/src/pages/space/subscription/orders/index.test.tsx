import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SubscriptionOrdersPage from './index';

const { mockPlans, mockOrders, mockHistoryPush } = vi.hoisted(() => ({
  mockPlans: vi.fn(),
  mockOrders: vi.fn(),
  mockHistoryPush: vi.fn(),
}));

vi.mock('@umijs/max', () => ({
  history: { push: mockHistoryPush },
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
  appsSubscriptionsApiListPlans: mockPlans,
  appsSubscriptionsApiListOrders: mockOrders,
}));

describe('SubscriptionOrdersPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

    expect(await screen.findByText('套餐购买记录')).toBeInTheDocument();
    expect(screen.getAllByText('专业版')).not.toHaveLength(0);
    expect(screen.getAllByText('首次购买')).not.toHaveLength(0);
    expect(screen.getAllByText('付款成功')).not.toHaveLength(0);
    expect(
      screen.getByText('仅展示当前空间付款成功的购买、续费与升级订单。'),
    ).toBeInTheDocument();
    expect(screen.getAllByText('¥299.00')).not.toHaveLength(0);
    expect(mockOrders).toHaveBeenCalledWith({ page: 1, page_size: 10 });

    fireEvent.click(screen.getAllByTitle('2')[0]);

    await waitFor(() => {
      expect(mockOrders).toHaveBeenCalledWith({ page: 2, page_size: 10 });
    });
  });
});
