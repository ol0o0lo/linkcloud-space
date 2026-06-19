import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import WalletAccountsPage from './index';

const {
  mockListAccounts,
  mockLedger,
  mockAdjust,
} = vi.hoisted(() => ({
  mockListAccounts: vi.fn(),
  mockLedger: vi.fn(),
  mockAdjust: vi.fn(),
}));

vi.mock('@/services/openapi/walletAdmin', () => ({
  appsWalletApiListWalletAccounts: mockListAccounts,
  appsWalletApiAdminWalletLedger: mockLedger,
  appsWalletApiCreateAdjustment: mockAdjust,
}));

describe('WalletAccountsPage', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    mockListAccounts.mockResolvedValue({
      items: [{ id: 1, user_id: 7, available_balance: 1200, frozen_balance: 100, total_income: 3000, total_withdrawn: 800 }],
      total: 1,
      page: 1,
      page_size: 10,
    });
    mockLedger.mockResolvedValue({
      items: [{ id: 9, entry_type: 'adjustment', amount_delta: 500, available_balance_after: 1700, frozen_balance_after: 100, biz_type: 'manual', biz_id: 'adj-1', remark: '补贴', created_at: '2026-06-16T10:00:00+08:00' }],
      total: 1,
      page: 1,
      page_size: 10,
    });
    mockAdjust.mockResolvedValue({});
  });

  it('loads wallet accounts and triggers ledger / adjustment actions', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <WalletAccountsPage />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(mockListAccounts).toHaveBeenCalledWith({ page: 1, page_size: 10 });
      expect(screen.getByText('用户 #7')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('查看流水'));

    await waitFor(() => {
      expect(mockLedger).toHaveBeenCalledWith({ user_id: 7, page: 1, page_size: 10 });
      expect(screen.getByText('补贴')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: '创建调账' }));
    fireEvent.change(screen.getByLabelText('用户 ID'), { target: { value: '7' } });
    fireEvent.change(screen.getByLabelText('金额'), { target: { value: '500' } });
    fireEvent.change(screen.getByLabelText('幂等键'), { target: { value: 'adj-1' } });
    fireEvent.change(screen.getByLabelText('备注'), { target: { value: '补贴' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'OK' }).at(-1)!);

    await waitFor(() => {
      expect(mockAdjust).toHaveBeenCalledWith({ user_id: 7, amount: 500, idempotency_key: 'adj-1', remark: '补贴' });
    });
  });
});
