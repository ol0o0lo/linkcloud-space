import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createNotificationCenterController, POLL_INTERVAL_MS } from '../notification-center-controller';

function flushPromises() {
  return Promise.resolve().then(() => Promise.resolve());
}

describe('notification-center-controller', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('默认按未读筛选加载通知列表', async () => {
    const listNotifications = vi.fn().mockResolvedValue([
      {
        body: '需要审批',
        created_at: '2026-06-11T12:00:00Z',
        id: 3,
        is_read: false,
        title: '审批提醒',
      },
    ]);

    const controller = createNotificationCenterController({
      addDocumentListener: vi.fn(),
      clearTimer: vi.fn(),
      isDocumentHidden: () => false,
      listNotifications,
      registerTimer: vi.fn(),
      removeDocumentListener: vi.fn(),
    });

    await controller.loadData();

    expect(listNotifications).toHaveBeenCalledWith('false');
    expect(controller.activeTaskFilter.value).toBe('unread');
    expect(controller.notificationSummary.value.unread).toBe(1);
  });

  it('启动后立即拉取，并按一分钟轮询且在页面恢复可见时补拉', async () => {
    const listNotifications = vi.fn().mockResolvedValue([]);
    const listeners = new Map<string, () => void>();
    let intervalHandler: (() => void) | undefined;
    let hidden = false;

    const controller = createNotificationCenterController({
      addDocumentListener: vi.fn((event, handler) => {
        listeners.set(event, handler as () => void);
      }),
      clearTimer: vi.fn(),
      isDocumentHidden: () => hidden,
      listNotifications,
      registerTimer: vi.fn((handler) => {
        intervalHandler = handler as () => void;
        return 11 as unknown as ReturnType<typeof setInterval>;
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

  it('切换筛选后继续按当前筛选轮询加载', async () => {
    const listNotifications = vi.fn().mockResolvedValue([]);
    let intervalHandler: (() => void) | undefined;

    const controller = createNotificationCenterController({
      addDocumentListener: vi.fn(),
      clearTimer: vi.fn(),
      isDocumentHidden: () => false,
      listNotifications,
      registerTimer: vi.fn((handler) => {
        intervalHandler = handler as () => void;
        return 12 as unknown as ReturnType<typeof setInterval>;
      }),
      removeDocumentListener: vi.fn(),
    });

    await controller.changeTaskFilter('read');
    controller.startPolling();
    await flushPromises();
    intervalHandler?.();
    await flushPromises();

    expect(listNotifications).toHaveBeenNthCalledWith(1, 'true');
    expect(listNotifications).toHaveBeenNthCalledWith(2, 'true');
    expect(listNotifications).toHaveBeenNthCalledWith(3, 'true');
    expect(POLL_INTERVAL_MS).toBe(60_000);
  });
});
