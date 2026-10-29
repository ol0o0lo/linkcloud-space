import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mock = vi.hoisted(() => ({
  state: { currentUser: { id: 1 }, selectedOrgSlug: 'tenant-a' },
  list: vi.fn(),
  count: vi.fn(),
  chatCount: vi.fn(),
  patch: vi.fn(),
  push: vi.fn(),
  requestPermission: vi.fn(),
}));
vi.mock('@umijs/max', () => ({
  useModel: () => ({ initialState: mock.state }),
  history: { push: mock.push },
}));
vi.mock('@/utils/orgSelection', () => ({
  getSelectedOrgSlug: () => mock.state.selectedOrgSlug,
}));
vi.mock('@/services/openapi/notifications', () => ({
  appsNotificationsApiListNotifications: mock.list,
  appsNotificationsApiUnreadCount: mock.count,
  appsNotificationsApiPatchNotification: mock.patch,
}));
vi.mock('@/services/manual/messaging', () => ({
  getMessagingUnreadCount: mock.chatCount,
}));

import NotificationBell from './index';

function notification(
  id: number,
  category = 'team.task.assigned',
): API.NotificationOut {
  return {
    id,
    category,
    title: `通知${id}`,
    body: '任务内容',
    is_read: false,
    created_at: '2026-10-25T08:00:00Z',
    data:
      category === 'messaging.message'
        ? { conversation_id: 21, organization_slug: 'tenant-a' }
        : {},
    url: '/dashboard/rental/workbench/tasks?assignment_id=7',
  };
}
function page(items: API.NotificationOut[], total = items.length) {
  return { items, total, page: 1, page_size: 50 };
}
class TestNotification {
  static permission: NotificationPermission = 'granted';
  static requestPermission = mock.requestPermission;
  static instances: TestNotification[] = [];
  onclick?: () => void;
  close = vi.fn();
  constructor(
    public title: string,
    public options: NotificationOptions,
  ) {
    TestNotification.instances.push(this);
  }
}
let client: QueryClient;
function renderBell(
  children?: React.ComponentProps<typeof NotificationBell>['children'],
) {
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={client}>
      <NotificationBell>{children}</NotificationBell>
    </QueryClientProvider>,
  );
}

describe('管理端通知入口与浏览器提醒', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mock.state = { currentUser: { id: 1 }, selectedOrgSlug: 'tenant-a' };
    mock.list.mockResolvedValue(page([notification(8)]));
    mock.count.mockResolvedValue({ count: 1 });
    mock.chatCount.mockResolvedValue({
      message_count: 0,
      conversation_count: 0,
    });
    mock.patch.mockResolvedValue({});
    TestNotification.permission = 'granted';
    TestNotification.instances = [];
    vi.stubGlobal('Notification', TestNotification);
    vi.spyOn(window, 'focus').mockImplementation(() => {});
    vi.spyOn(document, 'hasFocus').mockReturnValue(false);
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'hidden',
    });
  });
  afterEach(() => {
    cleanup();
    client?.clear();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    });
  });

  it('首次静默建立基线，绑定组织头并展示未读数量', async () => {
    renderBell();
    await screen.findByRole('button', { name: '消息通知，1 条未读' });
    expect(mock.list).toHaveBeenCalledWith(
      { page: 1, page_size: 50 },
      expect.objectContaining({
        headers: { 'X-Org-Slug': 'tenant-a' },
        signal: expect.any(AbortSignal),
      }),
    );
    expect(TestNotification.instances).toHaveLength(0);
    expect(mock.requestPermission).not.toHaveBeenCalled();
  });

  it('头像入口分别提供聊天和个人通知未读数，聊天不依赖通知偏好', async () => {
    mock.count.mockResolvedValue({ count: 0 });
    mock.chatCount.mockResolvedValue({
      message_count: 3,
      conversation_count: 1,
    });
    renderBell(({ unreadCount, chatUnreadCount }) => (
      <span role="status">
        通知{unreadCount}，聊天{chatUnreadCount}
      </span>
    ));
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('通知0，聊天3'),
    );
    expect(mock.chatCount).toHaveBeenCalledWith(
      'tenant-a',
      undefined,
      expect.any(AbortSignal),
    );
  });

  it('隐藏时每 30 秒接收任务和聊天提醒，同一通知不重复，点击进入正确会话', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderBell();
    await screen.findByRole('button', { name: '消息通知，1 条未读' });
    mock.list.mockResolvedValue(
      page([
        notification(10, 'messaging.message'),
        notification(9),
        notification(8),
      ]),
    );
    await act(() => vi.advanceTimersByTimeAsync(29_000));
    expect(mock.list).toHaveBeenCalledTimes(1);
    await act(() => vi.advanceTimersByTimeAsync(1_100));
    expect(mock.list).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(TestNotification.instances).toHaveLength(2));
    expect(mock.patch).not.toHaveBeenCalled();
    expect(TestNotification.instances.map((item) => item.title)).toEqual([
      '通知9',
      '通知10',
    ]);
    act(() => TestNotification.instances[1].onclick?.());
    expect(mock.push).toHaveBeenCalledWith(
      '/space/messaging?conversation_id=21&organization_slug=tenant-a',
    );
    await act(() => vi.advanceTimersByTimeAsync(30_100));
    expect(TestNotification.instances).toHaveLength(2);
  });

  it('权限申请由用户点击触发，拒绝后保留站内通知', async () => {
    TestNotification.permission = 'default';
    mock.requestPermission.mockResolvedValue('denied');
    renderBell();
    fireEvent.click(
      await screen.findByRole('button', { name: '消息通知，1 条未读' }),
    );
    const enable = await screen.findByRole('button', { name: '开启桌面通知' });
    expect(mock.requestPermission).not.toHaveBeenCalled();
    fireEvent.click(enable);
    await screen.findByText('桌面通知被阻止，请在浏览器设置中允许。');
    expect(mock.requestPermission).toHaveBeenCalledTimes(1);
    expect(screen.getByText('通知8')).toBeInTheDocument();
  });

  it.each([
    'organization',
    'account',
  ])('切换 %s 后丢弃旧通知响应，结束旧作用域', async (kind) => {
    let finishOld: ((value: ReturnType<typeof page>) => void) | undefined;
    mock.list.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishOld = resolve;
        }),
    );
    const view = renderBell();
    await waitFor(() => expect(mock.list).toHaveBeenCalledTimes(1));
    const oldSignal = mock.list.mock.calls[0][1].signal as AbortSignal;
    mock.state = {
      currentUser: { id: kind === 'account' ? 2 : 1 },
      selectedOrgSlug: kind === 'organization' ? 'tenant-b' : 'tenant-a',
    };
    mock.list.mockResolvedValue(page([notification(20)]));
    view.rerender(
      <QueryClientProvider client={client}>
        <NotificationBell />
      </QueryClientProvider>,
    );
    await act(async () => {
      finishOld?.(page([notification(99)]));
    });
    expect(oldSignal.aborted).toBe(true);
    fireEvent.click(
      await screen.findByRole('button', { name: '消息通知，1 条未读' }),
    );
    await screen.findByText('通知20');
    expect(screen.queryByText('通知99')).not.toBeInTheDocument();
    expect(TestNotification.instances).toHaveLength(0);
  });
});
