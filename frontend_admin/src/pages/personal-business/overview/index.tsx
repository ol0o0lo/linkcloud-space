import { useMutation, useQuery } from '@tanstack/react-query';
import { PageContainer } from '@ant-design/pro-components';
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Drawer,
  Form,
  Input,
  InputNumber,
  Row,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import React, { useMemo, useState } from 'react';
import {
  adminTableScroll,
  codeWrapStyle,
  drawerWidthMd,
  drawerWidthSm,
  fullWidthStyle,
  responsiveDescriptionColumns,
  twoColumnDescription,
  ResponsiveActions,
  WrappedCodeText,
  wrapTextStyle,
} from '@/pages/_shared/adminLayout';
import {
  appsWalletApiCancelUserWithdrawal,
  appsWalletApiCreateWithdrawal,
  appsWalletApiGetWithdrawal,
  appsWalletApiListWithdrawals,
  appsWalletApiWalletLedger,
  appsWalletApiWalletSummary,
} from '@/services/openapi/userWallet';
import {
  appsReferralsApiMyReferralRecords,
  appsReferralsApiMyReferralSummary,
} from '@/services/openapi/referrals';
import {
  appsAccountsApiGetMyRealName,
  appsAccountsApiListMyRealNameLogs,
} from '@/services/openapi/realName';
import {
  appsSettingsApiDeleteUserSettingView,
  appsSettingsApiGetUserSettingView,
  appsSettingsApiListUserSettings,
  appsSettingsApiPutUserSetting,
} from '@/services/openapi/userSettings';
import { enumMapping } from '@/services/manual/enums';
import { formatWalletAmount } from '@/pages/wallet-management/shared';

type WithdrawalInsight = API.WithdrawalOut & {
  status_label: string;
  status_color: string;
  governance_summary: string;
};
type RealNameStatusRecord = API.RealNameVerificationOut & {
  status__mapping?: string;
};
type RealNameLogRecord = API.RealNameLogOut & {
  action__mapping?: string;
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

function buildWithdrawalInsight(
  withdrawal: API.WithdrawalOut,
): WithdrawalInsight {
  switch (withdrawal.status) {
    case 'pending_review':
      return {
        ...withdrawal,
        status_label: '待审核',
        status_color: 'gold',
        governance_summary:
          '资金已冻结，等待平台审核决定是否继续进入出款链路。',
      };
    case 'approved':
      return {
        ...withdrawal,
        status_label: '待打款',
        status_color: 'blue',
        governance_summary: '审核已经通过，但尚未真正完成出款。',
      };
    case 'paying':
      return {
        ...withdrawal,
        status_label: '打款中',
        status_color: 'cyan',
        governance_summary: '代付已发起，当前重点是等待回调并确认状态同步。',
      };
    case 'failed':
      return {
        ...withdrawal,
        status_label: '失败待处理',
        status_color: 'red',
        governance_summary:
          '申请已经失败，先核查失败原因和余额回流，再决定是否继续操作。',
      };
    case 'rejected':
      return {
        ...withdrawal,
        status_label: '已驳回',
        status_color: 'default',
        governance_summary: '申请已被退回，后续重点是补资料和重新发起。',
      };
    case 'cancelled':
      return {
        ...withdrawal,
        status_label: '已撤销',
        status_color: 'default',
        governance_summary: '申请已由本人撤销，资金通常已回流到可用余额。',
      };
    case 'paid':
      return {
        ...withdrawal,
        status_label: '已打款',
        status_color: 'green',
        governance_summary: '申请已经完成打款，后续重点转到到账与对账确认。',
      };
    default:
      return {
        ...withdrawal,
        status_label: withdrawal.status,
        status_color: 'default',
        governance_summary: '当前申请处于未归类状态，建议补充统一业务语义。',
      };
  }
}

const PersonalBusinessPage: React.FC = () => {
  const [withdrawalDetailId, setWithdrawalDetailId] = useState<number>();
  const [settingDetailKey, setSettingDetailKey] = useState<string>();
  const [withdrawalForm] = Form.useForm<{
    amount: number;
    pay_channel: string;
    account: string;
    client_request_id: string;
  }>();
  const [settingForm] = Form.useForm<{ key: string; value: string }>();

  const walletSummaryQuery = useQuery({
    queryKey: ['personal-business', 'wallet-summary'],
    queryFn: () => appsWalletApiWalletSummary(),
  });
  const ledgerQuery = useQuery({
    queryKey: ['personal-business', 'wallet-ledger'],
    queryFn: () => appsWalletApiWalletLedger({ page: 1, page_size: 10 }),
  });
  const withdrawalsQuery = useQuery({
    queryKey: ['personal-business', 'withdrawals'],
    queryFn: () => appsWalletApiListWithdrawals({ page: 1, page_size: 10 }),
  });
  const withdrawalDetailQuery = useQuery({
    queryKey: ['personal-business', 'withdrawal-detail', withdrawalDetailId],
    queryFn: () =>
      appsWalletApiGetWithdrawal({ withdrawal_id: withdrawalDetailId! }),
    enabled: Boolean(withdrawalDetailId),
  });
  const referralSummaryQuery = useQuery({
    queryKey: ['personal-business', 'referral-summary'],
    queryFn: () => appsReferralsApiMyReferralSummary(),
  });
  const referralRecordsQuery = useQuery({
    queryKey: ['personal-business', 'referral-records'],
    queryFn: () =>
      appsReferralsApiMyReferralRecords({ page: 1, page_size: 10 }),
  });
  const realNameQuery = useQuery({
    queryKey: ['personal-business', 'real-name'],
    queryFn: () => appsAccountsApiGetMyRealName() as Promise<RealNameStatusRecord>,
  });
  const realNameLogsQuery = useQuery({
    queryKey: ['personal-business', 'real-name-logs'],
    queryFn: () => appsAccountsApiListMyRealNameLogs() as Promise<RealNameLogRecord[]>,
  });
  const userSettingsQuery = useQuery({
    queryKey: ['personal-business', 'user-settings'],
    queryFn: () => appsSettingsApiListUserSettings(),
  });
  const settingDetailQuery = useQuery({
    queryKey: ['personal-business', 'user-setting-detail', settingDetailKey],
    queryFn: () =>
      appsSettingsApiGetUserSettingView({ key: settingDetailKey! }),
    enabled: Boolean(settingDetailKey),
  });

  const createWithdrawalMutation = useMutation({
    mutationFn: (values: {
      amount: number;
      pay_channel: string;
      account: string;
      client_request_id: string;
    }) =>
      appsWalletApiCreateWithdrawal({
        amount: Number(values.amount),
        fee_amount: 0,
        pay_channel: values.pay_channel,
        payee_account: { account: values.account },
        client_request_id: values.client_request_id,
      }),
    onSuccess: () => withdrawalsQuery.refetch(),
  });
  const cancelWithdrawalMutation = useMutation({
    mutationFn: (id: number) =>
      appsWalletApiCancelUserWithdrawal({ withdrawal_id: id }),
    onSuccess: () => withdrawalsQuery.refetch(),
  });
  const putSettingMutation = useMutation({
    mutationFn: ({ key, value }: { key: string; value: string }) =>
      appsSettingsApiPutUserSetting({ key }, { value }),
    onSuccess: () => userSettingsQuery.refetch(),
  });
  const deleteSettingMutation = useMutation({
    mutationFn: (key: string) => appsSettingsApiDeleteUserSettingView({ key }),
    onSuccess: () => userSettingsQuery.refetch(),
  });

  const walletSummary = walletSummaryQuery.data;
  const withdrawals = useMemo(
    () => (withdrawalsQuery.data?.items || []).map(buildWithdrawalInsight),
    [withdrawalsQuery.data?.items],
  );
  const pendingWithdrawals = withdrawals.filter(
    (item) => item.status === 'pending_review',
  );
  const failedWithdrawals = withdrawals.filter(
    (item) => item.status === 'failed',
  );
  const activeWithdrawals = withdrawals.filter((item) =>
    ['pending_review', 'approved', 'paying', 'failed'].includes(item.status),
  );
  const userSettings = userSettingsQuery.data || [];
  const referralSummary = referralSummaryQuery.data;
  const realName = realNameQuery.data;
  const realNameStatusText = enumMapping(realName?.status, realName?.status__mapping || realName?.status_label);

  const ledgerColumns: ColumnsType<API.WalletLedgerOut> = [
    { title: '类型', dataIndex: 'entry_type', width: 140 },
    {
      title: '变动',
      dataIndex: 'amount_delta',
      width: 120,
      render: formatWalletAmount,
    },
    {
      title: '备注',
      dataIndex: 'remark',
      width: 240,
      render: (value) => <span style={wrapTextStyle}>{value || '-'}</span>,
    },
    {
      title: '时间',
      dataIndex: 'created_at',
      width: 170,
      render: (value) => dayjs(value).format('YYYY-MM-DD HH:mm'),
    },
  ];

  const withdrawalColumns: ColumnsType<WithdrawalInsight> = [
    { title: '申请 ID', dataIndex: 'id', width: 100 },
    {
      title: '当前状态',
      dataIndex: 'status_label',
      width: 180,
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
      title: '金额结果',
      dataIndex: 'amount',
      width: 190,
      render: (_value, record) => (
        <Space orientation="vertical" size={4}>
          <Typography.Text>{`申请 ${formatWalletAmount(record.amount)}`}</Typography.Text>
          <Typography.Text type="secondary">{`到账 ${formatWalletAmount(record.net_amount)}`}</Typography.Text>
        </Space>
      ),
    },
    { title: '渠道', dataIndex: 'pay_channel', width: 120 },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      width: 170,
      render: (value) => dayjs(value).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '操作',
      dataIndex: 'actions',
      width: 160,
      render: (_value, record) => (
        <ResponsiveActions>
          <a onClick={() => setWithdrawalDetailId(record.id)}>详情</a>
          {['pending_review', 'failed'].includes(record.status) ? (
            <a
              onClick={() =>
                void cancelWithdrawalMutation.mutateAsync(record.id)
              }
            >
              撤销提现
            </a>
          ) : null}
        </ResponsiveActions>
      ),
    },
  ];

  return (
    <PageContainer
      title="个人业务概览"
      subTitle="查看钱包、实名、邀请和个人设置。"
    >
      <Space orientation="vertical" size={16} style={fullWidthStyle}>
        <Card>
          <div style={sectionStyle}>
            <Typography.Text strong>个人经营概览</Typography.Text>
            <Row gutter={[12, 12]} style={{ marginTop: 16 }}>
              <Col xs={24} sm={12} xl={6}>
                <div style={overviewTileStyle}>
                  <Statistic
                    title="可用余额"
                    value={walletSummary?.available_balance || 0}
                    formatter={(value) =>
                      formatWalletAmount(Number(value || 0))
                    }
                  />
                  <Typography.Text type="secondary">
                    当前可直接用于提现或后续经营动作的余额。
                  </Typography.Text>
                </div>
              </Col>
              <Col xs={24} sm={12} xl={6}>
                <div style={overviewTileStyle}>
                  <Statistic
                    title="冻结余额"
                    value={walletSummary?.frozen_balance || 0}
                    formatter={(value) =>
                      formatWalletAmount(Number(value || 0))
                    }
                  />
                  <Typography.Text type="secondary">
                    通常对应待审核、处理中或失败待解释的提现申请。
                  </Typography.Text>
                </div>
              </Col>
              <Col xs={24} sm={12} xl={6}>
                <div style={overviewTileStyle}>
                  <Statistic
                    title="在途提现"
                    value={activeWithdrawals.length}
                  />
                  <Typography.Text type="secondary">
                    这些申请决定了个人经营资金何时能真正完成结算。
                  </Typography.Text>
                </div>
              </Col>
              <Col xs={24} sm={12} xl={6}>
                <div style={overviewTileStyle}>
                  <Statistic
                    title="邀请注册"
                    value={referralSummary?.registered_count || 0}
                  />
                  <Typography.Text type="secondary">
                    邀请码带来的实际注册转化数量。
                  </Typography.Text>
                </div>
              </Col>
            </Row>
          </div>

          <div style={{ ...sectionStyle, marginTop: 16 }}>
            <Typography.Text strong>经营详情</Typography.Text>
            <Row gutter={[12, 12]} style={{ marginTop: 16 }}>
              <Col xs={24} lg={14}>
                <div style={overviewTileStyle}>
                  <Space
                    orientation="vertical"
                    size={12}
                    style={fullWidthStyle}
                  >
                    <div>
                      <Space wrap size={[8, 8]}>
                        <Typography.Text strong>发起提现</Typography.Text>
                        <Tag
                          color={pendingWithdrawals.length ? 'gold' : 'blue'}
                        >
                          {pendingWithdrawals.length
                            ? `${pendingWithdrawals.length} 条待审核`
                            : '可继续申请'}
                        </Tag>
                      </Space>
                      <Typography.Paragraph
                        type="secondary"
                        style={{ marginBottom: 0, marginTop: 8 }}
                      >
                        把提现作为资金推进动作来处理，而不是单纯填写一个表单。申请提交后，重点是跟踪审核与结果。
                      </Typography.Paragraph>
                    </div>
                    <Form
                      form={withdrawalForm}
                      layout="vertical"
                      onFinish={(values) =>
                        createWithdrawalMutation.mutate(values)
                      }
                    >
                      <Row gutter={16} align="bottom">
                        <Col xs={24} md={12} xl={6}>
                          <Form.Item
                            label="提现金额"
                            name="amount"
                            rules={[
                              { required: true, message: '请输入提现金额' },
                            ]}
                          >
                            <InputNumber min={1} style={fullWidthStyle} />
                          </Form.Item>
                        </Col>
                        <Col xs={24} md={12} xl={6}>
                          <Form.Item
                            label="提现渠道"
                            name="pay_channel"
                            rules={[
                              { required: true, message: '请输入提现渠道' },
                            ]}
                          >
                            <Input />
                          </Form.Item>
                        </Col>
                        <Col xs={24} md={12} xl={6}>
                          <Form.Item
                            label="收款账号"
                            name="account"
                            rules={[
                              { required: true, message: '请输入收款账号' },
                            ]}
                          >
                            <Input />
                          </Form.Item>
                        </Col>
                        <Col xs={24} md={12} xl={6}>
                          <Form.Item
                            label="提现请求 ID"
                            name="client_request_id"
                            rules={[
                              { required: true, message: '请输入请求 ID' },
                            ]}
                          >
                            <Input />
                          </Form.Item>
                        </Col>
                        <Col xs={24}>
                          <Button
                            type="primary"
                            htmlType="submit"
                            loading={createWithdrawalMutation.isPending}
                          >
                            提交提现
                          </Button>
                        </Col>
                      </Row>
                    </Form>
                  </Space>
                </div>
              </Col>
              <Col xs={24} lg={10}>
                <div style={overviewTileStyle}>
                  <Space
                    orientation="vertical"
                    size={10}
                    style={fullWidthStyle}
                  >
                    <Space wrap size={[8, 8]}>
                      <Typography.Text strong>提现推进提醒</Typography.Text>
                      <Tag color={failedWithdrawals.length ? 'red' : 'green'}>
                        {failedWithdrawals.length
                          ? `${failedWithdrawals.length} 条失败待解释`
                          : '暂无失败'}{' '}
                      </Tag>
                    </Space>
                    <Typography.Text>
                      失败提现不只是一个状态，它通常意味着余额解释、用户预期和后续重提策略都需要重新说明。
                    </Typography.Text>
                    {failedWithdrawals.length ? (
                      <Alert
                        type="warning"
                        showIcon
                        title={`当前有 ${failedWithdrawals.length} 条失败提现待处理，优先查看详情并确认是否需要撤销或重新发起。`}
                      />
                    ) : (
                      <Alert
                        type="success"
                        showIcon
                        title="当前没有失败提现，资金推进链路相对健康。"
                      />
                    )}
                  </Space>
                </div>
              </Col>
            </Row>
          </div>

          <div style={{ ...sectionStyle, marginTop: 16 }}>
            <Typography.Text strong>增长与身份</Typography.Text>
            <Row gutter={[12, 12]} style={{ marginTop: 16 }}>
              <Col xs={24} xl={12}>
                <div style={overviewTileStyle}>
                  <Space
                    orientation="vertical"
                    size={12}
                    style={fullWidthStyle}
                  >
                    <Space wrap size={[8, 8]}>
                      <Typography.Text strong>我的邀请</Typography.Text>
                      <Tag
                        color={
                          referralSummary?.pending_review_count
                            ? 'gold'
                            : 'blue'
                        }
                      >
                        {referralSummary?.invite_code || '未生成邀请码'}
                      </Tag>
                    </Space>
                    <Descriptions
                      column={responsiveDescriptionColumns}
                      size="small"
                    >
                      <Descriptions.Item label="分享链接">
                        <span style={wrapTextStyle}>
                          {referralSummary?.share_link || '-'}
                        </span>
                      </Descriptions.Item>
                      <Descriptions.Item label="注册数">
                        {referralSummary?.registered_count || 0}
                      </Descriptions.Item>
                      <Descriptions.Item label="待审核">
                        {referralSummary?.pending_review_count || 0}
                      </Descriptions.Item>
                      <Descriptions.Item label="已奖励">
                        {referralSummary?.rewarded_count || 0}
                      </Descriptions.Item>
                    </Descriptions>
                    <Table
                      rowKey="id"
                      dataSource={referralRecordsQuery.data?.items || []}
                      pagination={false}
                      scroll={adminTableScroll}
                      columns={[
                        {
                          title: '被邀请人',
                          dataIndex: 'invitee_display',
                          width: 180,
                        },
                        { title: '状态', dataIndex: 'status', width: 120 },
                      ]}
                    />
                  </Space>
                </div>
              </Col>
              <Col xs={24} xl={12}>
                <div style={overviewTileStyle}>
                  <Space
                    orientation="vertical"
                    size={12}
                    style={fullWidthStyle}
                  >
                    <Space wrap size={[8, 8]}>
                      <Typography.Text strong>我的实名</Typography.Text>
                      <Tag
                        color={
                          realName?.status === 'unverified' ? 'gold' : 'green'
                        }
                      >
                        {realNameStatusText || '未知'}
                      </Tag>
                    </Space>
                    <Descriptions column={twoColumnDescription} size="small">
                      <Descriptions.Item label="状态">
                        {realNameStatusText || '-'}
                      </Descriptions.Item>
                      <Descriptions.Item label="姓名">
                        {realName?.real_name_masked || '-'}
                      </Descriptions.Item>
                      <Descriptions.Item label="证件">
                        {realName?.id_number_masked || '-'}
                      </Descriptions.Item>
                    </Descriptions>
                    <Typography.Text type="secondary" style={wrapTextStyle}>
                      实名入口已统一放到个人设置，若需提交或重新提交，请前往个人设置完成。
                    </Typography.Text>
                    <Button
                      type="link"
                      href="/account/center?tab=security"
                      style={{ paddingInline: 0 }}
                    >
                      去个人设置实名
                    </Button>
                    <Table
                      rowKey="created_at"
                      dataSource={realNameLogsQuery.data || []}
                      pagination={false}
                      scroll={adminTableScroll}
                      columns={[
                        {
                          title: '动作',
                          dataIndex: 'action_label',
                          width: 160,
                          render: (_value, record: RealNameLogRecord) =>
                            enumMapping(record.action, record.action__mapping || record.action_label),
                        },
                        {
                          title: '备注',
                          dataIndex: 'note',
                          width: 260,
                          render: (value) => (
                            <span style={wrapTextStyle}>{value || '-'}</span>
                          ),
                        },
                      ]}
                    />
                  </Space>
                </div>
              </Col>
            </Row>
          </div>

          <div style={{ ...sectionStyle, marginTop: 16 }}>
            <Typography.Text strong>偏好与资料</Typography.Text>
            <Row gutter={[12, 12]} style={{ marginTop: 16 }}>
              <Col xs={24} lg={10}>
                <div style={overviewTileStyle}>
                  <Space
                    orientation="vertical"
                    size={12}
                    style={fullWidthStyle}
                  >
                    <Typography.Text strong>个人设置维护</Typography.Text>
                    <Typography.Paragraph
                      type="secondary"
                      style={{ marginBottom: 0 }}
                    >
                      这里维护的是个人经营偏好和平台侧配置，不应和账户安全或实名认证入口混在一起。
                    </Typography.Paragraph>
                    <Form
                      form={settingForm}
                      layout="vertical"
                      onFinish={(values) => putSettingMutation.mutate(values)}
                    >
                      <Row gutter={16} align="bottom">
                        <Col xs={24} md={10}>
                          <Form.Item
                            label="设置 Key"
                            name="key"
                            rules={[
                              { required: true, message: '请输入设置 Key' },
                            ]}
                          >
                            <Input />
                          </Form.Item>
                        </Col>
                        <Col xs={24} md={10}>
                          <Form.Item
                            label="设置值"
                            name="value"
                            rules={[
                              { required: true, message: '请输入设置值' },
                            ]}
                          >
                            <Input />
                          </Form.Item>
                        </Col>
                        <Col xs={24} md={4}>
                          <Form.Item label=" " colon={false}>
                            <Button
                              type="primary"
                              htmlType="submit"
                              loading={putSettingMutation.isPending}
                            >
                              保存个人设置
                            </Button>
                          </Form.Item>
                        </Col>
                      </Row>
                    </Form>
                  </Space>
                </div>
              </Col>
              <Col xs={24} lg={14}>
                <div style={overviewTileStyle}>
                  <Space
                    orientation="vertical"
                    size={12}
                    style={fullWidthStyle}
                  >
                    <Typography.Text strong>设置列表</Typography.Text>
                    <Table
                      rowKey="key"
                      dataSource={userSettings}
                      pagination={false}
                      scroll={adminTableScroll}
                      columns={[
                        { title: 'Key', dataIndex: 'key', width: 180 },
                        {
                          title: 'Value',
                          dataIndex: 'value',
                          width: 260,
                          render: (value) => (
                            <span style={wrapTextStyle}>{String(value)}</span>
                          ),
                        },
                        {
                          title: '操作',
                          dataIndex: 'actions',
                          width: 120,
                          render: (_value, record) => (
                            <ResponsiveActions>
                              <a
                                onClick={() => setSettingDetailKey(record.key)}
                              >
                                详情
                              </a>
                              <a
                                onClick={() =>
                                  void deleteSettingMutation.mutateAsync(
                                    record.key,
                                  )
                                }
                              >
                                删除
                              </a>
                            </ResponsiveActions>
                          ),
                        },
                      ]}
                    />
                  </Space>
                </div>
              </Col>
            </Row>
          </div>

          <div style={{ ...sectionStyle, marginTop: 16 }}>
            <Space orientation="vertical" size={12} style={fullWidthStyle}>
              <Typography.Text strong>资金记录</Typography.Text>
              <Row gutter={[12, 12]}>
                <Col xs={24} xl={10}>
                  <div style={overviewTileStyle}>
                    <Space
                      orientation="vertical"
                      size={12}
                      style={fullWidthStyle}
                    >
                      <Typography.Text strong>钱包流水</Typography.Text>
                      <Table
                        rowKey="id"
                        loading={ledgerQuery.isLoading}
                        columns={ledgerColumns}
                        dataSource={ledgerQuery.data?.items || []}
                        pagination={false}
                        scroll={adminTableScroll}
                      />
                    </Space>
                  </div>
                </Col>
                <Col xs={24} xl={14}>
                  <div style={overviewTileStyle}>
                    <Space
                      orientation="vertical"
                      size={12}
                      style={fullWidthStyle}
                    >
                      <Typography.Text strong>提现申请</Typography.Text>
                      <Table
                        rowKey="id"
                        loading={withdrawalsQuery.isLoading}
                        columns={withdrawalColumns}
                        dataSource={withdrawals}
                        pagination={false}
                        scroll={adminTableScroll}
                      />
                    </Space>
                  </div>
                </Col>
              </Row>
            </Space>
          </div>
        </Card>

        <Drawer
          title="提现详情"
          open={Boolean(withdrawalDetailId)}
          onClose={() => setWithdrawalDetailId(undefined)}
          width={drawerWidthMd}
        >
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="提现 ID">
              {withdrawalDetailQuery.data?.id || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="状态">
              {withdrawalDetailQuery.data?.status || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="金额">
              {formatWalletAmount(withdrawalDetailQuery.data?.amount || 0)}
            </Descriptions.Item>
            <Descriptions.Item label="手续费">
              {formatWalletAmount(withdrawalDetailQuery.data?.fee_amount || 0)}
            </Descriptions.Item>
            <Descriptions.Item label="到账金额">
              {formatWalletAmount(withdrawalDetailQuery.data?.net_amount || 0)}
            </Descriptions.Item>
            <Descriptions.Item label="渠道">
              {withdrawalDetailQuery.data?.pay_channel || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="收款快照">
              <WrappedCodeText
                value={
                  withdrawalDetailQuery.data?.payee_account_snapshot || '-'
                }
              />
            </Descriptions.Item>
            <Descriptions.Item label="驳回原因">
              {withdrawalDetailQuery.data?.reject_reason || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="创建时间">
              {withdrawalDetailQuery.data?.created_at
                ? dayjs(withdrawalDetailQuery.data.created_at).format(
                    'YYYY-MM-DD HH:mm',
                  )
                : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="审核时间">
              {withdrawalDetailQuery.data?.reviewed_at
                ? dayjs(withdrawalDetailQuery.data.reviewed_at).format(
                    'YYYY-MM-DD HH:mm',
                  )
                : '-'}
            </Descriptions.Item>
          </Descriptions>
        </Drawer>

        <Drawer
          title="个人设置详情"
          open={Boolean(settingDetailKey)}
          onClose={() => setSettingDetailKey(undefined)}
          width={drawerWidthSm}
        >
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="Key">
              {settingDetailQuery.data?.key || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="Value">
              <span style={codeWrapStyle}>
                {settingDetailQuery.data
                  ? JSON.stringify(settingDetailQuery.data.value)
                  : '-'}
              </span>
            </Descriptions.Item>
          </Descriptions>
        </Drawer>
      </Space>
    </PageContainer>
  );
};

export default PersonalBusinessPage;
