import { useMutation, useQuery } from '@tanstack/react-query';
import { PageContainer } from '@ant-design/pro-components';
import {
  Alert,
  Button,
  Card,
  Form,
  Input,
  Modal,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import React, { useMemo, useState } from 'react';
import {
  AdminToolbar,
  adminTableScroll,
  fullWidthStyle,
  ResponsiveActions,
} from '@/pages/_shared/adminLayout';
import {
  appsWalletApiAdminWithdrawals,
  appsWalletApiPayoutWithdrawal,
  appsWalletApiReviewWithdrawal,
} from '@/services/openapi/walletAdmin';
import {
  appsWalletApiReconcile,
  appsWalletApiRetryWithdrawal,
} from '@/services/openapi/walletInternal';
import {
  IdempotencyFormItem,
  JsonText,
  PayoutModal,
  formatWalletAmount,
  walletQueryKeys,
} from '../shared';

type ReviewState = { withdrawal: API.WithdrawalOut; approved: boolean } | null;
type PayoutState = {
  withdrawal: API.WithdrawalOut;
  mode: 'payout' | 'retry';
} | null;

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

function buildWithdrawalInsight(
  withdrawal: API.WithdrawalOut,
): WithdrawalInsight {
  switch (withdrawal.status) {
    case 'pending_review':
      return {
        ...withdrawal,
        status_label: '待审核',
        status_color: 'gold',
        governance_label: '审核待处理',
        governance_summary:
          '申请仍处于冻结待审核阶段，当前最重要的是确认资料、金额和风控判断。',
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
        governance_summary:
          '申请已经通过审核，但还没有发起真实代付，容易在这里形成出款积压。',
        operating_label: '发起代付',
        operating_summary:
          '补齐渠道与商户单号后推进出款，避免申请长期停留在已通过状态。',
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
        governance_summary:
          '代付已发起，当前重点不是再次操作，而是确认回调和最终状态是否按时落账。',
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
        governance_summary:
          '渠道已经反馈失败，这类申请要先查失败原因，再决定是否重试代付。',
        operating_label: '重试代付',
        operating_summary:
          '不要盲目重试，先确认失败原因和余额回流状态是否解释清楚。',
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
        governance_summary:
          '申请已被驳回，关注点从出款动作转为驳回理由是否足够支持补资料和复提。',
        operating_label: '检查驳回理由',
        operating_summary:
          '确认驳回原因能否被前台用户理解，并检查资金是否已经回流可用余额。',
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
        governance_summary:
          '申请已由用户主动撤销，这条记录主要保留用于审计和回溯。',
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
        governance_summary:
          '资金已完成打款，后续重点转到对账一致性和到账确认。',
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
        governance_summary:
          '这条申请使用了未分类状态，建议补充统一状态语义后再进一步治理。',
        operating_label: '补齐状态语义',
        operating_summary:
          '先明确它属于审核、代付还是已收口阶段，再安排对应动作。',
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
  const [reconcileDiffCount, setReconcileDiffCount] = useState<number | null>(
    null,
  );

  const withdrawalsQuery = useQuery({
    queryKey: walletQueryKeys.withdrawals(page),
    queryFn: () => appsWalletApiAdminWithdrawals({ page, page_size: 10 }),
  });

  const reviewMutation = useMutation({
    mutationFn: ({
      withdrawal,
      payload,
    }: {
      withdrawal: API.WithdrawalOut;
      payload: API.WithdrawalReviewIn;
    }) =>
      appsWalletApiReviewWithdrawal({ withdrawal_id: withdrawal.id }, payload),
    onSuccess: async () => {
      setReviewState(null);
      reviewForm.resetFields();
      await withdrawalsQuery.refetch();
    },
  });
  const payoutMutation = useMutation({
    mutationFn: ({
      withdrawal,
      payload,
    }: {
      withdrawal: API.WithdrawalOut;
      payload: API.PayoutCreateIn;
    }) =>
      appsWalletApiPayoutWithdrawal({ withdrawal_id: withdrawal.id }, payload),
    onSuccess: async () => {
      setPayoutState(null);
      payoutForm.resetFields();
      await withdrawalsQuery.refetch();
    },
  });
  const retryMutation = useMutation({
    mutationFn: ({
      withdrawal,
      payload,
    }: {
      withdrawal: API.WithdrawalOut;
      payload: API.WithdrawalRetryIn;
    }) =>
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

  const withdrawals = useMemo(
    () => (withdrawalsQuery.data?.items || []).map(buildWithdrawalInsight),
    [withdrawalsQuery.data?.items],
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
          <Typography.Text type="secondary">
            {record.governance_summary}
          </Typography.Text>
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
          <Typography.Text type="secondary">
            {record.reviewed_at
              ? `审核 ${dayjs(record.reviewed_at).format('YYYY-MM-DD HH:mm')}`
              : '审核未完成'}
          </Typography.Text>
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
          <Typography.Text type="secondary">
            {record.operating_summary}
          </Typography.Text>
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
                  reviewForm.setFieldsValue({
                    approved: true,
                    reason: '',
                    idempotency_key: '',
                  });
                  setReviewState({ withdrawal: record, approved: true });
                }}
              >
                通过
              </a>
              <a
                onClick={() => {
                  reviewForm.setFieldsValue({
                    approved: false,
                    reason: record.reject_reason || '',
                    idempotency_key: '',
                  });
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
          {!record.is_review_pending &&
          !record.is_ready_for_payout &&
          !record.is_retry_needed ? (
            <Typography.Text type="secondary">已收口</Typography.Text>
          ) : null}
        </ResponsiveActions>
      ),
    },
  ];

  return (
    <PageContainer title="提现审核" subTitle="处理提现审核、代付和重试。">
      <Space orientation="vertical" size={16} style={fullWidthStyle}>
        <Card
          extra={
            <AdminToolbar>
              <Button
                loading={reconcileMutation.isPending}
                onClick={() => void reconcileMutation.mutateAsync()}
              >
                执行对账
              </Button>
            </AdminToolbar>
          }
        >
          {reconcileDiffCount !== null ? (
            <Alert
              type={reconcileDiffCount > 0 ? 'warning' : 'success'}
              showIcon
              title={
                reconcileDiffCount > 0
                  ? `本次对账发现 ${reconcileDiffCount} 条差异，请优先核查失败代付和状态滞留申请。`
                  : '本次对账未发现差异，提现台账与内部状态一致。'
              }
              style={{ marginBottom: 16 }}
            />
          ) : null}

          <div style={sectionStyle}>
            <Space orientation="vertical" size={12} style={fullWidthStyle}>
              <div>
                <Typography.Text strong>提现列表</Typography.Text>
                <Typography.Paragraph
                  type="secondary"
                  style={{ marginBottom: 0, marginTop: 8 }}
                >
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
                payload: {
                  ...values,
                  approved: reviewState.approved,
                  reason: values.reason || '',
                },
              });
            }
          }}
        >
          <Space orientation="vertical" size={12} style={fullWidthStyle}>
            <Alert
              type={reviewState?.approved ? 'info' : 'warning'}
              showIcon
              title={
                reviewState?.approved
                  ? '通过后申请会进入待打款阶段，下一步要尽快发起代付。'
                  : '驳回会把冻结资金退回可用余额，请确保原因能支撑后续补资料或复提。'
              }
            />
            <Form form={reviewForm} layout="vertical">
              <Form.Item label="原因" name="reason">
                <Input
                  placeholder={
                    reviewState?.approved
                      ? '可留空，或补充审核说明。'
                      : '请填写驳回原因。'
                  }
                />
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
              await retryMutation.mutateAsync({
                withdrawal: payoutState.withdrawal,
                payload,
              });
            } else if (payoutState) {
              await payoutMutation.mutateAsync({
                withdrawal: payoutState.withdrawal,
                payload,
              });
            }
          }}
        />
      </Space>
    </PageContainer>
  );
};

export default WalletWithdrawalsPage;
