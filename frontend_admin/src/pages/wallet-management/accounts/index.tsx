import { useMutation, useQuery } from '@tanstack/react-query';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { PageContainer, ProTable } from '@ant-design/pro-components';
import {
  Button,
  Card,
  Col,
  Drawer,
  Form,
  Input,
  InputNumber,
  Modal,
  Row,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import React, { useRef, useState } from 'react';
import {
  adminTableScroll,
  drawerWidthXl,
  fullWidthStyle,
  ResponsiveActions,
  wrapTextStyle,
} from '@/pages/_shared/adminLayout';
import {
  appsWalletApiAdminWalletLedger,
  appsWalletApiCreateAdjustment,
  appsWalletApiListWalletAccounts,
} from '@/services/openapi/walletAdmin';
import { formatWalletAmount, walletQueryKeys } from '../shared';

type AccountInsight = API.WalletAccountAdminOut & {
  total_balance: number;
  governance_label: string;
  governance_color: string;
};
type TablePageParams = {
  current?: number;
  pageSize?: number;
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

function buildAccountInsight(
  account: API.WalletAccountAdminOut,
): AccountInsight {
  const totalBalance = account.available_balance + account.frozen_balance;
  const withdrawalRatio =
    account.total_income > 0
      ? account.total_withdrawn / account.total_income
      : 0;

  if (account.frozen_balance > 0 && account.available_balance === 0) {
    return {
      ...account,
      total_balance: totalBalance,
      governance_label: '冻结待核查',
      governance_color: 'red',
    };
  }

  if (account.frozen_balance > 0) {
    return {
      ...account,
      total_balance: totalBalance,
      governance_label: '部分资金冻结',
      governance_color: 'gold',
    };
  }

  if (
    account.total_income === 0 &&
    account.total_withdrawn === 0 &&
    totalBalance === 0
  ) {
    return {
      ...account,
      total_balance: totalBalance,
      governance_label: '待激活',
      governance_color: 'default',
    };
  }

  if (account.available_balance > 0 && account.total_withdrawn === 0) {
    return {
      ...account,
      total_balance: totalBalance,
      governance_label: '余额沉淀中',
      governance_color: 'green',
    };
  }

  if (withdrawalRatio >= 0.8) {
    return {
      ...account,
      total_balance: totalBalance,
      governance_label: '提现占比较高',
      governance_color: 'blue',
    };
  }

  return {
    ...account,
    total_balance: totalBalance,
    governance_label: '经营中',
    governance_color: 'cyan',
  };
}

const WalletAccountsPage: React.FC = () => {
  const [ledgerUserId, setLedgerUserId] = useState<number>();
  const [selectedAccount, setSelectedAccount] = useState<AccountInsight>();
  const [adjustOpen, setAdjustOpen] = useState(false);
  const tableActionRef = useRef<ActionType>(null);
  const [form] = Form.useForm<API.WalletAdjustmentIn>();

  const ledgerQuery = useQuery({
    queryKey: walletQueryKeys.ledger(ledgerUserId, 1),
    queryFn: () =>
      appsWalletApiAdminWalletLedger({
        user_id: ledgerUserId || 0,
        page: 1,
        page_size: 10,
      }),
    enabled: Boolean(ledgerUserId),
  });
  const adjustMutation = useMutation({
    mutationFn: (payload: API.WalletAdjustmentIn) =>
      appsWalletApiCreateAdjustment(payload),
    onSuccess: async () => {
      setAdjustOpen(false);
      form.resetFields();
      tableActionRef.current?.reload();
      await ledgerQuery.refetch();
    },
  });

  const columns: ProColumns<AccountInsight>[] = [
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
      width: 140,
      render: (_value, record) => <Tag color={record.governance_color}>{record.governance_label}</Tag>,
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
      title: '操作',
      dataIndex: 'actions',
      width: 160,
      render: (_value, record) => (
        <ResponsiveActions>
          <a
            onClick={() => {
              setSelectedAccount(record);
              setLedgerUserId(record.user_id);
            }}
          >
            查看流水
          </a>
          <a
            onClick={() => {
              form.setFieldsValue({
                user_id: record.user_id,
                amount: undefined,
                idempotency_key: '',
                remark: '',
              });
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
    {
      title: '变动金额',
      dataIndex: 'amount_delta',
      width: 140,
      render: formatWalletAmount,
    },
    {
      title: '可用余额',
      dataIndex: 'available_balance_after',
      width: 140,
      render: formatWalletAmount,
    },
    {
      title: '冻结余额',
      dataIndex: 'frozen_balance_after',
      width: 140,
      render: formatWalletAmount,
    },
    {
      title: '业务',
      dataIndex: 'biz_type',
      width: 180,
      render: (_value, record) => `${record.biz_type} / ${record.biz_id}`,
    },
    {
      title: '备注',
      dataIndex: 'remark',
      width: 260,
      render: (value) => <span style={wrapTextStyle}>{value || '-'}</span>,
    },
    {
      title: '时间',
      dataIndex: 'created_at',
      width: 170,
      render: (value) => dayjs(value).format('YYYY-MM-DD HH:mm'),
    },
  ];

  return (
    <PageContainer title="钱包账户" subTitle="查看用户钱包账户与流水。">
      <Space orientation="vertical" size={16} style={fullWidthStyle}>
        <Card>
          <ProTable<AccountInsight>
            actionRef={tableActionRef}
            rowKey="id"
            headerTitle="账户列表"
            columns={columns}
            request={async (params: TablePageParams) => {
              const result = await appsWalletApiListWalletAccounts({
                page: params.current || 1,
                page_size: params.pageSize || 10,
              });
              return {
                data: (result.items || []).map(buildAccountInsight),
                total: result.total || 0,
                success: true,
              };
            }}
            search={false}
            options={{ density: true, reload: false, setting: true }}
            toolBarRender={() => [
              <Button
                key="adjust"
                type="primary"
                onClick={() => {
                  form.resetFields();
                  setAdjustOpen(true);
                }}
              >
                创建调账
              </Button>,
            ]}
            ghost
            scroll={adminTableScroll}
            pagination={{ defaultPageSize: 10 }}
          />
        </Card>

        <Drawer
          title={ledgerUserId ? `用户 #${ledgerUserId} 钱包流水` : '钱包流水'}
          open={Boolean(ledgerUserId)}
          width={drawerWidthXl}
          onClose={() => {
            setLedgerUserId(undefined);
            setSelectedAccount(undefined);
          }}
        >
          <Space orientation="vertical" size={16} style={fullWidthStyle}>
            <div style={sectionStyle}>
              <Typography.Text strong>账户资金概览</Typography.Text>
              <Row gutter={[12, 12]} style={{ marginTop: 16 }}>
                <Col xs={24} sm={12} xl={6}>
                  <div style={overviewTileStyle}>
                    <Statistic
                      title="可用余额"
                      value={selectedAccount?.available_balance || 0}
                      formatter={(value) =>
                        formatWalletAmount(Number(value || 0))
                      }
                    />
                  </div>
                </Col>
                <Col xs={24} sm={12} xl={6}>
                  <div style={overviewTileStyle}>
                    <Statistic
                      title="冻结余额"
                      value={selectedAccount?.frozen_balance || 0}
                      formatter={(value) =>
                        formatWalletAmount(Number(value || 0))
                      }
                    />
                  </div>
                </Col>
                <Col xs={24} sm={12} xl={6}>
                  <div style={overviewTileStyle}>
                    <Statistic
                      title="累计收入"
                      value={selectedAccount?.total_income || 0}
                      formatter={(value) =>
                        formatWalletAmount(Number(value || 0))
                      }
                    />
                  </div>
                </Col>
                <Col xs={24} sm={12} xl={6}>
                  <div style={overviewTileStyle}>
                    <Statistic
                      title="累计提现"
                      value={selectedAccount?.total_withdrawn || 0}
                      formatter={(value) =>
                        formatWalletAmount(Number(value || 0))
                      }
                    />
                  </div>
                </Col>
              </Row>
            </div>

            <div style={sectionStyle}>
              <Typography.Text strong>账户流水台账</Typography.Text>
              <Table
                rowKey="id"
                loading={ledgerQuery.isLoading}
                columns={ledgerColumns}
                dataSource={ledgerQuery.data?.items || []}
                pagination={false}
                scroll={adminTableScroll}
                style={{ marginTop: 16 }}
              />
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
            <Form form={form} layout="vertical">
              <Form.Item
                label="用户 ID"
                name="user_id"
                rules={[{ required: true, message: '请输入用户 ID' }]}
              >
                <InputNumber min={1} style={fullWidthStyle} />
              </Form.Item>
              <Form.Item
                label="金额"
                name="amount"
                rules={[{ required: true, message: '请输入金额' }]}
              >
                <InputNumber style={fullWidthStyle} />
              </Form.Item>
              <Form.Item
                label="幂等键"
                name="idempotency_key"
                rules={[{ required: true, message: '请输入幂等键' }]}
              >
                <Input />
              </Form.Item>
              <Form.Item label="备注" name="remark">
                <Input.TextArea
                  rows={3}
                  placeholder="请输入调账原因"
                />
              </Form.Item>
            </Form>
          </Space>
        </Modal>
      </Space>
    </PageContainer>
  );
};

export default WalletAccountsPage;
