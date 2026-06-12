import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createAdminNotificationsController } from '../admin-notifications-controller';

function flushPromises() {
  return Promise.resolve().then(() => Promise.resolve());
}

describe('use-admin-notifications', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('加载通知列表与未读数，并映射为顶栏通知项', async () => {
    const listNotifications = vi.fn().mockResolvedValue([
      {
        body: '有一条待处理审批',
        created_at: '2026-06-11T10:00:00Z',
        id: 7,
        is_read: false,
        title: '审批提醒',
        url: '/approvals/7',
      },
    ]);
    const getUnreadCount = vi.fn().mockResolvedValue({ count: 3 });

    const controller = createAdminNotificationsController({
      addDocumentListener: vi.fn(),
      bulkNotifications: vi.fn(),
      clearTimer: vi.fn(),
      defaultAvatar: '/avatar.png',
      deleteNotification: vi.fn(),
      getUnreadCount,
      isDocumentHidden: () => false,
      listNotifications,
      markNotification: vi.fn(),
      openExternalUrl: vi.fn(),
      pushRoute: vi.fn(),
      registerTimer: vi.fn(),
      removeDocumentListener: vi.fn(),
    });

    await controller.refresh();

    expect(listNotifications).toHaveBeenCalledWith(undefined, 20);
    expect(getUnreadCount).toHaveBeenCalledTimes(1);
    expect(controller.unreadCount.value).toBe(3);
    expect(controller.dot.value).toBe(true);
    expect(controller.notifications.value).toEqual([
      {
        avatar: '/avatar.png',
        date: '2026-06-11T10:00:00Z',
        id: 7,
        isRead: false,
        link: '/approvals/7',
        message: '有一条待处理审批',
        title: '审批提醒',
      },
    ]);
  });

  it('启动后立即拉取，并按一分钟轮询且在页面恢复可见时补拉', async () => {
    const listNotifications = vi.fn().mockResolvedValue([]);
    const getUnreadCount = vi.fn().mockResolvedValue({ count: 0 });
    const listeners = new Map<string, () => void>();
    let intervalHandler: (() => void) | undefined;
    let hidden = false;

    const controller = createAdminNotificationsController({
      addDocumentListener: vi.fn((event, handler) => {
        listeners.set(event, handler as () => void);
      }),
      bulkNotifications: vi.fn(),
      clearTimer: vi.fn(),
      defaultAvatar: '/avatar.png',
      deleteNotification: vi.fn(),
      getUnreadCount,
      isDocumentHidden: () => hidden,
      listNotifications,
      markNotification: vi.fn(),
      openExternalUrl: vi.fn(),
      pushRoute: vi.fn(),
      registerTimer: vi.fn((handler) => {
        intervalHandler = handler as () => void;
        return 99 as unknown as ReturnType<typeof setInterval>;
      }),
      removeDocumentListener: vi.fn(),
    });

    controller.startPolling();
    await flushPromises();

    expect(listNotifications).toHaveBeenCalledTimes(1);

    intervalHandler?.();
    await flushPromises();
    expect(listNotifications).toHaveBeenCalledTimes(2);

    hidden = true;
    intervalHandler?.();
    await flushPromises();
    expect(listNotifications).toHaveBeenCalledTimes(2);

    hidden = false;
    listeners.get('visibilitychange')?.();
    await flushPromises();
    expect(listNotifications).toHaveBeenCalledTimes(3);
  });

  it('支持标记已读、清空当前列表并处理跳转', async () => {
    const listNotifications = vi
      .fn()
      .mockResolvedValueOnce([
        {
          body: '',
          created_at: '2026-06-11T10:00:00Z',
          id: 7,
          is_read: false,
          title: '审批提醒',
          url: '/approvals/7',
        },
      ])
      .mockResolvedValueOnce([
        {
          body: '',
          created_at: '2026-06-11T10:00:00Z',
          id: 7,
          is_read: true,
          title: '审批提醒',
          url: '/approvals/7',
        },
      ])
      .mockResolvedValue([]);
    const getUnreadCount = vi.fn().mockResolvedValueOnce({ count: 1 }).mockResolvedValue({ count: 0 });
    const markNotification = vi.fn().mockResolvedValue(undefined);
    const bulkNotifications = vi.fn().mockResolvedValue(undefined);
    const pushRoute = vi.fn();
    const openExternalUrl = vi.fn();

    const controller = createAdminNotificationsController({
      addDocumentListener: vi.fn(),
      bulkNotifications,
      clearTimer: vi.fn(),
      defaultAvatar: '/avatar.png',
      deleteNotification: vi.fn(),
      getUnreadCount,
      isDocumentHidden: () => false,
      listNotifications,
      markNotification,
      openExternalUrl,
      pushRoute,
      registerTimer: vi.fn(),
      removeDocumentListener: vi.fn(),
    });

    await controller.refresh();
    await controller.markRead(controller.notifications.value[0]!);
    await controller.clearNotifications();
    controller.handleClick({ id: 1, avatar: '', date: '', message: '', title: '', link: '/internal' });
    controller.handleClick({ id: 2, avatar: '', date: '', message: '', title: '', link: 'https://example.com' });
    controller.viewAll();

    expect(markNotification).toHaveBeenCalledWith(7, true);
    expect(bulkNotifications).toHaveBeenCalledWith({ action: 'delete', ids: [7] });
    expect(pushRoute).toHaveBeenCalledWith({ path: '/internal', query: undefined, state: undefined });
    expect(openExternalUrl).toHaveBeenCalledWith('https://example.com');
    expect(pushRoute).toHaveBeenCalledWith({ name: 'Notifications' });
  });
});
