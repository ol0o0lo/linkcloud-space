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

function requiredElement<T>(value: T | null | undefined): T {
  if (!value) throw new Error('缺少预期的测试元素');
  return value;
}

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
    params,
    request,
    toolBarRender,
  }: any) => {
    const [data, setData] = React.useState<any[]>([]);
    const pageSize = pagination?.pageSize || pagination?.defaultPageSize || 10;

    const load = async () => {
      try {
        const result = await request?.({
          current: pagination?.current || 1,
          pageSize,
          ...params,
        });
        setData(result?.data || []);
      } catch {
        setData([]);
      }
    };

    React.useEffect(() => {
      if (actionRef) {
        actionRef.current = { reload: () => void load() };
      }
      void load();
    }, [pagination?.current, pageSize, JSON.stringify(params)]);

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
    window.history.replaceState({}, '', '/wallet-management/withdrawals');
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

    const pendingRow = requiredElement(screen.getByText('5').closest('tr'));
    fireEvent.click(within(pendingRow).getByText('通过'));
    fireEvent.change(screen.getByLabelText('幂等键'), {
      target: { value: 'review-5' },
    });
    fireEvent.click(
      requiredElement(screen.getAllByRole('button', { name: 'OK' }).at(-1)),
    );

    await waitFor(() => {
      expect(mockReview).toHaveBeenCalledWith(
        { withdrawal_id: 5 },
        { approved: true, reason: '', idempotency_key: 'review-5' },
      );
    });
    expect(await screen.findByText('提现审核已通过')).toBeInTheDocument();

    const approvedRow = requiredElement(screen.getByText('6').closest('tr'));
    fireEvent.click(
      within(approvedRow).getByRole('button', { name: '发起打款' }),
    );
    fireEvent.change(screen.getByLabelText('渠道'), {
      target: { value: 'mock' },
    });
    fireEvent.change(screen.getByLabelText('商户单号'), {
      target: { value: 'payout-6' },
    });
    fireEvent.change(
      requiredElement(screen.getAllByLabelText('幂等键').at(-1)),
      {
        target: { value: 'payout-6' },
      },
    );
    fireEvent.click(
      requiredElement(screen.getAllByRole('button', { name: 'OK' }).at(-1)),
    );

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
    expect(await screen.findByText('打款请求已提交')).toBeInTheDocument();

    const failedRow = requiredElement(screen.getByText('7').closest('tr'));
    fireEvent.click(
      requiredElement(within(failedRow).getAllByText('重试打款').at(-1)),
    );
    fireEvent.change(screen.getByLabelText('渠道'), {
      target: { value: 'mock' },
    });
    fireEvent.change(screen.getByLabelText('商户单号'), {
      target: { value: 'retry-7' },
    });
    fireEvent.change(
      requiredElement(screen.getAllByLabelText('幂等键').at(-1)),
      {
        target: { value: 'retry-7' },
      },
    );
    fireEvent.click(
      requiredElement(screen.getAllByRole('button', { name: 'OK' }).at(-1)),
    );

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
    expect(await screen.findByText('打款重试已提交')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '执行对账' }));

    await waitFor(() => {
      expect(mockReconcile).toHaveBeenCalled();
    });
    expect(
      await screen.findByText(/本次对账发现 2 条差异/),
    ).toBeInTheDocument();
  });

  it('restores withdrawal filters from the URL', async () => {
    window.history.replaceState(
      {},
      '',
      '/wallet-management/withdrawals?page=2&keyword=alice&status=pending_review&created_from=2026-08-01&created_to=2026-08-31',
    );

    render(
      <QueryClientProvider client={queryClient}>
        <WalletWithdrawalsPage />
      </QueryClientProvider>,
    );

    await waitFor(() =>
      expect(mockListWithdrawals).toHaveBeenCalledWith(
        expect.objectContaining({
          page: 2,
          page_size: 10,
          keyword: 'alice',
          status: 'pending_review',
          created_from: expect.stringContaining('2026-08-01'),
          created_to: expect.stringContaining('2026-09-01'),
        }),
      ),
    );
  });

  it('distinguishes withdrawal load failures and supports retry', async () => {
    mockListWithdrawals
      .mockRejectedValueOnce(new Error('network unavailable'))
      .mockResolvedValueOnce({ items: [], total: 0 });

    render(
      <QueryClientProvider client={queryClient}>
        <WalletWithdrawalsPage />
      </QueryClientProvider>,
    );

    expect(await screen.findByText('提现记录加载失败')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '重新加载提现记录' }));
    await waitFor(() => expect(mockListWithdrawals).toHaveBeenCalledTimes(2));
  });

  it('keeps the payout modal open and explains payout failures', async () => {
    mockPayout.mockRejectedValue(new Error('provider unavailable'));

    render(
      <QueryClientProvider client={queryClient}>
        <WalletWithdrawalsPage />
      </QueryClientProvider>,
    );

    const approvedRow = requiredElement(
      (await screen.findByText('6')).closest('tr'),
    );
    fireEvent.click(
      within(approvedRow).getByRole('button', { name: '发起打款' }),
    );
    fireEvent.change(screen.getByLabelText('渠道'), {
      target: { value: 'mock' },
    });
    fireEvent.change(screen.getByLabelText('商户单号'), {
      target: { value: 'payout-error-6' },
    });
    fireEvent.change(
      requiredElement(screen.getAllByLabelText('幂等键').at(-1)),
      { target: { value: 'payout-error-6' } },
    );
    fireEvent.click(
      requiredElement(screen.getAllByRole('button', { name: 'OK' }).at(-1)),
    );

    expect(
      await screen.findByText('打款请求失败，请核对信息后重试'),
    ).toBeInTheDocument();
    expect(screen.getAllByText('发起打款')).not.toHaveLength(0);
  });
});
