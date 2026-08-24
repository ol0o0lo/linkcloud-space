import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { App } from 'antd';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import RoleManagementPage from './index';

const {
  mockGetNavigation,
  mockHistoryPush,
  mockHistoryReplace,
  mockListPermissions,
  mockListRoleMembers,
  mockListRoles,
  mockLocation,
  mockWorkspace,
} = vi.hoisted(() => ({
  mockGetNavigation: vi.fn(),
  mockHistoryPush: vi.fn(),
  mockHistoryReplace: vi.fn(),
  mockListPermissions: vi.fn(),
  mockListRoleMembers: vi.fn(),
  mockListRoles: vi.fn(),
  mockLocation: {
    pathname: '/space/access',
    search: '',
  },
  mockWorkspace: {
    selectedOrgSlug: 'lan',
    queryClient: undefined as QueryClient | undefined,
  },
}));

vi.mock('@umijs/max', async () => {
  const actual =
    await vi.importActual<typeof import('@umijs/max')>('@umijs/max');
  return {
    ...actual,
    history: { push: mockHistoryPush, replace: mockHistoryReplace },
    useLocation: () => mockLocation,
  };
});

vi.mock('@/pages/space/shared', () => ({
  TenantSelectionGuard: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  formatPersonLabel: (user: { first_name?: string; username?: string }) =>
    user.first_name || user.username || '未知用户',
  useTenantWorkspace: () => mockWorkspace,
}));

vi.mock('@/services/manual/roleManagement', async () => {
  const actual = await vi.importActual<
    typeof import('@/services/manual/roleManagement')
  >('@/services/manual/roleManagement');
  return {
    ...actual,
    getRoleManagementNavigation: mockGetNavigation,
    listRolePermissions: mockListPermissions,
    listRoleMembers: mockListRoleMembers,
    listRoles: mockListRoles,
    createRole: vi.fn(),
    updateRole: vi.fn(),
    deleteRole: vi.fn(),
    patchRoleMembers: vi.fn(),
  };
});

const navigation = {
  space_role_count: 1,
  space_assigned_member_count: 1,
  teams: [{ id: 3, name: '销售部', role_count: 2, assigned_member_count: 1 }],
  capabilities: {
    role_view: true,
    role_manage: true,
    team_role_view_ids: [3],
    team_role_manage_ids: [3],
  },
};

const makeRole = (id: number, name: string, scope: 'org' | 'team') => ({
  id,
  code: `role_${id}`,
  name,
  description: `${name}说明`,
  scope,
  is_system: true,
  is_active: true,
  organization_id: null,
  team_id: null,
  permission_keys: ['organizations.member_view'],
  permission_count: 1,
  permission_modules: [{ key: 'organization', name: '成员与组织', count: 1 }],
  assigned_member_count: 1,
  created_at: '2026-08-24T00:00:00Z',
  updated_at: '2026-08-24T00:00:00Z',
});

describe('RoleManagementPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocation.pathname = '/space/access';
    mockLocation.search = '';
    mockGetNavigation.mockResolvedValue(structuredClone(navigation));
    mockListPermissions.mockResolvedValue([
      {
        key: 'organizations.member_view',
        name: '查看组织成员',
        app_label: 'organizations',
        codename: 'member_view',
        module_key: 'organization',
        module_name: '成员与组织',
      },
    ]);
    mockListRoles.mockImplementation((scope: { kind: string }) =>
      Promise.resolve([
        scope.kind === 'space'
          ? makeRole(1, '空间管理员', 'org')
          : makeRole(2, '团队管理员', 'team'),
      ]),
    );
    mockListRoleMembers.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      page_size: 20,
    });
  });

  const renderPage = () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    mockWorkspace.queryClient = queryClient;

    return render(
      <QueryClientProvider client={queryClient}>
        <App>
          <RoleManagementPage />
        </App>
      </QueryClientProvider>,
    );
  };

  it('默认进入空间范围并移除顶部作用域 Tab', async () => {
    renderPage();

    expect(
      await screen.findByRole('button', { name: '空间管理员' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
    await waitFor(() =>
      expect(mockHistoryReplace).toHaveBeenCalledWith(
        '/space/access?scope=space',
      ),
    );
  });

  it('从 URL 恢复团队作用范围', async () => {
    mockLocation.search = '?scope=team&team=3';

    renderPage();

    expect(
      await screen.findByRole('button', { name: '团队管理员' }),
    ).toBeInTheDocument();
    expect(mockListRoles).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'team', teamId: 3, teamName: '销售部' }),
    );
  });

  it('只有团队角色查看权限时默认进入第一个可访问团队', async () => {
    mockGetNavigation.mockResolvedValue({
      ...structuredClone(navigation),
      capabilities: {
        ...navigation.capabilities,
        role_view: false,
        role_manage: false,
      },
    });

    renderPage();

    await waitFor(() =>
      expect(mockListRoles).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: 'team',
          teamId: 3,
          teamName: '销售部',
        }),
      ),
    );
    await waitFor(() =>
      expect(mockHistoryReplace).toHaveBeenCalledWith(
        '/space/access?scope=team&team=3',
      ),
    );
  });

  it('无权限深链接显示无权限且不自动跳转', async () => {
    mockLocation.search = '?scope=team&team=999';

    renderPage();

    expect(await screen.findByText('无权查看所选作用范围')).toBeInTheDocument();
    expect(mockHistoryReplace).not.toHaveBeenCalled();
    expect(mockHistoryPush).not.toHaveBeenCalled();
    expect(mockListRoles).not.toHaveBeenCalled();
  });
});
