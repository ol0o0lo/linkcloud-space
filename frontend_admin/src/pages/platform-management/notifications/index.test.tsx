import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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

  beforeEach(() => {
    vi.clearAllMocks();
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
      expect(mockListNotifications).toHaveBeenCalledWith({
        page: 1,
        page_size: 10,
        is_read: undefined,
      });
      expect(screen.getByText('系统通知')).toBeInTheDocument();
    });

    const row = screen.getByText('系统通知').closest('tr');
    expect(row).not.toBeNull();

    fireEvent.click(within(row!).getByRole('button', { name: '详情' }));
    expect(new URLSearchParams(window.location.search).get('notification_id')).toBe(
      '8',
    );
    await waitFor(() =>
      expect(mockPatchNotification).toHaveBeenCalledWith(
        { notification_id: 8 },
        { is_read: true },
      ),
    );

    fireEvent.click(within(row!).getByText('标记已读'));
    await waitFor(() =>
      expect(mockPatchNotification).toHaveBeenCalledWith(
        { notification_id: 8 },
        { is_read: true },
      ),
    );

    fireEvent.click(screen.getByRole('button', { name: 'check 全部标记已读' }));
    await waitFor(() =>
      expect(mockBulk).toHaveBeenCalledWith({
        action: 'mark_read',
        all_unread: true,
      }),
    );

    fireEvent.click(screen.getByTitle('未读'));
    await waitFor(() =>
      expect(mockListNotifications).toHaveBeenLastCalledWith({
        page: 1,
        page_size: 10,
        is_read: 'false',
      }),
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
    expect(screen.queryByText('当前筛选下暂无通知')).not.toBeInTheDocument();

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
      expect(mockListNotifications).toHaveBeenCalledWith({
        page: 2,
        page_size: 10,
        is_read: 'false',
      }),
    );
    expect(await screen.findByText('通知详情')).toBeInTheDocument();
    expect(mockGetNotification).toHaveBeenCalledWith({ notification_id: 8 });
  });
});
