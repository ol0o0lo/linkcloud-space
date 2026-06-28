import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
          status: 'sent',
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
      status: 'sending',
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

  it('renders governance layout, creates dispatches, and opens detail data', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <NotificationDispatchesPage />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(mockListDispatches).toHaveBeenCalledWith({ page: 1, page_size: 10 });
      expect(screen.queryByText('分发概览')).not.toBeInTheDocument();
      expect(screen.queryByText('投放详情')).not.toBeInTheDocument();
      expect(screen.queryByText('关键提醒')).not.toBeInTheDocument();
      expect(screen.getByText('分发列表')).toBeInTheDocument();
      expect(screen.queryByText('全平台广播')).not.toBeInTheDocument();
      expect(screen.queryByText('用户定向')).not.toBeInTheDocument();
      expect(screen.queryByText('失败处理')).not.toBeInTheDocument();
      expect(screen.queryByText('查看通知')).not.toBeInTheDocument();
      expect(screen.queryByText('回看通知页')).not.toBeInTheDocument();
      expect(screen.queryByText('回到通知治理')).not.toBeInTheDocument();
      expect(screen.queryByText('联动通知治理')).not.toBeInTheDocument();
      expect(screen.queryByText('失败收口')).not.toBeInTheDocument();
      expect(screen.getByText('首条分发')).toBeInTheDocument();
    });

    const row = screen.getByText('首条分发').closest('tr');
    expect(row).not.toBeNull();
    expect(within(row!).getByText('已送达')).toBeInTheDocument();
    expect(within(row!).getByText('指定用户 (10)')).toBeInTheDocument();

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

    fireEvent.click(within(row!).getByText('详情'));
    await waitFor(() => {
      expect(mockGetDispatch).toHaveBeenCalledWith({ dispatch_id: 1 });
      expect(mockListDispatchNotifications).toHaveBeenCalledWith({ dispatch_id: 1, page: 1, page_size: 10 });
      expect(screen.getByText('分发详情')).toBeInTheDocument();
      expect(screen.getByText('发送中')).toBeInTheDocument();
    });
  });

  it('blocks submit when scope_ids_text contains invalid tokens', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <NotificationDispatchesPage />
      </QueryClientProvider>,
    );

    await screen.findByText('首条分发');

    fireEvent.click(screen.getByRole('button', { name: '新建分发' }));
    fireEvent.click(screen.getByRole('radio', { name: '指定用户' }));
    fireEvent.change(screen.getByLabelText('目标 ID 列表'), { target: { value: '1,abc' } });
    fireEvent.change(screen.getByLabelText('标题'), { target: { value: '非法目标' } });
    fireEvent.change(screen.getByLabelText('内容'), { target: { value: 'hello' } });
    fireEvent.click(screen.getByRole('button', { name: /确\s*定/ }));

    await waitFor(() => {
      expect(screen.getByText(/目标 ID 只能填写用英文逗号分隔的正整数/)).toBeInTheDocument();
      expect(mockCreateDispatch).not.toHaveBeenCalled();
    });
  });

  it('resets form after cancelling create modal and reopening it', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <NotificationDispatchesPage />
      </QueryClientProvider>,
    );

    await screen.findByText('首条分发');

    fireEvent.click(screen.getByRole('button', { name: '新建分发' }));
    fireEvent.click(screen.getByRole('radio', { name: '指定用户' }));
    fireEvent.change(screen.getByLabelText('目标 ID 列表'), { target: { value: '10' } });
    fireEvent.change(screen.getByLabelText('标题'), { target: { value: '待清空标题' } });
    fireEvent.change(screen.getByLabelText('内容'), { target: { value: '待清空内容' } });
    fireEvent.click(screen.getByRole('button', { name: /取\s*消/ }));

    await waitFor(() => {
      expect(screen.getByLabelText('目标 ID 列表')).toHaveValue('');
      expect(screen.getByLabelText('标题')).toHaveValue('');
      expect(screen.getByLabelText('内容')).toHaveValue('');
      expect(screen.getByRole('radio', { name: '全平台' })).toBeChecked();
    });

    fireEvent.click(screen.getByRole('button', { name: '新建分发' }));

    expect(screen.getByRole('radio', { name: '全平台' })).toBeChecked();
    expect(screen.getByLabelText('目标 ID 列表')).toHaveValue('');
    expect(screen.getByLabelText('标题')).toHaveValue('');
    expect(screen.getByLabelText('内容')).toHaveValue('');
  });
});
