import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { ProTable } from '@ant-design/pro-components';
import { useMutation } from '@tanstack/react-query';
import {
  Alert,
  Card,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Tag,
  Typography,
} from 'antd';
import dayjs from 'dayjs';
import React, { useRef, useState } from 'react';
import { PageContainer } from '@/components/PageContainer';
import {
  adminTableScroll,
  fullWidthStyle,
  ResponsiveActions,
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
  pageSize?: number;
};

const orderStatusMeta: Record<string, { color: string; label: string }> = {
  pending_payment: { color: 'gold', label: '待支付' },
  paid: { color: 'green', label: '已支付' },
  closed: { color: 'default', label: '已关闭' },
  payment_failed: { color: 'volcano', label: '支付失败' },
};

const refundStatusMeta: Record<string, { color: string; label: string }> = {
  none: { color: 'default', label: '未退款' },
  partial: { color: 'gold', label: '部分退款' },
  full: { color: 'volcano', label: '全额退款' },
};

const invoiceStatusMeta: Record<string, { color: string; label: string }> = {
  pending: { color: 'gold', label: '待处理' },
  processing: { color: 'blue', label: '处理中' },
  issued: { color: 'green', label: '已开票' },
  rejected: { color: 'volcano', label: '已拒绝' },
  cancelled: { color: 'default', label: '已取消' },
};

const invoiceStatusOptions = ['processing', 'issued', 'rejected'].map(
  (value) => ({
    value,
    label: invoiceStatusMeta[value].label,
  }),
);

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
  const orderActionRef = useRef<ActionType>(null);
  const invoiceActionRef = useRef<ActionType>(null);
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
    },
  });

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
        const orderStatus = orderStatusMeta[record.status] || {
          color: 'default',
          label: record.status,
        };
        const refundStatus = refundStatusMeta[record.refund_status] || {
          color: 'default',
          label: record.refund_status,
        };
        return (
          <Space orientation="vertical" size={4}>
            <Tag color={orderStatus.color}>{orderStatus.label}</Tag>
            <Tag color={refundStatus.color}>{refundStatus.label}</Tag>
          </Space>
        );
      },
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
      render: (_value, record) => (
        <ResponsiveActions>
          {record.status === 'paid' && record.refund_status === 'none' ? (
            <a
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
              登记退款
            </a>
          ) : (
            <Typography.Text type="secondary">已处置</Typography.Text>
          )}
        </ResponsiveActions>
      ),
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
        const meta = invoiceStatusMeta[record.status] || {
          color: 'default',
          label: record.status,
        };
        return <Tag color={meta.color}>{meta.label}</Tag>;
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
            <a
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
            </a>
          )}
        </ResponsiveActions>
      ),
    },
  ];

  return (
    <PageContainer title="订阅处置">
      <Space orientation="vertical" size={16} style={fullWidthStyle}>
        <Card>
          <ProTable<AdminOrder>
            actionRef={orderActionRef}
            rowKey="id"
            headerTitle="订阅订单"
            columns={orderColumns}
            request={async (params: TablePageParams) => {
              const result = await appsSubscriptionsApiAdminListOrders({
                page: params.current || 1,
                page_size: params.pageSize || 10,
              });
              return {
                data: (result.items || []) as AdminOrder[],
                total: result.total || 0,
                success: true,
              };
            }}
            search={false}
            options={{ density: true, reload: false, setting: true }}
            scroll={adminTableScroll}
            pagination={{ defaultPageSize: 10 }}
          />
        </Card>

        <Card>
          <ProTable<AdminInvoiceRequest>
            actionRef={invoiceActionRef}
            rowKey="id"
            headerTitle="开票申请"
            columns={invoiceColumns}
            request={async (params: TablePageParams) => {
              const result = await appsSubscriptionsApiAdminListInvoiceRequests(
                {
                  page: params.current || 1,
                  page_size: params.pageSize || 10,
                },
              );
              return {
                data: (result.items || []) as AdminInvoiceRequest[],
                total: result.total || 0,
                success: true,
              };
            }}
            search={false}
            options={{ density: true, reload: false, setting: true }}
            scroll={adminTableScroll}
            pagination={{ defaultPageSize: 10 }}
          />
        </Card>
      </Space>

      <Modal
        title={`登记退款${refundOrder ? ` · ${refundOrder.order_no}` : ''}`}
        open={Boolean(refundOrder)}
        confirmLoading={refundMutation.isPending}
        onCancel={() => setRefundOrder(undefined)}
        onOk={async () => {
          const payload = await refundForm.validateFields();
          if (refundOrder) {
            await refundMutation.mutateAsync({ order: refundOrder, payload });
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
            <Form.Item label="退款凭证" name="proof">
              <Input placeholder="可填写凭证编号或文件地址" />
            </Form.Item>
            <Form.Item
              label="订阅处理"
              name="subscription_action"
              rules={[{ required: true, message: '请选择订阅处理方式。' }]}
            >
              <Select
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
