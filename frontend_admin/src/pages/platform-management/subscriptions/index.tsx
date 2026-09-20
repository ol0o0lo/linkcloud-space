import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { ProTable } from '@ant-design/pro-components';
import { useMutation } from '@tanstack/react-query';
import {
  Alert,
  Button,
  Card,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Modal,
  message,
  Select,
  Space,
  Typography,
} from 'antd';
import dayjs from 'dayjs';
import React, { useRef, useState } from 'react';
import { AppStatusTag } from '@/components/AppStatus';
import { PageContainer } from '@/components/PageContainer';
import {
  AdminToolbar,
  adminTableScroll,
  fullWidthStyle,
  ResponsiveActions,
  toolbarControlStyle,
  toolbarShortSelectStyle,
} from '@/pages/_shared/adminLayout';
import {
  appsSubscriptionsApiAdminListInvoiceRequests,
  appsSubscriptionsApiAdminListOrders,
  appsSubscriptionsApiAdminProcessInvoiceRequest,
  appsSubscriptionsApiAdminRefundOrder,
} from '@/services/openapi/subscriptionsAdmin';
import { IdentityText } from '../shared';

type AdminOrder = API.SaaSOrderOut & {
  organization_id: number;
  organization_name: string;
  organization_slug: string;
  target_plan_name: string;
};

type AdminInvoiceRequest = API.InvoiceRequestOut & {
  organization_id: number;
  organization_name: string;
  organization_slug: string;
  order_no: string;
  target_plan_code: string;
  target_plan_name: string;
};

type TablePageParams = {
  current?: number;
  createdFrom?: string;
  createdTo?: string;
  keyword?: string;
  pageSize?: number;
  refundStatus?: string;
  status?: string;
};

type ListSearchState = {
  createdFrom: string;
  createdTo: string;
  keyword: string;
  page: number;
  refundStatus?: string;
  status?: string;
};

const PAGE_SIZE = 10;

const orderStatusMeta: Record<string, string> = {
  pending_payment: '待支付',
  paid: '已支付',
  closed: '已关闭',
  payment_failed: '支付失败',
};

const refundStatusMeta: Record<string, string> = {
  none: '未退款',
  partial: '部分退款',
  full: '全额退款',
};

const paymentStatusMeta: Record<string, string> = {
  pending: '待支付',
  succeeded: '渠道已支付',
  failed: '渠道失败',
  exception: '异常支付',
};

const closeReasonMeta: Record<string, string> = {
  timeout: '支付超时',
  superseded: '新订单替代',
  provider_failed: '渠道失败',
  user_cancelled: '用户取消',
};

const invoiceStatusMeta: Record<string, string> = {
  pending: '待开票',
  processing: '处理中',
  issued: '已开票',
  rejected: '已拒绝',
  cancelled: '已取消',
};

const invoiceStatusOptions = ['processing', 'issued', 'rejected'].map(
  (value) => ({
    value,
    label: invoiceStatusMeta[value],
  }),
);

const trimParam = (value: unknown) =>
  typeof value === 'string' && value.trim() ? value.trim() : undefined;

function positivePage(value: string | null) {
  const page = Number(value);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

function readListSearch(prefix: 'invoice' | 'order'): ListSearchState {
  const params = new URLSearchParams(window.location.search);
  return {
    page: positivePage(params.get(`${prefix}_page`)),
    keyword: trimParam(params.get(`${prefix}_keyword`)) || '',
    status: trimParam(params.get(`${prefix}_status`)),
    refundStatus: trimParam(params.get(`${prefix}_refund_status`)),
    createdFrom: trimParam(params.get(`${prefix}_created_from`)) || '',
    createdTo: trimParam(params.get(`${prefix}_created_to`)) || '',
  };
}

function syncListSearch(prefix: 'invoice' | 'order', state: ListSearchState) {
  const params = new URLSearchParams(window.location.search);
  const names = [
    'page',
    'keyword',
    'status',
    'refund_status',
    'created_from',
    'created_to',
  ];
  names.forEach((name) => {
    params.delete(`${prefix}_${name}`);
  });
  if (state.page > 1) params.set(`${prefix}_page`, String(state.page));
  if (state.keyword) params.set(`${prefix}_keyword`, state.keyword);
  if (state.status) params.set(`${prefix}_status`, state.status);
  if (state.refundStatus) {
    params.set(`${prefix}_refund_status`, state.refundStatus);
  }
  if (state.createdFrom) {
    params.set(`${prefix}_created_from`, state.createdFrom);
  }
  if (state.createdTo) params.set(`${prefix}_created_to`, state.createdTo);
  const search = params.toString();
  const nextUrl = `${window.location.pathname}${search ? `?${search}` : ''}${window.location.hash || ''}`;
  window.history.replaceState(window.history.state, '', nextUrl);
}

function apiDateRange(createdFrom?: string, createdTo?: string) {
  return {
    created_from: createdFrom
      ? dayjs(createdFrom).startOf('day').format()
      : undefined,
    created_to: createdTo
      ? dayjs(createdTo).add(1, 'day').startOf('day').format()
      : undefined,
  };
}

function formatAmount(amount: number) {
  return `¥${(amount / 100).toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : '操作失败，请稍后重试。';
}

const SubscriptionsAdminPage: React.FC = () => {
  const initialOrderSearch = React.useMemo(() => readListSearch('order'), []);
  const initialInvoiceSearch = React.useMemo(
    () => readListSearch('invoice'),
    [],
  );
  const orderActionRef = useRef<ActionType>(null);
  const invoiceActionRef = useRef<ActionType>(null);
  const [orderSearch, setOrderSearch] = useState(initialOrderSearch);
  const [orderKeywordDraft, setOrderKeywordDraft] = useState(
    initialOrderSearch.keyword,
  );
  const [invoiceSearch, setInvoiceSearch] = useState(initialInvoiceSearch);
  const [invoiceKeywordDraft, setInvoiceKeywordDraft] = useState(
    initialInvoiceSearch.keyword,
  );
  const [orderLoadError, setOrderLoadError] = useState<unknown>();
  const [invoiceLoadError, setInvoiceLoadError] = useState<unknown>();
  const [refundOrder, setRefundOrder] = useState<AdminOrder>();
  const [invoiceRequest, setInvoiceRequest] = useState<AdminInvoiceRequest>();
  const [refundForm] = Form.useForm<API.RefundIn>();
  const [invoiceForm] = Form.useForm<API.InvoiceProcessIn>();

  const refundMutation = useMutation({
    mutationFn: ({
      order,
      payload,
    }: {
      order: AdminOrder;
      payload: API.RefundIn;
    }) => appsSubscriptionsApiAdminRefundOrder({ order_id: order.id }, payload),
    onSuccess: () => {
      setRefundOrder(undefined);
      refundForm.resetFields();
      orderActionRef.current?.reload();
      message.success('退款登记成功');
    },
  });

  const invoiceMutation = useMutation({
    mutationFn: ({
      request,
      payload,
    }: {
      request: AdminInvoiceRequest;
      payload: API.InvoiceProcessIn;
    }) =>
      appsSubscriptionsApiAdminProcessInvoiceRequest(
        { invoice_request_id: request.id },
        payload,
      ),
    onSuccess: () => {
      setInvoiceRequest(undefined);
      invoiceForm.resetFields();
      invoiceActionRef.current?.reload();
      message.success('开票处理结果已保存');
    },
  });

  const updateOrderSearch = (next: Partial<ListSearchState>) => {
    setOrderSearch((current) => {
      const value = { ...current, ...next };
      syncListSearch('order', value);
      return value;
    });
  };

  const updateInvoiceSearch = (next: Partial<ListSearchState>) => {
    setInvoiceSearch((current) => {
      const value = { ...current, ...next };
      syncListSearch('invoice', value);
      return value;
    });
  };

  const orderColumns: ProColumns<AdminOrder>[] = [
    {
      title: '组织',
      dataIndex: 'organization_name',
      width: 220,
      render: (_value, record) => (
        <IdentityText
          primary={record.organization_name}
          secondary={`${record.organization_slug} · #${record.organization_id}`}
        />
      ),
    },
    {
      title: '订单与套餐',
      dataIndex: 'order_no',
      width: 230,
      render: (_value, record) => (
        <IdentityText
          primary={record.order_no}
          secondary={`${record.target_plan_name || record.target_plan_code} · ${record.billing_cycle === 'year' ? '年付' : '月付'}`}
        />
      ),
    },
    {
      title: '金额',
      dataIndex: 'payable_amount',
      width: 170,
      align: 'right',
      render: (_value, record) => (
        <Space orientation="vertical" size={4}>
          <Typography.Text>
            {formatAmount(record.payable_amount)}
          </Typography.Text>
          {record.refunded_amount > 0 ? (
            <Typography.Text type="secondary">
              已退 {formatAmount(record.refunded_amount)}
            </Typography.Text>
          ) : null}
        </Space>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 180,
      align: 'center',
      render: (_value, record) => {
        const orderStatus = orderStatusMeta[record.status] || record.status;
        const refundStatus =
          refundStatusMeta[record.refund_status] || record.refund_status;
        const paymentStatus = record.payment?.status
          ? paymentStatusMeta[String(record.payment.status)]
          : undefined;
        return (
          <Space orientation="vertical" size={4}>
            <AppStatusTag name="subscription.order" state={record.status}>
              {orderStatus}
            </AppStatusTag>
            {paymentStatus ? (
              <AppStatusTag
                name="subscription.payment"
                state={String(record.payment?.status)}
              >
                {paymentStatus}
              </AppStatusTag>
            ) : null}
            <AppStatusTag
              name="subscription.refund"
              state={record.refund_status}
            >
              {refundStatus}
            </AppStatusTag>
          </Space>
        );
      },
    },
    {
      title: '支付详情',
      dataIndex: 'payment_detail',
      width: 240,
      render: (_value, record) => (
        <Space orientation="vertical" size={4}>
          {record.close_reason ? (
            <Typography.Text type="secondary">
              {closeReasonMeta[record.close_reason] || record.close_reason}
            </Typography.Text>
          ) : null}
          {record.payment?.provider_trade_no ? (
            <Typography.Text copyable>
              {String(record.payment.provider_trade_no)}
            </Typography.Text>
          ) : null}
          {record.payment?.transaction_no ? (
            <Typography.Text type="secondary" copyable>
              {String(record.payment.transaction_no)}
            </Typography.Text>
          ) : null}
        </Space>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      width: 180,
      align: 'center',
      render: (value) => dayjs(value as string).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '操作',
      dataIndex: 'actions',
      width: 120,
      align: 'center',
      render: (_value, record) => {
        const isExceptionPayment = record.payment?.status === 'exception';
        return (
          <ResponsiveActions>
            {(record.status === 'paid' || isExceptionPayment) &&
            record.refund_status === 'none' ? (
              <Button
                type="link"
                size="small"
                onClick={() => {
                  refundMutation.reset();
                  refundForm.setFieldsValue({
                    amount: record.payable_amount,
                    reason: '',
                    proof: '',
                    subscription_action: 'keep',
                  });
                  setRefundOrder(record);
                }}
              >
                {isExceptionPayment ? '登记异常退款' : '登记退款'}
              </Button>
            ) : (
              <Typography.Text type="secondary">已完成</Typography.Text>
            )}
          </ResponsiveActions>
        );
      },
    },
  ];

  const invoiceColumns: ProColumns<AdminInvoiceRequest>[] = [
    {
      title: '组织',
      dataIndex: 'organization_name',
      width: 220,
      render: (_value, record) => (
        <IdentityText
          primary={record.organization_name}
          secondary={`${record.organization_slug} · #${record.organization_id}`}
        />
      ),
    },
    {
      title: '订单与套餐',
      dataIndex: 'order_no',
      width: 230,
      render: (_value, record) => (
        <IdentityText
          primary={record.order_no}
          secondary={record.target_plan_name || record.target_plan_code}
        />
      ),
    },
    {
      title: '发票抬头',
      dataIndex: 'profile_snapshot',
      width: 260,
      render: (_value, record) => {
        const profile = record.profile_snapshot;
        return (
          <IdentityText
            primary={String(profile.title || '未填写抬头')}
            secondary={
              profile.tax_number ? String(profile.tax_number) : undefined
            }
          />
        );
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 140,
      align: 'center',
      render: (_value, record) => {
        const label = invoiceStatusMeta[record.status] || record.status;
        return (
          <AppStatusTag name="invoice-request" state={record.status}>
            {label}
          </AppStatusTag>
        );
      },
    },
    {
      title: '申请时间',
      dataIndex: 'created_at',
      width: 180,
      align: 'center',
      render: (value) => dayjs(value as string).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '操作',
      dataIndex: 'actions',
      width: 120,
      align: 'center',
      render: (_value, record) => (
        <ResponsiveActions>
          {record.status === 'cancelled' ? (
            <Typography.Text type="secondary">已取消</Typography.Text>
          ) : (
            <Button
              type="link"
              size="small"
              onClick={() => {
                invoiceMutation.reset();
                invoiceForm.setFieldsValue({
                  status:
                    record.status === 'pending' ? 'processing' : record.status,
                  invoice_number: record.invoice_number || '',
                  file_url: record.file_url || '',
                  admin_note: record.admin_note || '',
                });
                setInvoiceRequest(record);
              }}
            >
              处理开票
            </Button>
          )}
        </ResponsiveActions>
      ),
    },
  ];

  return (
    <PageContainer title="订阅与订单">
      <Space orientation="vertical" size={16} style={fullWidthStyle}>
        <Card>
          {orderLoadError ? (
            <Alert
              type="error"
              showIcon
              title="订阅订单加载失败"
              description={errorMessage(orderLoadError)}
              action={
                <Button
                  size="small"
                  onClick={() => orderActionRef.current?.reload()}
                >
                  重新加载订单
                </Button>
              }
              style={{ marginBottom: 16 }}
            />
          ) : null}
          <ProTable<AdminOrder>
            actionRef={orderActionRef}
            rowKey="id"
            headerTitle="订阅订单"
            columns={orderColumns}
            request={async (params: TablePageParams) => {
              try {
                const result = await appsSubscriptionsApiAdminListOrders({
                  page: params.current || 1,
                  page_size: params.pageSize || PAGE_SIZE,
                  keyword: trimParam(params.keyword),
                  status: params.status,
                  refund_status: params.refundStatus,
                  ...apiDateRange(params.createdFrom, params.createdTo),
                });
                setOrderLoadError(undefined);
                return {
                  data: (result.items || []) as AdminOrder[],
                  total: result.total || 0,
                  success: true,
                };
              } catch (error) {
                setOrderLoadError(error);
                return { data: [], total: 0, success: true };
              }
            }}
            params={{
              keyword: orderSearch.keyword,
              status: orderSearch.status,
              refundStatus: orderSearch.refundStatus,
              createdFrom: orderSearch.createdFrom,
              createdTo: orderSearch.createdTo,
            }}
            search={false}
            options={{ density: true, reload: false, setting: true }}
            toolBarRender={() => [
              <AdminToolbar key="filters">
                <Input.Search
                  aria-label="订单关键词"
                  allowClear
                  placeholder="订单号或组织"
                  style={toolbarControlStyle}
                  value={orderKeywordDraft}
                  onChange={(event) => setOrderKeywordDraft(event.target.value)}
                  onSearch={(value) =>
                    updateOrderSearch({
                      page: 1,
                      keyword: trimParam(value) || '',
                    })
                  }
                />
                <Select
                  aria-label="订单状态"
                  allowClear
                  placeholder="订单状态"
                  style={toolbarShortSelectStyle}
                  value={orderSearch.status}
                  options={Object.entries(orderStatusMeta).map(
                    ([value, label]) => ({ value, label }),
                  )}
                  onChange={(status) => updateOrderSearch({ page: 1, status })}
                />
                <Select
                  aria-label="退款状态"
                  allowClear
                  placeholder="退款状态"
                  style={toolbarShortSelectStyle}
                  value={orderSearch.refundStatus}
                  options={Object.entries(refundStatusMeta).map(
                    ([value, label]) => ({ value, label }),
                  )}
                  onChange={(refundStatus) =>
                    updateOrderSearch({ page: 1, refundStatus })
                  }
                />
                <DatePicker.RangePicker
                  aria-label="订单创建时间"
                  value={
                    orderSearch.createdFrom && orderSearch.createdTo
                      ? [
                          dayjs(orderSearch.createdFrom),
                          dayjs(orderSearch.createdTo),
                        ]
                      : null
                  }
                  onChange={(dates) =>
                    updateOrderSearch({
                      page: 1,
                      createdFrom: dates?.[0]?.format('YYYY-MM-DD') || '',
                      createdTo: dates?.[1]?.format('YYYY-MM-DD') || '',
                    })
                  }
                />
                <Button
                  onClick={() => {
                    setOrderKeywordDraft('');
                    const reset = {
                      page: 1,
                      keyword: '',
                      status: undefined,
                      refundStatus: undefined,
                      createdFrom: '',
                      createdTo: '',
                    };
                    setOrderSearch(reset);
                    syncListSearch('order', reset);
                  }}
                >
                  重置
                </Button>
              </AdminToolbar>,
            ]}
            scroll={adminTableScroll}
            pagination={{
              current: orderSearch.page,
              pageSize: PAGE_SIZE,
              showSizeChanger: false,
              onChange: (page) => updateOrderSearch({ page }),
            }}
            locale={
              orderLoadError ? { emptyText: '订单数据加载失败' } : undefined
            }
          />
        </Card>

        <Card>
          {invoiceLoadError ? (
            <Alert
              type="error"
              showIcon
              title="开票申请加载失败"
              description={errorMessage(invoiceLoadError)}
              action={
                <Button
                  size="small"
                  onClick={() => invoiceActionRef.current?.reload()}
                >
                  重新加载开票申请
                </Button>
              }
              style={{ marginBottom: 16 }}
            />
          ) : null}
          <ProTable<AdminInvoiceRequest>
            actionRef={invoiceActionRef}
            rowKey="id"
            headerTitle="开票申请"
            columns={invoiceColumns}
            request={async (params: TablePageParams) => {
              try {
                const result =
                  await appsSubscriptionsApiAdminListInvoiceRequests({
                    page: params.current || 1,
                    page_size: params.pageSize || PAGE_SIZE,
                    keyword: trimParam(params.keyword),
                    status: params.status,
                    ...apiDateRange(params.createdFrom, params.createdTo),
                  });
                setInvoiceLoadError(undefined);
                return {
                  data: (result.items || []) as AdminInvoiceRequest[],
                  total: result.total || 0,
                  success: true,
                };
              } catch (error) {
                setInvoiceLoadError(error);
                return { data: [], total: 0, success: true };
              }
            }}
            params={{
              keyword: invoiceSearch.keyword,
              status: invoiceSearch.status,
              createdFrom: invoiceSearch.createdFrom,
              createdTo: invoiceSearch.createdTo,
            }}
            search={false}
            options={{ density: true, reload: false, setting: true }}
            toolBarRender={() => [
              <AdminToolbar key="filters">
                <Input.Search
                  aria-label="开票关键词"
                  allowClear
                  placeholder="订单、组织或发票抬头"
                  style={toolbarControlStyle}
                  value={invoiceKeywordDraft}
                  onChange={(event) =>
                    setInvoiceKeywordDraft(event.target.value)
                  }
                  onSearch={(value) =>
                    updateInvoiceSearch({
                      page: 1,
                      keyword: trimParam(value) || '',
                    })
                  }
                />
                <Select
                  aria-label="开票状态"
                  allowClear
                  placeholder="开票状态"
                  style={toolbarShortSelectStyle}
                  value={invoiceSearch.status}
                  options={Object.entries(invoiceStatusMeta).map(
                    ([value, label]) => ({ value, label }),
                  )}
                  onChange={(status) =>
                    updateInvoiceSearch({ page: 1, status })
                  }
                />
                <DatePicker.RangePicker
                  aria-label="开票申请时间"
                  value={
                    invoiceSearch.createdFrom && invoiceSearch.createdTo
                      ? [
                          dayjs(invoiceSearch.createdFrom),
                          dayjs(invoiceSearch.createdTo),
                        ]
                      : null
                  }
                  onChange={(dates) =>
                    updateInvoiceSearch({
                      page: 1,
                      createdFrom: dates?.[0]?.format('YYYY-MM-DD') || '',
                      createdTo: dates?.[1]?.format('YYYY-MM-DD') || '',
                    })
                  }
                />
                <Button
                  onClick={() => {
                    setInvoiceKeywordDraft('');
                    const reset = {
                      page: 1,
                      keyword: '',
                      status: undefined,
                      refundStatus: undefined,
                      createdFrom: '',
                      createdTo: '',
                    };
                    setInvoiceSearch(reset);
                    syncListSearch('invoice', reset);
                  }}
                >
                  重置
                </Button>
              </AdminToolbar>,
            ]}
            scroll={adminTableScroll}
            pagination={{
              current: invoiceSearch.page,
              pageSize: PAGE_SIZE,
              showSizeChanger: false,
              onChange: (page) => updateInvoiceSearch({ page }),
            }}
            locale={
              invoiceLoadError ? { emptyText: '开票申请加载失败' } : undefined
            }
          />
        </Card>
      </Space>

      <Modal
        title={`登记退款${refundOrder ? ` · ${refundOrder.order_no}` : ''}`}
        open={Boolean(refundOrder)}
        confirmLoading={refundMutation.isPending}
        onCancel={() => setRefundOrder(undefined)}
        onOk={async () => {
          try {
            const payload = await refundForm.validateFields();
            if (refundOrder) {
              await refundMutation.mutateAsync({ order: refundOrder, payload });
            }
          } catch {
            // 表单错误由 antd 直接展示；接口错误由 mutation Alert 展示。
          }
        }}
      >
        <Space orientation="vertical" size={12} style={fullWidthStyle}>
          {refundMutation.isError ? (
            <Alert
              type="error"
              showIcon
              title={errorMessage(refundMutation.error)}
            />
          ) : null}
          {refundOrder?.payment?.status === 'exception' ? (
            <Alert
              type="warning"
              showIcon
              title="异常支付只能保留当前订阅"
              description="请先在线下完成退款，再填写可核对的退款凭证。"
            />
          ) : null}
          <Form form={refundForm} layout="vertical">
            <Form.Item
              label="退款金额（分）"
              name="amount"
              rules={[{ required: true, message: '请填写退款金额。' }]}
            >
              <InputNumber min={1} style={fullWidthStyle} />
            </Form.Item>
            <Form.Item
              label="退款原因"
              name="reason"
              rules={[{ required: true, message: '请填写退款原因。' }]}
            >
              <Input />
            </Form.Item>
            <Form.Item
              label="退款凭证"
              name="proof"
              rules={
                refundOrder?.payment?.status === 'exception'
                  ? [{ required: true, message: '请填写退款凭证。' }]
                  : undefined
              }
            >
              <Input placeholder="可填写凭证编号或文件地址" />
            </Form.Item>
            <Form.Item
              label="订阅处理"
              name="subscription_action"
              rules={[{ required: true, message: '请选择订阅处理方式。' }]}
            >
              <Select
                disabled={refundOrder?.payment?.status === 'exception'}
                options={[
                  { value: 'keep', label: '保留当前订阅' },
                  { value: 'end', label: '立即结束订阅' },
                ]}
              />
            </Form.Item>
          </Form>
        </Space>
      </Modal>

      <Modal
        title={`处理开票${invoiceRequest ? ` · ${invoiceRequest.order_no}` : ''}`}
        open={Boolean(invoiceRequest)}
        confirmLoading={invoiceMutation.isPending}
        onCancel={() => setInvoiceRequest(undefined)}
        onOk={async () => {
          const values = await invoiceForm.validateFields();
          if (invoiceRequest) {
            await invoiceMutation.mutateAsync({
              request: invoiceRequest,
              payload: {
                status: values.status,
                invoice_number: values.invoice_number || '',
                file_url: values.file_url || '',
                admin_note: values.admin_note || '',
              },
            });
          }
        }}
      >
        <Space orientation="vertical" size={12} style={fullWidthStyle}>
          {invoiceMutation.isError ? (
            <Alert
              type="error"
              showIcon
              title={errorMessage(invoiceMutation.error)}
            />
          ) : null}
          <Form form={invoiceForm} layout="vertical">
            <Form.Item
              label="处理状态"
              name="status"
              rules={[{ required: true, message: '请选择处理状态。' }]}
            >
              <Select options={invoiceStatusOptions} />
            </Form.Item>
            <Form.Item label="发票号码" name="invoice_number">
              <Input />
            </Form.Item>
            <Form.Item label="文件地址" name="file_url">
              <Input />
            </Form.Item>
            <Form.Item label="管理员备注" name="admin_note">
              <Input.TextArea rows={3} />
            </Form.Item>
          </Form>
        </Space>
      </Modal>
    </PageContainer>
  );
};

export default SubscriptionsAdminPage;
