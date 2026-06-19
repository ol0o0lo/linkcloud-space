import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import NotificationsAdminPage from './index';

const {
  mockListNotifications,
  mockPatchNotification,
  mockDeleteNotification,
  mockBulk,
  mockPreferences,
  mockPatchPreference,
  mockUnreadCount,
  mockGetNotification,
} = vi.hoisted(() => ({
  mockListNotifications: vi.fn(),
  mockPatchNotification: vi.fn(),
  mockDeleteNotification: vi.fn(),
  mockBulk: vi.fn(),
  mockPreferences: vi.fn(),
  mockPatchPreference: vi.fn(),
  mockUnreadCount: vi.fn(),
  mockGetNotification: vi.fn(),
}));

vi.mock('@/services/openapi/notifications', () => ({
  appsNotificationsApiListNotifications: mockListNotifications,
  appsNotificationsApiGetNotification: mockGetNotification,
  appsNotificationsApiPatchNotification: mockPatchNotification,
  appsNotificationsApiDeleteNotification: mockDeleteNotification,
  appsNotificationsApiBulkAction: mockBulk,
  appsNotificationsApiListPreferences: mockPreferences,
  appsNotificationsApiPatchPreference: mockPatchPreference,
  appsNotificationsApiUnreadCount: mockUnreadCount,
}));

describe('NotificationsAdminPage', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    mockListNotifications.mockResolvedValue({ items: [{ id: 8, title: '系统通知', body: 'hello', is_read: false, created_at: '2026-06-16T10:00:00+08:00' }], total: 1, page: 1, page_size: 10 });
    mockGetNotification.mockResolvedValue({ id: 8, title: '系统通知', body: 'hello', is_read: false, created_at: '2026-06-16T10:00:00+08:00' });
    mockUnreadCount.mockResolvedValue({ count: 1 });
    mockPreferences.mockResolvedValue([{ key: 'system', label: '系统', in_app: true, email: false }]);
    mockPatchNotification.mockResolvedValue({});
    mockDeleteNotification.mockResolvedValue({});
    mockBulk.mockResolvedValue({});
    mockPatchPreference.mockResolvedValue({});
  });

  it('loads notifications and preferences then triggers actions', async () => {
    render(<QueryClientProvider client={queryClient}><NotificationsAdminPage /></QueryClientProvider>);

    await waitFor(() => {
      expect(mockListNotifications).toHaveBeenCalledWith({ page: 1, page_size: 10 });
      expect(mockPreferences).toHaveBeenCalled();
      expect(screen.getByText('我的通知')).toBeInTheDocument();
      expect(screen.getByText('系统通知')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('标记已读'));
    await waitFor(() => expect(mockPatchNotification).toHaveBeenCalledWith({ notification_id: 8 }, { is_read: true }));

    fireEvent.click(screen.getByText('删除'));
    await waitFor(() => expect(mockDeleteNotification).toHaveBeenCalledWith({ notification_id: 8 }));

    fireEvent.click(screen.getByRole('button', { name: '全部未读标记已读' }));
    await waitFor(() => expect(mockBulk).toHaveBeenCalledWith({ action: 'mark_read', all_unread: true }));

    fireEvent.click(screen.getByRole('tab', { name: '通知偏好' }));
    fireEvent.click(screen.getByLabelText('系统-邮件'));
    await waitFor(() => expect(mockPatchPreference).toHaveBeenCalledWith({ category: 'system' }, { email: true }));
  });
});
