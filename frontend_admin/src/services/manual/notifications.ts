import {
  appsNotificationsApiListNotifications,
} from '@/services/openapi/notifications';

export const notificationQueryKeys = {
  count: (userId: number | undefined, slug?: string) =>
    ['notification-bell', userId, slug, 'unread-count'] as const,
  feed: (userId: number, slug?: string) =>
    ['notification-bell', userId, slug, 'recent'] as const,
};

export function notificationRequestOptions(slug?: string, signal?: AbortSignal) {
  return {
    headers: { 'X-Org-Slug': slug || '' },
    signal,
    skipErrorHandler: true,
  };
}

// 初次只建立基线；之后翻页补齐新增通知，避免两次刷新之间超过一页时漏报。
export async function fetchNotificationFeed(
  slug: string | undefined,
  signal: AbortSignal,
  lastSeenId?: number,
) {
  const items: API.NotificationOut[] = [];
  let page = 1;
  while (!signal.aborted) {
    const result = await appsNotificationsApiListNotifications(
      { page, page_size: 50 },
      notificationRequestOptions(slug, signal),
    );
    if (signal.aborted) return [];
    items.push(...result.items);
    if (
      lastSeenId === undefined ||
      result.items.some((item) => item.id <= lastSeenId) ||
      result.items.length === 0 ||
      page * 50 >= result.total
    ) break;
    page += 1;
  }
  return items;
}
