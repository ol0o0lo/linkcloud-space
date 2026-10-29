import { BellOutlined } from '@ant-design/icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { history, useModel } from '@umijs/max';
import { Alert, Badge, Button, Empty, Popover, Spin, Typography } from 'antd';
import React, { useEffect, useRef, useState } from 'react';
import { BACKGROUND_REFRESH_INTERVAL } from '@/hooks/useBackgroundPolling';
import { getMessagingUnreadCount } from '@/services/manual/messaging';
import {
  fetchNotificationFeed,
  notificationQueryKeys,
  notificationRequestOptions,
} from '@/services/manual/notifications';
import {
  appsNotificationsApiPatchNotification,
  appsNotificationsApiUnreadCount,
} from '@/services/openapi/notifications';
import {
  getNotificationPath,
  NOTIFICATIONS_PATH,
} from '@/utils/notificationRouting';
import { getSelectedOrgSlug } from '@/utils/orgSelection';

function browserPermission() {
  return typeof window.Notification === 'function' &&
    window.isSecureContext !== false
    ? window.Notification.permission
    : 'unsupported';
}

export function BrowserNotificationPermission({ error }: { error?: string }) {
  const [permission, setPermission] = useState(browserPermission);
  const [requestError, setRequestError] = useState('');
  useEffect(() => {
    const update = () => setPermission(browserPermission());
    window.addEventListener('focus', update);
    document.addEventListener('visibilitychange', update);
    return () => {
      window.removeEventListener('focus', update);
      document.removeEventListener('visibilitychange', update);
    };
  }, []);
  const enable = async () => {
    try {
      setRequestError('');
      setPermission(await window.Notification.requestPermission());
    } catch {
      setRequestError('无法申请桌面通知权限，请检查浏览器设置。');
    }
  };
  return (
    <div className="flex flex-col gap-2">
      {permission === 'default' ? (
        <Button onClick={() => void enable()}>开启桌面通知</Button>
      ) : (
        <Typography.Text type="secondary">
          {permission === 'granted'
            ? '桌面通知已开启'
            : permission === 'denied'
              ? '桌面通知被阻止，请在浏览器设置中允许。'
              : '当前浏览器不支持桌面通知'}
        </Typography.Text>
      )}
      {(error || requestError) && (
        <Alert type="warning" title={error || requestError} />
      )}
    </div>
  );
}

export type NotificationEntryState = {
  unreadCount: number;
  chatUnreadCount: number;
};
type NotificationBellProps = {
  children?: (state: NotificationEntryState) => React.ReactElement;
};

function ScopedNotificationBell({
  userId,
  slug,
  children,
}: {
  userId: number;
  slug?: string;
} & NotificationBellProps) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [browserError, setBrowserError] = useState('');
  const lastSeenId = useRef<number | undefined>(undefined);
  const pollOptions = {
    refetchInterval: BACKGROUND_REFRESH_INTERVAL,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: 'always' as const,
    retry: false,
  };
  const unreadQuery = useQuery({
    queryKey: notificationQueryKeys.count(userId, slug),
    queryFn: ({ signal }) =>
      appsNotificationsApiUnreadCount(notificationRequestOptions(slug, signal)),
    ...pollOptions,
  });
  const feedQuery = useQuery({
    queryKey: notificationQueryKeys.feed(userId, slug),
    queryFn: ({ signal }) =>
      fetchNotificationFeed(slug, signal, lastSeenId.current),
    ...pollOptions,
  });
  const chatUnreadQuery = useQuery({
    queryKey: ['messaging-unread', userId, slug],
    queryFn: ({ signal }) =>
      slug
        ? getMessagingUnreadCount(slug, undefined, signal)
        : Promise.resolve({ message_count: 0, conversation_count: 0 }),
    enabled: Boolean(slug),
    ...pollOptions,
  });

  const openNotification = (item: API.NotificationOut) => {
    setOpen(false);
    if (!item.is_read) {
      void appsNotificationsApiPatchNotification(
        { notification_id: item.id },
        { is_read: true },
        notificationRequestOptions(slug),
      )
        .then(() =>
          queryClient.invalidateQueries({
            queryKey: ['notification-bell', userId, slug],
          }),
        )
        .catch(() => {
          // 跳转不依赖已读同步，稍后仍可在通知中心处理。
        });
    }
    history.push(getNotificationPath(item));
  };
  const openRef = useRef(openNotification);
  openRef.current = openNotification;

  useEffect(() => {
    if (!feedQuery.data) return;
    const previousId = lastSeenId.current;
    lastSeenId.current = feedQuery.data.reduce(
      (latest, item) => Math.max(latest, item.id),
      previousId || 0,
    );
    // 首次加载只展示列表和计数，不把历史通知弹一遍。
    if (
      previousId === undefined ||
      browserPermission() !== 'granted' ||
      getSelectedOrgSlug() !== slug
    )
      return;
    let active = true;
    const notices: Notification[] = [];
    for (const item of [...feedQuery.data].reverse()) {
      if (
        item.id <= previousId ||
        item.is_read ||
        (document.visibilityState !== 'hidden' && document.hasFocus())
      )
        continue;
      try {
        const notice = new window.Notification(item.title || '收到新通知', {
          body: item.body.slice(0, 180),
          tag: `linkcloud:${userId}:notification:${item.id}`,
        });
        notice.onclick = () => {
          if (!active || getSelectedOrgSlug() !== slug) return;
          window.focus();
          openRef.current(item);
          notice.close();
        };
        notices.push(notice);
      } catch {
        setBrowserError('此浏览器暂时无法弹出桌面通知，请使用站内通知列表。');
      }
    }
    return () => {
      active = false;
      notices.forEach((notice) => {
        notice.close();
      });
    };
  }, [feedQuery.data, slug, userId]);

  const count = unreadQuery.data?.count || 0;
  if (children)
    return children({
      unreadCount: count,
      chatUnreadCount: chatUnreadQuery.data?.message_count || 0,
    });
  return (
    <Popover
      trigger="click"
      placement="bottomRight"
      open={open}
      onOpenChange={setOpen}
      title="消息通知"
      content={
        <div className="flex w-[min(340px,calc(100vw-48px))] flex-col gap-3">
          <BrowserNotificationPermission error={browserError} />
          {feedQuery.isError ? (
            <Alert
              type="error"
              title="通知加载失败"
              action={
                <Button onClick={() => void feedQuery.refetch()}>重试</Button>
              }
            />
          ) : feedQuery.isLoading ? (
            <Spin />
          ) : !feedQuery.data?.length ? (
            <Empty description="暂无通知" />
          ) : (
            <div className="flex max-h-80 flex-col gap-1 overflow-y-auto">
              {feedQuery.data.slice(0, 8).map((item) => (
                <Button
                  key={item.id}
                  type="text"
                  block
                  className="h-auto! justify-start! py-2! text-left!"
                  onClick={() => openNotification(item)}
                >
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="flex items-center gap-2">
                      <Badge dot={!item.is_read} />
                      <span className="truncate">
                        {item.title || '收到新通知'}
                      </span>
                    </span>
                    <Typography.Text
                      type="secondary"
                      className="truncate text-xs!"
                    >
                      {item.body || '点击查看详情'}
                    </Typography.Text>
                  </span>
                </Button>
              ))}
            </div>
          )}
          <Button
            type="link"
            block
            onClick={() => {
              setOpen(false);
              history.push(NOTIFICATIONS_PATH);
            }}
          >
            查看全部通知
          </Button>
        </div>
      }
    >
      <Button type="text" aria-label={`消息通知，${count} 条未读`}>
        <Badge count={count} size="small" overflowCount={99}>
          <BellOutlined />
        </Badge>
      </Button>
    </Popover>
  );
}

export default function NotificationBell({ children }: NotificationBellProps) {
  const { initialState } = useModel('@@initialState');
  const userId = initialState?.currentUser?.id;
  const slug = initialState?.selectedOrgSlug;
  return userId ? (
    <ScopedNotificationBell
      key={`${userId}:${slug || ''}`}
      userId={userId}
      slug={slug}
    >
      {children}
    </ScopedNotificationBell>
  ) : null;
}
