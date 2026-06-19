import { useMutation, useQuery } from '@tanstack/react-query';
import { Button, Card, Form, Input, Modal, Space, Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import React, { useState } from 'react';
import { AdminToolbar, adminTableScroll, ResponsiveActions } from '@/pages/_shared/adminLayout';
import {
  appsWalletApiAdminWithdrawals,
  appsWalletApiPayoutWithdrawal,
  appsWalletApiReviewWithdrawal,
} from '@/services/openapi/walletAdmin';
import { appsWalletApiReconcile, appsWalletApiRetryWithdrawal } from '@/services/openapi/walletInternal';
import { IdempotencyFormItem, JsonText, PayoutModal, formatWalletAmount, walletQueryKeys } from '../shared';

type ReviewState = { withdrawal: API.WithdrawalOut; approved: boolean } | null;
type PayoutState = { withdrawal: API.WithdrawalOut; mode: 'payout' | 'retry' } | null;

const WalletWithdrawalsPage: React.FC = () => {
  const [page, setPage] = useState(1);
  const [reviewState, setReviewState] = useState<ReviewState>(null);
  const [payoutState, setPayoutState] = useState<PayoutState>(null);
  const [reviewForm] = Form.useForm<API.WithdrawalReviewIn>();
  const [payoutForm] = Form.useForm<API.PayoutCreateIn>();

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
  });

  const columns: ColumnsType<API.WithdrawalOut> = [
    { title: 'ID', dataIndex: 'id', width: 90 },
    { title: '状态', dataIndex: 'status', width: 120, render: (value) => <Tag>{value}</Tag> },
    { title: '渠道', dataIndex: 'pay_channel', width: 120 },
    { title: '金额', dataIndex: 'amount', width: 120, render: formatWalletAmount },
    { title: '手续费', dataIndex: 'fee_amount', width: 120, render: formatWalletAmount },
    { title: '到账金额', dataIndex: 'net_amount', width: 120, render: formatWalletAmount },
    { title: '收款账户', dataIndex: 'payee_account_snapshot', width: 260, render: (value) => <JsonText value={value} /> },
    { title: '创建时间', dataIndex: 'created_at', width: 170, render: (value) => dayjs(value).format('YYYY-MM-DD HH:mm') },
    {
      title: '操作',
      dataIndex: 'actions',
      width: 240,
      render: (_value, record) => (
        <ResponsiveActions>
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
          <a
            onClick={() => {
              payoutForm.resetFields();
              setPayoutState({ withdrawal: record, mode: 'payout' });
            }}
          >
            代付
          </a>
          <a
            onClick={() => {
              payoutForm.resetFields();
              setPayoutState({ withdrawal: record, mode: 'retry' });
            }}
          >
            重试代付
          </a>
        </ResponsiveActions>
      ),
    },
  ];

  return (
    <>
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
        <Table
          rowKey="id"
          loading={withdrawalsQuery.isLoading}
          columns={columns}
          dataSource={withdrawalsQuery.data?.items || []}
          scroll={adminTableScroll}
          pagination={{
            current: withdrawalsQuery.data?.page || page,
            pageSize: withdrawalsQuery.data?.page_size || 10,
            total: withdrawalsQuery.data?.total || 0,
            onChange: setPage,
          }}
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
              payload: { ...values, approved: reviewState.approved, reason: values.reason || '' },
            });
          }
        }}
      >
        <Form form={reviewForm} layout="vertical">
          <Form.Item label="原因" name="reason">
            <Input />
          </Form.Item>
          <IdempotencyFormItem />
        </Form>
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
    </>
  );
};

export default WalletWithdrawalsPage;
