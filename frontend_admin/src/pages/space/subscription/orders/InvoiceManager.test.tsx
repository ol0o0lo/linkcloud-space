import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InvoiceManager } from './InvoiceManager';

const mocks = vi.hoisted(() => ({
  createInvoiceRequest: vi.fn(),
  getInvoiceProfile: vi.fn(),
  listInvoiceRequests: vi.fn(),
  putInvoiceProfile: vi.fn(),
}));

vi.mock('@/services/openapi/subscriptions', () => ({
  appsSubscriptionsApiCreateInvoiceRequest: mocks.createInvoiceRequest,
  appsSubscriptionsApiGetInvoiceProfile: mocks.getInvoiceProfile,
  appsSubscriptionsApiListInvoiceRequests: mocks.listInvoiceRequests,
  appsSubscriptionsApiPutInvoiceProfile: mocks.putInvoiceProfile,
}));

const orders = [
  {
    id: 7,
    organization_id: 1,
    organization_name: '链云测试空间',
    organization_slug: 'demo',
    order_no: 'LC202609060001',
    order_type: 'initial_purchase',
    status: 'paid',
    close_reason: '',
    target_plan_code: 'professional',
    target_plan_name: '专业版',
    billing_cycle: 'month',
    list_amount: 9900,
    credit_amount: 0,
    payable_amount: 9900,
    expires_at: '2026-09-06T11:00:00+08:00',
    paid_at: '2026-09-06T10:00:00+08:00',
    refund_status: 'none',
    refunded_amount: 0,
    refund_reason: '',
    refund_proof: '',
    refund_subscription_action: '',
    refunded_at: null,
    created_at: '2026-09-06T09:00:00+08:00',
    payment: null,
    invoice: null,
  },
] satisfies API.SaaSOrderOut[];

function renderManager({ canManage = true }: { canManage?: boolean } = {}) {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({
          defaultOptions: {
            queries: { retry: false },
            mutations: { retry: false },
          },
        })
      }
    >
      <InvoiceManager
        orders={orders}
        planNameByCode={{ professional: '专业版' }}
        selectedOrgSlug="demo"
        canManage={canManage}
      />
    </QueryClientProvider>,
  );
}

describe('InvoiceManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getInvoiceProfile.mockResolvedValue({
      organization_id: 1,
      invoice_type: 'company',
      title: '链云测试科技有限公司',
      tax_number: '91440000123456789X',
      recipient_email: 'finance@example.com',
      registered_address: '',
      registered_phone: '',
      bank_name: '',
      bank_account: '',
    });
    mocks.listInvoiceRequests.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      page_size: 500,
    });
    mocks.createInvoiceRequest.mockResolvedValue({
      id: 1,
      order_id: 7,
      status: 'pending',
    });
    mocks.putInvoiceProfile.mockResolvedValue({});
  });

  it('选择已付款订单并提交开票申请', async () => {
    renderManager();

    expect(await screen.findByText('链云测试科技有限公司')).toBeInTheDocument();
    fireEvent.mouseDown(screen.getByRole('combobox', { name: '' }));
    fireEvent.click(await screen.findByText(/专业版 · LC202609060001/));
    fireEvent.click(screen.getByRole('button', { name: '申请开票' }));
    fireEvent.click(screen.getByRole('button', { name: '提交申请' }));

    await waitFor(() => {
      expect(mocks.createInvoiceRequest).toHaveBeenCalledWith({ order_id: 7 });
    });
  });

  it('展示已有开票申请进度和发票文件', async () => {
    mocks.listInvoiceRequests.mockResolvedValue({
      items: [
        {
          id: 3,
          order_id: 7,
          order_no: 'LC202609060001',
          target_plan_name: '专业版',
          status: 'issued',
          profile_snapshot: {},
          invoice_number: 'FP-001',
          issued_at: '2026-09-06T12:00:00+08:00',
          file_url: 'https://example.com/invoice.pdf',
          admin_note: '',
          created_at: '2026-09-06T10:00:00+08:00',
        },
      ],
      total: 1,
      page: 1,
      page_size: 500,
    });

    renderManager();

    expect(await screen.findByText('已开票')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '查看发票' })).toHaveAttribute(
      'href',
      'https://example.com/invoice.pdf',
    );
  });

  it('只读用户不加载或展示敏感开票资料', async () => {
    mocks.listInvoiceRequests.mockResolvedValue({
      items: [
        {
          id: 3,
          order_id: 7,
          order_no: 'LC202609060001',
          target_plan_name: '专业版',
          status: 'issued',
          profile_snapshot: {},
          invoice_number: 'FP-001',
          issued_at: '2026-09-06T12:00:00+08:00',
          file_url: 'https://example.com/invoice.pdf',
          admin_note: '',
          created_at: '2026-09-06T10:00:00+08:00',
        },
      ],
      total: 1,
      page: 1,
      page_size: 500,
    });

    renderManager({ canManage: false });

    expect(
      await screen.findByText('开票资料仅订阅管理员可查看和维护'),
    ).toBeInTheDocument();
    expect(await screen.findByText('已开票')).toBeInTheDocument();
    expect(mocks.getInvoiceProfile).not.toHaveBeenCalled();
    expect(screen.queryByText('91440000123456789X')).not.toBeInTheDocument();
  });
});
