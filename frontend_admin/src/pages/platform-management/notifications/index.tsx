import { CheckOutlined, LinkOutlined } from '@ant-design/icons';
import { history, useAccess } from '@umijs/max';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Button,
  Card,
  Descriptions,
  Drawer,
  Empty,
  Segmented,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import isToday from 'dayjs/plugin/isToday';
import React, { useMemo, useState } from 'react';
import { PageContainer } from '@/components/PageContainer';
import {
  AdminToolbar,
  adminTableScroll,
  drawerWidthMd,
  fullWidthStyle,
  ResponsiveActions,
  wrapTextStyle,
} from '@/pages/_shared/adminLayout';
import {
  appsNotificationsApiBulkAction,
  appsNotificationsApiGetNotification,
  appsNotificationsApiListNotifications,
  appsNotificationsApiPatchNotification,
  appsNotificationsApiUnreadCount,
} from '@/services/openapi/notifications';
import { SPACE_PATHS } from '@/utils/adminRouting';
import { platformQueryKeys } from '../shared';

const PAGE_SIZE = 10;

dayjs.extend(isToday);

type ReadFilter = 'all' | 'unread' | 'read';
type NotificationSearchState = {
  detailId?: number;
  page: number;
  readFilter: ReadFilter;
};
type NotificationInsight = API.NotificationOut & {
  status_label: string;
  status_color: string;
  status_summary: string;
  source_label: string;
  source_summary: string;
  action_summary: string;
  time_summary: string;
  category_label: string;
  category_color: string;
};

const sectionStyle: React.CSSProperties = {
  padding: 20,
  border: '1px solid var(--ant-color-border-secondary)',
  borderRadius: 8,
  background: 'var(--ant-color-fill-quaternary)',
};

const notificationPreviewStyle: React.CSSProperties = {
  ...wrapTextStyle,
  display: '-webkit-box',
  overflow: 'hidden',
  WebkitLineClamp: 2,
  WebkitBoxOrient: 'vertical',
};

function getFilterParam(filter: ReadFilter) {
  if (filter === 'unread') return 'false';
  if (filter === 'read') return 'true';
  return undefined;
}

function positiveNumber(value: string | null) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function getNotificationSearchState(search: string): NotificationSearchState {
  const params = new URLSearchParams(search);
  const read = params.get('read');
  return {
    detailId: positiveNumber(params.get('notification_id')),
    page: positiveNumber(params.get('page')) || 1,
    readFilter: read === 'unread' || read === 'read' ? read : 'all',
  };
}

function syncNotificationSearch(state: NotificationSearchState) {
  const params = new URLSearchParams(window.location.search);
  params.delete('notification_id');
  params.delete('page');
  params.delete('read');
  if (state.detailId) {
    params.set('notification_id', String(state.detailId));
  }
  if (state.page > 1) params.set('page', String(state.page));
  if (state.readFilter !== 'all') params.set('read', state.readFilter);
  const nextSearch = params.toString();
  const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}${window.location.hash || ''}`;
  const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash || ''}`;
  if (nextUrl !== currentUrl) {
    window.history.replaceState(window.history.state, '', nextUrl);
  }
}

function buildNotificationInsight(
  item: API.NotificationOut,
): NotificationInsight {
  const actorName = item.actor?.full_name || item.actor?.username;
  const sourceLabel = actorName ? `来自 ${actorName}` : '系统通知';
  const createdAt = dayjs(item.created_at);
  const category = item.category || '';
  const categoryLabel = category.startsWith('team.task')
    ? '团队任务'
    : category === 'team.announcement'
      ? '团队公告'
      : '普通通知';
  const categoryColor = category.startsWith('team.task')
    ? 'gold'
    : category === 'team.announcement'
      ? 'blue'
      : 'default';

  if (!item.is_read) {
    return {
      ...item,
      status_label: '未读',
      status_color: 'blue',
      status_summary: item.url
        ? '通知尚未阅读，可打开相关页面查看。'
        : '通知尚未阅读。',
      source_label: sourceLabel,
      source_summary: actorName
        ? '这条通知由该用户触发。'
        : '这条通知由系统自动发送。',
      action_summary: item.url ? '可打开相关页面' : '无相关页面',
      category_label: categoryLabel,
      category_color: categoryColor,
      time_summary: createdAt.isToday()
        ? `今天 ${createdAt.format('HH:mm')} 收到`
        : `${createdAt.format('YYYY-MM-DD HH:mm')} 收到`,
    };
  }

  return {
    ...item,
    status_label: '已读',
    status_color: 'default',
    status_summary: item.url
      ? '通知已读，可再次打开相关页面查看。'
      : '通知已读。',
    source_label: sourceLabel,
    source_summary: actorName
      ? '这条通知由该用户触发。'
      : '这条通知由系统自动发送。',
    action_summary: item.url ? '可再次打开相关页面' : '无相关页面',
    category_label: categoryLabel,
    category_color: categoryColor,
    time_summary: createdAt.isToday()
      ? `今天 ${createdAt.format('HH:mm')} 收到`
      : `${createdAt.format('YYYY-MM-DD HH:mm')} 收到`,
  };
}

const NotificationsAdminPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { canManageNotificationDispatches } = useAccess();
  const initialSearchState = useMemo(
    () => getNotificationSearchState(window.location.search),
    [],
  );
  const [page, setPage] = useState(initialSearchState.page);
  const [readFilter, setReadFilter] = useState<ReadFilter>(
    initialSearchState.readFilter,
  );
  const [detailId, setDetailId] = useState<number | undefined>(
    initialSearchState.detailId,
  );

  const updateSearchState = (next: Partial<NotificationSearchState>) => {
    syncNotificationSearch({
      detailId,
      page,
      readFilter,
      ...next,
    });
  };

  const openDetail = (id: number) => {
    setDetailId(id);
    updateSearchState({ detailId: id });
  };

  const closeDetail = () => {
    setDetailId(undefined);
    updateSearchState({ detailId: undefined });
  };

  const notificationsQuery = useQuery({
    queryKey: platformQueryKeys.notifications(page, getFilterParam(readFilter)),
    queryFn: () =>
      appsNotificationsApiListNotifications({
        page,
        page_size: PAGE_SIZE,
        is_read: getFilterParam(readFilter),
      }),
  });
  const unreadCountQuery = useQuery({
    queryKey: ['platform-management', 'notifications', 'unread-count'],
    queryFn: () => appsNotificationsApiUnreadCount(),
  });
  const detailQuery = useQuery({
    queryKey: ['platform-management', 'notification-detail', detailId],
    queryFn: () => {
      if (!detailId) throw new Error('缺少通知 ID');
      return appsNotificationsApiGetNotification({ notification_id: detailId });
    },
    enabled: Boolean(detailId),
  });
  const patchMutation = useMutation({
    mutationFn: ({ id, isRead }: { id: number; isRead: boolean }) =>
      appsNotificationsApiPatchNotification(
        { notification_id: id },
        { is_read: isRead },
      ),
    onSuccess: async () => {
      await notificationsQuery.refetch();
      await unreadCountQuery.refetch();
      queryClient.invalidateQueries({ queryKey: ['notification-bell'] });
      if (detailId) {
        await detailQuery.refetch();
      }
    },
  });
  const bulkMutation = useMutation({
    mutationFn: (body: API.BulkActionIn) =>
      appsNotificationsApiBulkAction(body),
    onSuccess: async () => {
      await notificationsQuery.refetch();
      await unreadCountQuery.refetch();
      queryClient.invalidateQueries({ queryKey: ['notification-bell'] });
    },
  });

  const insights = useMemo(
    () => (notificationsQuery.data?.items || []).map(buildNotificationInsight),
    [notificationsQuery.data?.items],
  );
  const unreadCount = unreadCountQuery.data?.count ?? 0;

  const columns: ColumnsType<NotificationInsight> = [
    {
      title: '通知主题',
      dataIndex: 'title',
      width: 280,
      render: (_value, record) => (
        <Space direction="vertical" size={4}>
          <Typography.Text style={wrapTextStyle}>
            {record.title || '无标题'}
          </Typography.Text>
          <Tag color={record.category_color}>{record.category_label}</Tag>
          <Typography.Text type="secondary" style={notificationPreviewStyle}>
            {record.body || '无正文'}
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: '阅读状态',
      dataIndex: 'status_label',
      width: 260,
      align: 'center',
      render: (_value, record) => (
        <Space direction="vertical" size={6}>
          <Tag color={record.status_color}>{record.status_label}</Tag>
          <Typography.Text type="secondary">
            {record.status_summary}
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: '来源与操作',
      dataIndex: 'source_label',
      width: 280,
      render: (_value, record) => (
        <Space direction="vertical" size={6}>
          <Typography.Text>{record.source_label}</Typography.Text>
          <Typography.Text type="secondary">
            {record.source_summary}
          </Typography.Text>
          <Typography.Text type="secondary">
            {record.action_summary}
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: '接收时间',
      dataIndex: 'created_at',
      width: 220,
      align: 'center',
      render: (_value, record) => (
        <Space direction="vertical" size={6}>
          <Typography.Text>{record.time_summary}</Typography.Text>
          <Typography.Text type="secondary">
            {dayjs(record.created_at).format('YYYY-MM-DD HH:mm')}
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: '操作',
      dataIndex: 'actions',
      width: 220,
      align: 'center',
      render: (_value, record) => (
        <ResponsiveActions>
          <Button
            type="link"
            size="small"
            onClick={() => {
              openDetail(record.id);
              if (!record.is_read) {
                void patchMutation.mutateAsync({ id: record.id, isRead: true });
              }
            }}
          >
            详情
          </Button>
          <Button
            type="link"
            size="small"
            onClick={() =>
              void patchMutation.mutateAsync({
                id: record.id,
                isRead: !record.is_read,
              })
            }
          >
            {record.is_read ? '标记未读' : '标记已读'}
          </Button>
        </ResponsiveActions>
      ),
    },
  ];

  const detailData = detailQuery.data
    ? buildNotificationInsight(detailQuery.data)
    : undefined;

  return (
    <PageContainer title="通知中心">
      <Card
        extra={
          <AdminToolbar>
            <Segmented
              options={[
                { label: '全部', value: 'all' },
                { label: '未读', value: 'unread' },
                { label: '已读', value: 'read' },
              ]}
              value={readFilter}
              onChange={(value) => {
                const nextReadFilter = value as ReadFilter;
                setPage(1);
                setReadFilter(nextReadFilter);
                updateSearchState({ page: 1, readFilter: nextReadFilter });
              }}
            />
            {canManageNotificationDispatches ? (
              <Button
                onClick={() => history.push(SPACE_PATHS.notificationDispatches)}
              >
                查看发送记录
              </Button>
            ) : null}
            <Button
              type="primary"
              icon={<CheckOutlined />}
              disabled={!unreadCount}
              onClick={() =>
                void bulkMutation.mutateAsync({
                  action: 'mark_read',
                  all_unread: true,
                })
              }
            >
              全部标记已读
            </Button>
          </AdminToolbar>
        }
      >
        <div style={sectionStyle}>
          <Space direction="vertical" size={12} style={fullWidthStyle}>
            <div>
              <Typography.Text strong>通知列表</Typography.Text>
            </div>
            {notificationsQuery.isError ? (
              <Alert
                type="error"
                showIcon
                title="通知加载失败"
                description="暂时无法取得通知列表，请检查网络后重新加载。"
                action={
                  <Button
                    size="small"
                    onClick={() => void notificationsQuery.refetch()}
                  >
                    重新加载
                  </Button>
                }
              />
            ) : !notificationsQuery.isLoading && insights.length === 0 ? (
              <Empty description="当前筛选下暂无通知" />
            ) : (
              <Table
                rowKey="id"
                loading={notificationsQuery.isLoading}
                columns={columns}
                dataSource={insights}
                scroll={adminTableScroll}
                pagination={{
                  current: notificationsQuery.data?.page || page,
                  pageSize: notificationsQuery.data?.page_size || PAGE_SIZE,
                  total: notificationsQuery.data?.total || 0,
                  onChange: (nextPage) => {
                    setPage(nextPage);
                    updateSearchState({ page: nextPage });
                  },
                }}
              />
            )}
          </Space>
        </div>
      </Card>

      <Drawer
        title="通知详情"
        open={Boolean(detailId)}
        onClose={closeDetail}
        width={drawerWidthMd}
      >
        <Space direction="vertical" size={12} style={fullWidthStyle}>
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="通知标题">
              {detailData?.title || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="阅读状态">
              {detailData ? (
                <Tag color={detailData.status_color}>
                  {detailData.status_label}
                </Tag>
              ) : (
                '-'
              )}
            </Descriptions.Item>
            <Descriptions.Item label="通知来源">
              {detailData?.source_label || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="通知类别">
              {detailData ? (
                <Tag color={detailData.category_color}>
                  {detailData.category_label}
                </Tag>
              ) : (
                '-'
              )}
            </Descriptions.Item>
            <Descriptions.Item label="来源说明">
              {detailData?.source_summary || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="相关操作">
              {detailData?.action_summary || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="关联对象">
              {detailData?.target_type && detailData.target_id
                ? `${detailData.target_type} #${detailData.target_id}`
                : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="接收时间">
              {detailData
                ? dayjs(detailData.created_at).format('YYYY-MM-DD HH:mm')
                : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="正文">
              <span style={wrapTextStyle}>{detailData?.body || '-'}</span>
            </Descriptions.Item>
            <Descriptions.Item label="跳转入口">
              {detailData?.url ? (
                <Typography.Link href={detailData.url} target="_blank">
                  <LinkOutlined /> 打开通知链接
                </Typography.Link>
              ) : (
                '-'
              )}
            </Descriptions.Item>
          </Descriptions>
        </Space>
      </Drawer>
    </PageContainer>
  );
};

export default NotificationsAdminPage;
