import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import WalletAccountsPage from './index';

const { mockListAccounts, mockLedger, mockAdjust } = vi.hoisted(() => ({
  mockListAccounts: vi.fn(),
  mockLedger: vi.fn(),
  mockAdjust: vi.fn(),
}));

function requiredElement<T>(value: T | null | undefined): T {
  if (!value) throw new Error('缺少预期的测试元素');
  return value;
}

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

vi.mock('@/services/openapi/walletAdmin', () => ({
  appsWalletApiListWalletAccounts: mockListAccounts,
  appsWalletApiAdminWalletLedger: mockLedger,
  appsWalletApiCreateAdjustment: mockAdjust,
}));

describe('WalletAccountsPage', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState({}, '', '/wallet-management/accounts');
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    mockListAccounts.mockResolvedValue({
      items: [
        {
          id: 1,
          user_id: 7,
          username: 'alice',
          email: 'alice@example.com',
          phone_label: '+8613800138000',
          real_name_label: '张*',
          available_balance: 1200,
          frozen_balance: 100,
          total_income: 3000,
          total_withdrawn: 800,
        },
        {
          id: 2,
          user_id: 8,
          available_balance: 0,
          frozen_balance: 0,
          total_income: 0,
          total_withdrawn: 0,
        },
        {
          id: 3,
          user_id: 9,
          available_balance: 0,
          frozen_balance: 900,
          total_income: 1800,
          total_withdrawn: 900,
        },
        {
          id: 4,
          user_id: 10,
          available_balance: 1600,
          frozen_balance: 0,
          total_income: 2000,
          total_withdrawn: 300,
        },
      ],
      total: 4,
      page: 1,
      page_size: 10,
    });
    mockLedger.mockResolvedValue({
      items: [
        {
          id: 9,
          entry_type: 'adjustment',
          amount_delta: 500,
          available_balance_after: 1700,
          frozen_balance_after: 100,
          biz_type: 'manual',
          biz_id: 'adj-1',
          remark: '补贴',
          created_at: '2026-06-16T10:00:00+08:00',
        },
      ],
      total: 1,
      page: 1,
      page_size: 10,
    });
    mockAdjust.mockResolvedValue({});
  });

  it('loads ledger entries and submits an adjustment', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <WalletAccountsPage />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(mockListAccounts).toHaveBeenCalledWith({ page: 1, page_size: 10 });
      expect(screen.getByText('张*')).toBeInTheDocument();
    });

    fireEvent.click(
      requiredElement(
        screen.getAllByRole('button', { name: '查看流水' }).at(0),
      ),
    );

    await waitFor(() => {
      expect(mockLedger).toHaveBeenCalledWith({
        user_id: 7,
        page: 1,
        page_size: 10,
      });
    });

    fireEvent.click(
      requiredElement(
        screen.getAllByRole('button', { name: '创建调账' }).at(0),
      ),
    );
    fireEvent.change(screen.getByLabelText('用户 ID'), {
      target: { value: '7' },
    });
    fireEvent.change(screen.getByLabelText('金额'), {
      target: { value: '500' },
    });
    fireEvent.change(screen.getByLabelText('幂等键'), {
      target: { value: 'adj-1' },
    });
    fireEvent.change(screen.getByLabelText('备注'), {
      target: { value: '补贴' },
    });
    fireEvent.click(
      requiredElement(screen.getAllByRole('button', { name: 'OK' }).at(-1)),
    );

    await waitFor(() => {
      expect(mockAdjust).toHaveBeenCalledWith({
        user_id: 7,
        amount: 500,
        idempotency_key: 'adj-1',
        remark: '补贴',
      });
    });
    expect(await screen.findByText('调账已创建')).toBeInTheDocument();
  });

  it('restores account filters from the URL', async () => {
    window.history.replaceState(
      {},
      '',
      '/wallet-management/accounts?page=2&keyword=alice&created_from=2026-08-01&created_to=2026-08-31',
    );

    render(
      <QueryClientProvider client={queryClient}>
        <WalletAccountsPage />
      </QueryClientProvider>,
    );

    await waitFor(() =>
      expect(mockListAccounts).toHaveBeenCalledWith(
        expect.objectContaining({
          page: 2,
          page_size: 10,
          keyword: 'alice',
          created_from: expect.stringContaining('2026-08-01'),
          created_to: expect.stringContaining('2026-09-01'),
        }),
      ),
    );
  });

  it('distinguishes account load failures and supports retry', async () => {
    mockListAccounts
      .mockRejectedValueOnce(new Error('network unavailable'))
      .mockResolvedValueOnce({ items: [], total: 0 });

    render(
      <QueryClientProvider client={queryClient}>
        <WalletAccountsPage />
      </QueryClientProvider>,
    );

    expect(await screen.findByText('钱包账户加载失败')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '重新加载账户' }));
    await waitFor(() => expect(mockListAccounts).toHaveBeenCalledTimes(2));
  });
});
