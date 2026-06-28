import { useMutation, useQuery } from '@tanstack/react-query';
import { PageContainer } from '@ant-design/pro-components';
import {
  Alert,
  Button,
  Card,
  Descriptions,
  Drawer,
  Form,
  Input,
  Modal,
  Radio,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import React, { useMemo, useState } from 'react';
import {
  AdminToolbar,
  adminTableScroll,
  drawerWidthMd,
  fullWidthStyle,
  ResponsiveActions,
  toolbarControlStyle,
  wrapTextStyle,
} from '@/pages/_shared/adminLayout';
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

type DispatchInsight = API.NotificationDispatchOut & {
  scope_label: string;
  scope_summary: string;
  status_label: string;
  status_color: string;
  status_summary: string;
  execution_summary: string;
  delivery_ratio: string;
  action_summary: string;
};

const SCOPE_LABELS: Record<string, string> = {
  platform: '全平台',
  organization: '指定空间',
  users: '指定用户',
};

const DEFAULT_CREATE_FORM_VALUES: Pick<
  CreateDispatchFormValues,
  'scope' | 'category'
> = {
  scope: 'platform',
  category: '',
};

const sectionStyle: React.CSSProperties = {
  padding: 20,
  border: '1px solid var(--ant-color-border-secondary)',
  borderRadius: 8,
  background: 'var(--ant-color-fill-quaternary)',
};

const contentPreviewStyle: React.CSSProperties = {
  ...wrapTextStyle,
  display: '-webkit-box',
  overflow: 'hidden',
  WebkitLineClamp: 2,
  WebkitBoxOrient: 'vertical',
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

function buildDispatchInsight(
  item: API.NotificationDispatchOut,
): DispatchInsight {
  const scopeLabel = formatScope(item.scope, item.scope_ids);
  const delivered = item.delivered_count || 0;
  const target = item.target_count || 0;
  const ratio = target ? `${delivered}/${target}` : '0/0';

  if (item.status === 'failed') {
    return {
      ...item,
      scope_label: scopeLabel,
      scope_summary:
        item.scope === 'platform'
          ? '面向全平台广播，失败影响面通常最大。'
          : '失败的定向分发更需要回看目标范围是否填对。',
      status_label: '分发失败',
      status_color: 'red',
      status_summary:
        item.error_message ||
        '当前分发没有成功送达，应该继续排查失败原因与影响范围。',
      execution_summary:
        '失败不是终点，至少要能解释失败发生在哪个范围、是否影响核心经营通知。',
      delivery_ratio: ratio,
      action_summary: '优先查看错误信息与投递明细',
    };
  }

  if (item.status === 'sending') {
    return {
      ...item,
      scope_label: scopeLabel,
      scope_summary: '这条分发仍在执行中，适合继续关注送达进度和积压情况。',
      status_label: '发送中',
      status_color: 'blue',
      status_summary: '系统仍在投递，后台应判断它是正常执行还是卡在中间状态。',
      execution_summary:
        '执行中的分发更适合作为值班追踪对象，不能只看创建时间。',
      delivery_ratio: ratio,
      action_summary: '继续追踪送达进度',
    };
  }

  if (item.status === 'pending') {
    return {
      ...item,
      scope_label: scopeLabel,
      scope_summary: '分发已创建但尚未真正开始送达，适合关注是否存在排队积压。',
      status_label: '待发送',
      status_color: 'gold',
      status_summary:
        '这类记录还没有进入真正的送达阶段，优先关注是否存在队列堆积。',
      execution_summary: '待发送越多，越说明平台通知链路有排队风险。',
      delivery_ratio: ratio,
      action_summary: '关注是否进入投递',
    };
  }

  return {
    ...item,
    scope_label: scopeLabel,
    scope_summary:
      item.scope === 'platform'
        ? '全平台分发已经送达，可继续观察通知页的确认情况。'
        : '定向分发已经送达，可回看目标对象是否真正收到并确认。',
    status_label: '已送达',
    status_color: 'green',
    status_summary: '当前分发已经完成送达，后续重点是回看通知确认与已读收口。',
    execution_summary:
      '已送达不是结束，平台还需要知道这些通知有没有变成真正的业务确认。',
    delivery_ratio: ratio,
    action_summary: '可到通知页继续确认',
  };
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
    queryKey: platformQueryKeys.notificationDispatchNotifications(
      detailId,
      detailPage,
    ),
    queryFn: () =>
      appsNotificationsApiListDispatchNotifications({
        dispatch_id: detailId!,
        page: detailPage,
        page_size: 10,
      }),
    enabled: Boolean(detailId),
  });
  const createMutation = useMutation({
    mutationFn: (payload: API.NotificationDispatchIn) =>
      appsNotificationsApiCreateDispatch(payload),
    onSuccess: async () => {
      setCreateOpen(false);
      form.resetFields();
      await listQuery.refetch();
    },
  });

  const scopeValue = Form.useWatch('scope', form) || 'platform';
  const insights = useMemo(
    () => (listQuery.data?.items || []).map(buildDispatchInsight),
    [listQuery.data?.items],
  );

  const dispatchColumns: ColumnsType<DispatchInsight> = [
    {
      title: '分发主题',
      dataIndex: 'title',
      width: 280,
      render: (_value, record) => (
        <Space direction="vertical" size={4}>
          <Typography.Text style={wrapTextStyle}>
            {record.title}
          </Typography.Text>
          <Typography.Text type="secondary" style={contentPreviewStyle}>
            {record.body || '无正文'}
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: '目标范围',
      dataIndex: 'scope',
      width: 260,
      render: (_value, record) => (
        <Space direction="vertical" size={6}>
          <Tag
            color={
              record.scope === 'platform'
                ? 'purple'
                : record.scope === 'organization'
                  ? 'blue'
                  : 'default'
            }
          >
            {record.scope_label}
          </Tag>
          <Typography.Text type="secondary">
            {record.scope_summary}
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: '投递状态',
      dataIndex: 'status',
      width: 280,
      render: (_value, record) => (
        <Space direction="vertical" size={6}>
          <Tag color={record.status_color}>{record.status_label}</Tag>
          <Typography.Text type="secondary">
            {record.status_summary}
          </Typography.Text>
          <Typography.Text type="secondary">
            {record.execution_summary}
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: '目标与结果',
      dataIndex: 'target_count',
      width: 220,
      render: (_value, record) => (
        <Space direction="vertical" size={6}>
          <Typography.Text>{`送达 ${record.delivery_ratio}`}</Typography.Text>
          <Typography.Text type="secondary">
            {record.action_summary}
          </Typography.Text>
          {record.url ? (
            <Typography.Text type="secondary">附带跳转入口</Typography.Text>
          ) : null}
        </Space>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      width: 200,
      render: (_value, record) => (
        <Space direction="vertical" size={6}>
          <Typography.Text>
            {dayjs(record.created_at).format('YYYY-MM-DD HH:mm')}
          </Typography.Text>
          <Typography.Text type="secondary">
            {record.sent_at
              ? `发送于 ${dayjs(record.sent_at).format('YYYY-MM-DD HH:mm')}`
              : '尚未完成发送'}
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: '操作',
      dataIndex: 'actions',
      width: 140,
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
  ];

  const detailNotificationColumns: ColumnsType<API.NotificationOut> = [
    {
      title: '通知标题',
      dataIndex: 'title',
      width: 200,
      render: (value) => <span style={wrapTextStyle}>{value}</span>,
    },
    {
      title: '通知正文',
      dataIndex: 'body',
      width: 260,
      render: (value) => <span style={wrapTextStyle}>{value}</span>,
    },
    {
      title: '确认状态',
      dataIndex: 'is_read',
      width: 120,
      render: (value) =>
        value ? <Tag color="default">已读</Tag> : <Tag color="gold">未读</Tag>,
    },
    {
      title: '到达时间',
      dataIndex: 'created_at',
      width: 180,
      render: (value) =>
        value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '-',
    },
  ];

  const detailInsight = detailQuery.data
    ? buildDispatchInsight(detailQuery.data)
    : undefined;

  return (
    <PageContainer title="通知分发管理" subTitle="创建和查看通知分发记录。">
      <Card
        extra={
          <AdminToolbar>
            <Button
              style={toolbarControlStyle}
              href="/dashboard/personal-business/notifications"
            >
              回到通知列表
            </Button>
            <Button
              type="primary"
              onClick={() => {
                form.resetFields();
                form.setFieldsValue(DEFAULT_CREATE_FORM_VALUES);
                setCreateOpen(true);
              }}
            >
              新建分发
            </Button>
          </AdminToolbar>
        }
      >
        <div style={sectionStyle}>
          <Space direction="vertical" size={12} style={fullWidthStyle}>
            <div>
              <Typography.Text strong>分发列表</Typography.Text>
              <Typography.Paragraph
                type="secondary"
                style={{ marginBottom: 0, marginTop: 8 }}
              >
                分发页需要说明这批通知发给了谁、发得怎么样，以及失败后该怎么继续处理。
              </Typography.Paragraph>
            </div>
            <Table
              rowKey="id"
              loading={listQuery.isLoading}
              columns={dispatchColumns}
              dataSource={insights}
              scroll={adminTableScroll}
              pagination={{
                current: listQuery.data?.page || page,
                pageSize: listQuery.data?.page_size || 10,
                total: listQuery.data?.total || 0,
                onChange: setPage,
              }}
            />
          </Space>
        </div>

        <Modal
          title="新建通知分发"
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
              if (!(error instanceof Error)) return;
              throw error;
            }
          }}
        >
          <Space direction="vertical" size={12} style={fullWidthStyle}>
            <Alert
              type="info"
              showIcon
              title="分发动作一旦发出，影响的是一整批目标对象的通知体验。"
            />
            <Form
              form={form}
              layout="vertical"
              initialValues={DEFAULT_CREATE_FORM_VALUES}
            >
              <Form.Item
                label="范围"
                name="scope"
                rules={[{ required: true, message: '请选择范围' }]}
              >
                <Radio.Group
                  optionType="button"
                  buttonStyle="solid"
                  options={[
                    { value: 'platform', label: '全平台' },
                    { value: 'organization', label: '指定空间' },
                    { value: 'users', label: '指定用户' },
                  ]}
                />
              </Form.Item>
              <Form.Item
                label="目标 ID 列表"
                name="scope_ids_text"
                dependencies={['scope']}
                extra={
                  scopeValue === 'platform'
                    ? '全平台无需填写目标 ID。'
                    : '使用英文逗号分隔多个正整数 ID。'
                }
                rules={[
                  {
                    validator: async (_rule, value) => {
                      if (form.getFieldValue('scope') === 'platform') return;
                      if (!value?.trim())
                        throw new Error('请输入至少一个正整数 ID');
                      if (hasInvalidScopeIdToken(value))
                        throw new Error(
                          '目标 ID 只能填写用英文逗号分隔的正整数',
                        );
                      if (!parseScopeIds(value).length)
                        throw new Error('请输入至少一个正整数 ID');
                    },
                  },
                ]}
              >
                <Input
                  placeholder={
                    scopeValue === 'organization' ? '例如 1,2' : '例如 10,11'
                  }
                />
              </Form.Item>
              <Form.Item label="类别" name="category">
                <Input placeholder="可选，例如 marketing" />
              </Form.Item>
              <Form.Item
                label="标题"
                name="title"
                rules={[{ required: true, message: '请输入标题' }]}
              >
                <Input />
              </Form.Item>
              <Form.Item
                label="内容"
                name="body"
                rules={[{ required: true, message: '请输入内容' }]}
              >
                <Input.TextArea rows={4} />
              </Form.Item>
              <Form.Item label="链接" name="url">
                <Input placeholder="可选链接" />
              </Form.Item>
            </Form>
          </Space>
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
          <Space direction="vertical" size={12} style={fullWidthStyle}>
            <Alert
              type="info"
              showIcon
              title="分发详情要一起看范围、送达结果、失败原因和投递明细，不能只盯着标题和正文。"
            />
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="分发标题">
                <span style={wrapTextStyle}>
                  {detailQuery.data?.title || '-'}
                </span>
              </Descriptions.Item>
              <Descriptions.Item label="目标范围">
                {detailInsight ? (
                  <Tag
                    color={
                      detailInsight.scope === 'platform'
                        ? 'purple'
                        : detailInsight.scope === 'organization'
                          ? 'blue'
                          : 'default'
                    }
                  >
                    {detailInsight.scope_label}
                  </Tag>
                ) : (
                  '-'
                )}
              </Descriptions.Item>
              <Descriptions.Item label="投递状态">
                {detailInsight ? (
                  <Tag color={detailInsight.status_color}>
                    {detailInsight.status_label}
                  </Tag>
                ) : (
                  '-'
                )}
              </Descriptions.Item>
              <Descriptions.Item label="目标/送达">
                {detailQuery.data
                  ? `${detailQuery.data.target_count}/${detailQuery.data.delivered_count}`
                  : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="错误信息">
                <span style={wrapTextStyle}>
                  {detailQuery.data?.error_message || '-'}
                </span>
              </Descriptions.Item>
              <Descriptions.Item label="类别">
                <span style={wrapTextStyle}>
                  {detailQuery.data?.category || '-'}
                </span>
              </Descriptions.Item>
              <Descriptions.Item label="正文">
                <span style={wrapTextStyle}>
                  {detailQuery.data?.body || '-'}
                </span>
              </Descriptions.Item>
              <Descriptions.Item label="链接">
                <span style={wrapTextStyle}>
                  {detailQuery.data?.url || '-'}
                </span>
              </Descriptions.Item>
              <Descriptions.Item label="创建人">
                <span style={wrapTextStyle}>
                  {detailQuery.data?.created_by || '-'}
                </span>
              </Descriptions.Item>
              <Descriptions.Item label="创建时间">
                {detailQuery.data?.created_at
                  ? dayjs(detailQuery.data.created_at).format(
                      'YYYY-MM-DD HH:mm',
                    )
                  : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="发送时间">
                {detailQuery.data?.sent_at
                  ? dayjs(detailQuery.data.sent_at).format('YYYY-MM-DD HH:mm')
                  : '-'}
              </Descriptions.Item>
            </Descriptions>

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
          </Space>
        </Drawer>
      </Card>
    </PageContainer>
  );
};

export default NotificationDispatchesPage;
