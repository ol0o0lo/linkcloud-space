import { CheckOutlined, DownOutlined, RightOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Empty, List, Pagination, Typography } from 'antd';
import { createStyles } from 'antd-style';
import dayjs from 'dayjs';
import isToday from 'dayjs/plugin/isToday';
import React, { useEffect, useState } from 'react';
import { fullWidthStyle } from '@/pages/_shared/adminLayout';
import {
  appsNotificationsApiBulkAction,
  appsNotificationsApiGetNotification,
  appsNotificationsApiListNotifications,
  appsNotificationsApiPatchNotification,
  appsNotificationsApiUnreadCount,
} from '@/services/openapi/notifications';
import { platformQueryKeys } from '../shared';

dayjs.extend(isToday);

const PAGE_SIZE = 10;

const formatTime = (dateStr: string) => {
  const d = dayjs(dateStr);
  if (d.isToday()) return d.format('HH:mm');
  if (d.isSame(dayjs(), 'year')) return d.format('MM/DD');
  return d.format('YYYY/MM/DD');
};

const useStyles = createStyles(({ token, css }) => ({
  listItem: css`
    cursor: pointer;
    padding: 12px 16px !important;
    border-radius: 8px;
    margin-bottom: 6px;
    background: ${token.colorBgContainer};

    transition: background 0.15s;
    &:hover { background: ${token.colorBgElevated}; }
  `,
  lastItem: css`
    margin-bottom: 0;
  `,
  unreadDot: css`
    display: inline-block;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: ${token.colorPrimary};
    flex-shrink: 0;
  `,
  itemRow: css`
    display: flex;
    align-items: center;
    gap: 8px;
  `,
  itemTitle: css`
    font-size: 14px;
    font-weight: 600;
    line-height: 1.5;
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
  itemTitleRead: css`
    font-weight: 400;
    color: ${token.colorTextSecondary};
  `,
  itemTime: css`
    font-size: 12px;
    color: ${token.colorTextQuaternary};
    white-space: nowrap;
    flex-shrink: 0;
  `,
  expandArrow: css`
    font-size: 12px;
    color: ${token.colorTextQuaternary};
    margin-left: 4px;
    transition: transform 0.2s;
  `,
  itemPreview: css`
    font-size: 13px;
    color: ${token.colorTextSecondary};
    line-height: 1.5;
    margin-top: 4px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
  expandedBody: css`
    font-size: 13px;
    color: ${token.colorText};
    line-height: 1.7;
    margin-top: 10px;
    white-space: pre-wrap;
    word-break: break-word;
  `,
  toolbar: css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16px;
  `,
  emptyWrapper: css`
    padding: 64px 0;
  `,
}));

const NotificationsAdminPage: React.FC = () => {
  const { styles } = useStyles();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<number | undefined>();

  const notificationsQuery = useQuery({
    queryKey: platformQueryKeys.notifications(page),
    queryFn: () => appsNotificationsApiListNotifications({ page, page_size: PAGE_SIZE }),
  });
  const unreadCountQuery = useQuery({
    queryKey: ['platform-management', 'notifications', 'unread-count'],
    queryFn: () => appsNotificationsApiUnreadCount(),
  });
  const detailQuery = useQuery({
    queryKey: ['platform-management', 'notification-detail', expandedId],
    queryFn: () => appsNotificationsApiGetNotification({ notification_id: expandedId! }),
    enabled: Boolean(expandedId),
  });
  const patchMutation = useMutation({
    mutationFn: ({ id, isRead }: { id: number; isRead: boolean }) =>
      appsNotificationsApiPatchNotification({ notification_id: id }, { is_read: isRead }),
    onSuccess: () => {
      notificationsQuery.refetch();
      unreadCountQuery.refetch();
      queryClient.invalidateQueries({ queryKey: ['notification-bell'] });
    },
  });
  const bulkMutation = useMutation({
    mutationFn: (body: API.BulkActionIn) => appsNotificationsApiBulkAction(body),
    onSuccess: () => {
      notificationsQuery.refetch();
      unreadCountQuery.refetch();
      queryClient.invalidateQueries({ queryKey: ['notification-bell'] });
    },
  });

  useEffect(() => {
    const markAsRead = async () => {
      if (expandedId != null && detailQuery.data && !detailQuery.data.is_read) {
        await patchMutation.mutateAsync({ id: expandedId, isRead: true });
      }
    };
    markAsRead();
  }, [expandedId]);

  const unreadCount = unreadCountQuery.data?.count ?? 0;
  const items = notificationsQuery.data?.items || [];
  const isLast = (i: number) => i === items.length - 1;

  return (
    <div style={fullWidthStyle}>
      <div className={styles.toolbar}>
        <Typography.Text type="secondary">
          共 {notificationsQuery.data?.total ?? 0} 条通知{unreadCount > 0 ? `，${unreadCount} 条未读` : ''}
        </Typography.Text>
        {unreadCount > 0 && (
          <Button icon={<CheckOutlined />} size="small" onClick={() => void bulkMutation.mutateAsync({ action: 'mark_read', all_unread: true })}>
            全部已读
          </Button>
        )}
      </div>
      <List
        loading={notificationsQuery.isLoading}
        dataSource={items}
        locale={{ emptyText: <div className={styles.emptyWrapper}><Empty description="暂无通知" /></div> }}
        renderItem={(item, i) => {
          const isExpanded = expandedId === item.id;
          return (
            <List.Item
              className={`${styles.listItem} ${isLast(i) ? styles.lastItem : ''}`}
              onClick={() => setExpandedId(isExpanded ? undefined : item.id)}
            >
              <div style={{ width: '100%' }}>
                <div className={styles.itemRow}>
                  {!item.is_read && <span className={styles.unreadDot} />}
                  <span className={`${styles.itemTitle} ${item.is_read ? styles.itemTitleRead : ''}`}>{item.title || '无标题'}</span>
                  <span className={styles.expandArrow}>{isExpanded ? <DownOutlined /> : <RightOutlined />}</span>
                  <span className={styles.itemTime}>{formatTime(item.created_at)}</span>
                </div>
                {!isExpanded && item.body && <div className={styles.itemPreview}>{item.body}</div>}
                {isExpanded && detailQuery.data && (
                  <>
                    {detailQuery.data.body && <div className={styles.expandedBody}>{detailQuery.data.body}</div>}
                    {detailQuery.data.url && (
                      <div style={{ marginTop: 8 }}>
                        <Typography.Link href={detailQuery.data.url} target="_blank" onClick={(e) => e.stopPropagation()}>
                          查看详情 <RightOutlined />
                        </Typography.Link>
                      </div>
                   )}
                  </>
                )}
              </div>
            </List.Item>
          );
        }}
      />
      <Pagination
        style={{ marginTop: 16, textAlign: 'right' }}
        current={notificationsQuery.data?.page || page}
        pageSize={notificationsQuery.data?.page_size || PAGE_SIZE}
        total={notificationsQuery.data?.total || 0}
        onChange={(p) => setPage(p)}
        showSizeChanger={false}
      />
    </div>
  );
};

export default NotificationsAdminPage;
