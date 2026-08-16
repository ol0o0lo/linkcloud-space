import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SubscriptionPage from './index';

const { mockCurrent, mockPlans, mockOrders, mockGetOrder, mockCreateOrder } = vi.hoisted(() => ({
  mockCurrent: vi.fn(),
  mockPlans: vi.fn(),
  mockOrders: vi.fn(),
  mockGetOrder: vi.fn(),
  mockCreateOrder: vi.fn(),
}));

vi.mock('../shared', () => ({
  TenantSelectionGuard: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useTenantWorkspace: () => ({ selectedOrgSlug: 'acme', queryClient: { invalidateQueries: vi.fn() } }),
}));

vi.mock('@/services/openapi/subscriptions', () => ({
  appsSubscriptionsApiCurrentSubscription: mockCurrent,
  appsSubscriptionsApiListPlans: mockPlans,
  appsSubscriptionsApiListOrders: mockOrders,
  appsSubscriptionsApiGetOrder: mockGetOrder,
  appsSubscriptionsApiCreateOrder: mockCreateOrder,
}));

describe('SubscriptionPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCurrent.mockResolvedValue({
      plan: { code: 'free', name: '免费版' },
      entitlement: { member_limit: 3, team_limit: 1, house_limit: 50, ends_at: null },
      usage: { member: 2, team: 1, house: 4 },
      subscription: null,
    });
    mockPlans.mockResolvedValue([
      { code: 'free', name: '免费版', description: '免费使用', display_order: 10, is_active: true, prices: [], entitlement: { member_limit: 3, team_limit: 1, house_limit: 50 } },
      { code: 'professional', name: '专业版', description: '适合团队', display_order: 30, is_active: true, prices: [{ billing_cycle: 'month', amount: 29900 }], entitlement: { member_limit: 30, team_limit: 10, house_limit: 3000 } },
    ]);
    mockOrders.mockResolvedValue({ items: [] });
    mockGetOrder.mockResolvedValue({ order_no: 'S001', status: 'pending_payment' });
    mockCreateOrder.mockResolvedValue({ order_no: 'S001', status: 'pending_payment', payable_amount: 29900, payment: { checkout: { code_url: 'weixin://wxpay/bizpayurl?pr=test' } } });
  });

  it('shows entitlement usage and opens a native payment QR code after purchase', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <SubscriptionPage />
      </QueryClientProvider>,
    );

    expect(await screen.findByText('2 / 3')).toBeInTheDocument();
    expect(screen.getByText('当前套餐：免费版')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /开通 专业版（月付）/ }));

    await waitFor(() => {
      expect(mockCreateOrder).toHaveBeenCalledWith({ target_plan_code: 'professional', billing_cycle: 'month', payment_mode: 'native' });
    });
    expect(await screen.findByAltText('微信支付二维码')).toBeInTheDocument();
  });
});
