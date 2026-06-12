import { onBeforeUnmount, onMounted } from 'vue';
import { preferences } from '@vben/preferences';
import { openWindow } from '@vben/utils';
import { useRouter } from 'vue-router';

import {
  bulkNotificationsApi,
  deleteNotificationApi,
  getUnreadCountApi,
  listNotificationsApi,
  markNotificationApi,
} from '#/api/django/resources';

import { createAdminNotificationsController } from './admin-notifications-controller';

export { POLL_INTERVAL_MS } from './admin-notifications-controller';

export function useAdminNotifications() {
  const router = useRouter();
  const controller = createAdminNotificationsController({
    addDocumentListener: (event, handler) => document.addEventListener(event, handler),
    bulkNotifications: bulkNotificationsApi,
    clearTimer: (handle) => clearInterval(handle),
    defaultAvatar: preferences.app.defaultAvatar,
    deleteNotification: deleteNotificationApi,
    getUnreadCount: getUnreadCountApi,
    isDocumentHidden: () => document.hidden,
    listNotifications: listNotificationsApi,
    markNotification: markNotificationApi,
    openExternalUrl: (url) => openWindow(url, { target: '_blank' }),
    pushRoute: (location) => router.push(location),
    registerTimer: (handler, intervalMs) => setInterval(handler, intervalMs),
    removeDocumentListener: (event, handler) => document.removeEventListener(event, handler),
  });

  onMounted(() => {
    controller.startPolling();
  });

  onBeforeUnmount(() => {
    controller.stopPolling();
  });

  return controller;
}
