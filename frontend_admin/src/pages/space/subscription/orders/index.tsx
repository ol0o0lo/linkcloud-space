import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  FileTextOutlined,
  ReloadOutlined,
  WechatOutlined,
} from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { history, useAccess } from '@umijs/max';
import type { TableColumnsType } from 'antd';
import {
  Alert,
  Button,
  Card,
  Empty,
  Modal,
  message,
  Pagination,
  Popconfirm,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd';
import { createStyles } from 'antd-style';
import React, { useMemo, useState } from 'react';
import { fixedPagePagination } from '@/pages/_shared/adminLayout';
import { cancelSubscriptionOrder } from '@/services/manual/subscriptions';
import {
  appsSubscriptionsApiCheckoutOrder,
  appsSubscriptionsApiListOrders,
  appsSubscriptionsApiListPlans,
  appsSubscriptionsApiRefreshOrderPayment,
} from '@/services/openapi/subscriptions';
import { SPACE_PATHS } from '@/utils/adminRouting';
import { TenantSelectionGuard, useTenantWorkspace } from '../../shared';
import { InvoiceManager } from './InvoiceManager';

const PAGE_SIZE = 10;

const ORDER_TYPE_LABELS: Record<string, string> = {
  initial_purchase: '首次购买',
  renewal: '续费',
  upgrade: '套餐升级',
};

const REFUND_STATUS_LABELS: Record<string, string> = {
  partial: '部分退款',
  full: '已退款',
};

const ORDER_STATUS_META: Record<string, { color?: string; label: string }> = {
  pending_payment: { color: 'gold', label: '待支付' },
  paid: { color: 'green', label: '已支付' },
  closed: { label: '已关闭' },
  payment_failed: { color: 'red', label: '支付失败' },
};

const CLOSE_REASON_LABELS: Record<string, string> = {
  timeout: '支付超时',
  superseded: '已被新订单替代',
  provider_failed: '渠道失败',
  user_cancelled: '用户取消',
};

const useStyles = createStyles(({ css, token }) => ({
  page: css`
    max-width: 1600px;
    margin: 8px auto 0;
    padding-bottom: 24px;
  `,
  recordsCard: css`
    overflow: hidden;
    border-color: ${token.colorBorderSecondary};
    border-radius: ${token.borderRadiusLG}px;
    box-shadow: ${token.boxShadowTertiary};

    .ant-card-body {
      padding: 0;
    }

    .ant-table-wrapper .ant-table-thead > tr > th {
      padding: 14px 24px;
      color: ${token.colorTextTertiary};
      font-size: ${token.fontSizeSM}px;
      font-weight: ${token.fontWeightStrong};
      background: ${token.colorFillQuaternary};
    }

    .ant-table-wrapper .ant-table-tbody > tr > td {
      padding: 18px 24px;
    }

    .ant-table-wrapper .ant-table-tbody > tr:hover > td {
      background: ${token.colorFillQuaternary};
    }
  `,
  recordsHeader: css`
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 24px;
    border-bottom: 1px solid ${token.colorBorderSecondary};

    @media (max-width: 575px) {
      padding: 18px 16px;
    }
  `,
  headerTitleRow: css`
    display: flex;
    align-items: flex-start;
    gap: 14px;
  `,
  headerIcon: css`
    display: inline-flex;
    width: 44px;
    height: 44px;
    flex: 0 0 auto;
    align-items: center;
    justify-content: center;
    border-radius: ${token.borderRadiusLG}px;
    color: ${token.colorPrimary};
    background: ${token.colorPrimaryBg};
    font-size: 18px;
  `,
  headerTitle: css`
    margin: 0 0 2px !important;
  `,
  headerDescription: css`
    margin: 0 !important;
    color: ${token.colorTextSecondary};
    font-size: ${token.fontSizeSM}px;
  `,
  headerActions: css`
    display: flex;
    align-items: center;
    gap: 12px;

    @media (max-width: 575px) {
      width: 100%;
      justify-content: space-between;
    }
  `,
  paidSummary: css`
    display: inline-flex;
    align-items: center;
    gap: 7px;
    color: ${token.colorTextSecondary};
    font-size: ${token.fontSizeSM}px;
    white-space: nowrap;

    .anticon {
      color: ${token.colorSuccess};
    }
  `,
  summaryCount: css`
    color: ${token.colorText};
    font-weight: ${token.fontWeightStrong};
    font-variant-numeric: tabular-nums;
  `,
  backButton: css`
    color: ${token.colorTextSecondary};

    @media (max-width: 575px) {
      width: 32px;
      padding-inline: 0;

      > span:not(.anticon) {
        display: none;
      }
    }
  `,
  desktopOrders: css`
    @media (max-width: 767px) {
      display: none;
    }
  `,
  mobileOrders: css`
    display: none;

    @media (max-width: 767px) {
      display: block;
    }
  `,
  mobileOrderItem: css`
    padding: 18px 16px;
    border-bottom: 1px solid ${token.colorBorderSecondary};

    &:last-child {
      border-bottom: 0;
    }
  `,
  mobileOrderHeader: css`
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 14px;
  `,
  mobileOrderMeta: css`
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 14px 18px;
  `,
  mobileOrderFact: css`
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: 3px;
  `,
  mobileOrderLabel: css`
    color: ${token.colorTextSecondary};
    font-size: ${token.fontSizeSM}px;
  `,
  orderCell: css`
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: 4px;
  `,
  orderType: css`
    color: ${token.colorTextHeading};
    font-weight: ${token.fontWeightStrong};
  `,
  orderNo: css`
    max-width: 260px;
    color: ${token.colorTextSecondary};
    font-family: ${token.fontFamilyCode};
    font-size: ${token.fontSizeSM}px;
  `,
  amount: css`
    color: ${token.colorTextHeading};
    font-size: ${token.fontSizeLG}px;
    font-weight: ${token.fontWeightStrong};
    font-variant-numeric: tabular-nums;
  `,
  originalAmount: css`
    color: ${token.colorTextTertiary};
    font-size: ${token.fontSizeSM}px;
  `,
  cycleTag: css`
    width: fit-content;
    margin-inline-end: 0;
    color: ${token.colorTextSecondary};
  `,
  paymentTime: css`
    color: ${token.colorText};
    font-variant-numeric: tabular-nums;
  `,
  paymentMeta: css`
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
  `,
  paidStatus: css`
    display: inline-flex;
    align-items: center;
    gap: 5px;
    color: ${token.colorSuccess};
    font-size: ${token.fontSizeSM}px;
  `,
  refundTag: css`
    margin-inline-end: 0;
  `,
  emptyState: css`
    padding: 48px 16px;
  `,
  mobilePagination: css`
    display: flex;
    justify-content: center;
    padding: 16px;
    border-top: 1px solid ${token.colorBorderSecondary};
  `,
}));

function formatAmount(amount: number) {
  return `¥${(amount / 100).toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

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

function billingCycleLabel(cycle?: string) {
  return cycle === 'year' ? '年付' : '月付';
}

const SubscriptionOrdersPage: React.FC = () => {
  const { styles } = useStyles();
  const workspace = useTenantWorkspace();
  const queryClient = useQueryClient();
  const { canManageSubscriptions } = useAccess();
  const [page, setPage] = useState(1);
  const [checkoutOrder, setCheckoutOrder] = useState<API.SaaSOrderOut>();

  const plansQuery = useQuery({
    queryKey: ['subscriptions', 'plans'],
    queryFn: appsSubscriptionsApiListPlans,
    enabled: Boolean(workspace.selectedOrgSlug),
  });
  const ordersQuery = useQuery({
    queryKey: [
      'subscriptions',
      'orders',
      workspace.selectedOrgSlug,
      page,
      PAGE_SIZE,
    ],
    queryFn: () =>
      appsSubscriptionsApiListOrders({ page, page_size: PAGE_SIZE }),
    enabled: Boolean(workspace.selectedOrgSlug),
  });

  const planNameByCode = useMemo(
    () =>
      Object.fromEntries(
        (plansQuery.data || []).map((plan) => [plan.code, plan.name]),
      ),
    [plansQuery.data],
  );
  const orders = ordersQuery.data?.items || [];
  const total = ordersQuery.data?.total || 0;

  const checkoutMutation = useMutation({
    mutationFn: (orderNo: string) =>
      appsSubscriptionsApiCheckoutOrder({ order_no: orderNo }),
    onSuccess: (order) => {
      if (!order.payment?.checkout?.code_url) {
        message.error('支付二维码获取失败，请稍后重试。');
        return;
      }
      setCheckoutOrder(order);
    },
  });
  const refreshMutation = useMutation({
    mutationFn: (orderNo: string) =>
      appsSubscriptionsApiRefreshOrderPayment({ order_no: orderNo }),
    onSuccess: async (order) => {
      await queryClient.invalidateQueries({
        queryKey: ['subscriptions', 'orders', workspace.selectedOrgSlug],
      });
      if (order.status === 'paid') {
        setCheckoutOrder(undefined);
        message.success('支付已确认，套餐权益已生效。');
      } else {
        setCheckoutOrder(order);
        message.info('暂未查询到支付成功结果，请稍后再试。');
      }
    },
  });
  const cancelMutation = useMutation({
    mutationFn: cancelSubscriptionOrder,
    onSuccess: async () => {
      setCheckoutOrder(undefined);
      await queryClient.invalidateQueries({
        queryKey: ['subscriptions', 'orders', workspace.selectedOrgSlug],
      });
      message.success('订单已取消。');
    },
  });

  const continuePayment = (order: API.SaaSOrderOut) => {
    const codeUrl = order.payment?.checkout?.code_url;
    if (codeUrl) {
      setCheckoutOrder(order);
      return;
    }
    checkoutMutation.mutate(order.order_no);
  };

  const orderColumns = useMemo<TableColumnsType<API.SaaSOrderOut>>(
    () => [
      {
        title: '订单',
        dataIndex: 'order_no',
        width: 300,
        fixed: 'left',
        render: (orderNo: string, record) => (
          <div className={styles.orderCell}>
            <span className={styles.orderType}>
              {ORDER_TYPE_LABELS[record.order_type] || record.order_type}
            </span>
            <Typography.Text
              className={styles.orderNo}
              copyable={{ text: orderNo }}
              ellipsis={{ tooltip: orderNo }}
            >
              {orderNo}
            </Typography.Text>
          </div>
        ),
      },
      {
        title: '购买套餐',
        dataIndex: 'target_plan_code',
        width: 200,
        render: (code: string, record) => (
          <div className={styles.orderCell}>
            <Typography.Text strong>
              {planNameByCode[code] || code}
            </Typography.Text>
            <Tag variant="filled" className={styles.cycleTag}>
              {billingCycleLabel(record.billing_cycle)}
            </Tag>
          </div>
        ),
      },
      {
        title: '实付金额',
        dataIndex: 'payable_amount',
        width: 180,
        align: 'right',
        render: (amount: number, record) => (
          <div className={styles.orderCell}>
            <span className={styles.amount}>{formatAmount(amount)}</span>
            {record.credit_amount > 0 && (
              <span className={styles.originalAmount}>
                原价 {formatAmount(record.list_amount)}
              </span>
            )}
          </div>
        ),
      },
      {
        title: '订单状态',
        dataIndex: 'status',
        width: 220,
        align: 'center',
        render: (status: string, record) => {
          const meta = ORDER_STATUS_META[status] || { label: status };
          return (
            <div className={styles.orderCell}>
              <div className={styles.paymentMeta}>
                <Tag color={meta.color} variant="filled">
                  {meta.label}
                </Tag>
                {record.refund_status !== 'none' && (
                  <Tag
                    color="purple"
                    variant="filled"
                    className={styles.refundTag}
                  >
                    {REFUND_STATUS_LABELS[record.refund_status] ||
                      record.refund_status}
                  </Tag>
                )}
              </div>
              <Typography.Text type="secondary">
                {record.close_reason
                  ? CLOSE_REASON_LABELS[record.close_reason] ||
                    record.close_reason
                  : status === 'paid'
                    ? `支付于 ${formatDateTime(record.paid_at)}`
                    : `创建于 ${formatDateTime(record.created_at)}`}
              </Typography.Text>
              {record.payment?.provider_trade_no ? (
                <Typography.Text type="secondary" copyable>
                  微信交易号 {String(record.payment.provider_trade_no)}
                </Typography.Text>
              ) : null}
            </div>
          );
        },
      },
      {
        title: '操作',
        dataIndex: 'actions',
        width: 190,
        align: 'center',
        render: (_value, record) =>
          canManageSubscriptions && record.status === 'pending_payment' ? (
            <Space size={4} wrap>
              <Button
                type="link"
                size="small"
                icon={<WechatOutlined />}
                loading={
                  checkoutMutation.isPending &&
                  checkoutMutation.variables === record.order_no
                }
                onClick={() => continuePayment(record)}
              >
                继续支付
              </Button>
              <Popconfirm
                title="确认取消该订单吗？"
                description="取消后当前支付二维码将失效。"
                okText="取消订单"
                cancelText="返回"
                onConfirm={() => cancelMutation.mutateAsync(record.order_no)}
              >
                <Button type="link" size="small" danger>
                  取消订单
                </Button>
              </Popconfirm>
            </Space>
          ) : record.status === 'paid' ? (
            <span className={styles.paidStatus}>
              <CheckCircleOutlined />
              已完成
            </span>
          ) : (
            <Typography.Text type="secondary">无需操作</Typography.Text>
          ),
      },
    ],
    [
      canManageSubscriptions,
      cancelMutation,
      checkoutMutation,
      planNameByCode,
      styles,
    ],
  );

  const emptyDescription = ordersQuery.isError
    ? '订单记录加载失败，请稍后重试'
    : '暂无套餐订单';

  return (
    <TenantSelectionGuard title={false}>
      <div className={styles.page}>
        <Card className={styles.recordsCard} loading={ordersQuery.isLoading}>
          <div className={styles.recordsHeader}>
            <div className={styles.headerTitleRow}>
              <span className={styles.headerIcon}>
                <FileTextOutlined />
              </span>
              <div>
                <Typography.Title level={4} className={styles.headerTitle}>
                  套餐订单中心
                </Typography.Title>
                <Typography.Paragraph className={styles.headerDescription}>
                  {canManageSubscriptions
                    ? '查看全部购买状态，继续未完成支付，并管理开票申请。'
                    : '查看全部购买状态、支付凭据和开票进度。'}
                </Typography.Paragraph>
              </div>
            </div>
            <div className={styles.headerActions}>
              <span className={styles.paidSummary}>
                <FileTextOutlined />
                全部订单
                <span className={styles.summaryCount}>
                  {total.toLocaleString('zh-CN')} 笔
                </span>
              </span>
              <Button
                type="text"
                className={styles.backButton}
                icon={<ArrowLeftOutlined />}
                aria-label="返回套餐管理"
                onClick={() => history.push(SPACE_PATHS.subscription)}
              >
                返回套餐管理
              </Button>
            </div>
          </div>

          <div className={styles.desktopOrders}>
            <Table<API.SaaSOrderOut>
              rowKey="order_no"
              dataSource={orders}
              columns={orderColumns}
              pagination={{
                ...fixedPagePagination(
                  ordersQuery.data?.page || page,
                  ordersQuery.data?.page_size || PAGE_SIZE,
                  total,
                  setPage,
                ),
                hideOnSinglePage: true,
              }}
              scroll={{ x: 1050 }}
              locale={{ emptyText: emptyDescription }}
            />
          </div>

          <div className={styles.mobileOrders}>
            {orders.length === 0 ? (
              <div className={styles.emptyState}>
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={emptyDescription}
                />
              </div>
            ) : (
              orders.map((order) => (
                <div className={styles.mobileOrderItem} key={order.order_no}>
                  <div className={styles.mobileOrderHeader}>
                    <div className={styles.orderCell}>
                      <Typography.Text strong>
                        {planNameByCode[order.target_plan_code] ||
                          order.target_plan_code}
                      </Typography.Text>
                      <Tag variant="filled" className={styles.cycleTag}>
                        {billingCycleLabel(order.billing_cycle)}
                      </Tag>
                    </div>
                    <span className={styles.amount}>
                      {formatAmount(order.payable_amount)}
                    </span>
                  </div>
                  <div className={styles.mobileOrderMeta}>
                    <div className={styles.mobileOrderFact}>
                      <span className={styles.mobileOrderLabel}>订单类型</span>
                      <span className={styles.orderType}>
                        {ORDER_TYPE_LABELS[order.order_type] ||
                          order.order_type}
                      </span>
                    </div>
                    <div className={styles.mobileOrderFact}>
                      <span className={styles.mobileOrderLabel}>订单状态</span>
                      <Tag
                        color={ORDER_STATUS_META[order.status]?.color}
                        variant="filled"
                        className={styles.cycleTag}
                      >
                        {ORDER_STATUS_META[order.status]?.label || order.status}
                      </Tag>
                    </div>
                    <div className={styles.mobileOrderFact}>
                      <span className={styles.mobileOrderLabel}>订单号</span>
                      <Typography.Text
                        className={styles.orderNo}
                        copyable={{ text: order.order_no }}
                        ellipsis={{ tooltip: order.order_no }}
                      >
                        {order.order_no}
                      </Typography.Text>
                    </div>
                    {order.refund_status !== 'none' && (
                      <div className={styles.mobileOrderFact}>
                        <span className={styles.mobileOrderLabel}>
                          退款状态
                        </span>
                        <Tag
                          color="purple"
                          variant="filled"
                          className={styles.refundTag}
                        >
                          {REFUND_STATUS_LABELS[order.refund_status] ||
                            order.refund_status}
                        </Tag>
                      </div>
                    )}
                  </div>
                  {canManageSubscriptions &&
                  order.status === 'pending_payment' ? (
                    <Space className="mt-4" wrap>
                      <Button
                        type="primary"
                        size="small"
                        icon={<WechatOutlined />}
                        onClick={() => continuePayment(order)}
                      >
                        继续支付
                      </Button>
                      <Popconfirm
                        title="确认取消该订单吗？"
                        okText="取消订单"
                        cancelText="返回"
                        onConfirm={() =>
                          cancelMutation.mutateAsync(order.order_no)
                        }
                      >
                        <Button size="small" danger>
                          取消订单
                        </Button>
                      </Popconfirm>
                    </Space>
                  ) : null}
                </div>
              ))
            )}
            {total > PAGE_SIZE && (
              <div className={styles.mobilePagination}>
                <Pagination
                  current={ordersQuery.data?.page || page}
                  pageSize={ordersQuery.data?.page_size || PAGE_SIZE}
                  total={total}
                  showSizeChanger={false}
                  responsive
                  showLessItems
                  onChange={setPage}
                />
              </div>
            )}
          </div>
        </Card>
        <div className="mt-4">
          <InvoiceManager
            orders={orders}
            planNameByCode={planNameByCode}
            selectedOrgSlug={workspace.selectedOrgSlug}
            canManage={canManageSubscriptions}
          />
        </div>
        <Modal
          title="微信扫码支付"
          open={Boolean(checkoutOrder)}
          footer={null}
          width={400}
          centered
          destroyOnHidden
          onCancel={() => setCheckoutOrder(undefined)}
        >
          {checkoutMutation.isError || refreshMutation.isError ? (
            <Alert
              className="mb-4"
              type="error"
              showIcon
              title="支付状态处理失败，请稍后重试。"
            />
          ) : null}
          <div className="flex flex-col items-center gap-4 py-2">
            {checkoutOrder?.payment?.checkout?.code_url ? (
              <img
                alt="微信支付二维码"
                className="h-52 w-52"
                src={`/qr/?data=${encodeURIComponent(String(checkoutOrder.payment.checkout.code_url))}`}
              />
            ) : null}
            <Typography.Text strong>
              {checkoutOrder ? formatAmount(checkoutOrder.payable_amount) : '—'}
            </Typography.Text>
            <Typography.Text type="secondary">
              二维码有效期至{' '}
              {formatDateTime(
                checkoutOrder?.payment?.expires_at || checkoutOrder?.expires_at,
              )}
            </Typography.Text>
            <Button
              type="primary"
              block
              icon={<ReloadOutlined />}
              loading={refreshMutation.isPending}
              onClick={() => {
                if (checkoutOrder) {
                  refreshMutation.mutate(checkoutOrder.order_no);
                }
              }}
            >
              我已支付，刷新状态
            </Button>
            <Popconfirm
              title="确认取消该订单吗？"
              description="取消后当前支付二维码将失效。"
              okText="取消订单"
              cancelText="继续支付"
              onConfirm={() =>
                checkoutOrder
                  ? cancelMutation.mutateAsync(checkoutOrder.order_no)
                  : undefined
              }
            >
              <Button block danger icon={<CloseCircleOutlined />}>
                取消订单
              </Button>
            </Popconfirm>
          </div>
        </Modal>
      </div>
    </TenantSelectionGuard>
  );
};

export default SubscriptionOrdersPage;
