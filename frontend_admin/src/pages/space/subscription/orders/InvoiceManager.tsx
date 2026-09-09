import { FileDoneOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { TableColumnsType } from 'antd';
import {
  Alert,
  Button,
  Card,
  Descriptions,
  Empty,
  Form,
  Input,
  Modal,
  message,
  Popconfirm,
  Radio,
  Select,
  Space,
  Table,
  Typography,
} from 'antd';
import React, { useMemo, useState } from 'react';
import { AppStatusTag } from '@/components/AppStatus';
import {
  appsSubscriptionsApiCreateInvoiceRequest,
  appsSubscriptionsApiGetInvoiceProfile,
  appsSubscriptionsApiListInvoiceRequests,
  appsSubscriptionsApiPutInvoiceProfile,
} from '@/services/openapi/subscriptions';

type OrganizationInvoiceRequest = API.InvoiceRequestOut & {
  order_no?: string;
  target_plan_name?: string;
};

type InvoiceManagerProps = {
  orders: API.SaaSOrderOut[];
  planNameByCode?: Record<string, string>;
  selectedOrgSlug?: string;
  canManage?: boolean;
};

const INVOICE_STATUS_LABELS: Record<string, string> = {
  pending: '待开票',
  processing: '处理中',
  issued: '已开票',
  rejected: '已拒绝',
  cancelled: '已取消',
};

function formatDateTime(value?: string | null) {
  return value
    ? new Date(value).toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      })
    : '—';
}

function getErrorMessage(error: any, fallback: string) {
  return String(
    error?.response?.data?.errors?.[0]?.message ||
      error?.data?.errors?.[0]?.message ||
      error?.response?.data?.message ||
      error?.data?.message ||
      error?.message ||
      fallback,
  );
}

export const InvoiceManager: React.FC<InvoiceManagerProps> = ({
  orders,
  planNameByCode = {},
  selectedOrgSlug,
  canManage = true,
}) => {
  const queryClient = useQueryClient();
  const [profileForm] = Form.useForm<API.InvoiceProfileIn>();
  const invoiceType = Form.useWatch('invoice_type', profileForm);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<number>();

  const profileQuery = useQuery({
    queryKey: ['subscriptions', 'invoice-profile', selectedOrgSlug],
    queryFn: appsSubscriptionsApiGetInvoiceProfile,
    enabled: Boolean(selectedOrgSlug) && canManage,
  });
  const invoiceRequestsQuery = useQuery({
    queryKey: ['subscriptions', 'invoice-requests', selectedOrgSlug],
    queryFn: () =>
      appsSubscriptionsApiListInvoiceRequests({ page: 1, page_size: 500 }),
    enabled: Boolean(selectedOrgSlug),
  });

  const invoiceRequests = (invoiceRequestsQuery.data?.items ||
    []) as OrganizationInvoiceRequest[];
  const requestedOrderIds = useMemo(
    () => new Set(invoiceRequests.map((item) => item.order_id)),
    [invoiceRequests],
  );
  const eligibleOrders = orders.filter(
    (order) =>
      order.status === 'paid' &&
      order.refund_status === 'none' &&
      !requestedOrderIds.has(order.id),
  );

  const profileMutation = useMutation({
    mutationFn: (values: API.InvoiceProfileIn) =>
      appsSubscriptionsApiPutInvoiceProfile(values),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['subscriptions', 'invoice-profile', selectedOrgSlug],
      });
      setProfileModalOpen(false);
      profileForm.resetFields();
      message.success('开票资料已保存');
    },
  });
  const invoiceRequestMutation = useMutation({
    mutationFn: (orderId: number) =>
      appsSubscriptionsApiCreateInvoiceRequest({ order_id: orderId }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['subscriptions', 'invoice-requests', selectedOrgSlug],
      });
      setSelectedOrderId(undefined);
      message.success('开票申请已提交');
    },
  });

  const openProfileModal = () => {
    const profile = profileQuery.data;
    profileForm.setFieldsValue({
      invoice_type: profile?.invoice_type || 'company',
      title: profile?.title || '',
      tax_number: profile?.tax_number || '',
      recipient_email: profile?.recipient_email || '',
      registered_address: profile?.registered_address || '',
      registered_phone: profile?.registered_phone || '',
      bank_name: profile?.bank_name || '',
      bank_account: profile?.bank_account || '',
    });
    setProfileModalOpen(true);
  };

  const requestColumns = useMemo<TableColumnsType<OrganizationInvoiceRequest>>(
    () => [
      {
        title: '订单',
        dataIndex: 'order_no',
        render: (orderNo: string | undefined, record) => (
          <Space orientation="vertical" size={0}>
            <Typography.Text strong>
              {record.target_plan_name || `订单 #${record.order_id}`}
            </Typography.Text>
            <Typography.Text type="secondary" copyable={Boolean(orderNo)}>
              {orderNo || `订单 ID：${record.order_id}`}
            </Typography.Text>
          </Space>
        ),
      },
      {
        title: '状态',
        dataIndex: 'status',
        align: 'center',
        render: (status: string) => (
          <AppStatusTag name="invoice-request" state={status}>
            {INVOICE_STATUS_LABELS[status] || status}
          </AppStatusTag>
        ),
      },
      {
        title: '申请时间',
        dataIndex: 'created_at',
        align: 'center',
        render: formatDateTime,
      },
      {
        title: '发票',
        dataIndex: 'file_url',
        align: 'center',
        render: (fileUrl: string, record) =>
          fileUrl ? (
            <Button type="link" href={fileUrl} target="_blank">
              查看发票
            </Button>
          ) : record.admin_note ? (
            <Typography.Text type="secondary">
              {record.admin_note}
            </Typography.Text>
          ) : (
            '—'
          ),
      },
    ],
    [],
  );

  return (
    <Card
      title={
        <Space>
          <FileDoneOutlined />
          开票管理
        </Space>
      }
      extra={
        canManage ? (
          <Button onClick={openProfileModal} loading={profileQuery.isLoading}>
            {profileQuery.data ? '维护开票资料' : '填写开票资料'}
          </Button>
        ) : null
      }
    >
      <Space orientation="vertical" size={20} style={{ width: '100%' }}>
        {!canManage ? (
          <Alert
            type="info"
            showIcon
            title="开票资料仅订阅管理员可查看和维护"
            description="你仍可查看开票申请进度和已开具的发票文件。"
          />
        ) : profileQuery.isError ? (
          <Alert
            type="error"
            showIcon
            title="开票资料加载失败"
            action={
              <Button size="small" onClick={() => void profileQuery.refetch()}>
                重试
              </Button>
            }
          />
        ) : profileQuery.data ? (
          <Descriptions
            size="small"
            column={{ xs: 1, sm: 2, lg: 4 }}
            items={[
              {
                key: 'type',
                label: '发票类型',
                children:
                  profileQuery.data.invoice_type === 'personal'
                    ? '个人'
                    : '企业',
              },
              {
                key: 'title',
                label: '发票抬头',
                children: profileQuery.data.title,
              },
              {
                key: 'tax-number',
                label: '税号',
                children: profileQuery.data.tax_number || '—',
              },
              {
                key: 'email',
                label: '接收邮箱',
                children: profileQuery.data.recipient_email,
              },
            ]}
          />
        ) : (
          <Alert
            type="info"
            showIcon
            title="申请开票前请先填写开票资料"
            description="资料会在提交申请时生成快照，后续修改不会影响已提交的申请。"
          />
        )}

        {canManage ? (
          <div>
            <Typography.Title level={5}>申请开票</Typography.Title>
            <Space wrap>
              <Select
                style={{ minWidth: 300 }}
                placeholder="选择当前页中尚未开票的订单"
                value={selectedOrderId}
                options={eligibleOrders.map((order) => ({
                  value: order.id,
                  label: `${planNameByCode[order.target_plan_code] || order.target_plan_code} · ${order.order_no}`,
                }))}
                onChange={setSelectedOrderId}
                notFoundContent="当前页没有可申请开票的订单"
              />
              <Popconfirm
                title="确认提交开票申请吗？"
                description="提交时会保存当前开票资料，平台处理后可在下方查看进度。"
                okText="提交申请"
                cancelText="取消"
                disabled={!profileQuery.data || !selectedOrderId}
                onConfirm={() => {
                  if (selectedOrderId) {
                    invoiceRequestMutation.mutate(selectedOrderId);
                  }
                }}
              >
                <Button
                  type="primary"
                  disabled={!profileQuery.data || !selectedOrderId}
                  loading={invoiceRequestMutation.isPending}
                >
                  申请开票
                </Button>
              </Popconfirm>
            </Space>
            {invoiceRequestMutation.isError ? (
              <Alert
                className="mt-3"
                type="error"
                showIcon
                title={getErrorMessage(
                  invoiceRequestMutation.error,
                  '开票申请提交失败，请稍后重试。',
                )}
              />
            ) : null}
          </div>
        ) : null}

        <div>
          <Typography.Title level={5}>申请进度</Typography.Title>
          {invoiceRequestsQuery.isError ? (
            <Alert
              type="error"
              showIcon
              title="开票申请加载失败"
              action={
                <Button
                  size="small"
                  onClick={() => void invoiceRequestsQuery.refetch()}
                >
                  重试
                </Button>
              }
            />
          ) : (
            <Table<OrganizationInvoiceRequest>
              rowKey="id"
              size="small"
              loading={invoiceRequestsQuery.isLoading}
              dataSource={invoiceRequests}
              columns={requestColumns}
              pagination={false}
              scroll={{ x: 'max-content' }}
              locale={{
                emptyText: (
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description="还没有开票申请"
                  />
                ),
              }}
            />
          )}
        </div>
      </Space>

      <Modal
        open={profileModalOpen}
        title="开票资料"
        width={720}
        okText="保存开票资料"
        cancelText="取消"
        confirmLoading={profileMutation.isPending}
        destroyOnHidden
        onCancel={() => {
          setProfileModalOpen(false);
          profileForm.resetFields();
          profileMutation.reset();
        }}
        onOk={() => void profileForm.submit()}
      >
        {profileMutation.isError ? (
          <Alert
            className="mb-4"
            type="error"
            showIcon
            title={getErrorMessage(
              profileMutation.error,
              '开票资料保存失败，请检查后重试。',
            )}
          />
        ) : null}
        <Form
          form={profileForm}
          layout="vertical"
          preserve={false}
          onFinish={(values) => profileMutation.mutate(values)}
        >
          <Form.Item
            label="发票类型"
            name="invoice_type"
            rules={[{ required: true, message: '请选择发票类型' }]}
          >
            <Radio.Group
              options={[
                { label: '企业', value: 'company' },
                { label: '个人', value: 'personal' },
              ]}
            />
          </Form.Item>
          <Form.Item
            label="发票抬头"
            name="title"
            rules={[
              { required: true, message: '请输入发票抬头' },
              { max: 128, message: '发票抬头最多 128 个字符' },
            ]}
          >
            <Input placeholder="企业名称或个人姓名" />
          </Form.Item>
          <Form.Item
            label="纳税人识别号"
            name="tax_number"
            rules={
              invoiceType === 'company'
                ? [{ required: true, message: '企业发票请输入纳税人识别号' }]
                : []
            }
          >
            <Input placeholder="个人发票可不填" />
          </Form.Item>
          <Form.Item
            label="接收邮箱"
            name="recipient_email"
            rules={[
              { required: true, message: '请输入接收邮箱' },
              { type: 'email', message: '邮箱格式不正确' },
            ]}
          >
            <Input placeholder="用于接收电子发票" />
          </Form.Item>
          <Form.Item label="注册地址" name="registered_address">
            <Input />
          </Form.Item>
          <Form.Item label="注册电话" name="registered_phone">
            <Input />
          </Form.Item>
          <Form.Item label="开户银行" name="bank_name">
            <Input />
          </Form.Item>
          <Form.Item label="银行账号" name="bank_account">
            <Input />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};
