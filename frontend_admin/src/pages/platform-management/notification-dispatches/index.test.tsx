import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import NotificationDispatchesPage from './index';

const {
  mockListDispatches,
  mockCreateDispatch,
  mockGetDispatch,
  mockListDispatchNotifications,
} = vi.hoisted(() => ({
  mockListDispatches: vi.fn(),
  mockCreateDispatch: vi.fn(),
  mockGetDispatch: vi.fn(),
  mockListDispatchNotifications: vi.fn(),
}));

vi.mock('@/services/openapi/notificationDispatches', () => ({
  appsNotificationsApiListDispatches: mockListDispatches,
  appsNotificationsApiCreateDispatch: mockCreateDispatch,
  appsNotificationsApiGetDispatch: mockGetDispatch,
  appsNotificationsApiListDispatchNotifications: mockListDispatchNotifications,
}));

describe('NotificationDispatchesPage', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    mockListDispatches.mockResolvedValue({
      items: [
        {
          id: 1,
          scope: 'users',
          scope_ids: [10],
          owner_organization_id: null,
          category: '',
          title: '首条分发',
          body: 'hello',
          url: null,
          data: {},
          status: 'success',
          target_count: 1,
          delivered_count: 1,
          error_message: '',
          sent_at: '2026-06-19T10:00:00+08:00',
          created_by: 'admin',
          created_at: '2026-06-19T10:00:00+08:00',
          updated_at: '2026-06-19T10:00:00+08:00',
        },
      ],
      total: 1,
      page: 1,
      page_size: 10,
    });
    mockCreateDispatch.mockResolvedValue({
      id: 2,
      scope: 'users',
      scope_ids: [10],
      owner_organization_id: null,
      category: '',
      title: '单人通知',
      body: 'hello',
      url: null,
      data: {},
      status: 'pending',
      target_count: 1,
      delivered_count: 0,
      error_message: '',
      sent_at: null,
      created_by: 'admin',
      created_at: '2026-06-19T11:00:00+08:00',
      updated_at: '2026-06-19T11:00:00+08:00',
    });
    mockGetDispatch.mockResolvedValue({
      id: 1,
      scope: 'users',
      scope_ids: [10],
      owner_organization_id: null,
      category: '',
      title: '首条分发',
      body: 'hello',
      url: null,
      data: {},
      status: 'success',
      target_count: 1,
      delivered_count: 1,
      error_message: '',
      sent_at: '2026-06-19T10:00:00+08:00',
      created_by: 'admin',
      created_at: '2026-06-19T10:00:00+08:00',
      updated_at: '2026-06-19T10:00:00+08:00',
    });
    mockListDispatchNotifications.mockResolvedValue({
      items: [
        {
          id: 100,
          title: '首条分发',
          body: 'hello',
          url: null,
          is_read: false,
          created_at: '2026-06-19T10:01:00+08:00',
          actor: null,
        },
      ],
      total: 1,
      page: 1,
      page_size: 10,
    });
  });

  it('loads dispatches, creates a users dispatch, and fetches detail data', async () => {
    render(<QueryClientProvider client={queryClient}><NotificationDispatchesPage /></QueryClientProvider>);

    await waitFor(() => {
      expect(mockListDispatches).toHaveBeenCalledWith({ page: 1, page_size: 10 });
      expect(screen.getByText('首条分发')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: '新建分发' }));
    fireEvent.click(screen.getByRole('radio', { name: '指定用户' }));
    fireEvent.change(screen.getByLabelText('目标 ID 列表'), { target: { value: '10' } });
    fireEvent.change(screen.getByLabelText('标题'), { target: { value: '单人通知' } });
    fireEvent.change(screen.getByLabelText('内容'), { target: { value: 'hello' } });
    fireEvent.click(screen.getByRole('button', { name: /确\s*定/ }));

    await waitFor(() =>
      expect(mockCreateDispatch).toHaveBeenCalledWith({
        scope: 'users',
        scope_ids: [10],
        title: '单人通知',
        body: 'hello',
        category: '',
        data: {},
      }),
    );

    fireEvent.click(screen.getByText('详情'));
    await waitFor(() => {
      expect(mockGetDispatch).toHaveBeenCalledWith({ dispatch_id: 1 });
      expect(mockListDispatchNotifications).toHaveBeenCalledWith({ dispatch_id: 1, page: 1, page_size: 10 });
    });
  });
});
