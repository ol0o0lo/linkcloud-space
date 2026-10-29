import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { ProTable } from '@ant-design/pro-components';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  Alert,
  Button,
  Card,
  Col,
  DatePicker,
  Drawer,
  Form,
  Input,
  InputNumber,
  Modal,
  message,
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
import { PageContainer } from '@/components/PageContainer';
import {
  AdminToolbar,
  adminTableScroll,
  drawerWidthXl,
  fullWidthStyle,
  ResponsiveActions,
  toolbarControlStyle,
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
  username?: string;
  email?: string;
  phone_label?: string;
  real_name_label?: string;
};
type TablePageParams = {
  createdFrom?: string;
  createdTo?: string;
  current?: number;
  keyword?: string;
  pageSize?: number;
};

type AccountSearchState = {
  createdFrom: string;
  createdTo: string;
  keyword: string;
  page: number;
};

const PAGE_SIZE = 10;

const trimParam = (value: unknown) =>
  typeof value === 'string' && value.trim() ? value.trim() : undefined;

function readSearchState(): AccountSearchState {
  const params = new URLSearchParams(window.location.search);
  const page = Number(params.get('page'));
  return {
    page: Number.isInteger(page) && page > 0 ? page : 1,
    keyword: trimParam(params.get('keyword')) || '',
    createdFrom: trimParam(params.get('created_from')) || '',
    createdTo: trimParam(params.get('created_to')) || '',
  };
}

function syncSearchState(state: AccountSearchState) {
  const params = new URLSearchParams(window.location.search);
  ['page', 'keyword', 'created_from', 'created_to'].forEach((name) => {
    params.delete(name);
  });
  if (state.page > 1) params.set('page', String(state.page));
  if (state.keyword) params.set('keyword', state.keyword);
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
      governance_label: '余额全部冻结',
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
      governance_label: '当前无余额',
      governance_color: 'default',
    };
  }

  if (account.available_balance > 0 && account.total_withdrawn === 0) {
    return {
      ...account,
      total_balance: totalBalance,
      governance_label: '有可用余额',
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
  const initialSearchState = React.useMemo(readSearchState, []);
  const [ledgerUserId, setLedgerUserId] = useState<number>();
  const [selectedAccount, setSelectedAccount] = useState<AccountInsight>();
  const [adjustOpen, setAdjustOpen] = useState(false);
  const tableActionRef = useRef<ActionType>(null);
  const [form] = Form.useForm<API.WalletAdjustmentIn>();
  const [searchState, setSearchState] = useState(initialSearchState);
  const [keywordDraft, setKeywordDraft] = useState(initialSearchState.keyword);
  const [listError, setListError] = useState<unknown>();

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
      message.success('调账已创建');
    },
  });

  const updateSearchState = (next: Partial<AccountSearchState>) => {
    setSearchState((current) => {
      const value = { ...current, ...next };
      syncSearchState(value);
      return value;
    });
  };

  const columns: ProColumns<AccountInsight>[] = [
    {
      title: '用户',
      dataIndex: 'user_id',
      width: 220,
      render: (_value, record) => {
        const primary =
          record.real_name_label ||
          record.username ||
          `用户 #${record.user_id}`;
        const contact =
          record.phone_label || record.email || `用户 #${record.user_id}`;
        return (
          <Space orientation="vertical" size={4}>
            <Typography.Text strong>{primary}</Typography.Text>
            <Typography.Text type="secondary">{contact}</Typography.Text>
            <Typography.Text type="secondary">{`总余额 ${formatWalletAmount(record.total_balance)}`}</Typography.Text>
          </Space>
        );
      },
    },
    {
      title: '账户状态',
      dataIndex: 'governance_label',
      width: 140,
      align: 'center',
      render: (_value, record) => (
        <Tag color={record.governance_color}>{record.governance_label}</Tag>
      ),
    },
    {
      title: '资金结构',
      dataIndex: 'funding',
      width: 220,
      align: 'right',
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
      align: 'right',
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
      align: 'center',
      render: (_value, record) => (
        <ResponsiveActions>
          <Button
            type="link"
            size="small"
            onClick={() => {
              setSelectedAccount(record);
              setLedgerUserId(record.user_id);
            }}
          >
            查看流水
          </Button>
          <Button
            type="link"
            size="small"
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
          </Button>
        </ResponsiveActions>
      ),
    },
  ];

  const ledgerColumns: ColumnsType<API.WalletLedgerOut> = [
    { title: '类型', dataIndex: 'entry_type', width: 120, align: 'center' },
    {
      title: '变动金额',
      dataIndex: 'amount_delta',
      width: 140,
      align: 'right',
      render: formatWalletAmount,
    },
    {
      title: '可用余额',
      dataIndex: 'available_balance_after',
      width: 140,
      align: 'right',
      render: formatWalletAmount,
    },
    {
      title: '冻结余额',
      dataIndex: 'frozen_balance_after',
      width: 140,
      align: 'right',
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
      align: 'center',
      render: (value) => dayjs(value).format('YYYY-MM-DD HH:mm'),
    },
  ];

  return (
    <PageContainer title="钱包账户">
      <Space orientation="vertical" size={16} style={fullWidthStyle}>
        <Card>
          {listError ? (
            <Alert
              type="error"
              showIcon
              title="钱包账户加载失败"
              description="暂时无法取得钱包账户，请检查网络后重试。"
              action={
                <Button
                  size="small"
                  onClick={() => tableActionRef.current?.reload()}
                >
                  重新加载账户
                </Button>
              }
              style={{ marginBottom: 16 }}
            />
          ) : null}
          <ProTable<AccountInsight>
            actionRef={tableActionRef}
            rowKey="id"
            headerTitle="账户列表"
            columns={columns}
            request={async (params: TablePageParams) => {
              try {
                const result = await appsWalletApiListWalletAccounts({
                  page: params.current || 1,
                  page_size: params.pageSize || PAGE_SIZE,
                  keyword: trimParam(params.keyword),
                  ...apiDateRange(params.createdFrom, params.createdTo),
                });
                setListError(undefined);
                return {
                  data: (result.items || []).map(buildAccountInsight),
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
              createdFrom: searchState.createdFrom,
              createdTo: searchState.createdTo,
            }}
            search={false}
            options={{ density: true, reload: false, setting: true }}
            toolBarRender={() => [
              <AdminToolbar key="actions">
                <Input.Search
                  aria-label="钱包账户关键词"
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
                <DatePicker.RangePicker
                  aria-label="钱包账户创建时间"
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
                    const reset: AccountSearchState = {
                      page: 1,
                      keyword: '',
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
                  type="primary"
                  onClick={() => {
                    form.resetFields();
                    setAdjustOpen(true);
                  }}
                >
                  创建调账
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
            locale={listError ? { emptyText: '钱包账户加载失败' } : undefined}
          />
        </Card>

        <Drawer
          title={ledgerUserId ? `用户 #${ledgerUserId} 钱包流水` : '钱包流水'}
          open={Boolean(ledgerUserId)}
          size={drawerWidthXl}
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
              <Typography.Text strong>账户流水</Typography.Text>
              {ledgerQuery.isError ? (
                <Alert
                  type="error"
                  showIcon
                  title="账户流水加载失败"
                  action={
                    <Button
                      size="small"
                      onClick={() => void ledgerQuery.refetch()}
                    >
                      重新加载流水
                    </Button>
                  }
                  style={{ marginTop: 16 }}
                />
              ) : (
                <Table
                  rowKey="id"
                  loading={ledgerQuery.isLoading}
                  columns={ledgerColumns}
                  dataSource={ledgerQuery.data?.items || []}
                  pagination={false}
                  scroll={adminTableScroll}
                  style={{ marginTop: 16 }}
                />
              )}
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
            {adjustMutation.isError ? (
              <Alert
                type="error"
                showIcon
                title="调账创建失败，请核对信息后重试"
              />
            ) : null}
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
                <Input.TextArea rows={3} placeholder="请输入调账原因" />
              </Form.Item>
            </Form>
          </Space>
        </Modal>
      </Space>
    </PageContainer>
  );
};

export default WalletAccountsPage;
