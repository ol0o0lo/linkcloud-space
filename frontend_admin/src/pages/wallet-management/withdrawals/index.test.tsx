import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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

vi.mock('@ant-design/pro-components', () => ({
  PageContainer: ({ children, title, subTitle }: any) => (
    <section>
      <h1>{title}</h1>
      <p>{subTitle}</p>
      {children}
    </section>
  ),
  ProTable: ({
    actionRef,
    columns,
    headerTitle,
    pagination,
    request,
    toolBarRender,
  }: any) => {
    const [data, setData] = React.useState<any[]>([]);
    const pageSize = pagination?.defaultPageSize || 10;

    const load = async () => {
      const result = await request?.({ current: 1, pageSize });
      setData(result?.data || []);
    };

    React.useEffect(() => {
      if (actionRef) {
        actionRef.current = { reload: () => void load() };
      }
      void load();
    }, []);

    return (
      <div>
        <h2>{headerTitle}</h2>
        {toolBarRender ? <div>{toolBarRender()}</div> : null}
        <table>
          <tbody>
            {data.map((record, rowIndex) => (
              <tr key={record.id}>
                {columns.map((column: any) => (
                  <td key={column.dataIndex}>
                    {column.render
                      ? column.render(
                          record[column.dataIndex],
                          record,
                          rowIndex,
                        )
                      : record[column.dataIndex]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  },
}));

import WalletWithdrawalsPage from './index';

describe('WalletWithdrawalsPage', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    mockListWithdrawals.mockResolvedValue({
      items: [
        {
          id: 5,
          amount: 1000,
          fee_amount: 50,
          net_amount: 950,
          status: 'pending_review',
          status__mapping: '待审核',
          pay_channel: 'alipay',
          payee_account_snapshot: { account: 'a@example.com' },
          reject_reason: '',
          created_at: '2026-06-16T10:00:00+08:00',
          reviewed_at: null,
        },
        {
          id: 6,
          amount: 1200,
          fee_amount: 60,
          net_amount: 1140,
          status: 'approved',
          status__mapping: '已通过',
          pay_channel: 'wechat',
          payee_account_snapshot: { account: 'b@example.com' },
          reject_reason: '',
          created_at: '2026-06-16T11:00:00+08:00',
          reviewed_at: '2026-06-16T11:30:00+08:00',
        },
        {
          id: 7,
          amount: 900,
          fee_amount: 30,
          net_amount: 870,
          status: 'failed',
          status__mapping: '失败待重试',
          pay_channel: 'wechat',
          payee_account_snapshot: { account: 'c@example.com' },
          reject_reason: '渠道失败',
          created_at: '2026-06-16T12:00:00+08:00',
          reviewed_at: '2026-06-16T12:30:00+08:00',
        },
        {
          id: 8,
          amount: 700,
          fee_amount: 20,
          net_amount: 680,
          status: 'rejected',
          status__mapping: '已驳回',
          pay_channel: 'wechat',
          payee_account_snapshot: { account: 'd@example.com' },
          reject_reason: '资料不完整',
          created_at: '2026-06-16T13:00:00+08:00',
          reviewed_at: '2026-06-16T13:30:00+08:00',
        },
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

  it('reviews, pays, retries, and reconciles withdrawals', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <WalletWithdrawalsPage />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(mockListWithdrawals).toHaveBeenCalledWith({
        page: 1,
        page_size: 10,
      });
    });

    const pendingRow = screen.getByText('5').closest('tr');
    expect(pendingRow).not.toBeNull();
    fireEvent.click(within(pendingRow!).getByText('通过'));
    fireEvent.change(screen.getByLabelText('幂等键'), {
      target: { value: 'review-5' },
    });
    fireEvent.click(screen.getAllByRole('button', { name: 'OK' }).at(-1)!);

    await waitFor(() => {
      expect(mockReview).toHaveBeenCalledWith(
        { withdrawal_id: 5 },
        { approved: true, reason: '', idempotency_key: 'review-5' },
      );
    });

    const approvedRow = screen.getByText('6').closest('tr');
    expect(approvedRow).not.toBeNull();
    fireEvent.click(within(approvedRow!).getAllByText('发起代付').at(-1)!);
    fireEvent.change(screen.getByLabelText('渠道'), {
      target: { value: 'mock' },
    });
    fireEvent.change(screen.getByLabelText('商户单号'), {
      target: { value: 'payout-6' },
    });
    fireEvent.change(screen.getAllByLabelText('幂等键').at(-1)!, {
      target: { value: 'payout-6' },
    });
    fireEvent.click(screen.getAllByRole('button', { name: 'OK' }).at(-1)!);

    await waitFor(() => {
      expect(mockPayout).toHaveBeenCalledWith(
        { withdrawal_id: 6 },
        {
          provider: 'mock',
          out_trade_no: 'payout-6',
          idempotency_key: 'payout-6',
          request_payload: {},
        },
      );
    });

    const failedRow = screen.getByText('7').closest('tr');
    expect(failedRow).not.toBeNull();
    fireEvent.click(within(failedRow!).getAllByText('重试代付').at(-1)!);
    fireEvent.change(screen.getByLabelText('渠道'), {
      target: { value: 'mock' },
    });
    fireEvent.change(screen.getByLabelText('商户单号'), {
      target: { value: 'retry-7' },
    });
    fireEvent.change(screen.getAllByLabelText('幂等键').at(-1)!, {
      target: { value: 'retry-7' },
    });
    fireEvent.click(screen.getAllByRole('button', { name: 'OK' }).at(-1)!);

    await waitFor(() => {
      expect(mockRetry).toHaveBeenCalledWith(
        { withdrawal_id: 7 },
        {
          provider: 'mock',
          out_trade_no: 'retry-7',
          idempotency_key: 'retry-7',
          request_payload: {},
        },
      );
    });

    fireEvent.click(screen.getByRole('button', { name: '执行对账' }));

    await waitFor(() => {
      expect(mockReconcile).toHaveBeenCalled();
    });
  });
});
