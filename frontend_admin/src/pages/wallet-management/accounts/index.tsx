import { useMutation, useQuery } from '@tanstack/react-query';
import { Button, Card, Drawer, Form, Input, InputNumber, Modal, Space, Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import React, { useState } from 'react';
import { AdminToolbar, adminTableScroll, drawerWidthXl, fullWidthStyle, ResponsiveActions, wrapTextStyle } from '@/pages/_shared/adminLayout';
import {
  appsWalletApiAdminWalletLedger,
  appsWalletApiCreateAdjustment,
  appsWalletApiListWalletAccounts,
} from '@/services/openapi/walletAdmin';
import { formatWalletAmount, walletQueryKeys } from '../shared';

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

  const columns: ColumnsType<API.WalletAccountAdminOut> = [
    { title: '用户', dataIndex: 'user_id', width: 140, render: (value) => `用户 #${value}` },
    { title: '可用余额', dataIndex: 'available_balance', width: 140, render: formatWalletAmount },
    { title: '冻结余额', dataIndex: 'frozen_balance', width: 140, render: formatWalletAmount },
    { title: '累计收入', dataIndex: 'total_income', width: 140, render: formatWalletAmount },
    { title: '累计提现', dataIndex: 'total_withdrawn', width: 140, render: formatWalletAmount },
    {
      title: '操作',
      dataIndex: 'actions',
      width: 120,
      render: (_value, record) => <ResponsiveActions><a onClick={() => setLedgerUserId(record.user_id)}>查看流水</a></ResponsiveActions>,
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
    <>
      <Card
        title="钱包账户"
        extra={
          <AdminToolbar>
            <Button type="primary" onClick={() => setAdjustOpen(true)}>
              创建调账
            </Button>
          </AdminToolbar>
        }
      >
        <Table
          rowKey="id"
          loading={accountsQuery.isLoading}
          columns={columns}
          dataSource={accountsQuery.data?.items || []}
          scroll={adminTableScroll}
          pagination={{
            current: accountsQuery.data?.page || page,
            pageSize: accountsQuery.data?.page_size || 10,
            total: accountsQuery.data?.total || 0,
            onChange: setPage,
          }}
        />
      </Card>
      <Drawer title={ledgerUserId ? `用户 #${ledgerUserId} 钱包流水` : '钱包流水'} open={Boolean(ledgerUserId)} width={drawerWidthXl} onClose={() => setLedgerUserId(undefined)}>
        <Table rowKey="id" loading={ledgerQuery.isLoading} columns={ledgerColumns} dataSource={ledgerQuery.data?.items || []} pagination={false} scroll={adminTableScroll} />
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
            <Input />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

export default WalletAccountsPage;
