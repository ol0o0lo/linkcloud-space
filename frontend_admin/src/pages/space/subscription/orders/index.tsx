import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { history } from '@umijs/max';
import type { TableColumnsType } from 'antd';
import { Button, Card, Empty, Pagination, Table, Tag, Typography } from 'antd';
import { createStyles } from 'antd-style';
import React, { useMemo, useState } from 'react';
import { fixedPagePagination } from '@/pages/_shared/adminLayout';
import {
  appsSubscriptionsApiListOrders,
  appsSubscriptionsApiListPlans,
} from '@/services/openapi/subscriptions';
import { SPACE_PATHS } from '@/utils/adminRouting';
import { TenantSelectionGuard, useTenantWorkspace } from '../../shared';

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
  const [page, setPage] = useState(1);

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
        title: '支付时间',
        dataIndex: 'paid_at',
        width: 240,
        align: 'center',
        render: (value: string | null, record) => (
          <div className={styles.orderCell}>
            <span className={styles.paymentTime}>
              {formatDateTime(value || record.created_at)}
            </span>
            <div className={styles.paymentMeta}>
              <span className={styles.paidStatus}>
                <CheckCircleOutlined />
                付款成功
              </span>
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
          </div>
        ),
      },
    ],
    [planNameByCode, styles],
  );

  const emptyDescription = ordersQuery.isError
    ? '订单记录加载失败，请稍后重试'
    : '暂无付款成功的套餐订单';

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
                  套餐购买记录
                </Typography.Title>
                <Typography.Paragraph className={styles.headerDescription}>
                  仅展示当前空间付款成功的购买、续费与升级订单。
                </Typography.Paragraph>
              </div>
            </div>
            <div className={styles.headerActions}>
              <span className={styles.paidSummary}>
                <CheckCircleOutlined />
                已付款订单
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
              scroll={{ x: 820 }}
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
                      <span className={styles.mobileOrderLabel}>支付时间</span>
                      <span>
                        {formatDateTime(order.paid_at || order.created_at)}
                      </span>
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
      </div>
    </TenantSelectionGuard>
  );
};

export default SubscriptionOrdersPage;
