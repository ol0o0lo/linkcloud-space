import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { ProTable } from '@ant-design/pro-components';
import { useMutation } from '@tanstack/react-query';
import { Alert, Button, Form, Input, message, Modal, Select, Space, Typography } from 'antd';
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
import type {
  SubscriptionSalesLead,
  SubscriptionSalesLeadStatus,
} from '@/services/manual/subscriptions';
import {
  listSubscriptionSalesLeads,
  updateSubscriptionSalesLead,
} from '@/services/manual/subscriptions';
import { IdentityText } from '../shared';

const PAGE_SIZE = 10;

const statusMeta: Record<SubscriptionSalesLeadStatus, string> = {
  new: '待联系',
  contacting: '跟进中',
  qualified: '已确认需求',
  won: '已成交',
  lost: '已流失',
};

const statusOptions = Object.entries(statusMeta).map(([value, label]) => ({
  value: value as SubscriptionSalesLeadStatus,
  label,
}));

type SearchParams = {
  current?: number;
  pageSize?: number;
  keyword?: string;
  status?: SubscriptionSalesLeadStatus;
};

type FollowUpForm = {
  status: SubscriptionSalesLeadStatus;
  admin_note: string;
};

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : '操作失败，请稍后重试。';
}

const SalesLeadsPage: React.FC = () => {
  const actionRef = useRef<ActionType>(null);
  const [form] = Form.useForm<FollowUpForm>();
  const [selectedLead, setSelectedLead] = useState<SubscriptionSalesLead>();
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState<SubscriptionSalesLeadStatus>();
  const [loadError, setLoadError] = useState<unknown>();

  const updateMutation = useMutation({
    mutationFn: ({ lead, values }: { lead: SubscriptionSalesLead; values: FollowUpForm }) =>
      updateSubscriptionSalesLead(lead.id, values),
    onSuccess: () => {
      message.success('销售线索已更新');
      setSelectedLead(undefined);
      form.resetFields();
      actionRef.current?.reload();
    },
  });

  const columns: ProColumns<SubscriptionSalesLead>[] = [
    {
      title: '客户与组织',
      dataIndex: 'contact_name',
      width: 240,
      render: (_value, record) => (
        <IdentityText
          primary={record.company_name || record.organization_name || record.contact_name}
          secondary={`${record.contact_name} · ${record.contact_phone}`}
        />
      ),
    },
    {
      title: '规模',
      dataIndex: 'team_size',
      width: 180,
      render: (_value, record) => (
        <Space orientation="vertical" size={2}>
          <Typography.Text>{record.team_size || '未填写团队规模'}</Typography.Text>
          <Typography.Text type="secondary">
            {record.house_scale || '未填写房源规模'}
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: '城市与需求',
      dataIndex: 'needs',
      width: 320,
      render: (_value, record) => (
        <Space orientation="vertical" size={2}>
          <Typography.Text>{record.city_name || '未填写城市'}</Typography.Text>
          <Typography.Paragraph
            type="secondary"
            ellipsis={{ rows: 2, tooltip: record.needs || '未填写需求' }}
            style={{ marginBottom: 0, maxWidth: 300 }}
          >
            {record.needs || '未填写需求'}
          </Typography.Paragraph>
        </Space>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 150,
      align: 'center',
      render: (_value, record) => (
        <AppStatusTag name="subscription.sales-lead" state={record.status}>
          {statusMeta[record.status]}
        </AppStatusTag>
      ),
    },
    {
      title: '跟进人',
      dataIndex: 'assigned_to_name',
      width: 140,
      align: 'center',
      render: (value) => value || '未分配',
    },
    {
      title: '提交时间',
      dataIndex: 'created_at',
      width: 180,
      align: 'center',
      render: (value) => dayjs(value as string).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '操作',
      dataIndex: 'actions',
      width: 110,
      align: 'center',
      render: (_value, record) => (
        <ResponsiveActions>
          <Button
            type="link"
            size="small"
            onClick={() => {
              updateMutation.reset();
              form.setFieldsValue({
                status: record.status === 'new' ? 'contacting' : record.status,
                admin_note: record.admin_note || '',
              });
              setSelectedLead(record);
            }}
          >
            跟进
          </Button>
        </ResponsiveActions>
      ),
    },
  ];

  return (
    <PageContainer title="企业版销售线索">
      {loadError ? (
        <Alert
          type="error"
          showIcon
          title="销售线索加载失败"
          description={getErrorMessage(loadError)}
          action={<Button onClick={() => actionRef.current?.reload()}>重新加载</Button>}
          style={{ marginBottom: 16 }}
        />
      ) : null}
      <ProTable<SubscriptionSalesLead>
        actionRef={actionRef}
        rowKey="id"
        headerTitle="企业版咨询"
        columns={columns}
        search={false}
        options={{ density: true, reload: true, setting: true }}
        params={{ keyword, status }}
        request={async (params: SearchParams) => {
          try {
            const result = await listSubscriptionSalesLeads({
              page: params.current || 1,
              page_size: params.pageSize || PAGE_SIZE,
              keyword: params.keyword?.trim() || undefined,
              status: params.status,
            });
            setLoadError(undefined);
            return { data: result.items, total: result.total, success: true };
          } catch (error) {
            setLoadError(error);
            return { data: [], total: 0, success: true };
          }
        }}
        toolBarRender={() => [
          <AdminToolbar key="filters">
            <Input.Search
              allowClear
              aria-label="销售线索关键词"
              placeholder="公司、联系人或电话"
              style={toolbarControlStyle}
              onSearch={(value) => setKeyword(value.trim())}
            />
            <Select
              allowClear
              aria-label="销售线索状态"
              placeholder="跟进状态"
              style={toolbarShortSelectStyle}
              value={status}
              options={statusOptions}
              onChange={setStatus}
            />
          </AdminToolbar>,
        ]}
        scroll={adminTableScroll}
        pagination={{ pageSize: PAGE_SIZE, showSizeChanger: false }}
        locale={loadError ? { emptyText: '销售线索加载失败' } : undefined}
      />

      <Modal
        title={selectedLead ? `跟进 · ${selectedLead.company_name || selectedLead.contact_name}` : '跟进销售线索'}
        open={Boolean(selectedLead)}
        confirmLoading={updateMutation.isPending}
        onCancel={() => setSelectedLead(undefined)}
        onOk={async () => {
          const values = await form.validateFields();
          if (selectedLead)
            await updateMutation.mutateAsync({ lead: selectedLead, values });
        }}
      >
        <Space orientation="vertical" size={12} style={fullWidthStyle}>
          {updateMutation.isError ? <Alert type="error" showIcon title={getErrorMessage(updateMutation.error)} /> : null}
          <Form form={form} layout="vertical">
            <Form.Item label="跟进状态" name="status" rules={[{ required: true, message: '请选择跟进状态。' }]}>
              <Select options={statusOptions} />
            </Form.Item>
            <Form.Item label="跟进备注" name="admin_note">
              <Input.TextArea rows={5} placeholder="记录客户需求、沟通结果和下一步动作" />
            </Form.Item>
          </Form>
        </Space>
      </Modal>
    </PageContainer>
  );
};

export default SalesLeadsPage;
