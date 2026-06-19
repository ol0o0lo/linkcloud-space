import { useMutation, useQuery } from '@tanstack/react-query';
import { Button, Card, Col, Descriptions, Drawer, Form, Input, InputNumber, Row, Space, Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import React, { useState } from 'react';
import { adminTableScroll, codeWrapStyle, drawerWidthMd, drawerWidthSm, fullWidthStyle, responsiveDescriptionColumns, twoColumnDescription, ResponsiveActions, WrappedCodeText, wrapTextStyle } from '@/pages/_shared/adminLayout';
import {
  appsWalletApiCancelUserWithdrawal,
  appsWalletApiCreateWithdrawal,
  appsWalletApiGetWithdrawal,
  appsWalletApiListWithdrawals,
  appsWalletApiWalletLedger,
  appsWalletApiWalletSummary,
} from '@/services/openapi/userWallet';
import { appsReferralsApiMyReferralRecords, appsReferralsApiMyReferralSummary } from '@/services/openapi/referrals';
import { appsAccountsApiGetMyRealName, appsAccountsApiListMyRealNameLogs } from '@/services/openapi/realName';
import { appsSettingsApiDeleteUserSettingView, appsSettingsApiGetUserSettingView, appsSettingsApiListUserSettings, appsSettingsApiPutUserSetting } from '@/services/openapi/userSettings';
import { formatWalletAmount } from '@/pages/wallet-management/shared';

const PersonalBusinessPage: React.FC = () => {
  const [withdrawalDetailId, setWithdrawalDetailId] = useState<number>();
  const [settingDetailKey, setSettingDetailKey] = useState<string>();
  const [withdrawalForm] = Form.useForm<{ amount: number; pay_channel: string; account: string; client_request_id: string }>();
  const [settingForm] = Form.useForm<{ key: string; value: string }>();

  const walletSummaryQuery = useQuery({ queryKey: ['personal-business', 'wallet-summary'], queryFn: () => appsWalletApiWalletSummary() });
  const ledgerQuery = useQuery({ queryKey: ['personal-business', 'wallet-ledger'], queryFn: () => appsWalletApiWalletLedger({ page: 1, page_size: 10 }) });
  const withdrawalsQuery = useQuery({ queryKey: ['personal-business', 'withdrawals'], queryFn: () => appsWalletApiListWithdrawals({ page: 1, page_size: 10 }) });
  const withdrawalDetailQuery = useQuery({
    queryKey: ['personal-business', 'withdrawal-detail', withdrawalDetailId],
    queryFn: () => appsWalletApiGetWithdrawal({ withdrawal_id: withdrawalDetailId! }),
    enabled: Boolean(withdrawalDetailId),
  });
  const referralSummaryQuery = useQuery({ queryKey: ['personal-business', 'referral-summary'], queryFn: () => appsReferralsApiMyReferralSummary() });
  const referralRecordsQuery = useQuery({ queryKey: ['personal-business', 'referral-records'], queryFn: () => appsReferralsApiMyReferralRecords({ page: 1, page_size: 10 }) });
  const realNameQuery = useQuery({ queryKey: ['personal-business', 'real-name'], queryFn: () => appsAccountsApiGetMyRealName() });
  const realNameLogsQuery = useQuery({ queryKey: ['personal-business', 'real-name-logs'], queryFn: () => appsAccountsApiListMyRealNameLogs() });
  const userSettingsQuery = useQuery({ queryKey: ['personal-business', 'user-settings'], queryFn: () => appsSettingsApiListUserSettings() });
  const settingDetailQuery = useQuery({
    queryKey: ['personal-business', 'user-setting-detail', settingDetailKey],
    queryFn: () => appsSettingsApiGetUserSettingView({ key: settingDetailKey! }),
    enabled: Boolean(settingDetailKey),
  });

  const createWithdrawalMutation = useMutation({
    mutationFn: (values: { amount: number; pay_channel: string; account: string; client_request_id: string }) =>
      appsWalletApiCreateWithdrawal({ amount: Number(values.amount), fee_amount: 0, pay_channel: values.pay_channel, payee_account: { account: values.account }, client_request_id: values.client_request_id }),
    onSuccess: () => withdrawalsQuery.refetch(),
  });
  const cancelWithdrawalMutation = useMutation({
    mutationFn: (id: number) => appsWalletApiCancelUserWithdrawal({ withdrawal_id: id }),
    onSuccess: () => withdrawalsQuery.refetch(),
  });
  const putSettingMutation = useMutation({
    mutationFn: ({ key, value }: { key: string; value: string }) => appsSettingsApiPutUserSetting({ key }, { value }),
    onSuccess: () => userSettingsQuery.refetch(),
  });
  const deleteSettingMutation = useMutation({
    mutationFn: (key: string) => appsSettingsApiDeleteUserSettingView({ key }),
    onSuccess: () => userSettingsQuery.refetch(),
  });

  const ledgerColumns: ColumnsType<API.WalletLedgerOut> = [
    { title: '类型', dataIndex: 'entry_type', width: 120 },
    { title: '变动', dataIndex: 'amount_delta', width: 120, render: formatWalletAmount },
    { title: '备注', dataIndex: 'remark', width: 220, render: (value) => <span style={wrapTextStyle}>{value || '-'}</span> },
    { title: '时间', dataIndex: 'created_at', width: 170, render: (value) => dayjs(value).format('YYYY-MM-DD HH:mm') },
  ];
  const withdrawalColumns: ColumnsType<API.WithdrawalOut> = [
    { title: '状态', dataIndex: 'status', width: 120, render: (value) => <Tag>{value}</Tag> },
    { title: '金额', dataIndex: 'amount', width: 120, render: formatWalletAmount },
    { title: '渠道', dataIndex: 'pay_channel', width: 140 },
    {
      title: '操作',
      dataIndex: 'actions',
      width: 160,
      render: (_value, record) => (
        <ResponsiveActions>
          <a onClick={() => setWithdrawalDetailId(record.id)}>详情</a>
          <a onClick={() => void cancelWithdrawalMutation.mutateAsync(record.id)}>撤销提现</a>
        </ResponsiveActions>
      ),
    },
  ];

  return (
    <Space orientation="vertical" style={fullWidthStyle}>
      <Card title="我的钱包">
        <Descriptions column={responsiveDescriptionColumns} size="small">
          <Descriptions.Item label="可用余额">{formatWalletAmount(walletSummaryQuery.data?.available_balance || 0)}</Descriptions.Item>
          <Descriptions.Item label="冻结余额">{formatWalletAmount(walletSummaryQuery.data?.frozen_balance || 0)}</Descriptions.Item>
          <Descriptions.Item label="累计收入">{formatWalletAmount(walletSummaryQuery.data?.total_income || 0)}</Descriptions.Item>
          <Descriptions.Item label="累计提现">{formatWalletAmount(walletSummaryQuery.data?.total_withdrawn || 0)}</Descriptions.Item>
        </Descriptions>
        <Form form={withdrawalForm} layout="vertical" style={{ marginTop: 16 }} onFinish={(values) => createWithdrawalMutation.mutate(values)}>
          <Row gutter={16} align="bottom">
            <Col xs={24} md={12} xl={6}>
              <Form.Item label="提现金额" name="amount" rules={[{ required: true, message: '请输入提现金额' }]}><InputNumber min={1} style={fullWidthStyle} /></Form.Item>
            </Col>
            <Col xs={24} md={12} xl={6}>
              <Form.Item label="提现渠道" name="pay_channel" rules={[{ required: true, message: '请输入提现渠道' }]}><Input /></Form.Item>
            </Col>
            <Col xs={24} md={12} xl={6}>
              <Form.Item label="收款账号" name="account" rules={[{ required: true, message: '请输入收款账号' }]}><Input /></Form.Item>
            </Col>
            <Col xs={24} md={12} xl={6}>
              <Form.Item label="提现请求 ID" name="client_request_id" rules={[{ required: true, message: '请输入请求 ID' }]}><Input /></Form.Item>
            </Col>
            <Col xs={24}>
              <Button type="primary" htmlType="submit">提交提现</Button>
            </Col>
          </Row>
        </Form>
      </Card>
      <Card title="钱包流水">
        <Table rowKey="id" loading={ledgerQuery.isLoading} columns={ledgerColumns} dataSource={ledgerQuery.data?.items || []} pagination={false} scroll={adminTableScroll} />
      </Card>
      <Card title="提现申请">
        <Table rowKey="id" loading={withdrawalsQuery.isLoading} columns={withdrawalColumns} dataSource={withdrawalsQuery.data?.items || []} pagination={false} scroll={adminTableScroll} />
      </Card>
      <Card title="我的裂变">
        <Descriptions column={responsiveDescriptionColumns} size="small">
          <Descriptions.Item label="邀请码">{referralSummaryQuery.data?.invite_code || '-'}</Descriptions.Item>
          <Descriptions.Item label="分享链接"><span style={wrapTextStyle}>{referralSummaryQuery.data?.share_link || '-'}</span></Descriptions.Item>
          <Descriptions.Item label="注册数">{referralSummaryQuery.data?.registered_count || 0}</Descriptions.Item>
          <Descriptions.Item label="待审核">{referralSummaryQuery.data?.pending_review_count || 0}</Descriptions.Item>
        </Descriptions>
        <Table rowKey="id" dataSource={referralRecordsQuery.data?.items || []} pagination={false} scroll={adminTableScroll} columns={[{ title: '被邀请人', dataIndex: 'invitee_display', width: 180 }, { title: '状态', dataIndex: 'status', width: 120 }]} />
      </Card>
      <Card title="我的实名">
        <Descriptions column={twoColumnDescription} size="small">
          <Descriptions.Item label="状态">{realNameQuery.data?.status_label || '-'}</Descriptions.Item>
          <Descriptions.Item label="姓名">{realNameQuery.data?.real_name_masked || '-'}</Descriptions.Item>
          <Descriptions.Item label="证件">{realNameQuery.data?.id_number_masked || '-'}</Descriptions.Item>
        </Descriptions>
        <Space direction="vertical" size={12} style={{ marginTop: 16 }}>
          <span style={wrapTextStyle}>实名认证入口已统一收口到个人设置，若需提交或重新提交，请前往个人设置完成。</span>
          <Button type="link" href="/account/center?tab=security" style={{ paddingInline: 0 }}>
            去个人设置实名
          </Button>
        </Space>
        <Table rowKey="created_at" dataSource={realNameLogsQuery.data || []} pagination={false} scroll={adminTableScroll} columns={[{ title: '动作', dataIndex: 'action_label', width: 160 }, { title: '备注', dataIndex: 'note', width: 260, render: (value) => <span style={wrapTextStyle}>{value || '-'}</span> }]} />
      </Card>
      <Card title="个人设置">
        <Form form={settingForm} layout="vertical" onFinish={(values) => putSettingMutation.mutate(values)}>
          <Row gutter={16} align="bottom">
            <Col xs={24} md={8}>
              <Form.Item label="设置 Key" name="key" rules={[{ required: true, message: '请输入设置 Key' }]}><Input /></Form.Item>
            </Col>
            <Col xs={24} md={10}>
              <Form.Item label="设置值" name="value" rules={[{ required: true, message: '请输入设置值' }]}><Input /></Form.Item>
            </Col>
            <Col xs={24} md={6}>
              <Form.Item label=" " colon={false}>
                <Button type="primary" htmlType="submit">保存个人设置</Button>
              </Form.Item>
            </Col>
          </Row>
        </Form>
        <Table
          rowKey="key"
          dataSource={userSettingsQuery.data || []}
          pagination={false}
          scroll={adminTableScroll}
          columns={[
            { title: 'Key', dataIndex: 'key', width: 180 },
            { title: 'Value', dataIndex: 'value', width: 260, render: (value) => <span style={wrapTextStyle}>{String(value)}</span> },
            {
              title: '操作',
              dataIndex: 'actions',
              width: 120,
              render: (_value, record) => (
                <ResponsiveActions>
                  <a onClick={() => setSettingDetailKey(record.key)}>详情</a>
                  <a onClick={() => void deleteSettingMutation.mutateAsync(record.key)}>删除</a>
                </ResponsiveActions>
              ),
            },
          ]}
        />
      </Card>
      <Drawer title="提现详情" open={Boolean(withdrawalDetailId)} onClose={() => setWithdrawalDetailId(undefined)} width={drawerWidthMd}>
        <Descriptions column={1} bordered size="small">
          <Descriptions.Item label="提现 ID">{withdrawalDetailQuery.data?.id || '-'}</Descriptions.Item>
          <Descriptions.Item label="状态">{withdrawalDetailQuery.data?.status || '-'}</Descriptions.Item>
          <Descriptions.Item label="金额">{formatWalletAmount(withdrawalDetailQuery.data?.amount || 0)}</Descriptions.Item>
          <Descriptions.Item label="手续费">{formatWalletAmount(withdrawalDetailQuery.data?.fee_amount || 0)}</Descriptions.Item>
          <Descriptions.Item label="到账金额">{formatWalletAmount(withdrawalDetailQuery.data?.net_amount || 0)}</Descriptions.Item>
          <Descriptions.Item label="渠道">{withdrawalDetailQuery.data?.pay_channel || '-'}</Descriptions.Item>
          <Descriptions.Item label="收款快照">
            <WrappedCodeText value={withdrawalDetailQuery.data?.payee_account_snapshot || '-'} />
          </Descriptions.Item>
          <Descriptions.Item label="驳回原因">{withdrawalDetailQuery.data?.reject_reason || '-'}</Descriptions.Item>
          <Descriptions.Item label="创建时间">{withdrawalDetailQuery.data?.created_at ? dayjs(withdrawalDetailQuery.data.created_at).format('YYYY-MM-DD HH:mm') : '-'}</Descriptions.Item>
          <Descriptions.Item label="审核时间">{withdrawalDetailQuery.data?.reviewed_at ? dayjs(withdrawalDetailQuery.data.reviewed_at).format('YYYY-MM-DD HH:mm') : '-'}</Descriptions.Item>
        </Descriptions>
      </Drawer>
      <Drawer title="个人设置详情" open={Boolean(settingDetailKey)} onClose={() => setSettingDetailKey(undefined)} width={drawerWidthSm}>
        <Descriptions column={1} bordered size="small">
          <Descriptions.Item label="Key">{settingDetailQuery.data?.key || '-'}</Descriptions.Item>
          <Descriptions.Item label="Value">
            <span style={codeWrapStyle}>{settingDetailQuery.data ? JSON.stringify(settingDetailQuery.data.value) : '-'}</span>
          </Descriptions.Item>
        </Descriptions>
      </Drawer>
    </Space>
  );
};

export default PersonalBusinessPage;
