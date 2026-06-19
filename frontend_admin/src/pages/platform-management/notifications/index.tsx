import {CheckOutlined, DownOutlined, RightOutlined} from '@ant-design/icons';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {Button, Empty, Pagination, Spin, Typography} from 'antd';
import dayjs from 'dayjs';
import isToday from 'dayjs/plugin/isToday';
import React, {useEffect, useState} from 'react';
import {fullWidthStyle} from '@/pages/_shared/adminLayout';
import {
  appsNotificationsApiBulkAction,
  appsNotificationsApiGetNotification,
  appsNotificationsApiListNotifications,
  appsNotificationsApiPatchNotification,
  appsNotificationsApiUnreadCount,
} from '@/services/openapi/notifications';
import {platformQueryKeys} from '../shared';

dayjs.extend(isToday);

const PAGE_SIZE = 10;

const formatTime = (dateStr: string) => {
  const d = dayjs(dateStr);
  if (d.isToday()) return d.format('HH:mm');
  if (d.isSame(dayjs(), 'year')) return d.format('MM/DD');
  return d.format('YYYY/MM/DD');
};

const NotificationsAdminPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<number | undefined>();

  const notificationsQuery = useQuery({
    queryKey: platformQueryKeys.notifications(page),
    queryFn: () => appsNotificationsApiListNotifications({page, page_size: PAGE_SIZE}),
  });
  const unreadCountQuery = useQuery({
    queryKey: ['platform-management', 'notifications', 'unread-count'],
    queryFn: () => appsNotificationsApiUnreadCount(),
  });
  const detailQuery = useQuery({
    queryKey: ['platform-management', 'notification-detail', expandedId],
    queryFn: () => appsNotificationsApiGetNotification({notification_id: expandedId!}),
    enabled: Boolean(expandedId),
  });
  const patchMutation = useMutation({
    mutationFn: ({id, isRead}: { id: number; isRead: boolean }) =>
      appsNotificationsApiPatchNotification({notification_id: id}, {is_read: isRead}),
    onSuccess: () => {
      notificationsQuery.refetch();
      unreadCountQuery.refetch();
      queryClient.invalidateQueries({queryKey: ['notification-bell']});
    },
  });
  const bulkMutation = useMutation({
    mutationFn: (body: API.BulkActionIn) => appsNotificationsApiBulkAction(body),
    onSuccess: () => {
      notificationsQuery.refetch();
      unreadCountQuery.refetch();
      queryClient.invalidateQueries({queryKey: ['notification-bell']});
    },
  });

  useEffect(() => {
    const markAsRead = async () => {
      if (expandedId != null && detailQuery.data && !detailQuery.data.is_read) {
        await patchMutation.mutateAsync({id: expandedId, isRead: true});
      }
    };
    markAsRead();
  }, [expandedId]);

  const unreadCount = unreadCountQuery.data?.count ?? 0;
  const items = notificationsQuery.data?.items || [];

  return (
    <div style={fullWidthStyle}>
      <div className="flex items-center justify-between mb-4">
        <Typography.Text type="secondary">
          共 {notificationsQuery.data?.total ?? 0} 条通知{unreadCount > 0 ? `，${unreadCount} 条未读` : ''}
        </Typography.Text>
        {unreadCount > 0 && (
          <Button icon={<CheckOutlined/>} size="small" onClick={() => void bulkMutation.mutateAsync({action: 'mark_read', all_unread: true})}>
            全部已读
          </Button>
        )}
      </div>

      {notificationsQuery.isLoading && <Spin/>}

      {!notificationsQuery.isLoading && items.length === 0 && (
        <div className="py-16"><Empty description="暂无通知"/></div>
      )}

      {items.map((item, i) => {
        const isExpanded = expandedId === item.id;
        return (
          <div
            key={item.id}
            className={`cursor-pointer rounded-lg px-4 py-3 transition-colors bg-white hover:shadow-sm ${i < items.length - 1 ? 'mb-1.5' : ''}  ${isExpanded ? 'bg-shadow' : ''}`}
            onClick={() => setExpandedId(isExpanded ? undefined : item.id)}
          >
            <div className="flex items-center gap-2">
              {!item.is_read && <span className="inline-block size-2 shrink-0 rounded-full bg-blue-500"/>}
              <span
                className={`${isExpanded ? "font-bold text-gray-900" : ""} text-sm flex-1 min-w-0 truncate ${item.is_read ? 'font-normal text-gray-600' : 'font-bold text-gray-900'}`}>
                {item.title || '无标题'}
              </span>
              <span className="text-xs text-gray-400 shrink-0">{formatTime(item.created_at)}</span>
              <span className="text-xs text-gray-400 shrink-0 ml-1">{isExpanded ? <DownOutlined/> : <RightOutlined/>}</span>

            </div>
            {!isExpanded && item.body && <div className={`text-sm leading-normal mt-1 truncate ${item.is_read ? "text-gray-400" : "text-gray-600"}`}>{item.body}</div>}
            {isExpanded && detailQuery.data && (
              <>
                {detailQuery.data.body && (
                  <div className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap break-words">{detailQuery.data.body}</div>
                )}
                {detailQuery.data.url && (
                  <div className="mt-2">
                    <Typography.Link href={detailQuery.data.url} target="_blank" onClick={(e) => e.stopPropagation()}>
                      查看详情 <RightOutlined/>
                    </Typography.Link>
                  </div>
                )}
              </>
            )}
          </div>
        );
      })}

      <Pagination
        style={{marginTop: 16, textAlign: 'right'}}
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
