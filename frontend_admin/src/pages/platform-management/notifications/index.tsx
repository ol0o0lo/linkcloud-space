import { useMutation, useQuery } from '@tanstack/react-query';
import { Button, Card, Descriptions, Drawer, Space, Switch, Table, Tabs, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import React, { useState } from 'react';
import { adminTableScroll, drawerWidthMd, fullWidthStyle, ResponsiveActions, wrapTextStyle } from '@/pages/_shared/adminLayout';
import {
  appsNotificationsApiBulkAction,
  appsNotificationsApiDeleteNotification,
  appsNotificationsApiGetNotification,
  appsNotificationsApiListNotifications,
  appsNotificationsApiListPreferences,
  appsNotificationsApiPatchNotification,
  appsNotificationsApiPatchPreference,
  appsNotificationsApiUnreadCount,
} from '@/services/openapi/notifications';
import { platformQueryKeys } from '../shared';

const NotificationsAdminPage: React.FC = () => {
  const [page, setPage] = useState(1);
  const [detailId, setDetailId] = useState<number>();
  const notificationsQuery = useQuery({
    queryKey: platformQueryKeys.notifications(page),
    queryFn: () => appsNotificationsApiListNotifications({ page, page_size: 10 }),
  });
  const unreadCountQuery = useQuery({
    queryKey: ['platform-management', 'notifications', 'unread-count'],
    queryFn: () => appsNotificationsApiUnreadCount(),
  });
  const detailQuery = useQuery({
    queryKey: ['platform-management', 'notification-detail', detailId],
    queryFn: () => appsNotificationsApiGetNotification({ notification_id: detailId! }),
    enabled: Boolean(detailId),
  });
  const preferencesQuery = useQuery({
    queryKey: platformQueryKeys.notificationPreferences,
    queryFn: () => appsNotificationsApiListPreferences(),
  });
  const patchMutation = useMutation({
    mutationFn: ({ id, isRead }: { id: number; isRead: boolean }) => appsNotificationsApiPatchNotification({ notification_id: id }, { is_read: isRead }),
    onSuccess: () => {
      notificationsQuery.refetch();
      unreadCountQuery.refetch();
    },
  });
  const deleteMutation = useMutation({
    mutationFn: (id: number) => appsNotificationsApiDeleteNotification({ notification_id: id }),
    onSuccess: () => {
      notificationsQuery.refetch();
      unreadCountQuery.refetch();
    },
  });
  const bulkMutation = useMutation({
    mutationFn: (body: API.BulkActionIn) => appsNotificationsApiBulkAction(body),
    onSuccess: () => {
      notificationsQuery.refetch();
      unreadCountQuery.refetch();
    },
  });
  const preferenceMutation = useMutation({
    mutationFn: ({ key, body }: { key: string; body: API.NotificationPreferencePatchIn }) => appsNotificationsApiPatchPreference({ category: key }, body),
    onSuccess: () => preferencesQuery.refetch(),
  });

  const columns: ColumnsType<API.NotificationOut> = [
    { title: '标题', dataIndex: 'title', width: 220, render: (value) => <span style={wrapTextStyle}>{value}</span> },
    { title: '内容', dataIndex: 'body', width: 360, render: (value) => <span style={wrapTextStyle}>{value}</span> },
    { title: '状态', dataIndex: 'is_read', width: 100, render: (value) => (value ? <Tag>已读</Tag> : <Tag color="gold">未读</Tag>) },
    { title: '时间', dataIndex: 'created_at', width: 170, render: (value) => dayjs(value).format('YYYY-MM-DD HH:mm') },
    {
      title: '操作',
      dataIndex: 'actions',
      width: 180,
      render: (_value, record) => (
        <ResponsiveActions>
          <a onClick={() => setDetailId(record.id)}>详情</a>
          <a onClick={() => void patchMutation.mutateAsync({ id: record.id, isRead: !record.is_read })}>{record.is_read ? '标记未读' : '标记已读'}</a>
          <a onClick={() => void deleteMutation.mutateAsync(record.id)}>删除</a>
        </ResponsiveActions>
      ),
    },
  ];

  return (
    <Card title="通知中心" extra={<Tag color="gold">未读 {unreadCountQuery.data?.count || 0}</Tag>}>
      <Tabs
        items={[
          {
            key: 'notifications',
            label: '通知列表',
            children: (
              <Space orientation="vertical" style={fullWidthStyle}>
                <Button onClick={() => void bulkMutation.mutateAsync({ action: 'mark_read', all_unread: true })}>全部未读标记已读</Button>
                <Table
                  rowKey="id"
                  loading={notificationsQuery.isLoading}
                  columns={columns}
                  dataSource={notificationsQuery.data?.items || []}
                  scroll={adminTableScroll}
                  pagination={{ current: notificationsQuery.data?.page || page, pageSize: notificationsQuery.data?.page_size || 10, total: notificationsQuery.data?.total || 0, onChange: setPage }}
                />
              </Space>
            ),
          },
          {
            key: 'preferences',
            label: '通知偏好',
            children: (
              <Table
                rowKey="key"
                loading={preferencesQuery.isLoading}
                dataSource={preferencesQuery.data || []}
                pagination={false}
                scroll={adminTableScroll}
                columns={[
                  { title: '类别', dataIndex: 'label', width: 220 },
                  { title: '站内', dataIndex: 'in_app', width: 100, render: (value, record) => <Switch aria-label={`${record.label}-站内`} checked={value} onChange={(checked) => void preferenceMutation.mutateAsync({ key: record.key, body: { in_app: checked } })} /> },
                  { title: '邮件', dataIndex: 'email', width: 100, render: (value, record) => <Switch aria-label={`${record.label}-邮件`} checked={value} onChange={(checked) => void preferenceMutation.mutateAsync({ key: record.key, body: { email: checked } })} /> },
                ]}
              />
            ),
          },
        ]}
      />
      <Drawer title="通知详情" open={Boolean(detailId)} onClose={() => setDetailId(undefined)} width={drawerWidthMd}>
        <Descriptions column={1} bordered size="small">
          <Descriptions.Item label="标题"><span style={wrapTextStyle}>{detailQuery.data?.title || '-'}</span></Descriptions.Item>
          <Descriptions.Item label="内容"><span style={wrapTextStyle}>{detailQuery.data?.body || '-'}</span></Descriptions.Item>
          <Descriptions.Item label="链接"><span style={wrapTextStyle}>{detailQuery.data?.url || '-'}</span></Descriptions.Item>
          <Descriptions.Item label="状态">{detailQuery.data?.is_read ? '已读' : '未读'}</Descriptions.Item>
          <Descriptions.Item label="触发人">{detailQuery.data?.actor?.full_name || detailQuery.data?.actor?.username || '-'}</Descriptions.Item>
          <Descriptions.Item label="时间">{detailQuery.data?.created_at ? dayjs(detailQuery.data.created_at).format('YYYY-MM-DD HH:mm') : '-'}</Descriptions.Item>
        </Descriptions>
      </Drawer>
    </Card>
  );
};

export default NotificationsAdminPage;
