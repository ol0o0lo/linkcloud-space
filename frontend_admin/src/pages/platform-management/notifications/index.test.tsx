import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import NotificationsAdminPage from './index';

const {
  mockListNotifications,
  mockPatchNotification,
  mockBulk,
  mockUnreadCount,
  mockGetNotification,
} = vi.hoisted(() => ({
  mockListNotifications: vi.fn(),
  mockPatchNotification: vi.fn(),
  mockBulk: vi.fn(),
  mockUnreadCount: vi.fn(),
  mockGetNotification: vi.fn(),
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

describe('NotificationsAdminPage', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    mockListNotifications.mockResolvedValue({
      items: [
        {
          id: 8,
          title: '系统通知',
          body: 'hello',
          is_read: false,
          created_at: '2026-06-16T10:00:00+08:00',
          actor: { id: 1, username: 'alice', full_name: 'Alice Zhang' },
          url: '/dashboard/property-rental/workbench',
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
      url: '/dashboard/property-rental/workbench',
    });
    mockUnreadCount.mockResolvedValue({ count: 1 });
    mockPatchNotification.mockResolvedValue({});
    mockBulk.mockResolvedValue({});
  });

  it('renders governance layout and handles notification actions', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <NotificationsAdminPage />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(mockListNotifications).toHaveBeenCalledWith({ page: 1, page_size: 10, is_read: undefined });
      expect(screen.getByText('通知概览')).toBeInTheDocument();
      expect(screen.queryByText('处理状态')).not.toBeInTheDocument();
      expect(screen.queryByText('关键提醒')).not.toBeInTheDocument();
      expect(screen.getByText('通知列表')).toBeInTheDocument();
      expect(screen.getByText('系统通知')).toBeInTheDocument();
      expect(screen.queryByText('当前处理面')).not.toBeInTheDocument();
      expect(screen.queryByText('来源与承接')).not.toBeInTheDocument();
      expect(screen.queryByText('回到通知治理')).not.toBeInTheDocument();
    });

    const row = screen.getByText('系统通知').closest('tr');
    expect(row).not.toBeNull();
    expect(within(row!).getByText('待处理')).toBeInTheDocument();
    expect(within(row!).getByText('来自 Alice Zhang')).toBeInTheDocument();

    fireEvent.click(within(row!).getByText('详情'));
    await waitFor(() => expect(mockPatchNotification).toHaveBeenCalledWith({ notification_id: 8 }, { is_read: true }));
    expect(await screen.findByText('通知详情')).toBeInTheDocument();
    expect(screen.queryByText('通知详情需要一起查看正文、确认状态和后续入口。')).not.toBeInTheDocument();
    expect(screen.getByText('打开通知链接')).toHaveAttribute('href', '/dashboard/property-rental/workbench');

    fireEvent.click(within(row!).getByText('标记已读'));
    await waitFor(() => expect(mockPatchNotification).toHaveBeenCalledWith({ notification_id: 8 }, { is_read: true }));

    fireEvent.click(screen.getByRole('button', { name: 'check 全部标记已读' }));
    await waitFor(() => expect(mockBulk).toHaveBeenCalledWith({ action: 'mark_read', all_unread: true }));

    fireEvent.click(screen.getByText('未读'));
    await waitFor(() => expect(mockListNotifications).toHaveBeenLastCalledWith({ page: 1, page_size: 10, is_read: 'false' }));
  });
});
