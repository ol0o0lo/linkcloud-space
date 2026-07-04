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

vi.mock('@ant-design/pro-components', () => ({
  PageContainer: ({ children, title, subTitle }: any) => (
    <section>
      <h1>{title}</h1>
      <p>{subTitle}</p>
      {children}
    </section>
  ),
  ProTable: ({ actionRef, columns, headerTitle, pagination, request, toolBarRender }: any) => {
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
                    {column.render ? column.render(record[column.dataIndex], record, rowIndex) : record[column.dataIndex]}
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
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    mockListAccounts.mockResolvedValue({
      items: [
        { id: 1, user_id: 7, username: 'alice', email: 'alice@example.com', phone_label: '+8613800138000', real_name_label: '张*', available_balance: 1200, frozen_balance: 100, total_income: 3000, total_withdrawn: 800 },
        { id: 2, user_id: 8, available_balance: 0, frozen_balance: 0, total_income: 0, total_withdrawn: 0 },
        { id: 3, user_id: 9, available_balance: 0, frozen_balance: 900, total_income: 1800, total_withdrawn: 900 },
        { id: 4, user_id: 10, available_balance: 1600, frozen_balance: 0, total_income: 2000, total_withdrawn: 300 },
      ],
      total: 4,
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

  it('renders wallet governance overview and preserves ledger / adjustment actions', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <WalletAccountsPage />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(mockListAccounts).toHaveBeenCalledWith({ page: 1, page_size: 10 });
      expect(screen.getByText('张*')).toBeInTheDocument();
      expect(screen.getByText('+8613800138000')).toBeInTheDocument();
      expect(screen.queryByText('账户概览')).not.toBeInTheDocument();
      expect(screen.queryByText('账户详情')).not.toBeInTheDocument();
      expect(screen.queryByText('关键提醒')).not.toBeInTheDocument();
      expect(screen.getByText('账户列表')).toBeInTheDocument();
      expect(screen.getByText('部分资金冻结')).toBeInTheDocument();
      expect(screen.queryByText('冻结与可用并存')).not.toBeInTheDocument();
      expect(screen.queryByText('待激活账户')).not.toBeInTheDocument();
      expect(screen.queryByText('余额沉淀账户')).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByText('查看流水')[0]!);

    await waitFor(() => {
      expect(mockLedger).toHaveBeenCalledWith({ user_id: 7, page: 1, page_size: 10 });
      expect(screen.getByText('补贴')).toBeInTheDocument();
      expect(screen.getByText('账户资金概览')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: '创建调账' }));
    expect(screen.queryByText('调账用于收口异常、补贴或扣减，不建议替代正常的提现、返款或对账流程。')).not.toBeInTheDocument();
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
