import { useMutation, useQuery } from '@tanstack/react-query';
import { Alert, Button, Card, Col, Form, Input, Modal, Row, Space, Statistic, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import React, { useMemo, useState } from 'react';
import { AdminToolbar, adminTableScroll, fullWidthStyle, ResponsiveActions } from '@/pages/_shared/adminLayout';
import {
  appsWalletApiAdminWithdrawals,
  appsWalletApiPayoutWithdrawal,
  appsWalletApiReviewWithdrawal,
} from '@/services/openapi/walletAdmin';
import { appsWalletApiReconcile, appsWalletApiRetryWithdrawal } from '@/services/openapi/walletInternal';
import { IdempotencyFormItem, JsonText, PayoutModal, formatWalletAmount, walletQueryKeys } from '../shared';

type ReviewState = { withdrawal: API.WithdrawalOut; approved: boolean } | null;
type PayoutState = { withdrawal: API.WithdrawalOut; mode: 'payout' | 'retry' } | null;

type GovernanceSignal = {
  key: string;
  title: string;
  emphasis: string;
  summary: string;
  description: string;
  actionLabel: string;
  actionHref: string;
};

type WithdrawalInsight = API.WithdrawalOut & {
  status_label: string;
  status_color: string;
  governance_label: string;
  governance_summary: string;
  operating_label: string;
  operating_summary: string;
  is_review_pending: boolean;
  is_ready_for_payout: boolean;
  is_paying: boolean;
  is_retry_needed: boolean;
  is_closed: boolean;
};

const sectionStyle: React.CSSProperties = {
  padding: 20,
  border: '1px solid var(--ant-color-border-secondary)',
  borderRadius: 8,
  background: 'var(--ant-color-fill-quaternary)',
};

const overviewTileStyle: React.CSSProperties = {
  height: '100%',
  padding: 16,
  borderRadius: 8,
  border: '1px solid var(--ant-color-border-secondary)',
  background: 'var(--ant-color-bg-container)',
};

function buildWithdrawalInsight(withdrawal: API.WithdrawalOut): WithdrawalInsight {
  switch (withdrawal.status) {
    case 'pending_review':
      return {
        ...withdrawal,
        status_label: '待审核',
        status_color: 'gold',
        governance_label: '审核待处理',
        governance_summary: '申请仍处于冻结待审核阶段，当前最重要的是确认资料、金额和风控判断。',
        operating_label: '优先审核',
        operating_summary: '决定是通过进入代付，还是驳回并把资金退回可用余额。',
        is_review_pending: true,
        is_ready_for_payout: false,
        is_paying: false,
        is_retry_needed: false,
        is_closed: false,
      };
    case 'approved':
      return {
        ...withdrawal,
        status_label: '待打款',
        status_color: 'blue',
        governance_label: '审核已通过',
        governance_summary: '申请已经通过审核，但还没有发起真实代付，容易在这里形成出款积压。',
        operating_label: '发起代付',
        operating_summary: '补齐渠道与商户单号后推进出款，避免申请长期停留在已通过状态。',
        is_review_pending: false,
        is_ready_for_payout: true,
        is_paying: false,
        is_retry_needed: false,
        is_closed: false,
      };
    case 'paying':
      return {
        ...withdrawal,
        status_label: '打款中',
        status_color: 'cyan',
        governance_label: '等待渠道回调',
        governance_summary: '代付已发起，当前重点不是再次操作，而是确认回调和最终状态是否按时落账。',
        operating_label: '跟踪回调',
        operating_summary: '优先核查长时间未结束的打款单，避免重复发起代付。',
        is_review_pending: false,
        is_ready_for_payout: false,
        is_paying: true,
        is_retry_needed: false,
        is_closed: false,
      };
    case 'failed':
      return {
        ...withdrawal,
        status_label: '打款失败',
        status_color: 'red',
        governance_label: '失败待重试',
        governance_summary: '渠道已经反馈失败，这类申请要先查失败原因，再决定是否重试代付。',
        operating_label: '重试代付',
        operating_summary: '不要盲目重试，先确认失败原因和余额回流状态是否解释清楚。',
        is_review_pending: false,
        is_ready_for_payout: false,
        is_paying: false,
        is_retry_needed: true,
        is_closed: false,
      };
    case 'rejected':
      return {
        ...withdrawal,
        status_label: '已驳回',
        status_color: 'default',
        governance_label: '审核已退回',
        governance_summary: '申请已被驳回，关注点从出款动作转为驳回理由是否足够支持补资料和复提。',
        operating_label: '检查驳回理由',
        operating_summary: '确认驳回原因能否被前台用户理解，并检查资金是否已经回流可用余额。',
        is_review_pending: false,
        is_ready_for_payout: false,
        is_paying: false,
        is_retry_needed: false,
        is_closed: true,
      };
    case 'cancelled':
      return {
        ...withdrawal,
        status_label: '已撤销',
        status_color: 'default',
        governance_label: '用户已撤回',
        governance_summary: '申请已由用户主动撤销，这条记录主要保留用于审计和回溯。',
        operating_label: '保留审计记录',
        operating_summary: '确认撤销后余额已解冻即可，不需要再进入代付链路。',
        is_review_pending: false,
        is_ready_for_payout: false,
        is_paying: false,
        is_retry_needed: false,
        is_closed: true,
      };
    case 'paid':
      return {
        ...withdrawal,
        status_label: '已打款',
        status_color: 'green',
        governance_label: '出款已完成',
        governance_summary: '资金已完成打款，后续重点转到对账一致性和到账确认。',
        operating_label: '对账确认',
        operating_summary: '重点检查到账、渠道回执和内部台账是否一致。',
        is_review_pending: false,
        is_ready_for_payout: false,
        is_paying: false,
        is_retry_needed: false,
        is_closed: true,
      };
    default:
      return {
        ...withdrawal,
        status_label: withdrawal.status,
        status_color: 'default',
        governance_label: '状态待识别',
        governance_summary: '这条申请使用了未分类状态，建议补充统一状态语义后再进一步治理。',
        operating_label: '补齐状态语义',
        operating_summary: '先明确它属于审核、代付还是已收口阶段，再安排对应动作。',
        is_review_pending: false,
        is_ready_for_payout: false,
        is_paying: false,
        is_retry_needed: false,
        is_closed: false,
      };
  }
}

const WalletWithdrawalsPage: React.FC = () => {
  const [page, setPage] = useState(1);
  const [reviewState, setReviewState] = useState<ReviewState>(null);
  const [payoutState, setPayoutState] = useState<PayoutState>(null);
  const [reviewForm] = Form.useForm<API.WithdrawalReviewIn>();
  const [payoutForm] = Form.useForm<API.PayoutCreateIn>();
  const [reconcileDiffCount, setReconcileDiffCount] = useState<number | null>(null);

  const withdrawalsQuery = useQuery({
    queryKey: walletQueryKeys.withdrawals(page),
    queryFn: () => appsWalletApiAdminWithdrawals({ page, page_size: 10 }),
  });

  const reviewMutation = useMutation({
    mutationFn: ({ withdrawal, payload }: { withdrawal: API.WithdrawalOut; payload: API.WithdrawalReviewIn }) =>
      appsWalletApiReviewWithdrawal({ withdrawal_id: withdrawal.id }, payload),
    onSuccess: async () => {
      setReviewState(null);
      reviewForm.resetFields();
      await withdrawalsQuery.refetch();
    },
  });
  const payoutMutation = useMutation({
    mutationFn: ({ withdrawal, payload }: { withdrawal: API.WithdrawalOut; payload: API.PayoutCreateIn }) =>
      appsWalletApiPayoutWithdrawal({ withdrawal_id: withdrawal.id }, payload),
    onSuccess: async () => {
      setPayoutState(null);
      payoutForm.resetFields();
      await withdrawalsQuery.refetch();
    },
  });
  const retryMutation = useMutation({
    mutationFn: ({ withdrawal, payload }: { withdrawal: API.WithdrawalOut; payload: API.WithdrawalRetryIn }) =>
      appsWalletApiRetryWithdrawal({ withdrawal_id: withdrawal.id }, payload),
    onSuccess: async () => {
      setPayoutState(null);
      payoutForm.resetFields();
      await withdrawalsQuery.refetch();
    },
  });
  const reconcileMutation = useMutation({
    mutationFn: () => appsWalletApiReconcile(),
    onSuccess: (result) => {
      setReconcileDiffCount(result.diff_count);
    },
  });

  const withdrawals = useMemo(() => (withdrawalsQuery.data?.items || []).map(buildWithdrawalInsight), [withdrawalsQuery.data?.items]);

  const pendingReviewCount = withdrawals.filter((item) => item.is_review_pending).length;
  const readyForPayoutCount = withdrawals.filter((item) => item.is_ready_for_payout).length;
  const payingCount = withdrawals.filter((item) => item.is_paying).length;
  const retryCount = withdrawals.filter((item) => item.is_retry_needed).length;
  const closedCount = withdrawals.filter((item) => item.is_closed).length;

  const closureSignals = useMemo<GovernanceSignal[]>(
    () => [
      {
        key: 'review',
        title: '审核积压',
        emphasis: pendingReviewCount ? `${pendingReviewCount} 条申请待审核` : '审核压力可控',
        summary: pendingReviewCount
          ? '待审核申请仍占用冻结资金，说明审核链路还没有把资金下一步去向讲清楚。'
          : '当前没有待审核申请，审核链路相对顺畅。',
        description: '审核页的第一职责不是点按钮，而是尽快决定冻结资金是继续出款还是回流钱包。',
        actionLabel: '查看钱包账户',
        actionHref: '/dashboard/wallet-management/accounts',
      },
      {
        key: 'payout',
        title: '代付推进',
        emphasis: readyForPayoutCount || payingCount ? `${readyForPayoutCount + payingCount} 条申请待推进` : '代付推进平稳',
        summary: readyForPayoutCount
          ? '已通过但未打款的申请会形成经营积压，需要尽快发起代付。'
          : payingCount
            ? '当前主要风险在打款中申请的回调时效和状态滞留。'
            : '当前代付链路没有明显积压。',
        description: '审核通过不等于流程结束，真正的经营风险通常出现在代付未发起或状态长期卡住。',
        actionLabel: '查看冻结账户',
        actionHref: '/dashboard/wallet-management/accounts',
      },
      {
        key: 'retry',
        title: '失败重试',
        emphasis: retryCount ? `${retryCount} 条申请待重试` : '失败申请已收口',
        summary: retryCount
          ? '失败申请如果不解释清楚失败原因，会在账户余额、用户预期和人工处理上同时留下尾巴。'
          : '当前没有失败待重试申请，失败处理链路较干净。',
        description: '重试不是默认动作，先核对失败原因和余额回流，再决定是否重新出款。',
        actionLabel: '查看提现管理',
        actionHref: '/dashboard/wallet-management/withdrawals',
      },
      {
        key: 'closure',
        title: '收口结果',
        emphasis: closedCount ? `${closedCount} 条申请已收口` : '收口记录较少',
        summary: closedCount
          ? '已驳回、已撤销和已打款申请一起构成了提现治理的收口结果。'
          : '当前仍以处理中申请为主，后续要重点关注收口质量。',
        description: '成熟后台不仅要看申请进来了多少，更要看最后如何结束、是否能被解释。',
        actionLabel: '查看个人经营',
        actionHref: '/dashboard/personal-business/overview',
      },
    ],
    [closedCount, payingCount, pendingReviewCount, readyForPayoutCount, retryCount],
  );

  const columns: ColumnsType<WithdrawalInsight> = [
    { title: '申请 ID', dataIndex: 'id', width: 110 },
    {
      title: '当前状态',
      dataIndex: 'status_label',
      width: 220,
      render: (_value, record) => (
        <Space orientation="vertical" size={6}>
          <Tag color={record.status_color}>{record.status_label}</Tag>
          <Typography.Text type="secondary">{record.governance_summary}</Typography.Text>
        </Space>
      ),
    },
    {
      title: '资金结果',
      dataIndex: 'amount',
      width: 220,
      render: (_value, record) => (
        <Space orientation="vertical" size={4}>
          <Typography.Text>{`申请金额 ${formatWalletAmount(record.amount)}`}</Typography.Text>
          <Typography.Text type="secondary">{`手续费 ${formatWalletAmount(record.fee_amount)} / 到账 ${formatWalletAmount(record.net_amount)}`}</Typography.Text>
        </Space>
      ),
    },
    {
      title: '收款快照',
      dataIndex: 'payee_account_snapshot',
      width: 260,
      render: (value) => <JsonText value={value} />,
    },
    {
      title: '生命周期',
      dataIndex: 'created_at',
      width: 240,
      render: (_value, record) => (
        <Space orientation="vertical" size={4}>
          <Typography.Text>{`申请 ${dayjs(record.created_at).format('YYYY-MM-DD HH:mm')}`}</Typography.Text>
          <Typography.Text type="secondary">{record.reviewed_at ? `审核 ${dayjs(record.reviewed_at).format('YYYY-MM-DD HH:mm')}` : '审核未完成'}</Typography.Text>
        </Space>
      ),
    },
    {
      title: '执行建议',
      dataIndex: 'operating_label',
      width: 240,
      render: (_value, record) => (
        <Space orientation="vertical" size={6}>
          <Tag color={record.status_color}>{record.operating_label}</Tag>
          <Typography.Text type="secondary">{record.operating_summary}</Typography.Text>
        </Space>
      ),
    },
    {
      title: '操作',
      dataIndex: 'actions',
      width: 220,
      render: (_value, record) => (
        <ResponsiveActions>
          {record.is_review_pending ? (
            <>
              <a
                onClick={() => {
                  reviewForm.setFieldsValue({ approved: true, reason: '', idempotency_key: '' });
                  setReviewState({ withdrawal: record, approved: true });
                }}
              >
                通过
              </a>
              <a
                onClick={() => {
                  reviewForm.setFieldsValue({ approved: false, reason: record.reject_reason || '', idempotency_key: '' });
                  setReviewState({ withdrawal: record, approved: false });
                }}
              >
                驳回
              </a>
            </>
          ) : null}
          {record.is_ready_for_payout ? (
            <a
              onClick={() => {
                payoutForm.resetFields();
                setPayoutState({ withdrawal: record, mode: 'payout' });
              }}
            >
              发起代付
            </a>
          ) : null}
          {record.is_retry_needed ? (
            <a
              onClick={() => {
                payoutForm.resetFields();
                setPayoutState({ withdrawal: record, mode: 'retry' });
              }}
            >
              重试代付
            </a>
          ) : null}
          {!record.is_review_pending && !record.is_ready_for_payout && !record.is_retry_needed ? <Typography.Text type="secondary">已收口</Typography.Text> : null}
        </ResponsiveActions>
      ),
    },
  ];

  return (
    <Space orientation="vertical" size={16} style={fullWidthStyle}>
      <Card
        title="提现审核"
        extra={
          <AdminToolbar>
            <Button loading={reconcileMutation.isPending} onClick={() => void reconcileMutation.mutateAsync()}>
              执行对账
            </Button>
          </AdminToolbar>
        }
      >
        {reconcileDiffCount !== null ? (
          <Alert
            type={reconcileDiffCount > 0 ? 'warning' : 'success'}
            showIcon
            title={reconcileDiffCount > 0 ? `本次对账发现 ${reconcileDiffCount} 条差异，请优先核查失败代付和状态滞留申请。` : '本次对账未发现差异，提现台账与内部状态一致。'}
            style={{ marginBottom: 16 }}
          />
        ) : null}

        <div style={sectionStyle}>
          <Typography.Text strong>提现治理概览</Typography.Text>
          <Row gutter={[12, 12]} style={{ marginTop: 16 }}>
            <Col xs={24} sm={12} xl={6}>
              <div style={overviewTileStyle}>
                <Statistic title="当前申请" value={withdrawals.length} />
                <Typography.Text type="secondary">当前页已纳入治理视角的提现申请总数。</Typography.Text>
              </div>
            </Col>
            <Col xs={24} sm={12} xl={6}>
              <div style={overviewTileStyle}>
                <Statistic title="待审核申请" value={pendingReviewCount} />
                <Typography.Text type="secondary">这部分资金仍然冻结在钱包内，尚未明确下一步去向。</Typography.Text>
              </div>
            </Col>
            <Col xs={24} sm={12} xl={6}>
              <div style={overviewTileStyle}>
                <Statistic title="待打款申请" value={readyForPayoutCount + payingCount} />
                <Typography.Text type="secondary">已通过或打款中的申请，决定了当前出款推进压力。</Typography.Text>
              </div>
            </Col>
            <Col xs={24} sm={12} xl={6}>
              <div style={overviewTileStyle}>
                <Statistic title="失败待重试" value={retryCount} />
                <Typography.Text type="secondary">失败申请要先解释原因，再决定是否进入重试动作。</Typography.Text>
              </div>
            </Col>
          </Row>
        </div>

        <div style={{ ...sectionStyle, marginTop: 16 }}>
          <Typography.Text strong>当前提现执行面</Typography.Text>
          <Row gutter={[12, 12]} style={{ marginTop: 16 }}>
            <Col xs={24} md={12} xl={6}>
              <div style={overviewTileStyle}>
                <Space orientation="vertical" size={8}>
                  <Space wrap size={[8, 8]}>
                    <Typography.Text strong>待审核申请</Typography.Text>
                    <Tag color={pendingReviewCount ? 'gold' : 'default'}>{pendingReviewCount ? `${pendingReviewCount} 条待处理` : '暂无积压'}</Tag>
                  </Space>
                  <Typography.Text>这一步决定冻结资金是继续进入出款链路，还是回流到用户可用余额。</Typography.Text>
                  <a href="/dashboard/wallet-management/accounts">查看钱包账户</a>
                </Space>
              </div>
            </Col>
            <Col xs={24} md={12} xl={6}>
              <div style={overviewTileStyle}>
                <Space orientation="vertical" size={8}>
                  <Space wrap size={[8, 8]}>
                    <Typography.Text strong>待打款申请</Typography.Text>
                    <Tag color={readyForPayoutCount ? 'blue' : 'default'}>{readyForPayoutCount ? `${readyForPayoutCount} 条待发起` : '推进正常'}</Tag>
                  </Space>
                  <Typography.Text>审核通过后若迟迟不发起代付，会让流程停在最容易积压的中间状态。</Typography.Text>
                  <a href="/dashboard/wallet-management/withdrawals">推进代付</a>
                </Space>
              </div>
            </Col>
            <Col xs={24} md={12} xl={6}>
              <div style={overviewTileStyle}>
                <Space orientation="vertical" size={8}>
                  <Space wrap size={[8, 8]}>
                    <Typography.Text strong>打款中申请</Typography.Text>
                    <Tag color={payingCount ? 'cyan' : 'default'}>{payingCount ? `${payingCount} 条待回调` : '无滞留'}</Tag>
                  </Space>
                  <Typography.Text>这类申请的核心不是重复操作，而是跟踪渠道回调是否及时、状态是否同步。</Typography.Text>
                  <a href="/dashboard/wallet-management/accounts">核对冻结资金</a>
                </Space>
              </div>
            </Col>
            <Col xs={24} md={12} xl={6}>
              <div style={overviewTileStyle}>
                <Space orientation="vertical" size={8}>
                  <Space wrap size={[8, 8]}>
                    <Typography.Text strong>失败待重试</Typography.Text>
                    <Tag color={retryCount ? 'red' : 'default'}>{retryCount ? `${retryCount} 条待判断` : '失败已收口'}</Tag>
                  </Space>
                  <Typography.Text>先解释失败原因和余额回流，再决定是否重试，比盲目重发更符合企业后台习惯。</Typography.Text>
                  <a href="/dashboard/wallet-management/accounts">核查余额回流</a>
                </Space>
              </div>
            </Col>
          </Row>
        </div>

        <div style={{ ...sectionStyle, marginTop: 16 }}>
          <Typography.Text strong>闭环信号</Typography.Text>
          <Row gutter={[12, 12]} style={{ marginTop: 16 }}>
            {closureSignals.map((signal) => (
              <Col key={signal.key} xs={24} sm={12} xl={6}>
                <div style={overviewTileStyle}>
                  <Space orientation="vertical" size={8}>
                    <Typography.Text strong>{signal.title}</Typography.Text>
                    <Tag color="blue">{signal.emphasis}</Tag>
                    <Typography.Text>{signal.summary}</Typography.Text>
                    <Typography.Text type="secondary">{signal.description}</Typography.Text>
                    <a href={signal.actionHref}>{signal.actionLabel}</a>
                  </Space>
                </div>
              </Col>
            ))}
          </Row>
        </div>

        <div style={{ ...sectionStyle, marginTop: 16 }}>
          <Space orientation="vertical" size={12} style={fullWidthStyle}>
            <div>
              <Typography.Text strong>提现治理台账</Typography.Text>
              <Typography.Paragraph type="secondary" style={{ marginBottom: 0, marginTop: 8 }}>
                把审核、代付、失败重试和最终收口都放到同一张台账里看，避免运营只知道点动作，却不知道这笔钱现在处在哪个阶段。
              </Typography.Paragraph>
            </div>
            <Table
              rowKey="id"
              loading={withdrawalsQuery.isLoading}
              columns={columns}
              dataSource={withdrawals}
              scroll={adminTableScroll}
              pagination={{
                current: withdrawalsQuery.data?.page || page,
                pageSize: withdrawalsQuery.data?.page_size || 10,
                total: withdrawalsQuery.data?.total || 0,
                onChange: setPage,
              }}
            />
          </Space>
        </div>
      </Card>

      <Modal
        title={reviewState?.approved ? '通过提现' : '驳回提现'}
        open={Boolean(reviewState)}
        confirmLoading={reviewMutation.isPending}
        onCancel={() => setReviewState(null)}
        onOk={async () => {
          const values = await reviewForm.validateFields();
          if (reviewState) {
            await reviewMutation.mutateAsync({
              withdrawal: reviewState.withdrawal,
              payload: { ...values, approved: reviewState.approved, reason: values.reason || '' },
            });
          }
        }}
      >
        <Space orientation="vertical" size={12} style={fullWidthStyle}>
          <Alert
            type={reviewState?.approved ? 'info' : 'warning'}
            showIcon
            title={reviewState?.approved ? '通过后申请会进入待打款阶段，下一步要尽快发起代付。' : '驳回会把冻结资金退回可用余额，请确保原因能支撑后续补资料或复提。'}
          />
          <Form form={reviewForm} layout="vertical">
            <Form.Item label="原因" name="reason">
              <Input placeholder={reviewState?.approved ? '可留空，或补充审核说明。' : '请填写驳回原因。'} />
            </Form.Item>
            <IdempotencyFormItem />
          </Form>
        </Space>
      </Modal>

      <PayoutModal
        title={payoutState?.mode === 'retry' ? '重试代付' : '发起代付'}
        open={Boolean(payoutState)}
        loading={payoutMutation.isPending || retryMutation.isPending}
        form={payoutForm}
        onCancel={() => setPayoutState(null)}
        onOk={async () => {
          const values = await payoutForm.validateFields();
          const payload = { ...values, request_payload: {} };
          if (payoutState?.mode === 'retry') {
            await retryMutation.mutateAsync({ withdrawal: payoutState.withdrawal, payload });
          } else if (payoutState) {
            await payoutMutation.mutateAsync({ withdrawal: payoutState.withdrawal, payload });
          }
        }}
      />
    </Space>
  );
};

export default WalletWithdrawalsPage;
