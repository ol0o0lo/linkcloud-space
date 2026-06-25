import { useMutation, useQuery } from '@tanstack/react-query';
import { Alert, Button, Card, Col, Drawer, Form, Input, InputNumber, Modal, Row, Space, Statistic, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import React, { useMemo, useState } from 'react';
import { AdminToolbar, adminTableScroll, drawerWidthXl, fullWidthStyle, ResponsiveActions, wrapTextStyle } from '@/pages/_shared/adminLayout';
import {
  appsWalletApiAdminWalletLedger,
  appsWalletApiCreateAdjustment,
  appsWalletApiListWalletAccounts,
} from '@/services/openapi/walletAdmin';
import { formatWalletAmount, walletQueryKeys } from '../shared';

type GovernanceSignal = {
  key: string;
  title: string;
  emphasis: string;
  summary: string;
  description: string;
  actionLabel: string;
  actionHref: string;
};

type AccountInsight = API.WalletAccountAdminOut & {
  total_balance: number;
  governance_label: string;
  governance_summary: string;
  governance_color: string;
  operating_label: string;
  operating_summary: string;
  operating_color: string;
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

function buildAccountInsight(account: API.WalletAccountAdminOut): AccountInsight {
  const totalBalance = account.available_balance + account.frozen_balance;
  const withdrawalRatio = account.total_income > 0 ? account.total_withdrawn / account.total_income : 0;

  if (account.frozen_balance > 0 && account.available_balance === 0) {
    return {
      ...account,
      total_balance: totalBalance,
      governance_label: '冻结待核查',
      governance_summary: '余额主要停留在冻结资金，应优先核查提现审核、对账差异或人工冻结原因。',
      governance_color: 'red',
      operating_label: '优先核冻结来源',
      operating_summary: '先去提现审核或对账链路确认冻结资金能否释放，再决定是否调账。',
      operating_color: 'red',
    };
  }

  if (account.frozen_balance > 0) {
    return {
      ...account,
      total_balance: totalBalance,
      governance_label: '冻结与可用并存',
      governance_summary: '账户同时存在可用与冻结资金，适合列入重点跟踪名单，避免账务解释不清。',
      governance_color: 'gold',
      operating_label: '跟进资金拆分',
      operating_summary: '确认冻结资金去向和可用余额是否还能继续承接提现或返款。',
      operating_color: 'gold',
    };
  }

  if (account.total_income === 0 && account.total_withdrawn === 0 && totalBalance === 0) {
    return {
      ...account,
      total_balance: totalBalance,
      governance_label: '待激活',
      governance_summary: '账户尚未进入真实收支周期，当前更像一个空台账对象。',
      governance_color: 'default',
      operating_label: '观察是否要纳入运营',
      operating_summary: '如果对应用户暂时没有业务收益场景，可以保持空账户并延后治理动作。',
      operating_color: 'default',
    };
  }

  if (account.available_balance > 0 && account.total_withdrawn === 0) {
    return {
      ...account,
      total_balance: totalBalance,
      governance_label: '余额沉淀中',
      governance_summary: '账户已经形成可用余额，但仍未发生提现动作，适合观察结算节奏。',
      governance_color: 'green',
      operating_label: '跟进结算准备度',
      operating_summary: '核对收款信息、提现策略和结算周期，避免资金长期沉淀。',
      operating_color: 'green',
    };
  }

  if (withdrawalRatio >= 0.8) {
    return {
      ...account,
      total_balance: totalBalance,
      governance_label: '提现占比较高',
      governance_summary: '累计提现已接近累计收入，账户更适合作为结算与对账对象持续观察。',
      governance_color: 'blue',
      operating_label: '关注结算闭环',
      operating_summary: '结合提现审核、代付和对账页面，确认这类账户是否存在重复出款或状态滞后。',
      operating_color: 'blue',
    };
  }

  return {
    ...account,
    total_balance: totalBalance,
    governance_label: '经营中',
    governance_summary: '账户已进入正常收支承接周期，可作为常规经营账户继续观察。',
    governance_color: 'cyan',
    operating_label: '常规跟踪',
    operating_summary: '保持流水可追溯和余额解释清晰即可，不需要额外人工干预。',
    operating_color: 'cyan',
  };
}

const WalletAccountsPage: React.FC = () => {
  const [page, setPage] = useState(1);
  const [ledgerUserId, setLedgerUserId] = useState<number>();
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [form] = Form.useForm<API.WalletAdjustmentIn>();

  const accountsQuery = useQuery({
    queryKey: walletQueryKeys.accounts(page),
    queryFn: () => appsWalletApiListWalletAccounts({ page, page_size: 10 }),
  });
  const ledgerQuery = useQuery({
    queryKey: walletQueryKeys.ledger(ledgerUserId, 1),
    queryFn: () => appsWalletApiAdminWalletLedger({ user_id: ledgerUserId!, page: 1, page_size: 10 }),
    enabled: Boolean(ledgerUserId),
  });
  const adjustMutation = useMutation({
    mutationFn: (payload: API.WalletAdjustmentIn) => appsWalletApiCreateAdjustment(payload),
    onSuccess: async () => {
      setAdjustOpen(false);
      form.resetFields();
      await accountsQuery.refetch();
      await ledgerQuery.refetch();
    },
  });

  const accountInsights = useMemo(() => (accountsQuery.data?.items || []).map(buildAccountInsight), [accountsQuery.data?.items]);
  const selectedAccount = useMemo(() => accountInsights.find((item) => item.user_id === ledgerUserId), [accountInsights, ledgerUserId]);

  const fundedAccounts = accountInsights.filter((item) => item.total_balance > 0 || item.total_income > 0 || item.total_withdrawn > 0);
  const frozenAccounts = accountInsights.filter((item) => item.frozen_balance > 0);
  const dormantAccounts = accountInsights.filter((item) => item.total_balance === 0 && item.total_income === 0 && item.total_withdrawn === 0);
  const retainedBalanceAccounts = accountInsights.filter((item) => item.available_balance > 0 && item.total_withdrawn === 0);
  const payoutReadyAccounts = accountInsights.filter((item) => item.available_balance > 0 && item.frozen_balance === 0);
  const highWithdrawalAccounts = accountInsights.filter((item) => item.total_income > 0 && item.total_withdrawn / item.total_income >= 0.8);

  const closureSignals = useMemo<GovernanceSignal[]>(
    () => [
      {
        key: 'frozen',
        title: '冻结资金',
        emphasis: frozenAccounts.length ? `${frozenAccounts.length} 个账户待核查` : '冻结资金已收口',
        summary: frozenAccounts.length
          ? '冻结资金账户需要优先串联提现审核、代付和对账链路，否则余额解释会长期不清。'
          : '当前没有发现冻结资金账户，钱包台账相对干净。',
        description: '冻结资金不一定有问题，但一定要有明确原因、责任入口和释放路径。',
        actionLabel: '进入提现审核',
        actionHref: '/dashboard/wallet-management/withdrawals',
      },
      {
        key: 'dormant',
        title: '空账户治理',
        emphasis: dormantAccounts.length ? `${dormantAccounts.length} 个待激活账户` : '空账户数量可控',
        summary: dormantAccounts.length
          ? '空账户不必强行处理，但应明确它们是待进入业务，还是仅作为系统预置对象保留。'
          : '当前账户大多已进入真实业务承接阶段。',
        description: '企业后台不怕空对象，怕的是空对象越来越多，却没人知道该不该纳入运营。',
        actionLabel: '查看个人经营',
        actionHref: '/dashboard/personal-business/overview',
      },
      {
        key: 'retained',
        title: '余额沉淀',
        emphasis: retainedBalanceAccounts.length ? `${retainedBalanceAccounts.length} 个账户待跟进结算` : '沉淀压力较低',
        summary: retainedBalanceAccounts.length
          ? '可用余额长期沉淀通常意味着提现资料、结算节奏或业务提醒没有形成闭环。'
          : '当前可用余额的沉淀情况比较轻，结算节奏相对健康。',
        description: '这类账户不一定需要立刻处理，但很适合作为运营或财务的日常跟进清单。',
        actionLabel: '查看提现审核',
        actionHref: '/dashboard/wallet-management/withdrawals',
      },
      {
        key: 'withdrawal',
        title: '结算节奏',
        emphasis: highWithdrawalAccounts.length ? `${highWithdrawalAccounts.length} 个账户提现占比高` : '结算节奏平稳',
        summary: highWithdrawalAccounts.length
          ? '高提现占比账户更需要确认提现状态、代付状态和最终到账的一致性。'
          : '当前账户结算节奏整体正常，没有明显集中出款压力。',
        description: '钱包账户页负责解释“资金现在在哪”，提现页负责解释“这笔钱为什么到了那里”。',
        actionLabel: '进入提现管理',
        actionHref: '/dashboard/wallet-management/withdrawals',
      },
    ],
    [dormantAccounts.length, frozenAccounts.length, highWithdrawalAccounts.length, retainedBalanceAccounts.length],
  );

  const columns: ColumnsType<AccountInsight> = [
    {
      title: '用户',
      dataIndex: 'user_id',
      width: 180,
      render: (_value, record) => (
        <Space orientation="vertical" size={4}>
          <Typography.Text strong>{`用户 #${record.user_id}`}</Typography.Text>
          <Typography.Text type="secondary">{`总余额 ${formatWalletAmount(record.total_balance)}`}</Typography.Text>
        </Space>
      ),
    },
    {
      title: '账户状态',
      dataIndex: 'governance_label',
      width: 260,
      render: (_value, record) => (
        <Space orientation="vertical" size={6}>
          <Tag color={record.governance_color}>{record.governance_label}</Tag>
          <Typography.Text type="secondary">{record.governance_summary}</Typography.Text>
        </Space>
      ),
    },
    {
      title: '资金结构',
      dataIndex: 'funding',
      width: 220,
      render: (_value, record) => (
        <Space orientation="vertical" size={4}>
          <Typography.Text>{`可用 ${formatWalletAmount(record.available_balance)}`}</Typography.Text>
          <Typography.Text type="secondary">{`冻结 ${formatWalletAmount(record.frozen_balance)}`}</Typography.Text>
        </Space>
      ),
    },
    {
      title: '经营结果',
      dataIndex: 'settlement',
      width: 220,
      render: (_value, record) => (
        <Space orientation="vertical" size={4}>
          <Typography.Text>{`累计收入 ${formatWalletAmount(record.total_income)}`}</Typography.Text>
          <Typography.Text type="secondary">{`累计提现 ${formatWalletAmount(record.total_withdrawn)}`}</Typography.Text>
        </Space>
      ),
    },
    {
      title: '执行建议',
      dataIndex: 'operating_label',
      width: 260,
      render: (_value, record) => (
        <Space orientation="vertical" size={6}>
          <Tag color={record.operating_color}>{record.operating_label}</Tag>
          <Typography.Text type="secondary">{record.operating_summary}</Typography.Text>
        </Space>
      ),
    },
    {
      title: '操作',
      dataIndex: 'actions',
      width: 160,
      render: (_value, record) => (
        <ResponsiveActions>
          <a onClick={() => setLedgerUserId(record.user_id)}>查看流水</a>
          <a
            onClick={() => {
              form.setFieldsValue({ user_id: record.user_id, amount: undefined, idempotency_key: '', remark: '' });
              setAdjustOpen(true);
            }}
          >
            创建调账
          </a>
        </ResponsiveActions>
      ),
    },
  ];

  const ledgerColumns: ColumnsType<API.WalletLedgerOut> = [
    { title: '类型', dataIndex: 'entry_type', width: 120 },
    { title: '变动金额', dataIndex: 'amount_delta', width: 140, render: formatWalletAmount },
    { title: '可用余额', dataIndex: 'available_balance_after', width: 140, render: formatWalletAmount },
    { title: '冻结余额', dataIndex: 'frozen_balance_after', width: 140, render: formatWalletAmount },
    { title: '业务', dataIndex: 'biz_type', width: 180, render: (_value, record) => `${record.biz_type} / ${record.biz_id}` },
    { title: '备注', dataIndex: 'remark', width: 260, render: (value) => <span style={wrapTextStyle}>{value || '-'}</span> },
    { title: '时间', dataIndex: 'created_at', width: 170, render: (value) => dayjs(value).format('YYYY-MM-DD HH:mm') },
  ];

  return (
    <Space orientation="vertical" size={16} style={fullWidthStyle}>
      <Card
        title="钱包账户"
        extra={
          <AdminToolbar>
            <Button
              type="primary"
              onClick={() => {
                form.resetFields();
                setAdjustOpen(true);
              }}
            >
              创建调账
            </Button>
          </AdminToolbar>
        }
      >
        <div style={sectionStyle}>
          <Typography.Text strong>账户治理概览</Typography.Text>
          <Row gutter={[12, 12]} style={{ marginTop: 16 }}>
            <Col xs={24} sm={12} xl={6}>
              <div style={overviewTileStyle}>
                <Statistic title="当前账户" value={accountInsights.length} />
                <Typography.Text type="secondary">当前页已纳入观察的钱包账户数。</Typography.Text>
              </div>
            </Col>
            <Col xs={24} sm={12} xl={6}>
              <div style={overviewTileStyle}>
                <Statistic title="已进入经营" value={fundedAccounts.length} />
                <Typography.Text type="secondary">已经形成余额、收入或提现记录的账户数量。</Typography.Text>
              </div>
            </Col>
            <Col xs={24} sm={12} xl={6}>
              <div style={overviewTileStyle}>
                <Statistic title="冻结资金账户" value={frozenAccounts.length} />
                <Typography.Text type="secondary">这类账户优先看冻结原因与释放路径是否清楚。</Typography.Text>
              </div>
            </Col>
            <Col xs={24} sm={12} xl={6}>
              <div style={overviewTileStyle}>
                <Statistic title="可结算账户" value={payoutReadyAccounts.length} />
                <Typography.Text type="secondary">存在可用余额且未被冻结的账户，更接近真实结算对象。</Typography.Text>
              </div>
            </Col>
          </Row>
        </div>

        <div style={{ ...sectionStyle, marginTop: 16 }}>
          <Typography.Text strong>当前账户执行面</Typography.Text>
          <Row gutter={[12, 12]} style={{ marginTop: 16 }}>
            <Col xs={24} md={12} xl={6}>
              <div style={overviewTileStyle}>
                <Space orientation="vertical" size={8}>
                  <Space wrap size={[8, 8]}>
                    <Typography.Text strong>冻结资金账户</Typography.Text>
                    <Tag color={frozenAccounts.length ? 'red' : 'default'}>{frozenAccounts.length ? `${frozenAccounts.length} 个待处理` : '暂无异常'}</Tag>
                  </Space>
                  <Typography.Text>这类账户需要首先串联提现审核、代付与对账流程，确认冻结是业务过程还是异常状态。</Typography.Text>
                  <a href="/dashboard/wallet-management/withdrawals">进入提现管理</a>
                </Space>
              </div>
            </Col>
            <Col xs={24} md={12} xl={6}>
              <div style={overviewTileStyle}>
                <Space orientation="vertical" size={8}>
                  <Space wrap size={[8, 8]}>
                    <Typography.Text strong>待激活账户</Typography.Text>
                    <Tag color={dormantAccounts.length ? 'gold' : 'default'}>{dormantAccounts.length ? `${dormantAccounts.length} 个空账户` : '已基本激活'}</Tag>
                  </Space>
                  <Typography.Text>空账户可以存在，但要分清它们是业务预置对象，还是已经被遗忘的空台账。</Typography.Text>
                  <a href="/dashboard/personal-business/overview">查看个人经营</a>
                </Space>
              </div>
            </Col>
            <Col xs={24} md={12} xl={6}>
              <div style={overviewTileStyle}>
                <Space orientation="vertical" size={8}>
                  <Space wrap size={[8, 8]}>
                    <Typography.Text strong>余额沉淀账户</Typography.Text>
                    <Tag color={retainedBalanceAccounts.length ? 'green' : 'default'}>{retainedBalanceAccounts.length ? `${retainedBalanceAccounts.length} 个待跟进` : '沉淀较低'}</Tag>
                  </Space>
                  <Typography.Text>账户已经积累可用余额，但还没有形成提现动作，适合作为运营或财务的日常跟进清单。</Typography.Text>
                  <a href="/dashboard/wallet-management/withdrawals">跟进提现准备</a>
                </Space>
              </div>
            </Col>
            <Col xs={24} md={12} xl={6}>
              <div style={overviewTileStyle}>
                <Space orientation="vertical" size={8}>
                  <Space wrap size={[8, 8]}>
                    <Typography.Text strong>高结算账户</Typography.Text>
                    <Tag color={highWithdrawalAccounts.length ? 'blue' : 'default'}>{highWithdrawalAccounts.length ? `${highWithdrawalAccounts.length} 个重点观察` : '结算平稳'}</Tag>
                  </Space>
                  <Typography.Text>累计提现占比较高的账户更需要确认提现审核、代付状态和最终到账是否一致。</Typography.Text>
                  <a href="/dashboard/wallet-management/withdrawals">查看代付进度</a>
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
              <Typography.Text strong>账户治理台账</Typography.Text>
              <Typography.Paragraph type="secondary" style={{ marginBottom: 0, marginTop: 8 }}>
                先解释每个账户当前的资金状态，再把查看流水和创建调账收口到同一张治理台账里，方便运营、财务和管理员协同处理。
              </Typography.Paragraph>
            </div>
            <Table
              rowKey="id"
              loading={accountsQuery.isLoading}
              columns={columns}
              dataSource={accountInsights}
              scroll={adminTableScroll}
              pagination={{
                current: accountsQuery.data?.page || page,
                pageSize: accountsQuery.data?.page_size || 10,
                total: accountsQuery.data?.total || 0,
                onChange: setPage,
              }}
            />
          </Space>
        </div>
      </Card>

      <Drawer title={ledgerUserId ? `用户 #${ledgerUserId} 钱包流水` : '钱包流水'} open={Boolean(ledgerUserId)} width={drawerWidthXl} onClose={() => setLedgerUserId(undefined)}>
        <Space orientation="vertical" size={16} style={fullWidthStyle}>
          <div style={sectionStyle}>
            <Typography.Text strong>账户资金概览</Typography.Text>
            <Row gutter={[12, 12]} style={{ marginTop: 16 }}>
              <Col xs={24} sm={12} xl={6}>
                <div style={overviewTileStyle}>
                  <Statistic title="可用余额" value={selectedAccount?.available_balance || 0} formatter={(value) => formatWalletAmount(Number(value || 0))} />
                </div>
              </Col>
              <Col xs={24} sm={12} xl={6}>
                <div style={overviewTileStyle}>
                  <Statistic title="冻结余额" value={selectedAccount?.frozen_balance || 0} formatter={(value) => formatWalletAmount(Number(value || 0))} />
                </div>
              </Col>
              <Col xs={24} sm={12} xl={6}>
                <div style={overviewTileStyle}>
                  <Statistic title="累计收入" value={selectedAccount?.total_income || 0} formatter={(value) => formatWalletAmount(Number(value || 0))} />
                </div>
              </Col>
              <Col xs={24} sm={12} xl={6}>
                <div style={overviewTileStyle}>
                  <Statistic title="累计提现" value={selectedAccount?.total_withdrawn || 0} formatter={(value) => formatWalletAmount(Number(value || 0))} />
                </div>
              </Col>
            </Row>
          </div>

          {selectedAccount ? (
            <div style={sectionStyle}>
              <Row gutter={[12, 12]}>
                <Col xs={24} md={12}>
                  <div style={overviewTileStyle}>
                    <Space orientation="vertical" size={8}>
                      <Typography.Text strong>当前状态</Typography.Text>
                      <Tag color={selectedAccount.governance_color}>{selectedAccount.governance_label}</Tag>
                      <Typography.Text>{selectedAccount.governance_summary}</Typography.Text>
                    </Space>
                  </div>
                </Col>
                <Col xs={24} md={12}>
                  <div style={overviewTileStyle}>
                    <Space orientation="vertical" size={8}>
                      <Typography.Text strong>建议动作</Typography.Text>
                      <Tag color={selectedAccount.operating_color}>{selectedAccount.operating_label}</Tag>
                      <Typography.Text>{selectedAccount.operating_summary}</Typography.Text>
                    </Space>
                  </div>
                </Col>
              </Row>
            </div>
          ) : null}

          <div style={sectionStyle}>
            <Typography.Text strong>账户流水台账</Typography.Text>
            <Table rowKey="id" loading={ledgerQuery.isLoading} columns={ledgerColumns} dataSource={ledgerQuery.data?.items || []} pagination={false} scroll={adminTableScroll} style={{ marginTop: 16 }} />
          </div>
        </Space>
      </Drawer>

      <Modal
        title="创建调账"
        open={adjustOpen}
        confirmLoading={adjustMutation.isPending}
        onCancel={() => setAdjustOpen(false)}
        onOk={async () => {
          const values = await form.validateFields();
          await adjustMutation.mutateAsync(values);
        }}
      >
        <Space orientation="vertical" size={12} style={fullWidthStyle}>
          <Alert
            type="info"
            showIcon
            message="调账用于收口异常、补贴或扣减，不建议替代正常的提现、返款或对账流程。"
          />
          <Form form={form} layout="vertical">
            <Form.Item label="用户 ID" name="user_id" rules={[{ required: true, message: '请输入用户 ID' }]}>
              <InputNumber min={1} style={fullWidthStyle} />
            </Form.Item>
            <Form.Item label="金额" name="amount" rules={[{ required: true, message: '请输入金额' }]}>
              <InputNumber style={fullWidthStyle} />
            </Form.Item>
            <Form.Item label="幂等键" name="idempotency_key" rules={[{ required: true, message: '请输入幂等键' }]}>
              <Input />
            </Form.Item>
            <Form.Item label="备注" name="remark">
              <Input.TextArea rows={3} placeholder="说明这次调账为何发生，以及它准备收口哪一类问题。" />
            </Form.Item>
          </Form>
        </Space>
      </Modal>
    </Space>
  );
};

export default WalletAccountsPage;
