import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
    mockListNotifications.mockResolvedValue({ items: [{ id: 8, title: '系统通知', body: 'hello', is_read: false, created_at: '2026-06-16T10:00:00+08:00' }], total: 1, page: 1, page_size: 10 });
    mockGetNotification.mockResolvedValue({ id: 8, title: '系统通知', body: 'hello', is_read: false, created_at: '2026-06-16T10:00:00+08:00' });
    mockUnreadCount.mockResolvedValue({ count: 1 });
    mockPatchNotification.mockResolvedValue({});
    mockBulk.mockResolvedValue({});
  });

  it('loads and displays notifications', async () => {
    render(<QueryClientProvider client={queryClient}><NotificationsAdminPage /></QueryClientProvider>);
    await waitFor(() => {
      expect(mockListNotifications).toHaveBeenCalledWith({ page: 1, page_size: 10 });
      expect(screen.getByText('系统通知')).toBeInTheDocument();
    });
  });

  it('marks all as read', async () => {
    render(<QueryClientProvider client={queryClient}><NotificationsAdminPage /></QueryClientProvider>);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'check 全部已读' })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: 'check 全部已读' }));
    await waitFor(() => expect(mockBulk).toHaveBeenCalledWith({ action: 'mark_read', all_unread: true }));
  });
});
