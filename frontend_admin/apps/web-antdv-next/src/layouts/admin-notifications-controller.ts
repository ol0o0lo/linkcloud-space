import type { NotificationItem } from '@vben/layouts';

import { computed, ref } from 'vue';

import type { NotificationRow } from '#/api/django/resources';

export const POLL_INTERVAL_MS = 60_000;

const WIDGET_PAGE_SIZE = 20;

type DocumentListener = (event: string, handler: EventListener) => void;
type PushRoute = (location: { name: string } | { path: string; query?: Record<string, any>; state?: Record<string, any> }) => unknown;
type TimerHandle = ReturnType<typeof setInterval>;

export interface AdminNotificationsDeps {
  addDocumentListener: DocumentListener;
  bulkNotifications: (payload: { action: 'delete' | 'mark_read' | 'mark_unread'; all_unread?: boolean; ids?: number[] }) => Promise<unknown>;
  clearTimer: (handle: TimerHandle) => void;
  defaultAvatar: string;
  deleteNotification: (id: number) => Promise<unknown>;
  getUnreadCount: () => Promise<{ count: number }>;
  isDocumentHidden: () => boolean;
  listNotifications: (isRead?: string, pageSize?: number) => Promise<NotificationRow[]>;
  markNotification: (id: number, isRead: boolean) => Promise<unknown>;
  openExternalUrl: (url: string) => void;
  pushRoute: PushRoute;
  registerTimer: (handler: () => void, intervalMs: number) => TimerHandle;
  removeDocumentListener: DocumentListener;
}

function normalizeId(id: NotificationItem['id']) {
  const value = Number(id);
  return Number.isNaN(value) ? null : value;
}

function toNotificationItem(row: NotificationRow, defaultAvatar: string): NotificationItem {
  return {
    avatar: defaultAvatar,
    date: row.created_at,
    id: row.id,
    isRead: row.is_read,
    link: row.url || undefined,
    message: row.body || '这条通知暂时没有更多内容。',
    title: row.title,
  };
}

export function createAdminNotificationsController(deps: AdminNotificationsDeps) {
  const loading = ref(false);
  const notifications = ref<NotificationItem[]>([]);
  const unreadCount = ref(0);
  const dot = computed(() => unreadCount.value > 0);

  let pollHandle: null | TimerHandle = null;
  let visibilityHandler: EventListener | null = null;
  let requestId = 0;

  async function refresh() {
    const currentRequestId = ++requestId;
    loading.value = true;
    try {
      const [rowsResult, unreadResult] = await Promise.allSettled([
        deps.listNotifications(undefined, WIDGET_PAGE_SIZE),
        deps.getUnreadCount(),
      ]);
      if (currentRequestId !== requestId) return;
      if (rowsResult.status === 'fulfilled') {
        notifications.value = rowsResult.value.map((item) => toNotificationItem(item, deps.defaultAvatar));
      }
      if (unreadResult.status === 'fulfilled') {
        unreadCount.value = unreadResult.value.count ?? 0;
      }
    } finally {
      if (currentRequestId === requestId) {
        loading.value = false;
      }
    }
  }

  async function markRead(item: NotificationItem) {
    const id = normalizeId(item.id);
    if (id === null) return;
    await deps.markNotification(id, true);
    await refresh();
  }

  async function remove(item: NotificationItem) {
    const id = normalizeId(item.id);
    if (id === null) return;
    await deps.deleteNotification(id);
    await refresh();
  }

  async function clearNotifications() {
    const ids = notifications.value.map((item) => normalizeId(item.id)).filter((item): item is number => item !== null);
    if (ids.length === 0) return;
    await deps.bulkNotifications({ action: 'delete', ids });
    await refresh();
  }

  async function makeAllRead() {
    if (unreadCount.value <= 0) return;
    await deps.bulkNotifications({ action: 'mark_read', all_unread: true });
    await refresh();
  }

  function handleClick(item: NotificationItem) {
    if (!item.link) {
      deps.pushRoute({ name: 'Notifications' });
      return;
    }
    if (item.link.startsWith('http://') || item.link.startsWith('https://')) {
      deps.openExternalUrl(item.link);
      return;
    }
    deps.pushRoute({
      path: item.link,
      query: item.query,
      state: item.state,
    });
  }

  function viewAll() {
    deps.pushRoute({ name: 'Notifications' });
  }

  function stopPolling() {
    if (pollHandle !== null) {
      deps.clearTimer(pollHandle);
      pollHandle = null;
    }
    if (visibilityHandler) {
      deps.removeDocumentListener('visibilitychange', visibilityHandler);
      visibilityHandler = null;
    }
  }

  function startPolling() {
    if (pollHandle !== null) return;
    void refresh();
    pollHandle = deps.registerTimer(() => {
      if (!deps.isDocumentHidden()) {
        void refresh();
      }
    }, POLL_INTERVAL_MS);
    visibilityHandler = () => {
      if (!deps.isDocumentHidden()) {
        void refresh();
      }
    };
    deps.addDocumentListener('visibilitychange', visibilityHandler);
  }

  return {
    clearNotifications,
    dot,
    handleClick,
    loading,
    makeAllRead,
    markRead,
    notifications,
    refresh,
    remove,
    startPolling,
    stopPolling,
    unreadCount,
    viewAll,
  };
}
