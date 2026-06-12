import { onBeforeUnmount, onMounted } from 'vue';

import { listNotificationsApi } from '#/api/django/resources';

import { createNotificationCenterController } from './notification-center-controller';

export { POLL_INTERVAL_MS } from './notification-center-controller';

export function useNotificationCenter() {
  const controller = createNotificationCenterController({
    addDocumentListener: (event, handler) => document.addEventListener(event, handler),
    clearTimer: (handle) => clearInterval(handle),
    isDocumentHidden: () => document.hidden,
    listNotifications: listNotificationsApi,
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
