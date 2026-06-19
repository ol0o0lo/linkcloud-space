import { useMutation, useQuery } from '@tanstack/react-query';
import { Button, Card, Descriptions, Drawer, Form, Input, Modal, Radio, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import React, { useMemo, useState } from 'react';
import { AdminToolbar, adminTableScroll, drawerWidthMd, ResponsiveActions, wrapTextStyle } from '@/pages/_shared/adminLayout';
import {
  appsNotificationsApiCreateDispatch,
  appsNotificationsApiGetDispatch,
  appsNotificationsApiListDispatchNotifications,
  appsNotificationsApiListDispatches,
} from '@/services/openapi/notificationDispatches';
import { platformQueryKeys } from '../shared';

type CreateDispatchFormValues = {
  scope: API.NotificationDispatchIn['scope'];
  scope_ids_text?: string;
  category?: string;
  title: string;
  body?: string;
  url?: string;
};

const SCOPE_LABELS: Record<string, string> = {
  platform: '全平台',
  organization: '指定租户',
  users: '指定用户',
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'gold',
  sending: 'blue',
  sent: 'green',
  failed: 'red',
};

const DEFAULT_CREATE_FORM_VALUES: Pick<CreateDispatchFormValues, 'scope' | 'category'> = {
  scope: 'platform',
  category: '',
};

function parseScopeIdTokens(value?: string) {
  if (!value) return [];
  return value.split(',').map((item) => item.trim());
}

function hasInvalidScopeIdToken(value?: string) {
  const tokens = parseScopeIdTokens(value);
  return tokens.some((item) => !/^[1-9]\d*$/.test(item));
}

function parseScopeIds(value?: string) {
  return parseScopeIdTokens(value).map((item) => Number(item));
}

function formatScope(scope?: string, scopeIds: number[] = []) {
  const label = SCOPE_LABELS[scope || ''] || scope || '-';
  if (scope === 'platform') return label;
  return scopeIds.length ? `${label} (${scopeIds.join(', ')})` : label;
}

function formatStatus(status?: string) {
  return <Tag color={STATUS_COLORS[status || '']}>{status || 'unknown'}</Tag>;
}

const NotificationDispatchesPage: React.FC = () => {
  const [page, setPage] = useState(1);
  const [detailId, setDetailId] = useState<number>();
  const [detailPage, setDetailPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [form] = Form.useForm<CreateDispatchFormValues>();

  const listQuery = useQuery({
    queryKey: platformQueryKeys.notificationDispatches(page),
    queryFn: () => appsNotificationsApiListDispatches({ page, page_size: 10 }),
  });
  const detailQuery = useQuery({
    queryKey: platformQueryKeys.notificationDispatchDetail(detailId),
    queryFn: () => appsNotificationsApiGetDispatch({ dispatch_id: detailId! }),
    enabled: Boolean(detailId),
  });
  const detailNotificationsQuery = useQuery({
    queryKey: platformQueryKeys.notificationDispatchNotifications(detailId, detailPage),
    queryFn: () => appsNotificationsApiListDispatchNotifications({ dispatch_id: detailId!, page: detailPage, page_size: 10 }),
    enabled: Boolean(detailId),
  });
  const createMutation = useMutation({
    mutationFn: (payload: API.NotificationDispatchIn) => appsNotificationsApiCreateDispatch(payload),
    onSuccess: async () => {
      setCreateOpen(false);
      form.resetFields();
      await listQuery.refetch();
    },
  });

  const scopeValue = Form.useWatch('scope', form) || 'platform';
  const dispatchColumns: ColumnsType<API.NotificationDispatchOut> = useMemo(
    () => [
      { title: '标题', dataIndex: 'title', width: 220, render: (value) => <span style={wrapTextStyle}>{value}</span> },
      { title: '范围', dataIndex: 'scope', width: 220, render: (_value, record) => <span style={wrapTextStyle}>{formatScope(record.scope, record.scope_ids)}</span> },
      { title: '状态', dataIndex: 'status', width: 120, render: (value) => formatStatus(value) },
      { title: '目标/送达', dataIndex: 'target_count', width: 120, render: (_value, record) => `${record.target_count}/${record.delivered_count}` },
      { title: '创建时间', dataIndex: 'created_at', width: 170, render: (value) => (value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '-') },
      {
        title: '操作',
        dataIndex: 'actions',
        width: 120,
        render: (_value, record) => (
          <ResponsiveActions>
            <a
              onClick={() => {
                setDetailId(record.id);
                setDetailPage(1);
              }}
            >
              详情
            </a>
          </ResponsiveActions>
        ),
      },
    ],
    [],
  );

  const detailNotificationColumns: ColumnsType<API.NotificationOut> = [
    { title: '标题', dataIndex: 'title', width: 180, render: (value) => <span style={wrapTextStyle}>{value}</span> },
    { title: '内容', dataIndex: 'body', width: 260, render: (value) => <span style={wrapTextStyle}>{value}</span> },
    { title: '状态', dataIndex: 'is_read', width: 100, render: (value) => (value ? <Tag>已读</Tag> : <Tag color="gold">未读</Tag>) },
    { title: '时间', dataIndex: 'created_at', width: 170, render: (value) => (value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '-') },
  ];

  return (
    <Card title="通知分发" extra={<AdminToolbar><Button type="primary" onClick={() => {
      form.resetFields();
      form.setFieldsValue(DEFAULT_CREATE_FORM_VALUES);
      setCreateOpen(true);
    }}>新建分发</Button></AdminToolbar>}>
      <Table
        rowKey="id"
        loading={listQuery.isLoading}
        columns={dispatchColumns}
        dataSource={listQuery.data?.items || []}
        scroll={adminTableScroll}
        pagination={{ current: listQuery.data?.page || page, pageSize: listQuery.data?.page_size || 10, total: listQuery.data?.total || 0, onChange: setPage }}
      />
      <Modal
        title="新建分发"
        open={createOpen}
        okText="确定"
        cancelText="取消"
        confirmLoading={createMutation.isPending}
        onCancel={() => {
          form.resetFields();
          setCreateOpen(false);
        }}
        onOk={async () => {
          try {
            const values = await form.validateFields();
            const scopeIds = parseScopeIds(values.scope_ids_text);
            const payload: API.NotificationDispatchIn = {
              scope: values.scope,
              category: values.category || '',
              title: values.title,
              body: values.body || '',
              data: {},
            };
            if (values.url) payload.url = values.url;
            if (values.scope !== 'platform') payload.scope_ids = scopeIds;
            await createMutation.mutateAsync(payload);
          } catch (error) {
            // Form validation errors are already displayed inline by antd.
            if (!(error instanceof Error)) return;
            throw error;
          }
        }}
      >
        <Form form={form} layout="vertical" initialValues={DEFAULT_CREATE_FORM_VALUES}>
          <Form.Item label="范围" name="scope" rules={[{ required: true, message: '请选择范围' }]}>
            <Radio.Group
              optionType="button"
              buttonStyle="solid"
              options={[
                { value: 'platform', label: '全平台' },
                { value: 'organization', label: '指定租户' },
                { value: 'users', label: '指定用户' },
              ]}
            />
          </Form.Item>
          <Form.Item
            label="目标 ID 列表"
            name="scope_ids_text"
            dependencies={['scope']}
            extra={scopeValue === 'platform' ? '全平台无需填写目标 ID。' : '使用英文逗号分隔多个正整数 ID。'}
            rules={[
              {
                validator: async (_rule, value) => {
                  if (form.getFieldValue('scope') === 'platform') return;
                  if (!value?.trim()) throw new Error('请输入至少一个正整数 ID');
                  if (hasInvalidScopeIdToken(value)) throw new Error('目标 ID 只能填写用英文逗号分隔的正整数');
                  if (!parseScopeIds(value).length) throw new Error('请输入至少一个正整数 ID');
                },
              },
            ]}
          >
            <Input placeholder={scopeValue === 'organization' ? '例如 1,2' : '例如 10,11'} />
          </Form.Item>
          <Form.Item label="类别" name="category">
            <Input placeholder="可选，例如 marketing" />
          </Form.Item>
          <Form.Item label="标题" name="title" rules={[{ required: true, message: '请输入标题' }]}>
            <Input />
          </Form.Item>
          <Form.Item label="内容" name="body" rules={[{ required: true, message: '请输入内容' }]}>
            <Input.TextArea rows={4} />
          </Form.Item>
          <Form.Item label="链接" name="url">
            <Input placeholder="可选链接" />
          </Form.Item>
        </Form>
      </Modal>
      <Drawer
        title="分发详情"
        open={Boolean(detailId)}
        onClose={() => {
          setDetailId(undefined);
          setDetailPage(1);
        }}
        width={drawerWidthMd}
      >
        <Descriptions column={1} bordered size="small">
          <Descriptions.Item label="标题"><span style={wrapTextStyle}>{detailQuery.data?.title || '-'}</span></Descriptions.Item>
          <Descriptions.Item label="范围"><span style={wrapTextStyle}>{formatScope(detailQuery.data?.scope, detailQuery.data?.scope_ids)}</span></Descriptions.Item>
          <Descriptions.Item label="状态">{formatStatus(detailQuery.data?.status)}</Descriptions.Item>
          <Descriptions.Item label="目标/送达">{detailQuery.data ? `${detailQuery.data.target_count}/${detailQuery.data.delivered_count}` : '-'}</Descriptions.Item>
          <Descriptions.Item label="错误信息"><span style={wrapTextStyle}>{detailQuery.data?.error_message || '-'}</span></Descriptions.Item>
          <Descriptions.Item label="类别"><span style={wrapTextStyle}>{detailQuery.data?.category || '-'}</span></Descriptions.Item>
          <Descriptions.Item label="内容"><span style={wrapTextStyle}>{detailQuery.data?.body || '-'}</span></Descriptions.Item>
          <Descriptions.Item label="链接"><span style={wrapTextStyle}>{detailQuery.data?.url || '-'}</span></Descriptions.Item>
        </Descriptions>

        <Typography.Title level={5} style={{ marginTop: 16 }}>
          投递明细
        </Typography.Title>
        <Table
          rowKey="id"
          loading={detailNotificationsQuery.isLoading}
          columns={detailNotificationColumns}
          dataSource={detailNotificationsQuery.data?.items || []}
          scroll={adminTableScroll}
          pagination={{
            current: detailNotificationsQuery.data?.page || detailPage,
            pageSize: detailNotificationsQuery.data?.page_size || 10,
            total: detailNotificationsQuery.data?.total || 0,
            onChange: setDetailPage,
          }}
        />
      </Drawer>
    </Card>
  );
};

export default NotificationDispatchesPage;
