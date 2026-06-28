import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
      items: [
        { id: 5, amount: 1000, fee_amount: 50, net_amount: 950, status: 'pending_review', pay_channel: 'alipay', payee_account_snapshot: { account: 'a@example.com' }, reject_reason: '', created_at: '2026-06-16T10:00:00+08:00', reviewed_at: null },
        { id: 6, amount: 1200, fee_amount: 60, net_amount: 1140, status: 'approved', pay_channel: 'wechat', payee_account_snapshot: { account: 'b@example.com' }, reject_reason: '', created_at: '2026-06-16T11:00:00+08:00', reviewed_at: '2026-06-16T11:30:00+08:00' },
        { id: 7, amount: 900, fee_amount: 30, net_amount: 870, status: 'failed', pay_channel: 'wechat', payee_account_snapshot: { account: 'c@example.com' }, reject_reason: '渠道失败', created_at: '2026-06-16T12:00:00+08:00', reviewed_at: '2026-06-16T12:30:00+08:00' },
        { id: 8, amount: 700, fee_amount: 20, net_amount: 680, status: 'rejected', pay_channel: 'wechat', payee_account_snapshot: { account: 'd@example.com' }, reject_reason: '资料不完整', created_at: '2026-06-16T13:00:00+08:00', reviewed_at: '2026-06-16T13:30:00+08:00' },
      ],
      total: 4,
      page: 1,
      page_size: 10,
    });
    mockReview.mockResolvedValue({});
    mockPayout.mockResolvedValue({});
    mockRetry.mockResolvedValue({});
    mockReconcile.mockResolvedValue({ diff_count: 2 });
  });

  it('renders governance layout and keeps review / payout / retry / reconcile actions on valid statuses', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <WalletWithdrawalsPage />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(mockListWithdrawals).toHaveBeenCalledWith({ page: 1, page_size: 10 });
      expect(screen.queryByText('提现概览')).not.toBeInTheDocument();
      expect(screen.queryByText('提现详情')).not.toBeInTheDocument();
      expect(screen.queryByText('关键提醒')).not.toBeInTheDocument();
      expect(screen.getByText('提现列表')).toBeInTheDocument();
      expect(screen.getAllByText('待审核申请').length).toBeGreaterThan(0);
      expect(screen.getAllByText('待打款申请').length).toBeGreaterThan(0);
      expect(screen.getAllByText('失败待重试').length).toBeGreaterThan(0);
      expect(screen.queryByText('打款中申请')).not.toBeInTheDocument();
      expect(screen.queryByText('查看钱包账户')).not.toBeInTheDocument();
      expect(screen.queryByText('推进代付')).not.toBeInTheDocument();
      expect(screen.queryByText('核对冻结资金')).not.toBeInTheDocument();
      expect(screen.queryByText('核查余额回流')).not.toBeInTheDocument();
      expect(screen.getByText('待审核')).toBeInTheDocument();
    });

    const pendingRow = screen.getByText('5').closest('tr');
    expect(pendingRow).not.toBeNull();
    fireEvent.click(within(pendingRow!).getByText('通过'));
    fireEvent.change(screen.getByLabelText('幂等键'), { target: { value: 'review-5' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'OK' }).at(-1)!);

    await waitFor(() => {
      expect(mockReview).toHaveBeenCalledWith({ withdrawal_id: 5 }, { approved: true, reason: '', idempotency_key: 'review-5' });
    });

    const approvedRow = screen.getByText('6').closest('tr');
    expect(approvedRow).not.toBeNull();
    fireEvent.click(within(approvedRow!).getAllByText('发起代付').at(-1)!);
    fireEvent.change(screen.getByLabelText('渠道'), { target: { value: 'mock' } });
    fireEvent.change(screen.getByLabelText('商户单号'), { target: { value: 'payout-6' } });
    fireEvent.change(screen.getAllByLabelText('幂等键').at(-1)!, { target: { value: 'payout-6' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'OK' }).at(-1)!);

    await waitFor(() => {
      expect(mockPayout).toHaveBeenCalledWith({ withdrawal_id: 6 }, { provider: 'mock', out_trade_no: 'payout-6', idempotency_key: 'payout-6', request_payload: {} });
    });

    const failedRow = screen.getByText('7').closest('tr');
    expect(failedRow).not.toBeNull();
    fireEvent.click(within(failedRow!).getAllByText('重试代付').at(-1)!);
    fireEvent.change(screen.getByLabelText('渠道'), { target: { value: 'mock' } });
    fireEvent.change(screen.getByLabelText('商户单号'), { target: { value: 'retry-7' } });
    fireEvent.change(screen.getAllByLabelText('幂等键').at(-1)!, { target: { value: 'retry-7' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'OK' }).at(-1)!);

    await waitFor(() => {
      expect(mockRetry).toHaveBeenCalledWith({ withdrawal_id: 7 }, { provider: 'mock', out_trade_no: 'retry-7', idempotency_key: 'retry-7', request_payload: {} });
    });

    fireEvent.click(screen.getByRole('button', { name: '执行对账' }));

    await waitFor(() => {
      expect(mockReconcile).toHaveBeenCalled();
      expect(screen.getByText('本次对账发现 2 条差异，请优先核查失败代付和状态滞留申请。')).toBeInTheDocument();
    });
  });
});
