import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { Grid } from 'antd';
import dayjs from 'dayjs';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const locationState = vi.hoisted(() => ({ key: 'initial' }));

const {
  mockListNotifications,
  mockPatchNotification,
  mockBulk,
  mockUnreadCount,
  mockGetNotification,
  mockAccess,
  mockHistoryPush,
} = vi.hoisted(() => ({
  mockListNotifications: vi.fn(),
  mockPatchNotification: vi.fn(),
  mockBulk: vi.fn(),
  mockUnreadCount: vi.fn(),
  mockGetNotification: vi.fn(),
  mockAccess: { canManageNotificationDispatches: true },
  mockHistoryPush: vi.fn(),
}));

vi.mock('@umijs/max', () => ({
  history: { push: mockHistoryPush },
  useAccess: () => mockAccess,
  useLocation: () => ({
    search: window.location.search,
    key: locationState.key,
  }),
  useModel: () => ({
    initialState: { currentUser: { id: 1 }, selectedOrgSlug: 'tenant-a' },
  }),
}));

vi.mock('@/services/openapi/notifications', () => ({
  appsNotificationsApiListNotifications: mockListNotifications,
  appsNotificationsApiGetNotification: mockGetNotification,
  appsNotificationsApiPatchNotification: mockPatchNotification,
  appsNotificationsApiDeleteNotification: vi.fn(),
  appsNotificationsApiBulkAction: mockBulk,
  appsNotificationsApiListPreferences: vi.fn(),
  appsNotificationsApiPatchPreference: vi.fn(),
  appsNotificationsApiUnreadCount: mockUnreadCount,
}));

vi.mock('@ant-design/pro-components', () => ({
  PageContainer: ({ children, title, subTitle }: any) => (
    <section>
      <h1>{title}</h1>
      <p>{subTitle}</p>
      {children}
    </section>
  ),
}));

import NotificationsAdminPage from './index';

describe('NotificationsAdminPage', () => {
  let queryClient: QueryClient;

  afterEach(() => vi.restoreAllMocks());

  beforeEach(() => {
    locationState.key = 'initial';
    vi.clearAllMocks();
    vi.spyOn(Grid, 'useBreakpoint').mockReturnValue({ md: true, sm: true });
    window.history.replaceState({}, '', '/personal-business/notifications');
    mockAccess.canManageNotificationDispatches = true;
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    mockListNotifications.mockResolvedValue({
      items: [
        {
          id: 8,
          title: '系统通知',
          body: 'hello',
          is_read: false,
          created_at: '2026-06-16T10:00:00+08:00',
          actor: { id: 1, username: 'alice', full_name: 'Alice Zhang' },
          url: '/dashboard/rental/workbench/overview',
        },
      ],
      total: 1,
      page: 1,
      page_size: 10,
    });
    mockGetNotification.mockResolvedValue({
      id: 8,
      title: '系统通知',
      body: 'hello',
      is_read: false,
      created_at: '2026-06-16T10:00:00+08:00',
      actor: { id: 1, username: 'alice', full_name: 'Alice Zhang' },
      url: '/dashboard/rental/workbench/overview',
    });
    mockUnreadCount.mockResolvedValue({ count: 1 });
    mockPatchNotification.mockResolvedValue({});
    mockBulk.mockResolvedValue({});
  });

  it('marks notifications read in bulk or individually and applies filters', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <NotificationsAdminPage />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(mockListNotifications).toHaveBeenCalledWith(
        {
          page: 1,
          page_size: 10,
          is_read: undefined,
        },
        expect.objectContaining({
          headers: { 'X-Org-Slug': 'tenant-a' },
          signal: expect.any(AbortSignal),
        }),
      );
      expect(screen.getByText('系统通知')).toBeInTheDocument();
    });

    const row = screen.getByText('系统通知').closest('li');
    expect(row).not.toBeNull();
    if (!row) throw new Error('未找到通知行');

    expect(screen.getByText('选择一条通知')).toBeInTheDocument();
    expect(mockPatchNotification).not.toHaveBeenCalled();
    fireEvent.click(
      within(row).getByRole('button', { name: '系统通知，未读' }),
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(
      new URLSearchParams(window.location.search).get('notification_id'),
    ).toBe('8');
    await waitFor(() =>
      expect(mockPatchNotification).toHaveBeenCalledWith(
        { notification_id: 8 },
        { is_read: true },
        expect.objectContaining({ headers: { 'X-Org-Slug': 'tenant-a' } }),
      ),
    );

    fireEvent.click(screen.getByRole('button', { name: 'check 全部已读' }));
    await waitFor(() =>
      expect(mockBulk).toHaveBeenCalledWith(
        {
          action: 'mark_read',
          all_unread: true,
        },
        expect.objectContaining({ headers: { 'X-Org-Slug': 'tenant-a' } }),
      ),
    );

    fireEvent.click(screen.getByRole('tab', { name: /^未读/ }));
    await waitFor(() =>
      expect(mockListNotifications).toHaveBeenLastCalledWith(
        {
          page: 1,
          page_size: 10,
          is_read: 'false',
        },
        expect.objectContaining({ headers: { 'X-Org-Slug': 'tenant-a' } }),
      ),
    );
  });

  it('将阅读状态融入条目，在常驻详情中标记未读', async () => {
    mockListNotifications.mockResolvedValue({
      items: [
        {
          id: 8,
          title: '订阅已到期',
          body: '请及时续费。',
          is_read: true,
          created_at: '2026-06-16T10:00:00+08:00',
        },
      ],
      total: 1,
      page: 1,
      page_size: 10,
    });
    render(
      <QueryClientProvider client={queryClient}>
        <NotificationsAdminPage />
      </QueryClientProvider>,
    );

    const title = await screen.findByText('订阅已到期');
    const row = title.closest('li');
    if (!row) throw new Error('未找到通知条目');
    expect(within(row).getByText('已读')).toHaveClass('sr-only');
    expect(within(row).getByText('2026-06-16 10:00')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByText('通知已读。')).not.toBeInTheDocument();

    fireEvent.click(
      within(row).getByRole('button', { name: '订阅已到期，已读' }),
    );
    fireEvent.click(await screen.findByRole('button', { name: '标记未读' }));
    await waitFor(() =>
      expect(mockPatchNotification).toHaveBeenCalledWith(
        { notification_id: 8 },
        { is_read: false },
        expect.objectContaining({ headers: { 'X-Org-Slug': 'tenant-a' } }),
      ),
    );
  });

  it('加载失败时展示可重试错误而不是空状态', async () => {
    mockListNotifications.mockRejectedValueOnce(new Error('network'));

    render(
      <QueryClientProvider client={queryClient}>
        <NotificationsAdminPage />
      </QueryClientProvider>,
    );

    expect(await screen.findByText('通知加载失败')).toBeInTheDocument();
    expect(screen.queryByText('暂无通知')).not.toBeInTheDocument();

    mockListNotifications.mockResolvedValueOnce({
      items: [],
      total: 0,
      page: 1,
      page_size: 10,
    });
    fireEvent.click(screen.getByRole('button', { name: '重新加载' }));

    await waitFor(() => expect(mockListNotifications).toHaveBeenCalledTimes(2));
  });

  it('没有发送通知权限时隐藏发送记录入口', async () => {
    mockAccess.canManageNotificationDispatches = false;

    render(
      <QueryClientProvider client={queryClient}>
        <NotificationsAdminPage />
      </QueryClientProvider>,
    );

    expect(await screen.findByText('系统通知')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: '查看发送记录' }),
    ).not.toBeInTheDocument();
  });

  it('聊天通知展示聊天类别并携带源组织打开管理端会话', async () => {
    const item = {
      id: 9,
      category: 'messaging.message',
      title: '收到新消息',
      body: '联系方式已发送',
      is_read: true,
      created_at: '2026-10-24T10:00:00+08:00',
      data: {
        conversation_id: 21,
        organization_slug: 'tenant-b',
        message_seq: 3,
      },
      url: '/pages/messages/conversation?conversation_id=21',
    };
    mockListNotifications.mockResolvedValue({
      items: [item],
      total: 1,
      page: 1,
      page_size: 10,
    });
    mockGetNotification.mockResolvedValue(item);
    render(
      <QueryClientProvider client={queryClient}>
        <NotificationsAdminPage />
      </QueryClientProvider>,
    );

    expect(await screen.findByText('聊天消息')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '收到新消息，已读' }));
    expect(
      await screen.findByRole('link', { name: /查看会话/ }),
    ).toHaveAttribute(
      'href',
      '/dashboard/space/messaging?conversation_id=21&organization_slug=tenant-b',
    );
  });

  it('从 URL 恢复通知筛选、页码和详情', async () => {
    window.history.replaceState(
      {},
      '',
      '/personal-business/notifications?page=2&read=unread&notification_id=8',
    );

    render(
      <QueryClientProvider client={queryClient}>
        <NotificationsAdminPage />
      </QueryClientProvider>,
    );

    await waitFor(() =>
      expect(mockListNotifications).toHaveBeenCalledWith(
        {
          page: 2,
          page_size: 10,
          is_read: 'false',
        },
        expect.objectContaining({
          headers: { 'X-Org-Slug': 'tenant-a' },
          signal: expect.any(AbortSignal),
        }),
      ),
    );
    expect(
      await screen.findByRole('heading', { name: '系统通知' }),
    ).toBeInTheDocument();
    expect(mockGetNotification).toHaveBeenCalledWith(
      { notification_id: 8 },
      expect.objectContaining({ headers: { 'X-Org-Slug': 'tenant-a' } }),
    );
  });

  it('停留在通知中心时可打开另一条通知详情', async () => {
    const view = render(
      <QueryClientProvider client={queryClient}>
        <NotificationsAdminPage />
      </QueryClientProvider>,
    );
    await screen.findByText('系统通知');
    mockGetNotification.mockResolvedValue({
      id: 9,
      title: '另一条通知',
      body: '新正文',
      is_read: true,
      created_at: '2026-10-25T08:00:00Z',
      data: {},
      category: '',
    });
    window.history.replaceState(
      {},
      '',
      '/personal-business/notifications?notification_id=9',
    );
    locationState.key = 'notification-9';
    view.rerender(
      <QueryClientProvider client={queryClient}>
        <NotificationsAdminPage />
      </QueryClientProvider>,
    );
    expect(await screen.findByText('另一条通知')).toBeInTheDocument();
  });
  it('按时间分组，切换条目更新右侧正文并保留详情地址', async () => {
    const first = {
      id: 8,
      title: '今天的通知',
      body: '今天的正文',
      category: '',
      data: {},
      is_read: true,
      created_at: dayjs().toISOString(),
    };
    const second = {
      ...first,
      id: 9,
      title: '昨天的通知',
      body: '昨天的正文',
      created_at: dayjs().subtract(1, 'day').toISOString(),
    };
    const older = {
      ...first,
      id: 10,
      title: '更早的通知',
      created_at: dayjs().subtract(3, 'day').toISOString(),
    };
    mockListNotifications.mockResolvedValue({
      items: [first, second, older],
      total: 3,
      page: 1,
      page_size: 10,
    });
    mockGetNotification.mockImplementation(async ({ notification_id }) =>
      [first, second, older].find((item) => item.id === notification_id),
    );
    render(
      <QueryClientProvider client={queryClient}>
        <NotificationsAdminPage />
      </QueryClientProvider>,
    );
    expect(
      await screen.findByRole('region', { name: '今天' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('region', { name: '昨天' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: '更早' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '今天的通知，已读' }));
    const detail = screen.getByRole('complementary', { name: '通知详情' });
    expect(
      await within(detail).findByRole('heading', { name: '今天的通知' }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '昨天的通知，已读' }));
    expect(
      await within(detail).findByRole('heading', { name: '昨天的通知' }),
    ).toBeInTheDocument();
    expect(within(detail).getByText('昨天的正文')).toBeInTheDocument();
    expect(within(detail).queryByText('今天的正文')).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: '昨天的通知，已读' }),
    ).toHaveAttribute('aria-current', 'true');
    expect(
      new URLSearchParams(window.location.search).get('notification_id'),
    ).toBe('9');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('详情加载失败可单独重试', async () => {
    mockGetNotification.mockRejectedValue(new Error('network'));
    render(
      <QueryClientProvider client={queryClient}>
        <NotificationsAdminPage />
      </QueryClientProvider>,
    );
    fireEvent.click(
      await screen.findByRole('button', { name: '系统通知，未读' }),
    );
    expect(await screen.findByText('通知详情加载失败')).toBeInTheDocument();
    mockGetNotification.mockResolvedValue({
      id: 8,
      title: '系统通知',
      body: 'hello',
      is_read: true,
      created_at: '2026-06-16T10:00:00+08:00',
    });
    fireEvent.click(screen.getByRole('button', { name: '重新加载详情' }));
    expect(
      await screen.findByRole('heading', { name: '系统通知' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('通知详情加载失败')).not.toBeInTheDocument();
  });

  it('窄屏原位展开，未读列表刷新移除条目后仍保留正在阅读的正文', async () => {
    vi.mocked(Grid.useBreakpoint).mockReturnValue({ md: false, sm: false });
    let read = false;
    const item = {
      id: 8,
      title: '未读通知',
      body: '需要保留的正文',
      category: '',
      data: {},
      is_read: false,
      created_at: dayjs().toISOString(),
    };
    mockListNotifications.mockImplementation(async ({ is_read }) => {
      const items =
        is_read === 'false' && read ? [] : [{ ...item, is_read: read }];
      return { items, total: items.length, page: 1, page_size: 10 };
    });
    mockGetNotification.mockImplementation(async () => ({
      ...item,
      is_read: read,
    }));
    mockPatchNotification.mockImplementation(async () => {
      read = true;
      return { ...item, is_read: true };
    });
    mockUnreadCount.mockImplementation(async () => ({ count: read ? 0 : 1 }));
    render(
      <QueryClientProvider client={queryClient}>
        <NotificationsAdminPage />
      </QueryClientProvider>,
    );
    await screen.findByRole('button', { name: '未读通知，未读' });
    fireEvent.click(screen.getByRole('tab', { name: /^未读/ }));
    await waitFor(() =>
      expect(mockListNotifications).toHaveBeenLastCalledWith(
        expect.objectContaining({ is_read: 'false' }),
        expect.anything(),
      ),
    );
    fireEvent.click(
      await screen.findByRole('button', { name: '未读通知，未读' }),
    );
    const current = await screen.findByRole('region', {
      name: '当前查看的通知',
    });
    expect(within(current).getByText('需要保留的正文')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('complementary', { name: '通知详情' }),
    ).not.toBeInTheDocument();
    fireEvent.click(within(current).getByRole('button', { name: '收起详情' }));
    expect(
      screen.queryByRole('region', { name: '当前查看的通知' }),
    ).not.toBeInTheDocument();
    expect(
      new URLSearchParams(window.location.search).get('notification_id'),
    ).toBeNull();
  });
});
