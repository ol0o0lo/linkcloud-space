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
  mockListOrders,
  mockRefundOrder,
  mockListInvoiceRequests,
  mockProcessInvoiceRequest,
} = vi.hoisted(() => ({
  mockListOrders: vi.fn(),
  mockRefundOrder: vi.fn(),
  mockListInvoiceRequests: vi.fn(),
  mockProcessInvoiceRequest: vi.fn(),
}));

vi.mock('@/services/openapi/subscriptionsAdmin', () => ({
  appsSubscriptionsApiAdminListOrders: mockListOrders,
  appsSubscriptionsApiAdminRefundOrder: mockRefundOrder,
  appsSubscriptionsApiAdminListInvoiceRequests: mockListInvoiceRequests,
  appsSubscriptionsApiAdminProcessInvoiceRequest: mockProcessInvoiceRequest,
}));

vi.mock('@ant-design/pro-components', () => ({
  PageContainer: ({ children, title }: any) => (
    <section>
      <h1>{title}</h1>
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
      <section>
        <h2>{headerTitle}</h2>
        <table>
          <tbody>
            {data.map((record, rowIndex) => (
              <tr key={record.id}>
                {columns.map((column: any) => (
                  <td key={String(column.key || column.dataIndex)}>
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
      </section>
    );
  },
}));

import SubscriptionsAdminPage from './index';

function requireElement<T extends Element>(
  value: T | null,
  message: string,
): T {
  if (!value) throw new Error(message);
  return value;
}

describe('SubscriptionsAdminPage', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState({}, '', '/platform-management/subscriptions');
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    mockListOrders.mockResolvedValue({
      items: [
        {
          id: 11,
          organization_id: 7,
          organization_name: '链云测试空间',
          organization_slug: 'linkcloud-test-space',
          order_no: 'LC202608300001',
          target_plan_code: 'professional',
          target_plan_name: '专业版',
          billing_cycle: 'month',
          payable_amount: 29900,
          status: 'paid',
          refund_status: 'none',
          refunded_amount: 0,
          created_at: '2026-08-30T09:00:00+08:00',
        },
        {
          id: 12,
          organization_id: 7,
          organization_name: '链云测试空间',
          organization_slug: 'linkcloud-test-space',
          order_no: 'LC202608300002',
          target_plan_code: 'professional',
          target_plan_name: '专业版',
          billing_cycle: 'month',
          payable_amount: 29900,
          status: 'closed',
          close_reason: 'user_cancelled',
          refund_status: 'none',
          refunded_amount: 0,
          payment: {
            status: 'exception',
            transaction_no: 'P202608300002',
            provider_trade_no: 'WX-LATE-001',
          },
          created_at: '2026-08-30T09:30:00+08:00',
        },
      ],
      total: 2,
      page: 1,
      page_size: 10,
    });
    mockListInvoiceRequests.mockResolvedValue({
      items: [
        {
          id: 21,
          organization_id: 7,
          organization_name: '链云测试空间',
          organization_slug: 'linkcloud-test-space',
          order_id: 11,
          order_no: 'LC202608300001',
          target_plan_code: 'professional',
          target_plan_name: '专业版',
          status: 'pending',
          profile_snapshot: { title: '链云测试科技有限公司' },
          invoice_number: '',
          file_url: '',
          admin_note: '',
          issued_at: null,
          created_at: '2026-08-30T10:00:00+08:00',
        },
      ],
      total: 1,
      page: 1,
      page_size: 10,
    });
    mockRefundOrder.mockResolvedValue({});
    mockProcessInvoiceRequest.mockResolvedValue({});
  });

  function renderPage() {
    render(
      <QueryClientProvider client={queryClient}>
        <SubscriptionsAdminPage />
      </QueryClientProvider>,
    );
  }

  it('submits a refund and refreshes the order table', async () => {
    renderPage();

    const orderSection = requireElement(
      (await screen.findByRole('heading', { name: '订阅订单' })).closest(
        'section',
      ),
      'Expected order section to render',
    );
    const orderRow = within(orderSection).getByText('LC202608300001');
    fireEvent.click(
      within(
        requireElement(orderRow.closest('tr'), 'Expected order row to render'),
      ).getByRole('button', { name: '登记退款' }),
    );
    fireEvent.change(screen.getByLabelText('退款金额（分）'), {
      target: { value: '9900' },
    });
    fireEvent.change(screen.getByLabelText('退款原因'), {
      target: { value: '客户协商退款' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));

    await waitFor(() => {
      expect(mockRefundOrder).toHaveBeenCalledWith(
        { order_id: 11 },
        {
          amount: 9900,
          reason: '客户协商退款',
          proof: '',
          subscription_action: 'keep',
        },
      );
      expect(mockListOrders).toHaveBeenCalledTimes(2);
    });
    expect(await screen.findByText('退款登记成功')).toBeInTheDocument();
  });

  it('processes an invoice request and refreshes the invoice table', async () => {
    renderPage();

    const invoiceTitle = await screen.findByText('链云测试科技有限公司');
    fireEvent.click(
      within(
        requireElement(
          invoiceTitle.closest('tr'),
          'Expected invoice row to render',
        ),
      ).getByRole('button', { name: '处理开票' }),
    );
    fireEvent.change(screen.getByLabelText('管理员备注'), {
      target: { value: '资料已核对，进入开票流程' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));

    await waitFor(() => {
      expect(mockProcessInvoiceRequest).toHaveBeenCalledWith(
        { invoice_request_id: 21 },
        {
          status: 'processing',
          invoice_number: '',
          file_url: '',
          admin_note: '资料已核对，进入开票流程',
        },
      );
      expect(mockListInvoiceRequests).toHaveBeenCalledTimes(2);
    });
    expect(await screen.findByText('开票处理结果已保存')).toBeInTheDocument();
  });

  it('shows late-payment evidence and requires an exception refund proof', async () => {
    renderPage();

    const lateOrder = await screen.findByText('LC202608300002');
    const row = within(
      requireElement(lateOrder.closest('tr'), 'Expected late payment row'),
    );
    expect(row.getByText('异常支付')).toBeInTheDocument();
    expect(row.getByText('用户取消')).toBeInTheDocument();
    expect(row.getByText('WX-LATE-001')).toBeInTheDocument();

    fireEvent.click(row.getByRole('button', { name: '登记异常退款' }));
    expect(screen.getByText('异常支付只能保留当前订阅')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('退款原因'), {
      target: { value: '迟到付款已在线下退回' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));

    expect(await screen.findByText('请填写退款凭证。')).toBeInTheDocument();
    expect(mockRefundOrder).not.toHaveBeenCalledWith(
      { order_id: 12 },
      expect.anything(),
    );
  });

  it('restores independent order and invoice filters from the URL', async () => {
    window.history.replaceState(
      {},
      '',
      '/platform-management/subscriptions?order_page=2&order_keyword=LC2026&order_status=paid&order_refund_status=none&order_created_from=2026-08-01&order_created_to=2026-08-31&invoice_page=3&invoice_keyword=%E9%93%BE%E4%BA%91&invoice_status=pending',
    );

    renderPage();

    await waitFor(() => {
      expect(mockListOrders).toHaveBeenCalledWith(
        expect.objectContaining({
          page: 2,
          page_size: 10,
          keyword: 'LC2026',
          status: 'paid',
          refund_status: 'none',
          created_from: expect.stringContaining('2026-08-01'),
          created_to: expect.stringContaining('2026-09-01'),
        }),
      );
      expect(mockListInvoiceRequests).toHaveBeenCalledWith(
        expect.objectContaining({
          page: 3,
          page_size: 10,
          keyword: '链云',
          status: 'pending',
        }),
      );
    });
  });

  it('distinguishes order load failures and supports retry', async () => {
    mockListOrders
      .mockRejectedValueOnce(new Error('network unavailable'))
      .mockResolvedValueOnce({ items: [], total: 0 });

    renderPage();

    expect(await screen.findByText('订阅订单加载失败')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '重新加载订单' }));

    await waitFor(() => expect(mockListOrders).toHaveBeenCalledTimes(2));
  });
});
