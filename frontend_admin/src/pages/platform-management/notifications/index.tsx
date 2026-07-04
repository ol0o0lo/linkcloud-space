import { CheckOutlined, LinkOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageContainer } from '@ant-design/pro-components';
import {
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
import { platformQueryKeys } from '../shared';

const PAGE_SIZE = 10;

dayjs.extend(isToday);

type ReadFilter = 'all' | 'unread' | 'read';
type NotificationInsight = API.NotificationOut & {
  status_label: string;
  status_color: string;
  status_summary: string;
  source_label: string;
  source_summary: string;
  action_summary: string;
  time_summary: string;
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

function buildNotificationInsight(
  item: API.NotificationOut,
): NotificationInsight {
  const actorName = item.actor?.full_name || item.actor?.username;
  const sourceLabel = actorName ? `来自 ${actorName}` : '系统触达';
  const createdAt = dayjs(item.created_at);

  if (!item.is_read) {
    return {
      ...item,
      status_label: '待处理',
      status_color: 'blue',
      status_summary: item.url
        ? '通知仍未处理，且附带后续入口。'
        : '通知仍未确认，当前主要作为提醒。',
      source_label: sourceLabel,
      source_summary: actorName
        ? '这条通知由明确用户触发，必要时可继续追溯来源。'
        : '系统类通知主要用于平台提醒和公告。',
      action_summary: item.url ? '可继续跳转处理' : '暂无后续跳转',
      time_summary: createdAt.isToday()
        ? `今天 ${createdAt.format('HH:mm')} 到达`
        : `${createdAt.format('YYYY-MM-DD HH:mm')} 到达`,
    };
  }

  return {
    ...item,
    status_label: '已确认',
    status_color: 'default',
    status_summary: item.url
      ? '通知已读，后续如需继续处理可从详情中的跳转入口进入。'
      : '通知已经读过，目前主要保留为审计和回看依据。',
    source_label: sourceLabel,
    source_summary: actorName
      ? '来源清晰，后续需要时可以继续定位到具体用户。'
      : '系统通知已经进入已读状态，可继续作为平台记录。',
    action_summary: item.url ? '已读但可继续跳转' : '已读存档',
    time_summary: createdAt.isToday()
      ? `今天 ${createdAt.format('HH:mm')} 已确认`
      : `${createdAt.format('YYYY-MM-DD HH:mm')} 已确认`,
  };
}

const NotificationsAdminPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [readFilter, setReadFilter] = useState<ReadFilter>('all');
  const [detailId, setDetailId] = useState<number>();

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
    queryFn: () =>
      appsNotificationsApiGetNotification({ notification_id: detailId! }),
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
          <Typography.Text type="secondary" style={notificationPreviewStyle}>
            {record.body || '无正文'}
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: '触达状态',
      dataIndex: 'status_label',
      width: 260,
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
      title: '来源与后续',
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
      title: '到达时间',
      dataIndex: 'created_at',
      width: 220,
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
      render: (_value, record) => (
        <ResponsiveActions>
          <a
            onClick={() => {
              setDetailId(record.id);
              if (!record.is_read) {
                void patchMutation.mutateAsync({ id: record.id, isRead: true });
              }
            }}
          >
            详情
          </a>
          <a
            onClick={() =>
              void patchMutation.mutateAsync({
                id: record.id,
                isRead: !record.is_read,
              })
            }
          >
            {record.is_read ? '标记未读' : '标记已读'}
          </a>
        </ResponsiveActions>
      ),
    },
  ];

  const detailData = detailQuery.data
    ? buildNotificationInsight(detailQuery.data)
    : undefined;

  return (
    <PageContainer title="通知管理">
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
                setPage(1);
                setReadFilter(value as ReadFilter);
              }}
            />
            <Button href="/dashboard/tenant-operations/notification-dispatches">
              查看通知分发
            </Button>
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
            {!notificationsQuery.isLoading && insights.length === 0 ? (
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
                  onChange: setPage,
                }}
              />
            )}
          </Space>
        </div>
      </Card>

      <Drawer
        title="通知详情"
        open={Boolean(detailId)}
        onClose={() => setDetailId(undefined)}
        width={drawerWidthMd}
      >
        <Space direction="vertical" size={12} style={fullWidthStyle}>
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="通知标题">
              {detailData?.title || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="触达状态">
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
            <Descriptions.Item label="来源说明">
              {detailData?.source_summary || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="后续动作">
              {detailData?.action_summary || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="到达时间">
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
