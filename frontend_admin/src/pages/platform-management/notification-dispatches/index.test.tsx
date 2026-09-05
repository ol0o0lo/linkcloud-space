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
  mockUseModel,
  mockUseLocation,
  mockUseTenantWorkspace,
  mockAppContext,
  mockListDispatches,
  mockCreateDispatch,
  mockGetDispatch,
  mockListPreferences,
  mockListTargets,
} = vi.hoisted(() => ({
  mockUseModel: vi.fn(),
  mockUseLocation: vi.fn(),
  mockUseTenantWorkspace: vi.fn(),
  mockAppContext: vi.fn(),
  mockListDispatches: vi.fn(),
  mockCreateDispatch: vi.fn(),
  mockGetDispatch: vi.fn(),
  mockListPreferences: vi.fn(),
  mockListTargets: vi.fn(),
}));

vi.mock('@umijs/max', () => ({
  useLocation: mockUseLocation,
  useModel: mockUseModel,
}));

vi.mock('@/pages/space/shared', () => ({
  useTenantWorkspace: mockUseTenantWorkspace,
}));

vi.mock('@/services/openapi/appSystem', () => ({
  appsBaseApiAppContext: mockAppContext,
}));

vi.mock('@/services/openapi/notificationDispatches', () => ({
  appsNotificationsApiListDispatches: mockListDispatches,
  appsNotificationsApiCreateDispatch: mockCreateDispatch,
  appsNotificationsApiGetDispatch: mockGetDispatch,
}));

vi.mock('@/services/openapi/notifications', () => ({
  appsNotificationsApiListPreferences: mockListPreferences,
}));

vi.mock('@/services/manual/notificationDispatches', () => ({
  listNotificationDispatchTargets: mockListTargets,
}));

vi.mock('@ant-design/pro-components', () => ({
  PageContainer: ({ children, title, subTitle }: any) => (
    <section>
      <h1>{title}</h1>
      <p>{subTitle}</p>
      {children}
    </section>
  ),
  ProTable: ({
    actionRef,
    columns,
    headerTitle,
    pagination,
    request,
    toolBarRender,
  }: any) => {
    const [data, setData] = React.useState<any[]>([]);
    const pageSize = pagination?.defaultPageSize || 10;

    const load = async () => {
      const result = await request?.({ current: 1, pageSize });
      setData(result?.data || []);
    };

    React.useEffect(() => {
      if (actionRef) {
        actionRef.current = { reload: () => void load() };
      }
      void load();
    }, []);

    return (
      <div>
        <div>{headerTitle}</div>
        {toolBarRender ? <div>{toolBarRender()}</div> : null}
        <table>
          <thead>
            <tr>
              {columns.map((column: any) => (
                <th key={column.dataIndex}>{column.title}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((record, rowIndex) => (
              <tr key={record.id}>
                {columns.map((column: any) => (
                  <td key={column.dataIndex}>
                    {column.render
                      ? column.render(undefined, record, rowIndex)
                      : record[column.dataIndex]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  },
}));

import NotificationDispatchesPage from './index';

declare const __TEST_SUITE_SHARD__: string | undefined;

function registerTestShard(name: string, register: () => void) {
  if (
    typeof __TEST_SUITE_SHARD__ === 'undefined' ||
    __TEST_SUITE_SHARD__ === name
  ) {
    register();
  }
}

function renderPage(queryClient: QueryClient) {
  return render(
    <QueryClientProvider client={queryClient}>
      <NotificationDispatchesPage />
    </QueryClientProvider>,
  );
}

describe('NotificationDispatchesPage', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    mockUseModel.mockReturnValue({
      initialState: {
        currentUser: {
          id: 1,
          username: 'tenant-owner',
          is_superuser: false,
        },
      },
    });
    mockUseLocation.mockReturnValue({
      pathname: '/space/notification-dispatches',
    });
    mockUseTenantWorkspace.mockReturnValue({
      selectedOrgSlug: 'lan',
      selectedOrganization: {
        id: 7,
        name: 'LAN 空间',
        slug: 'lan',
        is_current: true,
        is_primary: true,
      },
      appContext: {
        org: {
          id: 7,
          name: 'LAN 空间',
          slug: 'lan',
          is_owner: true,
        },
      },
      organizationsQuery: { isLoading: false },
    });
    mockAppContext.mockResolvedValue({
      org: {
        id: 7,
        name: 'LAN 空间',
        slug: 'lan',
        is_owner: true,
      },
    });
    mockListPreferences.mockResolvedValue([
      {
        key: 'operations',
        label: '运营通知',
        description: '空间运营相关的重要提醒。',
        default_channels__mapping: ['In-app'],
        required_channels__mapping: [],
        in_app: true,
        email: false,
      },
    ]);
    mockListTargets.mockResolvedValue({
      items: [
        {
          id: 10,
          label: 'Alice',
          description: 'alice · alice@example.com',
          avatar_url: null,
        },
      ],
      total: 1,
      page: 1,
      page_size: 50,
    });
    mockListDispatches.mockResolvedValue({
      items: [
        {
          id: 1,
          scope: 'users',
          scope__mapping: 'Users',
          scope_ids: [10],
          owner_organization_id: 7,
          category: '',
          title: '首条分发',
          body: 'hello',
          url: null,
          data: {},
          status: 'sent',
          status__mapping: 'Sent',
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
      scope: 'organization',
      scope_ids: [7],
      owner_organization_id: 7,
      category: '',
      title: '空间通知',
      body: 'hello',
      url: null,
      data: {},
      status: 'pending',
      target_count: 0,
      delivered_count: 0,
      error_message: '',
      sent_at: null,
      created_by: 'tenant-owner',
      created_at: '2026-06-19T11:00:00+08:00',
      updated_at: '2026-06-19T11:00:00+08:00',
    });
    mockGetDispatch.mockResolvedValue({
      id: 1,
      scope: 'users',
      scope__mapping: 'Users',
      scope_ids: [10],
      owner_organization_id: 7,
      category: '',
      title: '首条分发',
      body: 'hello',
      url: null,
      data: {},
      status: 'sending',
      status__mapping: 'Sending',
      target_count: 1,
      delivered_count: 1,
      error_message: '',
      sent_at: '2026-06-19T10:00:00+08:00',
      created_by: 'admin',
      created_at: '2026-06-19T10:00:00+08:00',
      updated_at: '2026-06-19T10:00:00+08:00',
    });
  });

  registerTestShard('notification-scopes', () => {
    it('uses tenant-safe defaults, localizes mappings, creates dispatches, and opens detail data', async () => {
      renderPage(queryClient);

      await waitFor(() => {
        expect(mockAppContext).not.toHaveBeenCalled();
        expect(mockListDispatches).toHaveBeenCalledWith({
          page: 1,
          page_size: 10,
          management_context: 'tenant',
        });
        expect(screen.getByText('首条分发')).toBeInTheDocument();
      });

      const row = screen.getByText('首条分发').closest('tr');
      expect(row).not.toBeNull();
      if (!row) throw new Error('分发行未渲染');
      expect(within(row).getByText('发送完成')).toBeInTheDocument();
      expect(within(row).getByText('指定成员 · 1 人')).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: '新建通知' }));
      expect(screen.getByRole('radio', { name: '空间全员' })).toBeChecked();
      expect(
        screen.queryByRole('radio', { name: '全平台' }),
      ).not.toBeInTheDocument();
      expect(screen.getByText('发送空间通知')).toBeInTheDocument();
      expect(
        screen.getByText('重要消息将通过通知中心送达成员'),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('heading', { name: '选择接收人' }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('radiogroup', { name: '选择接收人' }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('heading', { name: '填写消息内容' }),
      ).toBeInTheDocument();
      expect(
        screen.getByText('将发送给「LAN 空间」的全部成员'),
      ).toBeInTheDocument();
      expect(
        screen.getByText('准备发送给当前空间全部成员'),
      ).toBeInTheDocument();
      expect(
        screen.queryByText('通知仅发送至「LAN 空间」内，不会触达其他空间'),
      ).not.toBeInTheDocument();
      expect(screen.queryByText('通知预览')).not.toBeInTheDocument();
      expect(screen.queryByText('发送摘要')).not.toBeInTheDocument();

      fireEvent.change(screen.getByLabelText('标题'), {
        target: { value: '  空间通知  ' },
      });
      fireEvent.change(screen.getByLabelText('内容'), {
        target: { value: '  hello  ' },
      });
      fireEvent.click(screen.getByRole('button', { name: /发送通知/ }));

      await waitFor(() =>
        expect(mockCreateDispatch).toHaveBeenCalledWith(
          { management_context: 'tenant' },
          {
            scope: 'organization',
            scope_ids: [7],
            title: '空间通知',
            body: 'hello',
            category: '',
            data: {},
          },
        ),
      );

      fireEvent.click(within(row).getByRole('button', { name: '详情' }));
      await waitFor(() => {
        expect(mockGetDispatch).toHaveBeenCalledWith({
          dispatch_id: 1,
          management_context: 'tenant',
        });
        expect(screen.getByText('分发详情')).toBeInTheDocument();
        expect(screen.getByText('发送中')).toBeInTheDocument();
      });
    });

    it('lets superusers search and select named users instead of entering ids', async () => {
      mockUseModel.mockReturnValue({
        initialState: {
          currentUser: {
            id: 1,
            username: 'platform-admin',
            is_superuser: true,
          },
        },
      });
      mockUseLocation.mockReturnValue({
        pathname: '/super-admin/notification-dispatches',
      });
      renderPage(queryClient);

      await screen.findByText('首条分发');
      expect(mockAppContext).not.toHaveBeenCalled();
      expect(mockListDispatches).toHaveBeenCalledWith({
        page: 1,
        page_size: 10,
        management_context: 'platform',
      });

      const platformRow = screen.getByText('首条分发').closest('tr');
      if (!platformRow) throw new Error('平台分发行未渲染');
      fireEvent.click(
        within(platformRow).getByRole('button', { name: '详情' }),
      );
      await waitFor(() =>
        expect(mockGetDispatch).toHaveBeenCalledWith({
          dispatch_id: 1,
          management_context: 'platform',
        }),
      );

      fireEvent.click(screen.getByRole('button', { name: '新建通知' }));
      expect(screen.getByRole('radio', { name: '全平台' })).toBeChecked();
      fireEvent.click(screen.getByRole('radio', { name: '指定用户' }));

      await waitFor(() =>
        expect(mockListTargets).toHaveBeenCalledWith({
          scope: 'users',
          management_context: 'platform',
          keyword: undefined,
          page: 1,
          page_size: 50,
        }),
      );

      const recipientSelect = screen.getByLabelText('接收用户');
      fireEvent.mouseDown(recipientSelect);
      fireEvent.click(
        await screen.findByText('Alice · alice · alice@example.com'),
      );
      fireEvent.change(screen.getByLabelText('标题'), {
        target: { value: '单人通知' },
      });
      fireEvent.change(screen.getByLabelText('内容'), {
        target: { value: 'hello' },
      });
      fireEvent.click(screen.getByRole('button', { name: /发送通知/ }));

      await waitFor(() =>
        expect(mockCreateDispatch).toHaveBeenCalledWith(
          { management_context: 'platform' },
          {
            scope: 'users',
            scope_ids: [10],
            title: '单人通知',
            body: 'hello',
            category: '',
            data: {},
          },
        ),
      );
    });

    it('keeps superusers in tenant mode and sends to a selected team', async () => {
      mockUseModel.mockReturnValue({
        initialState: {
          currentUser: {
            id: 1,
            username: 'platform-admin',
            is_superuser: true,
          },
        },
      });
      mockUseLocation.mockReturnValue({
        pathname: '/space/notification-dispatches',
      });
      mockListTargets.mockResolvedValue({
        items: [
          {
            id: 12,
            label: '运营一组',
            description: '3 名成员',
            avatar_url: null,
          },
        ],
        total: 1,
        page: 1,
        page_size: 50,
      });

      renderPage(queryClient);

      await screen.findByText('首条分发');
      expect(mockAppContext).not.toHaveBeenCalled();
      expect(mockListDispatches).toHaveBeenCalledWith({
        page: 1,
        page_size: 10,
        management_context: 'tenant',
      });

      const tenantRow = screen.getByText('首条分发').closest('tr');
      if (!tenantRow) throw new Error('租户分发行未渲染');
      fireEvent.click(within(tenantRow).getByRole('button', { name: '详情' }));
      await waitFor(() =>
        expect(mockGetDispatch).toHaveBeenCalledWith({
          dispatch_id: 1,
          management_context: 'tenant',
        }),
      );

      fireEvent.click(screen.getByRole('button', { name: '新建通知' }));
      expect(screen.getByRole('radio', { name: '空间全员' })).toBeChecked();
      expect(
        screen.queryByRole('radio', { name: '全平台' }),
      ).not.toBeInTheDocument();
      expect(
        screen.getByRole('radio', { name: '指定成员' }),
      ).toBeInTheDocument();
      fireEvent.click(screen.getByRole('radio', { name: '指定团队' }));

      await waitFor(() =>
        expect(mockListTargets).toHaveBeenCalledWith({
          scope: 'teams',
          management_context: 'tenant',
          keyword: undefined,
          page: 1,
          page_size: 50,
        }),
      );

      fireEvent.mouseDown(screen.getByLabelText('目标团队'));
      fireEvent.click(await screen.findByText('运营一组 · 3 名成员'));
      fireEvent.change(screen.getByLabelText('标题'), {
        target: { value: '团队通知' },
      });
      fireEvent.change(screen.getByLabelText('内容'), {
        target: { value: '请按时处理任务' },
      });
      fireEvent.click(screen.getByRole('button', { name: /发送通知/ }));

      await waitFor(() =>
        expect(mockCreateDispatch).toHaveBeenCalledWith(
          { management_context: 'tenant' },
          {
            scope: 'teams',
            scope_ids: [12],
            title: '团队通知',
            body: '请按时处理任务',
            category: '',
            data: {},
          },
        ),
      );
    });
  });

  registerTestShard('notification-validation', () => {
    it.each([
      'example.com/path',
      '//example.com/path',
      '/\\example.com/path',
    ])('blocks unsupported link %s before dispatching', async (unsupportedUrl) => {
      mockUseModel.mockReturnValue({
        initialState: {
          currentUser: {
            id: 1,
            username: 'platform-admin',
            is_superuser: true,
          },
        },
      });
      mockUseLocation.mockReturnValue({
        pathname: '/super-admin/notification-dispatches',
      });
      renderPage(queryClient);

      await screen.findByText('首条分发');
      fireEvent.click(screen.getByRole('button', { name: '新建通知' }));
      fireEvent.change(screen.getByLabelText('标题'), {
        target: { value: '非法链接' },
      });
      fireEvent.change(screen.getByLabelText('内容'), {
        target: { value: 'hello' },
      });
      expect(
        screen.queryByLabelText('点击后前往（可选）'),
      ).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: '添加链接' }));
      fireEvent.change(screen.getByLabelText('点击后前往（可选）'), {
        target: { value: unsupportedUrl },
      });
      fireEvent.click(screen.getByRole('button', { name: /发送通知/ }));

      expect(
        await screen.findByText('请输入站内路径或完整的 http(s) 链接'),
      ).toBeInTheDocument();
      expect(mockCreateDispatch).not.toHaveBeenCalled();
    });

    it('accepts uppercase HTTP links consistently with the backend', async () => {
      mockUseModel.mockReturnValue({
        initialState: {
          currentUser: {
            id: 1,
            username: 'platform-admin',
            is_superuser: true,
          },
        },
      });
      mockUseLocation.mockReturnValue({
        pathname: '/super-admin/notification-dispatches',
      });
      renderPage(queryClient);

      await screen.findByText('首条分发');
      fireEvent.click(screen.getByRole('button', { name: '新建通知' }));
      fireEvent.change(screen.getByLabelText('标题'), {
        target: { value: '安全链接' },
      });
      fireEvent.change(screen.getByLabelText('内容'), {
        target: { value: 'hello' },
      });
      fireEvent.click(screen.getByRole('button', { name: '添加链接' }));
      fireEvent.change(screen.getByLabelText('点击后前往（可选）'), {
        target: { value: 'HTTPS://example.com/notice' },
      });
      fireEvent.click(screen.getByRole('button', { name: /发送通知/ }));

      await waitFor(() =>
        expect(mockCreateDispatch).toHaveBeenCalledWith(
          { management_context: 'platform' },
          {
            scope: 'platform',
            scope_ids: [],
            title: '安全链接',
            body: 'hello',
            category: '',
            url: 'HTTPS://example.com/notice',
            data: {},
          },
        ),
      );
    });

    it('shows a retry action when recipient targets fail to load', async () => {
      mockUseModel.mockReturnValue({
        initialState: {
          currentUser: {
            id: 1,
            username: 'platform-admin',
            is_superuser: true,
          },
        },
      });
      mockUseLocation.mockReturnValue({
        pathname: '/super-admin/notification-dispatches',
      });
      mockListTargets.mockRejectedValueOnce(new Error('network error'));
      renderPage(queryClient);

      await screen.findByText('首条分发');
      fireEvent.click(screen.getByRole('button', { name: '新建通知' }));
      fireEvent.click(screen.getByRole('radio', { name: '指定用户' }));

      await waitFor(() => expect(mockListTargets).toHaveBeenCalledTimes(1));
      fireEvent.mouseDown(screen.getByLabelText('接收用户'));
      expect(await screen.findByText('接收目标加载失败')).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: '重新加载接收目标' }));
      await waitFor(() => expect(mockListTargets).toHaveBeenCalledTimes(2));
    });

    it('closes the editor and reloads records after switching spaces', async () => {
      const page = renderPage(queryClient);

      await screen.findByText('首条分发');
      fireEvent.click(screen.getByRole('button', { name: '新建通知' }));
      expect(
        screen.getByRole('dialog', { name: /发送空间通知/ }),
      ).toBeInTheDocument();
      const listCallsBeforeSwitch = mockListDispatches.mock.calls.length;

      mockUseTenantWorkspace.mockReturnValue({
        selectedOrgSlug: 'new-space',
        selectedOrganization: {
          id: 9,
          name: '新空间',
          slug: 'new-space',
          is_current: true,
          is_primary: false,
        },
        appContext: {
          org: {
            id: 9,
            name: '新空间',
            slug: 'new-space',
            is_owner: true,
          },
        },
        organizationsQuery: { isLoading: false },
      });
      page.rerender(
        <QueryClientProvider client={queryClient}>
          <NotificationDispatchesPage />
        </QueryClientProvider>,
      );

      await waitFor(() => {
        expect(mockListDispatches.mock.calls.length).toBeGreaterThan(
          listCallsBeforeSwitch,
        );
      });

      fireEvent.click(screen.getByRole('button', { name: '新建通知' }));
      expect(screen.getByRole('radio', { name: '空间全员' })).toBeChecked();
    });

    it('resets form after cancelling and reopening the modal', async () => {
      renderPage(queryClient);

      await screen.findByText('首条分发');
      fireEvent.click(screen.getByRole('button', { name: '新建通知' }));
      fireEvent.change(screen.getByLabelText('标题'), {
        target: { value: '待清空标题' },
      });
      fireEvent.change(screen.getByLabelText('内容'), {
        target: { value: '待清空内容' },
      });
      fireEvent.click(screen.getByRole('button', { name: /取\s*消/ }));

      fireEvent.click(screen.getByRole('button', { name: '新建通知' }));
      expect(screen.getByRole('radio', { name: '空间全员' })).toBeChecked();
      expect(screen.getByLabelText('标题')).toHaveValue('');
      expect(screen.getByLabelText('内容')).toHaveValue('');
    });
  });
});
