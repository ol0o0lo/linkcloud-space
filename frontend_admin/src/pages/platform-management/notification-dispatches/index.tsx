import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { PageContainer, ProTable } from '@ant-design/pro-components';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  Button,
  Card,
  Descriptions,
  Drawer,
  Form,
  Input,
  Modal,
  Popover,
  Radio,
  Space,
  Tag,
  Typography,
} from 'antd';
import dayjs from 'dayjs';
import React, { useRef, useState } from 'react';
import {
  adminTableScroll,
  drawerWidthMd,
  fullWidthStyle,
  ResponsiveActions,
  toolbarControlStyle,
  wrapTextStyle,
} from '@/pages/_shared/adminLayout';
import {
  enumMapping,
  enumSelectOptions,
  useEnums,
} from '@/services/manual/enums';
import {
  appsNotificationsApiCreateDispatch,
  appsNotificationsApiGetDispatch,
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

type NotificationDispatchWithMapping = API.NotificationDispatchOut & {
  scope__mapping?: string;
  status__mapping?: string;
};

type DispatchInsight = NotificationDispatchWithMapping & {
  scope_label: string;
  status_label: string;
  status_color: string;
  delivery_ratio: string;
};
type TablePageParams = {
  current?: number;
  pageSize?: number;
};

const DEFAULT_CREATE_FORM_VALUES: Pick<
  CreateDispatchFormValues,
  'scope' | 'category'
> = {
  scope: 'platform',
  category: '',
};

const contentPreviewStyle: React.CSSProperties = {
  maxWidth: 320,
  display: '-webkit-box',
  overflow: 'hidden',
  WebkitLineClamp: 2,
  WebkitBoxOrient: 'vertical',
  wordBreak: 'break-word',
};

const titlePreviewStyle: React.CSSProperties = {
  maxWidth: 320,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const dispatchPopoverBodyStyle: React.CSSProperties = {
  width: 420,
  maxWidth: 'min(420px, calc(100vw - 48px))',
  maxHeight: 320,
  overflow: 'auto',
  color: '#fff',
  scrollbarWidth: 'none',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
};

const dispatchPopoverTitleStyle: React.CSSProperties = {
  color: '#fff',
};

const detailSummaryStyle: React.CSSProperties = {
  padding: 16,
  border: '1px solid var(--ant-color-border-secondary)',
  borderRadius: 8,
  background: 'var(--ant-color-fill-quaternary)',
};

const detailBodyStyle: React.CSSProperties = {
  padding: 16,
  border: '1px solid var(--ant-color-border-secondary)',
  borderRadius: 8,
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
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

function formatScope(
  scope?: string,
  scopeMapping?: string,
  scopeIds: number[] = [],
) {
  const label = enumMapping(scope, scopeMapping);
  if (scope === 'platform') return label;
  return scopeIds.length ? `${label} (${scopeIds.join(', ')})` : label;
}

function buildDispatchInsight(
  item: NotificationDispatchWithMapping,
): DispatchInsight {
  const scopeLabel = formatScope(
    item.scope,
    item.scope__mapping,
    item.scope_ids,
  );
  const statusLabel = enumMapping(item.status, item.status__mapping);
  const delivered = item.delivered_count || 0;
  const target = item.target_count || 0;
  const ratio = target ? `${delivered}/${target}` : '0/0';

  if (item.status === 'failed') {
    return {
      ...item,
      scope_label: scopeLabel,
      status_label: statusLabel,
      status_color: 'red',
      delivery_ratio: ratio,
    };
  }

  if (item.status === 'sending') {
    return {
      ...item,
      scope_label: scopeLabel,
      status_label: statusLabel,
      status_color: 'blue',
      delivery_ratio: ratio,
    };
  }

  if (item.status === 'pending') {
    return {
      ...item,
      scope_label: scopeLabel,
      status_label: statusLabel,
      status_color: 'gold',
      delivery_ratio: ratio,
    };
  }

  return {
    ...item,
    scope_label: scopeLabel,
    status_label: statusLabel,
    status_color: 'green',
    delivery_ratio: ratio,
  };
}

const NotificationDispatchesPage: React.FC = () => {
  const [detailId, setDetailId] = useState<number>();
  const [createOpen, setCreateOpen] = useState(false);
  const tableActionRef = useRef<ActionType>(null);
  const [form] = Form.useForm<CreateDispatchFormValues>();
  const dispatchEnums = useEnums(['notifications.dispatch_scope']);

  const detailQuery = useQuery({
    queryKey: platformQueryKeys.notificationDispatchDetail(detailId),
    queryFn: () =>
      appsNotificationsApiGetDispatch({ dispatch_id: detailId || 0 }),
    enabled: Boolean(detailId),
  });
  const createMutation = useMutation({
    mutationFn: (payload: API.NotificationDispatchIn) =>
      appsNotificationsApiCreateDispatch(payload),
    onSuccess: async () => {
      setCreateOpen(false);
      form.resetFields();
      tableActionRef.current?.reload();
    },
  });

  const scopeValue = Form.useWatch('scope', form) || 'platform';

  const dispatchColumns: ProColumns<DispatchInsight>[] = [
    {
      title: '分发主题',
      dataIndex: 'title',
      width: 280,
      render: (_value, record) => (
        <Popover
          trigger="hover"
          placement="rightTop"
          mouseEnterDelay={0.5}
          color="rgba(0, 0, 0, 0.88)"
          content={
            <Space
              orientation="vertical"
              size={8}
              style={dispatchPopoverBodyStyle}
            >
              <Typography.Text strong style={dispatchPopoverTitleStyle}>
                {record.title}
              </Typography.Text>
              <Typography.Text style={dispatchPopoverTitleStyle}>
                {record.body || '无正文'}
              </Typography.Text>
            </Space>
          }
        >
          <Space orientation="vertical" size={4} style={fullWidthStyle}>
            <Typography.Text style={titlePreviewStyle}>
              {record.title}
            </Typography.Text>
            <Typography.Text type="secondary">
              <span style={contentPreviewStyle}>{record.body || '无正文'}</span>
            </Typography.Text>
          </Space>
        </Popover>
      ),
    },
    {
      title: '目标范围',
      dataIndex: 'scope',
      width: 180,
      render: (_value, record) => (
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
      ),
    },
    {
      title: '投递状态',
      dataIndex: 'status',
      width: 140,
      render: (_value, record) => (
        <Tag color={record.status_color}>{record.status_label}</Tag>
      ),
    },
    {
      title: '目标与结果',
      dataIndex: 'target_count',
      width: 140,
      render: (_value, record) => (
        <Space orientation="vertical" size={4}>
          <Typography.Text>{`送达 ${record.delivery_ratio}`}</Typography.Text>
          {record.url ? (
            <Typography.Text type="secondary">有链接</Typography.Text>
          ) : null}
        </Space>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      width: 170,
      render: (_value, record) => (
        <Typography.Text>
          {dayjs(record.created_at).format('YYYY-MM-DD HH:mm')}
        </Typography.Text>
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
            }}
          >
            详情
          </a>
        </ResponsiveActions>
      ),
    },
  ];

  const detailInsight = detailQuery.data
    ? buildDispatchInsight(detailQuery.data as NotificationDispatchWithMapping)
    : undefined;

  return (
    <PageContainer title="通知分发管理" subTitle="创建和查看通知分发记录。">
      <Card>
        <ProTable<DispatchInsight>
          actionRef={tableActionRef}
          rowKey="id"
          headerTitle="分发列表"
          columns={dispatchColumns}
          request={async (params: TablePageParams) => {
            const result = await appsNotificationsApiListDispatches({
              page: params.current || 1,
              page_size: params.pageSize || 10,
            });
            return {
              data: (
                (result.items || []) as NotificationDispatchWithMapping[]
              ).map((item) => buildDispatchInsight(item)),
              total: result.total || 0,
              success: true,
            };
          }}
          search={false}
          options={{ density: true, reload: false, setting: true }}
          toolBarRender={() => [
            <Button
              key="create"
              type="primary"
              onClick={() => {
                form.resetFields();
                form.setFieldsValue(DEFAULT_CREATE_FORM_VALUES);
                setCreateOpen(true);
              }}
            >
              新建分发
            </Button>,
          ]}
          ghost
          scroll={adminTableScroll}
          pagination={{ defaultPageSize: 10 }}
        />

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
          <Space orientation="vertical" size={12} style={fullWidthStyle}>
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
                  options={enumSelectOptions(
                    dispatchEnums.data,
                    'notifications.dispatch_scope',
                  )}
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
          }}
          width={drawerWidthMd}
        >
          <Space orientation="vertical" size={12} style={fullWidthStyle}>
            <div style={detailSummaryStyle}>
              <Space orientation="vertical" size={12} style={fullWidthStyle}>
                <Typography.Text strong>
                  {detailQuery.data?.title || '-'}
                </Typography.Text>
                <Space wrap size={[8, 8]}>
                  {detailInsight ? (
                    <>
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
                      <Tag color={detailInsight.status_color}>
                        {detailInsight.status_label}
                      </Tag>
                    </>
                  ) : null}
                  <Typography.Text type="secondary">
                    {detailQuery.data
                      ? `送达 ${detailQuery.data.delivered_count}/${detailQuery.data.target_count}`
                      : '送达 -'}
                  </Typography.Text>
                </Space>
              </Space>
            </div>

            <Descriptions column={2} bordered size="small">
              <Descriptions.Item label="类别">
                {detailQuery.data?.category || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="创建人">
                {detailQuery.data?.created_by || '-'}
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
              <Descriptions.Item label="链接" span={2}>
                <span style={wrapTextStyle}>
                  {detailQuery.data?.url || '-'}
                </span>
              </Descriptions.Item>
              <Descriptions.Item label="错误信息" span={2}>
                <span style={wrapTextStyle}>
                  {detailQuery.data?.error_message || '-'}
                </span>
              </Descriptions.Item>
            </Descriptions>

            <div style={detailBodyStyle}>
              <Typography.Text>{detailQuery.data?.body || '-'}</Typography.Text>
            </div>
          </Space>
        </Drawer>
      </Card>
    </PageContainer>
  );
};

export default NotificationDispatchesPage;
