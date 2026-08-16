import { useMutation, useQuery } from '@tanstack/react-query';
import { Button, Card, Col, Descriptions, message, Modal, Row, Space, Table, Typography } from 'antd';
import React, { useEffect, useMemo, useState } from 'react';
import {
  appsSubscriptionsApiCreateOrder,
  appsSubscriptionsApiCurrentSubscription,
  appsSubscriptionsApiGetOrder,
  appsSubscriptionsApiListOrders,
  appsSubscriptionsApiListPlans,
} from '@/services/openapi/subscriptions';
import { TenantSelectionGuard, useTenantWorkspace } from '../shared';

type Entitlement = {
  member_limit?: number | null;
  team_limit?: number | null;
  house_limit?: number | null;
  ends_at?: string | null;
};

type Usage = { member?: number; team?: number; house?: number };

function formatAmount(amount: number) {
  return `¥${(amount / 100).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`;
}

function formatLimit(used: number, limit?: number | null) {
  return `${used} / ${limit == null ? '不限' : limit}`;
}

function paymentStatusLabel(status: string) {
  return { pending_payment: '待支付', paid: '已支付', closed: '已关闭', payment_failed: '支付失败' }[status] || status;
}

const SubscriptionPage: React.FC = () => {
  const workspace = useTenantWorkspace();
  const [checkoutCodeUrl, setCheckoutCodeUrl] = useState<string>();
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutOrderNo, setCheckoutOrderNo] = useState<string>();
  const [completedOrderNo, setCompletedOrderNo] = useState<string>();
  const currentQuery = useQuery({ queryKey: ['subscriptions', 'current', workspace.selectedOrgSlug], queryFn: appsSubscriptionsApiCurrentSubscription, enabled: Boolean(workspace.selectedOrgSlug) });
  const plansQuery = useQuery({ queryKey: ['subscriptions', 'plans'], queryFn: appsSubscriptionsApiListPlans, enabled: Boolean(workspace.selectedOrgSlug) });
  const ordersQuery = useQuery({ queryKey: ['subscriptions', 'orders', workspace.selectedOrgSlug], queryFn: () => appsSubscriptionsApiListOrders({ page: 1, page_size: 10 }), enabled: Boolean(workspace.selectedOrgSlug) });
  const checkoutOrderQuery = useQuery({
    queryKey: ['subscriptions', 'order', workspace.selectedOrgSlug, checkoutOrderNo],
    queryFn: () => appsSubscriptionsApiGetOrder({ order_no: checkoutOrderNo || '' }),
    enabled: Boolean(checkoutOrderNo),
    refetchInterval: (query) => (query.state.data?.status === 'pending_payment' ? 2000 : false),
  });

  const purchaseMutation = useMutation({
    mutationFn: (payload: API.PurchaseOrderIn) => appsSubscriptionsApiCreateOrder(payload),
    onSuccess: async (order) => {
      const checkout = order.payment?.checkout as { code_url?: string } | undefined;
      setCheckoutCodeUrl(checkout?.code_url);
      setCheckoutOrderNo(order.order_no);
      if (checkout?.code_url) {
        setCheckoutOpen(true);
      } else {
        message.warning('订单已创建，但收银台尚未启用微信支付配置，请联系平台管理员后重新发起订单。');
      }
      await workspace.queryClient.invalidateQueries({ queryKey: ['subscriptions', 'orders', workspace.selectedOrgSlug] });
    },
  });

  useEffect(() => {
    if (checkoutOrderQuery.data?.status !== 'paid' || !checkoutOrderNo || checkoutOrderNo === completedOrderNo) return;
    setCompletedOrderNo(checkoutOrderNo);
    setCheckoutOpen(false);
    message.success('支付成功，套餐权益已开通。');
    void Promise.all([
      workspace.queryClient.invalidateQueries({ queryKey: ['subscriptions', 'current', workspace.selectedOrgSlug] }),
      workspace.queryClient.invalidateQueries({ queryKey: ['subscriptions', 'orders', workspace.selectedOrgSlug] }),
    ]);
  }, [checkoutOrderNo, checkoutOrderQuery.data?.status, completedOrderNo, workspace.queryClient, workspace.selectedOrgSlug]);

  const currentPlanCode = String(currentQuery.data?.plan?.code || 'free');
  const currentPlanOrder = useMemo(
    () => plansQuery.data?.find((plan) => plan.code === currentPlanCode)?.display_order ?? 0,
    [currentPlanCode, plansQuery.data],
  );
  const entitlement = (currentQuery.data?.entitlement || {}) as Entitlement;
  const usage = (currentQuery.data?.usage || {}) as Usage;
  const orders = ordersQuery.data?.items || [];

  return (
    <TenantSelectionGuard title="订阅与权益">
      <Space orientation="vertical" size={16} style={{ width: '100%' }}>
        <Card loading={currentQuery.isLoading} title={`当前套餐：${currentQuery.data?.plan?.name || '免费版'}`}>
          <Descriptions
            column={{ xs: 1, sm: 3 }}
            items={[
              { key: 'member', label: '成员', children: formatLimit(usage.member || 0, entitlement.member_limit) },
              { key: 'team', label: '团队', children: formatLimit(usage.team || 0, entitlement.team_limit) },
              { key: 'house', label: '房源', children: formatLimit(usage.house || 0, entitlement.house_limit) },
              { key: 'expiry', label: '有效期至', children: entitlement.ends_at ? new Date(entitlement.ends_at).toLocaleString('zh-CN') : '免费版常驻' },
            ]}
          />
        </Card>

        <Card loading={plansQuery.isLoading} title="选择套餐">
          <Row gutter={[16, 16]}>
            {(plansQuery.data || []).map((plan) => {
              const planEntitlement = (plan.entitlement || {}) as Entitlement;
              const lowerPlan = plan.display_order < currentPlanOrder;
              return (
                <Col key={plan.code} xs={24} md={12} xl={6}>
                  <Card size="small" title={plan.name}>
                    <Typography.Paragraph type="secondary">{plan.description || '按当前套餐权益使用服务。'}</Typography.Paragraph>
                    <Typography.Paragraph>
                      成员 {planEntitlement.member_limit ?? '不限'} · 团队 {planEntitlement.team_limit ?? '不限'} · 房源 {planEntitlement.house_limit ?? '不限'}
                    </Typography.Paragraph>
                    <Space orientation="vertical" style={{ width: '100%' }}>
                      {(plan.prices || []).map((price) => {
                        const billingCycle = String(price.billing_cycle);
                        const cycleLabel = billingCycle === 'year' ? '年付' : '月付';
                        return (
                          <Button
                            key={billingCycle}
                            block
                            disabled={plan.code === 'free' || lowerPlan}
                            loading={purchaseMutation.isPending}
                            onClick={() => purchaseMutation.mutate({ target_plan_code: plan.code, billing_cycle: billingCycle, payment_mode: 'native' })}
                          >
                            {lowerPlan ? '当前周期结束后可购买' : `开通 ${plan.name}（${cycleLabel}） ${formatAmount(Number(price.amount || 0))}`}
                          </Button>
                        );
                      })}
                    </Space>
                  </Card>
                </Col>
              );
            })}
          </Row>
        </Card>

        <Modal
          title="微信扫码支付"
          open={checkoutOpen}
          onCancel={() => setCheckoutOpen(false)}
          footer={<Button onClick={() => setCheckoutOpen(false)}>关闭</Button>}
          destroyOnHidden
        >
          <Typography.Paragraph type="secondary">请使用微信扫码完成支付，支付成功后会自动开通套餐权益。</Typography.Paragraph>
          {checkoutCodeUrl && <img alt="微信支付二维码" src={`/qr/?data=${encodeURIComponent(checkoutCodeUrl)}`} style={{ display: 'block', width: 220, height: 220, margin: '0 auto' }} />}
        </Modal>

        <Card loading={ordersQuery.isLoading} title="支付记录">
          <Table<API.SaaSOrderOut>
            rowKey="order_no"
            pagination={false}
            dataSource={orders}
            columns={[
              { title: '订单号', dataIndex: 'order_no', ellipsis: true },
              { title: '套餐', dataIndex: 'target_plan_code' },
              { title: '应付金额', dataIndex: 'payable_amount', render: (amount) => formatAmount(amount) },
              { title: '状态', dataIndex: 'status', render: paymentStatusLabel },
              { title: '创建时间', dataIndex: 'created_at', render: (value) => new Date(value).toLocaleString('zh-CN') },
            ]}
          />
        </Card>
      </Space>
    </TenantSelectionGuard>
  );
};

export default SubscriptionPage;
