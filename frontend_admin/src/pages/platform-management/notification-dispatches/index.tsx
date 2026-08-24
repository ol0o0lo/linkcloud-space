import { CopyOutlined, SendOutlined } from '@ant-design/icons';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { ProTable } from '@ant-design/pro-components';
import { useQuery } from '@tanstack/react-query';
import { useLocation, useModel } from '@umijs/max';
import {
  Alert,
  Button,
  Card,
  Descriptions,
  Drawer,
  Popover,
  Progress,
  Skeleton,
  Space,
  Tag,
  Typography,
} from 'antd';
import dayjs from 'dayjs';
import React, { useEffect, useRef, useState } from 'react';
import { PageContainer } from '@/components/PageContainer';
import {
  drawerWidthMd,
  fullWidthStyle,
  ResponsiveActions,
  wrapTextStyle,
} from '@/pages/_shared/adminLayout';
import { useTenantWorkspace } from '@/pages/space/shared';
import type { NotificationDispatchManagementContext } from '@/services/manual/notificationDispatches';
import { appsBaseApiAppContext } from '@/services/openapi/appSystem';
import {
  appsNotificationsApiGetDispatch,
  appsNotificationsApiListDispatches,
} from '@/services/openapi/notificationDispatches';
import { normalizeAdminPath, SPACE_PATHS } from '@/utils/adminRouting';
import { platformQueryKeys } from '../shared';
import NotificationDispatchCreateModal, {
  type DispatchScope,
} from './CreateNotificationDispatchModal';
import { useStyles } from './styles';

type NotificationDispatchWithMapping = Omit<
  API.NotificationDispatchOut,
  'scope'
> & {
  scope: DispatchScope;
  scope__mapping?: string;
  status__mapping?: string;
};

type DispatchInsight = NotificationDispatchWithMapping & {
  scope_label: string;
  status_label: string;
  status_color: string;
  delivery_ratio: string;
  delivery_percent: number;
};

type TablePageParams = {
  current?: number;
  pageSize?: number;
};

const SCOPE_LABELS: Record<DispatchScope, string> = {
  platform: '全平台',
  organization: '指定空间',
  teams: '指定团队',
  users: '指定用户',
};

const STATUS_META: Record<string, { label: string; color: string }> = {
  pending: { label: '等待发送', color: 'gold' },
  sending: { label: '发送中', color: 'blue' },
  sent: { label: '发送完成', color: 'green' },
  failed: { label: '发送失败', color: 'red' },
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

function formatScope(item: NotificationDispatchWithMapping) {
  const count = new Set(item.scope_ids || []).size;
  if (item.scope === 'platform') return SCOPE_LABELS.platform;
  if (item.scope === 'organization') {
    return item.owner_organization_id ? '当前空间' : `指定空间 · ${count} 个`;
  }
  if (item.scope === 'teams') {
    return `指定团队 · ${count} 个`;
  }
  if (item.scope === 'users') {
    return `${item.owner_organization_id ? '指定成员' : '指定用户'} · ${count} 人`;
  }
  return item.scope__mapping || item.scope || '-';
}

function buildDispatchInsight(
  item: NotificationDispatchWithMapping,
): DispatchInsight {
  const delivered = item.delivered_count || 0;
  const target = item.target_count || 0;
  const statusMeta = STATUS_META[item.status] || {
    label: item.status__mapping || item.status || '未知状态',
    color: 'default',
  };

  return {
    ...item,
    scope_label: formatScope(item),
    status_label: statusMeta.label,
    status_color: statusMeta.color,
    delivery_ratio: target ? `${delivered}/${target}` : '0/0',
    delivery_percent: target
      ? Math.min(100, Math.round((delivered / target) * 100))
      : 0,
  };
}

function isDispatchActive(status?: string) {
  return status === 'pending' || status === 'sending';
}

const NotificationDispatchesPage: React.FC = () => {
  const { styles } = useStyles();
  const location = useLocation();
  const { initialState } = useModel('@@initialState');
  const workspace = useTenantWorkspace();
  const isSuperuser = Boolean(initialState?.currentUser?.is_superuser);
  const isTenantMode =
    normalizeAdminPath(location.pathname) ===
    SPACE_PATHS.notificationDispatches;
  const managementContext: NotificationDispatchManagementContext = isTenantMode
    ? 'tenant'
    : 'platform';
  const selectedOrgSlug = isTenantMode
    ? workspace.selectedOrgSlug || workspace.selectedOrganization?.slug
    : undefined;
  const [detailId, setDetailId] = useState<number>();
  const [createOpen, setCreateOpen] = useState(false);
  const [createSource, setCreateSource] =
    useState<NotificationDispatchWithMapping>();
  const [hasActiveDispatches, setHasActiveDispatches] = useState(false);
  const tableActionRef = useRef<ActionType>(null);
  const managementBoundaryRef = useRef(
    isTenantMode ? `tenant:${selectedOrgSlug || ''}` : 'platform',
  );
  const tenantContextQuery = useQuery({
    queryKey: ['notification-dispatches', 'tenant-context', selectedOrgSlug],
    queryFn: () => appsBaseApiAppContext(),
    enabled: isTenantMode && Boolean(selectedOrgSlug),
    initialData:
      workspace.appContext?.org?.slug === selectedOrgSlug
        ? workspace.appContext
        : undefined,
    staleTime: 60_000,
  });
  const currentOrganization = tenantContextQuery.data?.org;
  const canManageDispatches = isTenantMode
    ? isSuperuser || Boolean(currentOrganization?.is_owner)
    : isSuperuser;

  const detailQuery = useQuery({
    queryKey: [
      ...platformQueryKeys.notificationDispatchDetail(detailId),
      isTenantMode ? 'tenant' : 'platform',
      selectedOrgSlug,
    ],
    queryFn: () =>
      appsNotificationsApiGetDispatch({
        dispatch_id: detailId || 0,
        management_context: managementContext,
      }),
    enabled: Boolean(detailId),
  });
  useEffect(() => {
    const nextBoundary = isTenantMode
      ? `tenant:${selectedOrgSlug || ''}`
      : 'platform';
    if (managementBoundaryRef.current === nextBoundary) return;

    managementBoundaryRef.current = nextBoundary;
    setDetailId(undefined);
    setCreateOpen(false);
    setCreateSource(undefined);
    setHasActiveDispatches(false);
    tableActionRef.current?.reload();
  }, [isTenantMode, selectedOrgSlug]);

  useEffect(() => {
    if (!hasActiveDispatches) return undefined;
    const timer = window.setInterval(() => {
      tableActionRef.current?.reload();
    }, 5000);
    return () => window.clearInterval(timer);
  }, [hasActiveDispatches]);

  const detailStatus = detailQuery.data?.status;
  useEffect(() => {
    if (!detailId || !isDispatchActive(detailStatus)) return undefined;
    const timer = window.setInterval(() => {
      void detailQuery.refetch();
    }, 5000);
    return () => window.clearInterval(timer);
  }, [detailId, detailQuery.refetch, detailStatus]);

  const openCreate = (source?: NotificationDispatchWithMapping) => {
    setCreateSource(source);
    setDetailId(undefined);
    setCreateOpen(true);
  };

  const closeCreate = () => {
    setCreateSource(undefined);
    setCreateOpen(false);
  };

  const dispatchColumns: ProColumns<DispatchInsight>[] = [
    {
      title: '通知内容',
      dataIndex: 'title',
      width: 235,
      render: (_value, record) => (
        <Popover
          trigger="hover"
          placement="rightTop"
          mouseEnterDelay={0.4}
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
          <Space orientation="vertical" size={3} style={fullWidthStyle}>
            <Typography.Text strong className={styles.titlePreview}>
              {record.title}
            </Typography.Text>
            <Typography.Text type="secondary">
              <span className={styles.contentPreview}>
                {record.body || '无正文'}
              </span>
            </Typography.Text>
          </Space>
        </Popover>
      ),
    },
    {
      title: '发送范围',
      dataIndex: 'scope',
      width: 130,
      align: 'center',
      render: (_value, record) => (
        <Tag
          color={
            record.scope === 'platform'
              ? 'purple'
              : record.scope === 'organization'
                ? 'blue'
                : record.scope === 'teams'
                  ? 'cyan'
                  : 'default'
          }
        >
          {record.scope_label}
        </Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 90,
      align: 'center',
      render: (_value, record) => (
        <Tag color={record.status_color}>{record.status_label}</Tag>
      ),
    },
    {
      title: '投递结果',
      dataIndex: 'target_count',
      width: 120,
      align: 'center',
      render: (_value, record) => {
        if (record.status === 'pending' && !record.target_count) {
          return <Typography.Text type="secondary">等待统计</Typography.Text>;
        }
        if (record.status === 'failed' && !record.target_count) {
          return <Typography.Text type="danger">未完成投递</Typography.Text>;
        }
        return (
          <Space
            orientation="vertical"
            size={2}
            className={styles.deliveryCell}
          >
            <Typography.Text>{record.delivery_ratio}</Typography.Text>
            <Progress
              percent={record.delivery_percent}
              showInfo={false}
              size="small"
              status={record.status === 'failed' ? 'exception' : 'normal'}
            />
          </Space>
        );
      },
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      width: 150,
      align: 'center',
      render: (_value, record) => (
        <Typography.Text>
          {dayjs(record.created_at).format('YYYY-MM-DD HH:mm')}
        </Typography.Text>
      ),
    },
    {
      title: '操作',
      dataIndex: 'actions',
      fixed: 'right',
      width: 64,
      align: 'center',
      render: (_value, record) => (
        <ResponsiveActions>
          <Button
            type="link"
            size="small"
            onClick={() => {
              setDetailId(record.id);
            }}
          >
            详情
          </Button>
        </ResponsiveActions>
      ),
    },
  ];

  const detailInsight = detailQuery.data
    ? buildDispatchInsight(detailQuery.data as NotificationDispatchWithMapping)
    : undefined;

  if (isTenantMode && tenantContextQuery.isLoading) {
    return (
      <PageContainer title={isTenantMode ? '通知分发' : '平台通知广播'}>
        <Card loading />
      </PageContainer>
    );
  }

  if (isTenantMode && !currentOrganization) {
    return (
      <PageContainer title={isTenantMode ? '通知分发' : '平台通知广播'}>
        <Alert
          type="warning"
          showIcon
          title="请先选择空间"
          description="选择空间后才能查看和创建该空间的通知分发。"
        />
      </PageContainer>
    );
  }

  if (!canManageDispatches) {
    return (
      <PageContainer title={isTenantMode ? '通知分发' : '平台通知广播'}>
        <Alert
          type="warning"
          showIcon
          title="仅空间所有者可以分发通知"
          description="你仍可在通知中心查看收到的消息；如需分发通知，请联系空间所有者。"
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer title={isTenantMode ? '通知分发' : '平台通知广播'}>
      <Card>
        <ProTable<DispatchInsight>
          actionRef={tableActionRef}
          rowKey="id"
          headerTitle="分发记录"
          columns={dispatchColumns}
          request={async (params: TablePageParams) => {
            const result = await appsNotificationsApiListDispatches({
              page: params.current || 1,
              page_size: params.pageSize || 10,
              management_context: managementContext,
            });
            const items = (
              (result.items || []) as NotificationDispatchWithMapping[]
            ).map((item) => buildDispatchInsight(item));
            setHasActiveDispatches(
              items.some((item) => isDispatchActive(item.status)),
            );
            return {
              data: items,
              total: result.total || 0,
              success: true,
            };
          }}
          search={false}
          options={{ density: false, reload: true, setting: false }}
          toolBarRender={() => [
            <Button
              key="create"
              type="primary"
              icon={<SendOutlined />}
              aria-label="新建通知"
              onClick={() => openCreate()}
            >
              新建通知
            </Button>,
          ]}
          ghost
          scroll={{ x: 760 }}
          pagination={{ defaultPageSize: 10, showSizeChanger: false }}
        />

        <NotificationDispatchCreateModal
          open={createOpen}
          isTenantMode={isTenantMode}
          managementContext={managementContext}
          currentOrganization={currentOrganization || undefined}
          source={createSource}
          onCancel={closeCreate}
          onSuccess={() => {
            closeCreate();
            tableActionRef.current?.reload();
          }}
        />

        <Drawer
          title="分发详情"
          open={Boolean(detailId)}
          onClose={() => {
            setDetailId(undefined);
          }}
          size={drawerWidthMd}
          extra={
            detailQuery.data ? (
              <Button
                icon={<CopyOutlined />}
                onClick={() =>
                  openCreate(
                    detailQuery.data as NotificationDispatchWithMapping,
                  )
                }
              >
                复用内容
              </Button>
            ) : null
          }
        >
          {detailQuery.isLoading ? <Skeleton active /> : null}
          {detailQuery.isError ? (
            <Alert
              type="error"
              showIcon
              title="分发详情加载失败"
              description="请关闭后重试，或稍后刷新页面。"
            />
          ) : null}
          {detailQuery.data && detailInsight ? (
            <Space orientation="vertical" size={16} style={fullWidthStyle}>
              <div className={styles.detailSummary}>
                <Space orientation="vertical" size={12} style={fullWidthStyle}>
                  <Typography.Text strong>
                    {detailQuery.data.title || '-'}
                  </Typography.Text>
                  <Space wrap size={[8, 8]}>
                    <Tag
                      color={
                        detailInsight.scope === 'platform'
                          ? 'purple'
                          : detailInsight.scope === 'organization'
                            ? 'blue'
                            : detailInsight.scope === 'teams'
                              ? 'cyan'
                              : 'default'
                      }
                    >
                      {detailInsight.scope_label}
                    </Tag>
                    <Tag color={detailInsight.status_color}>
                      {detailInsight.status_label}
                    </Tag>
                  </Space>
                  {detailInsight.target_count ? (
                    <Progress
                      percent={detailInsight.delivery_percent}
                      status={
                        detailInsight.status === 'failed'
                          ? 'exception'
                          : 'normal'
                      }
                      format={() => `送达 ${detailInsight.delivery_ratio}`}
                    />
                  ) : (
                    <Typography.Text type="secondary">
                      {isDispatchActive(detailInsight.status)
                        ? '正在统计目标人数…'
                        : '尚无投递结果'}
                    </Typography.Text>
                  )}
                </Space>
              </div>

              {detailQuery.data.error_message ? (
                <Alert
                  type="error"
                  showIcon
                  title="分发失败"
                  description={detailQuery.data.error_message}
                />
              ) : null}

              <Descriptions column={1} bordered size="small">
                <Descriptions.Item label="发送范围">
                  {detailInsight.scope_label}
                </Descriptions.Item>
                {detailQuery.data.scope !== 'platform' ? (
                  <Descriptions.Item label="目标 ID">
                    <div className={styles.targetTags}>
                      {(detailQuery.data.scope_ids || []).map((id) => (
                        <Tag key={id}>{id}</Tag>
                      ))}
                    </div>
                  </Descriptions.Item>
                ) : null}
                <Descriptions.Item label="通知分类">
                  {detailQuery.data.category || '不分类'}
                </Descriptions.Item>
                <Descriptions.Item label="创建人">
                  {detailQuery.data.created_by || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="创建时间">
                  {detailQuery.data.created_at
                    ? dayjs(detailQuery.data.created_at).format(
                        'YYYY-MM-DD HH:mm',
                      )
                    : '-'}
                </Descriptions.Item>
                <Descriptions.Item label="发送时间">
                  {detailQuery.data.sent_at
                    ? dayjs(detailQuery.data.sent_at).format('YYYY-MM-DD HH:mm')
                    : '尚未完成'}
                </Descriptions.Item>
                <Descriptions.Item label="点击链接">
                  {detailQuery.data.url ? (
                    <Typography.Link href={detailQuery.data.url}>
                      <span style={wrapTextStyle}>{detailQuery.data.url}</span>
                    </Typography.Link>
                  ) : (
                    '-'
                  )}
                </Descriptions.Item>
              </Descriptions>

              <div>
                <Typography.Text strong>通知内容</Typography.Text>
                <div className={styles.detailBody} style={{ marginTop: 8 }}>
                  <Typography.Text>
                    {detailQuery.data.body || '-'}
                  </Typography.Text>
                </div>
              </div>
            </Space>
          ) : null}
        </Drawer>
      </Card>
    </PageContainer>
  );
};

export default NotificationDispatchesPage;
