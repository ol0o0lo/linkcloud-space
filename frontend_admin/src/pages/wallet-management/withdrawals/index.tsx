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
import { enumMapping } from '@/services/manual/enums';
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
  formatWalletAmount,
  getWithdrawalAmountLabel,
  IdempotencyFormItem,
  JsonText,
  PayoutModal,
} from '../shared';

type WithdrawalWithMapping = API.WithdrawalOut & {
  status__mapping?: string;
  pay_channel__mapping?: string;
};

type ReviewState = {
  withdrawal: WithdrawalWithMapping;
  approved: boolean;
} | null;
type PayoutState = {
  withdrawal: WithdrawalWithMapping;
  mode: 'payout' | 'retry';
} | null;

type WithdrawalInsight = WithdrawalWithMapping & {
  status_label: string;
  is_review_pending: boolean;
  is_ready_for_payout: boolean;
  is_paying: boolean;
  is_retry_needed: boolean;
  is_closed: boolean;
};
type TablePageParams = {
  createdFrom?: string;
  createdTo?: string;
  current?: number;
  keyword?: string;
  pageSize?: number;
  status?: string;
};

type WithdrawalSearchState = {
  createdFrom: string;
  createdTo: string;
  keyword: string;
  page: number;
  status?: string;
};

const PAGE_SIZE = 10;

const withdrawalStatusOptions = [
  { value: 'pending_review', label: '待审核' },
  { value: 'approved', label: '已通过' },
  { value: 'paying', label: '打款中' },
  { value: 'failed', label: '失败待重试' },
  { value: 'rejected', label: '已驳回' },
  { value: 'cancelled', label: '已取消' },
  { value: 'paid', label: '已打款' },
];

const trimParam = (value: unknown) =>
  typeof value === 'string' && value.trim() ? value.trim() : undefined;

function readSearchState(): WithdrawalSearchState {
  const params = new URLSearchParams(window.location.search);
  const page = Number(params.get('page'));
  return {
    page: Number.isInteger(page) && page > 0 ? page : 1,
    keyword: trimParam(params.get('keyword')) || '',
    status: trimParam(params.get('status')),
    createdFrom: trimParam(params.get('created_from')) || '',
    createdTo: trimParam(params.get('created_to')) || '',
  };
}

function syncSearchState(state: WithdrawalSearchState) {
  const params = new URLSearchParams(window.location.search);
  ['page', 'keyword', 'status', 'created_from', 'created_to'].forEach(
    (name) => {
      params.delete(name);
    },
  );
  if (state.page > 1) params.set('page', String(state.page));
  if (state.keyword) params.set('keyword', state.keyword);
  if (state.status) params.set('status', state.status);
  if (state.createdFrom) params.set('created_from', state.createdFrom);
  if (state.createdTo) params.set('created_to', state.createdTo);
  const search = params.toString();
  window.history.replaceState(
    window.history.state,
    '',
    `${window.location.pathname}${search ? `?${search}` : ''}${window.location.hash || ''}`,
  );
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

function buildWithdrawalInsight(
  withdrawal: WithdrawalWithMapping,
): WithdrawalInsight {
  const statusLabel = enumMapping(
    withdrawal.status,
    withdrawal.status__mapping,
  );
  switch (withdrawal.status) {
    case 'pending_review':
      return {
        ...withdrawal,
        status_label: statusLabel,
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
        is_review_pending: false,
        is_ready_for_payout: false,
        is_paying: false,
        is_retry_needed: false,
        is_closed: false,
      };
  }
}

const WalletWithdrawalsPage: React.FC = () => {
  const initialSearchState = React.useMemo(readSearchState, []);
  const [reviewState, setReviewState] = useState<ReviewState>(null);
  const [payoutState, setPayoutState] = useState<PayoutState>(null);
  const tableActionRef = useRef<ActionType>(null);
  const [reviewForm] = Form.useForm<API.WithdrawalReviewIn>();
  const [payoutForm] = Form.useForm<API.PayoutCreateIn>();
  const [reconcileDiffCount, setReconcileDiffCount] = useState<number | null>(
    null,
  );
  const [searchState, setSearchState] = useState(initialSearchState);
  const [keywordDraft, setKeywordDraft] = useState(initialSearchState.keyword);
  const [listError, setListError] = useState<unknown>();

  const reviewMutation = useMutation({
    mutationFn: ({
      withdrawal,
      payload,
    }: {
      withdrawal: API.WithdrawalOut;
      payload: API.WithdrawalReviewIn;
    }) =>
      appsWalletApiReviewWithdrawal({ withdrawal_id: withdrawal.id }, payload),
    onSuccess: async (_result, variables) => {
      setReviewState(null);
      reviewForm.resetFields();
      tableActionRef.current?.reload();
      message.success(
        variables.payload.approved ? '提现审核已通过' : '提现审核已驳回',
      );
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
      message.success('打款请求已提交');
    },
  });
  const retryMutation = useMutation({
    mutationFn: ({
      withdrawal,
      payload,
    }: {
      withdrawal: API.WithdrawalOut;
      payload: API.PayoutCreateIn;
    }) =>
      appsWalletApiRetryWithdrawal({ withdrawal_id: withdrawal.id }, payload),
    onSuccess: async () => {
      setPayoutState(null);
      payoutForm.resetFields();
      tableActionRef.current?.reload();
      message.success('打款重试已提交');
    },
  });
  const reconcileMutation = useMutation({
    mutationFn: () => appsWalletApiReconcile(),
    onSuccess: (result) => {
      setReconcileDiffCount(result.diff_count);
      message.success('钱包对账已完成');
    },
  });

  const updateSearchState = (next: Partial<WithdrawalSearchState>) => {
    setSearchState((current) => {
      const value = { ...current, ...next };
      syncSearchState(value);
      return value;
    });
  };

  const columns: ProColumns<WithdrawalInsight>[] = [
    { title: '申请 ID', dataIndex: 'id', width: 110 },
    {
      title: '当前状态',
      dataIndex: 'status_label',
      width: 140,
      align: 'center',
      render: (_value, record) => (
        <AppStatusTag name="wallet.withdrawal" state={record.status}>
          {record.status_label}
        </AppStatusTag>
      ),
    },
    {
      title: '资金结果',
      dataIndex: 'amount',
      width: 220,
      align: 'right',
      render: (_value, record) => (
        <Space orientation="vertical" size={4}>
          <Typography.Text>{`申请金额 ${formatWalletAmount(record.amount)}`}</Typography.Text>
          <Typography.Text type="secondary">{`手续费 ${formatWalletAmount(record.fee_amount)} / ${getWithdrawalAmountLabel(record.status)} ${formatWalletAmount(record.net_amount)}`}</Typography.Text>
        </Space>
      ),
    },
    {
      title: '申请时的收款信息',
      dataIndex: 'payee_account_snapshot',
      width: 260,
      render: (value) => <JsonText value={value} />,
    },
    {
      title: '生命周期',
      dataIndex: 'created_at',
      width: 240,
      align: 'center',
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
      align: 'center',
      render: (_value, record) => (
        <ResponsiveActions>
          {record.is_review_pending ? (
            <>
              <Button
                type="link"
                size="small"
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
              </Button>
              <Button
                danger
                type="link"
                size="small"
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
              </Button>
            </>
          ) : null}
          {record.is_ready_for_payout ? (
            <Button
              type="link"
              size="small"
              onClick={() => {
                payoutMutation.reset();
                retryMutation.reset();
                payoutForm.resetFields();
                setPayoutState({ withdrawal: record, mode: 'payout' });
              }}
            >
              发起打款
            </Button>
          ) : null}
          {record.is_retry_needed ? (
            <Button
              type="link"
              size="small"
              onClick={() => {
                payoutMutation.reset();
                retryMutation.reset();
                payoutForm.resetFields();
                setPayoutState({ withdrawal: record, mode: 'retry' });
              }}
            >
              重试打款
            </Button>
          ) : null}
          {!record.is_review_pending &&
          !record.is_ready_for_payout &&
          !record.is_retry_needed ? (
            <Typography.Text type="secondary">已完成</Typography.Text>
          ) : null}
        </ResponsiveActions>
      ),
    },
  ];

  return (
    <PageContainer title="提现审核">
      <Space orientation="vertical" size={16} style={fullWidthStyle}>
        <Card>
          {listError ? (
            <Alert
              type="error"
              showIcon
              title="提现记录加载失败"
              description="暂时无法取得提现记录，请检查网络后重试。"
              action={
                <Button
                  size="small"
                  onClick={() => tableActionRef.current?.reload()}
                >
                  重新加载提现记录
                </Button>
              }
              style={{ marginBottom: 16 }}
            />
          ) : null}
          {reconcileDiffCount !== null ? (
            <Alert
              type={reconcileDiffCount > 0 ? 'warning' : 'success'}
              showIcon
              title={
                reconcileDiffCount > 0
                  ? `本次对账发现 ${reconcileDiffCount} 条差异，请优先核查打款失败和状态未更新的申请。`
                  : '本次对账未发现差异，提现记录与系统状态一致。'
              }
              style={{ marginBottom: 16 }}
            />
          ) : null}
          {reconcileMutation.isError ? (
            <Alert
              type="error"
              showIcon
              title="钱包对账失败，请稍后重试"
              style={{ marginBottom: 16 }}
            />
          ) : null}

          <ProTable<WithdrawalInsight>
            actionRef={tableActionRef}
            rowKey="id"
            headerTitle="提现列表"
            columns={columns}
            request={async (params: TablePageParams) => {
              try {
                const result = await appsWalletApiAdminWithdrawals({
                  page: params.current || 1,
                  page_size: params.pageSize || PAGE_SIZE,
                  keyword: trimParam(params.keyword),
                  status: params.status,
                  ...apiDateRange(params.createdFrom, params.createdTo),
                });
                setListError(undefined);
                return {
                  data: ((result.items || []) as WithdrawalWithMapping[]).map(
                    (item) => buildWithdrawalInsight(item),
                  ),
                  total: result.total || 0,
                  success: true,
                };
              } catch (error) {
                setListError(error);
                return { data: [], total: 0, success: true };
              }
            }}
            params={{
              keyword: searchState.keyword,
              status: searchState.status,
              createdFrom: searchState.createdFrom,
              createdTo: searchState.createdTo,
            }}
            search={false}
            options={{ density: true, reload: false, setting: true }}
            toolBarRender={() => [
              <AdminToolbar key="actions">
                <Input.Search
                  aria-label="提现记录关键词"
                  allowClear
                  placeholder="用户 ID、姓名、账号或邮箱"
                  style={toolbarControlStyle}
                  value={keywordDraft}
                  onChange={(event) => setKeywordDraft(event.target.value)}
                  onSearch={(value) =>
                    updateSearchState({
                      page: 1,
                      keyword: trimParam(value) || '',
                    })
                  }
                />
                <Select
                  aria-label="提现状态"
                  allowClear
                  placeholder="提现状态"
                  style={toolbarShortSelectStyle}
                  value={searchState.status}
                  options={withdrawalStatusOptions}
                  onChange={(status) => updateSearchState({ page: 1, status })}
                />
                <DatePicker.RangePicker
                  aria-label="提现申请时间"
                  value={
                    searchState.createdFrom && searchState.createdTo
                      ? [
                          dayjs(searchState.createdFrom),
                          dayjs(searchState.createdTo),
                        ]
                      : null
                  }
                  onChange={(dates) =>
                    updateSearchState({
                      page: 1,
                      createdFrom: dates?.[0]?.format('YYYY-MM-DD') || '',
                      createdTo: dates?.[1]?.format('YYYY-MM-DD') || '',
                    })
                  }
                />
                <Button
                  onClick={() => {
                    setKeywordDraft('');
                    const reset: WithdrawalSearchState = {
                      page: 1,
                      keyword: '',
                      status: undefined,
                      createdFrom: '',
                      createdTo: '',
                    };
                    setSearchState(reset);
                    syncSearchState(reset);
                  }}
                >
                  重置
                </Button>
                <Button
                  loading={reconcileMutation.isPending}
                  onClick={() => void reconcileMutation.mutateAsync()}
                >
                  执行对账
                </Button>
              </AdminToolbar>,
            ]}
            ghost
            scroll={adminTableScroll}
            pagination={{
              current: searchState.page,
              pageSize: PAGE_SIZE,
              showSizeChanger: false,
              onChange: (page) => updateSearchState({ page }),
            }}
            locale={listError ? { emptyText: '提现记录加载失败' } : undefined}
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
            {reviewMutation.isError ? (
              <Alert
                type="error"
                showIcon
                title="提现审核失败，请核对信息后重试"
              />
            ) : null}
            <Alert
              type={reviewState?.approved ? 'info' : 'warning'}
              showIcon
              title={
                reviewState?.approved
                  ? '通过后申请会进入待打款阶段，下一步要尽快发起打款。'
                  : '驳回会把冻结资金退回可用余额，请确保原因能支持后续补充材料或重新提交。'
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
          title={payoutState?.mode === 'retry' ? '重试打款' : '发起打款'}
          open={Boolean(payoutState)}
          loading={payoutMutation.isPending || retryMutation.isPending}
          error={
            payoutMutation.isError
              ? '打款请求失败，请核对信息后重试'
              : retryMutation.isError
                ? '打款重试失败，请核对信息后重试'
                : undefined
          }
          form={payoutForm}
          onCancel={() => {
            payoutMutation.reset();
            retryMutation.reset();
            setPayoutState(null);
          }}
          onOk={async () => {
            const values = await payoutForm.validateFields();
            const payload = { ...values, request_payload: {} };
            try {
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
            } catch {
              // 错误状态保留在弹窗内，便于用户修正后重试。
            }
          }}
        />
      </Space>
    </PageContainer>
  );
};

export default WalletWithdrawalsPage;
