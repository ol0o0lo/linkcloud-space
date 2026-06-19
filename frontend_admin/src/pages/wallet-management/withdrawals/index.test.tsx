import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import WalletWithdrawalsPage from './index';

const {
  mockListWithdrawals,
  mockReview,
  mockPayout,
  mockRetry,
  mockReconcile,
} = vi.hoisted(() => ({
  mockListWithdrawals: vi.fn(),
  mockReview: vi.fn(),
  mockPayout: vi.fn(),
  mockRetry: vi.fn(),
  mockReconcile: vi.fn(),
}));

vi.mock('@/services/openapi/walletAdmin', () => ({
  appsWalletApiAdminWithdrawals: mockListWithdrawals,
  appsWalletApiReviewWithdrawal: mockReview,
  appsWalletApiPayoutWithdrawal: mockPayout,
}));

vi.mock('@/services/openapi/walletInternal', () => ({
  appsWalletApiRetryWithdrawal: mockRetry,
  appsWalletApiReconcile: mockReconcile,
}));

describe('WalletWithdrawalsPage', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    mockListWithdrawals.mockResolvedValue({
      items: [{ id: 5, amount: 1000, fee_amount: 50, net_amount: 950, status: 'pending', pay_channel: 'alipay', payee_account_snapshot: { account: 'a@example.com' }, reject_reason: '', created_at: '2026-06-16T10:00:00+08:00', reviewed_at: null }],
      total: 1,
      page: 1,
      page_size: 10,
    });
    mockReview.mockResolvedValue({});
    mockPayout.mockResolvedValue({});
    mockRetry.mockResolvedValue({});
    mockReconcile.mockResolvedValue({ diff_count: 0 });
  });

  it('loads withdrawals and triggers review / payout / retry / reconcile actions', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <WalletWithdrawalsPage />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(mockListWithdrawals).toHaveBeenCalledWith({ page: 1, page_size: 10 });
      expect(screen.getByText('pending')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('通过'));
    fireEvent.change(screen.getByLabelText('幂等键'), { target: { value: 'review-5' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'OK' }).at(-1)!);

    await waitFor(() => {
      expect(mockReview).toHaveBeenCalledWith({ withdrawal_id: 5 }, { approved: true, reason: '', idempotency_key: 'review-5' });
    });

    fireEvent.click(screen.getByText('代付'));
    fireEvent.change(screen.getByLabelText('渠道'), { target: { value: 'mock' } });
    fireEvent.change(screen.getByLabelText('商户单号'), { target: { value: 'payout-5' } });
    fireEvent.change(screen.getAllByLabelText('幂等键').at(-1)!, { target: { value: 'payout-5' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'OK' }).at(-1)!);

    await waitFor(() => {
      expect(mockPayout).toHaveBeenCalledWith({ withdrawal_id: 5 }, { provider: 'mock', out_trade_no: 'payout-5', idempotency_key: 'payout-5', request_payload: {} });
    });

    fireEvent.click(screen.getByText('重试代付'));
    fireEvent.change(screen.getByLabelText('渠道'), { target: { value: 'mock' } });
    fireEvent.change(screen.getByLabelText('商户单号'), { target: { value: 'retry-5' } });
    fireEvent.change(screen.getAllByLabelText('幂等键').at(-1)!, { target: { value: 'retry-5' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'OK' }).at(-1)!);

    await waitFor(() => {
      expect(mockRetry).toHaveBeenCalledWith({ withdrawal_id: 5 }, { provider: 'mock', out_trade_no: 'retry-5', idempotency_key: 'retry-5', request_payload: {} });
    });

    fireEvent.click(screen.getByRole('button', { name: '执行对账' }));

    await waitFor(() => {
      expect(mockReconcile).toHaveBeenCalled();
    });
  });
});
