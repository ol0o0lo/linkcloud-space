import { useMutation } from '@tanstack/react-query';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { ProTable } from '@ant-design/pro-components';
import {
  Alert,
  Button,
  Card,
  Form,
  Input,
  Modal,
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
  appsWalletApiAdminWithdrawals,
  appsWalletApiPayoutWithdrawal,
  appsWalletApiReviewWithdrawal,
} from '@/services/openapi/walletAdmin';
import {
  appsWalletApiReconcile,
  appsWalletApiRetryWithdrawal,
} from '@/services/openapi/walletInternal';
import { enumMapping } from '@/services/manual/enums';
import {
  IdempotencyFormItem,
  JsonText,
  PayoutModal,
  formatWalletAmount,
} from '../shared';

type WithdrawalWithMapping = API.WithdrawalOut & {
  status__mapping?: string;
  pay_channel__mapping?: string;
};

type ReviewState = { withdrawal: WithdrawalWithMapping; approved: boolean } | null;
type PayoutState = {
  withdrawal: WithdrawalWithMapping;
  mode: 'payout' | 'retry';
} | null;

type WithdrawalInsight = WithdrawalWithMapping & {
  status_label: string;
  status_color: string;
  is_review_pending: boolean;
  is_ready_for_payout: boolean;
  is_paying: boolean;
  is_retry_needed: boolean;
  is_closed: boolean;
};
type TablePageParams = {
  current?: number;
  pageSize?: number;
};

function buildWithdrawalInsight(
  withdrawal: WithdrawalWithMapping,
): WithdrawalInsight {
  const statusLabel = enumMapping(withdrawal.status, withdrawal.status__mapping);
  switch (withdrawal.status) {
    case 'pending_review':
      return {
        ...withdrawal,
        status_label: statusLabel,
        status_color: 'gold',
        is_review_pending: true,
        is_ready_for_payout: false,
        is_paying: false,
        is_retry_needed: false,
        is_closed: false,
      };
    case 'approved':
      return {
        ...withdrawal,
        status_label: statusLabel,
        status_color: 'blue',
        is_review_pending: false,
        is_ready_for_payout: true,
        is_paying: false,
        is_retry_needed: false,
        is_closed: false,
      };
    case 'paying':
      return {
        ...withdrawal,
        status_label: statusLabel,
        status_color: 'cyan',
        is_review_pending: false,
        is_ready_for_payout: false,
        is_paying: true,
        is_retry_needed: false,
        is_closed: false,
      };
    case 'failed':
      return {
        ...withdrawal,
        status_label: statusLabel,
        status_color: 'red',
        is_review_pending: false,
        is_ready_for_payout: false,
        is_paying: false,
        is_retry_needed: true,
        is_closed: false,
      };
    case 'rejected':
      return {
        ...withdrawal,
        status_label: statusLabel,
        status_color: 'default',
        is_review_pending: false,
        is_ready_for_payout: false,
        is_paying: false,
        is_retry_needed: false,
        is_closed: true,
      };
    case 'cancelled':
      return {
        ...withdrawal,
        status_label: statusLabel,
        status_color: 'default',
        is_review_pending: false,
        is_ready_for_payout: false,
        is_paying: false,
        is_retry_needed: false,
        is_closed: true,
      };
    case 'paid':
      return {
        ...withdrawal,
        status_label: statusLabel,
        status_color: 'green',
        is_review_pending: false,
        is_ready_for_payout: false,
        is_paying: false,
        is_retry_needed: false,
        is_closed: true,
      };
    default:
      return {
        ...withdrawal,
        status_label: statusLabel,
        status_color: 'default',
        is_review_pending: false,
        is_ready_for_payout: false,
        is_paying: false,
        is_retry_needed: false,
        is_closed: false,
      };
  }
}

const WalletWithdrawalsPage: React.FC = () => {
  const [reviewState, setReviewState] = useState<ReviewState>(null);
  const [payoutState, setPayoutState] = useState<PayoutState>(null);
  const tableActionRef = useRef<ActionType>(null);
  const [reviewForm] = Form.useForm<API.WithdrawalReviewIn>();
  const [payoutForm] = Form.useForm<API.PayoutCreateIn>();
  const [reconcileDiffCount, setReconcileDiffCount] = useState<number | null>(
    null,
  );

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
      tableActionRef.current?.reload();
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
      tableActionRef.current?.reload();
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
      tableActionRef.current?.reload();
    },
  });
  const reconcileMutation = useMutation({
    mutationFn: () => appsWalletApiReconcile(),
    onSuccess: (result) => {
      setReconcileDiffCount(result.diff_count);
    },
  });

  const columns: ProColumns<WithdrawalInsight>[] = [
    { title: '申请 ID', dataIndex: 'id', width: 110 },
    {
      title: '当前状态',
      dataIndex: 'status_label',
      width: 140,
      render: (_value, record) => <Tag color={record.status_color}>{record.status_label}</Tag>,
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
    <PageContainer title="提现审核">
      <Space orientation="vertical" size={16} style={fullWidthStyle}>
        <Card>
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

          <ProTable<WithdrawalInsight>
            actionRef={tableActionRef}
            rowKey="id"
            headerTitle="提现列表"
            columns={columns}
            request={async (params: TablePageParams) => {
              const result = await appsWalletApiAdminWithdrawals({
                page: params.current || 1,
                page_size: params.pageSize || 10,
              });
              return {
                data: ((result.items || []) as WithdrawalWithMapping[]).map((item) => buildWithdrawalInsight(item)),
                total: result.total || 0,
                success: true,
              };
            }}
            search={false}
            options={{ density: true, reload: false, setting: true }}
            toolBarRender={() => [
              <Button
                key="reconcile"
                loading={reconcileMutation.isPending}
                onClick={() => void reconcileMutation.mutateAsync()}
              >
                执行对账
              </Button>,
            ]}
            ghost
            scroll={adminTableScroll}
            pagination={{ defaultPageSize: 10 }}
          />
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
