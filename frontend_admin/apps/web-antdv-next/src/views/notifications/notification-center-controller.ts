import { computed, ref } from 'vue';

import type { NotificationRow } from '#/api/django/resources';

export const POLL_INTERVAL_MS = 60_000;

export type NotificationTaskFilter = 'all' | 'read' | 'unread';

type DocumentListener = (event: string, handler: EventListener) => void;
type TimerHandle = ReturnType<typeof setInterval>;

export interface NotificationCenterDeps {
  addDocumentListener: DocumentListener;
  clearTimer: (handle: TimerHandle) => void;
  isDocumentHidden: () => boolean;
  listNotifications: (isRead?: string) => Promise<NotificationRow[]>;
  registerTimer: (handler: () => void, intervalMs: number) => TimerHandle;
  removeDocumentListener: DocumentListener;
}

export function createNotificationCenterController(deps: NotificationCenterDeps) {
  const loading = ref(false);
  const notifications = ref<NotificationRow[]>([]);
  const selectedRowKeys = ref<number[]>([]);
  const activeTaskFilter = ref<NotificationTaskFilter>('unread');
  const detailVisible = ref(false);
  const activeNotification = ref<NotificationRow | null>(null);
  const loadRequestId = ref(0);

  const apiReadFilter = computed(() => {
    if (activeTaskFilter.value === 'read') return 'true';
    if (activeTaskFilter.value === 'unread') return 'false';
    return undefined;
  });

  const notificationSummary = computed(() => {
    const total = notifications.value.length;
    const unread = notifications.value.filter((item) => !item.is_read).length;
    return {
      selected: selectedRowKeys.value.length,
      total,
      unread,
    };
  });

  let pollHandle: TimerHandle | null = null;
  let visibilityHandler: EventListener | null = null;

  function onSelectionChange(keys: Array<number | string>) {
    selectedRowKeys.value = keys.map((key) => Number(key)).filter((key) => !Number.isNaN(key));
  }

  function syncActiveNotification() {
    if (!activeNotification.value) return;
    const freshRecord = notifications.value.find((item) => item.id === activeNotification.value?.id);
    if (freshRecord) {
      activeNotification.value = freshRecord;
      return;
    }
    detailVisible.value = false;
    activeNotification.value = null;
  }

  async function loadData() {
    const requestId = loadRequestId.value + 1;
    loadRequestId.value = requestId;
    loading.value = true;
    try {
      const rows = await deps.listNotifications(apiReadFilter.value).catch(() => []);
      if (requestId !== loadRequestId.value) return;
      notifications.value = rows;
      syncActiveNotification();
    } finally {
      if (requestId === loadRequestId.value) {
        loading.value = false;
      }
    }
  }

  function openNotification(record: NotificationRow) {
    activeNotification.value = record;
    detailVisible.value = true;
  }

  async function changeTaskFilter(value: NotificationTaskFilter) {
    if (activeTaskFilter.value === value) return;
    activeTaskFilter.value = value;
    selectedRowKeys.value = [];
    await loadData();
  }

  function closeNotificationDetail() {
    detailVisible.value = false;
    activeNotification.value = null;
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
    void loadData();
    pollHandle = deps.registerTimer(() => {
      if (!deps.isDocumentHidden()) {
        void loadData();
      }
    }, POLL_INTERVAL_MS);
    visibilityHandler = () => {
      if (!deps.isDocumentHidden()) {
        void loadData();
      }
    };
    deps.addDocumentListener('visibilitychange', visibilityHandler);
  }

  return {
    activeNotification,
    activeTaskFilter,
    apiReadFilter,
    changeTaskFilter,
    closeNotificationDetail,
    detailVisible,
    loadData,
    loading,
    notificationSummary,
    notifications,
    onSelectionChange,
    openNotification,
    selectedRowKeys,
    startPolling,
    stopPolling,
  };
}
