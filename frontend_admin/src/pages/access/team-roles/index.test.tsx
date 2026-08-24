import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TeamRolesPanel } from './index';

function clickLastOkButton() {
  const button = screen.getAllByRole('button', { name: 'OK' }).at(-1);
  expect(button).toBeDefined();
  if (button) fireEvent.click(button);
}

const {
  mockListPermissions,
  mockListTeams,
  mockListTeamRoles,
  mockListTeamBindings,
  mockCreateTeamRole,
  mockPatchTeamRole,
  mockDeleteTeamRole,
  mockNavigation,
} = vi.hoisted(() => ({
  mockListPermissions: vi.fn(),
  mockListTeams: vi.fn(),
  mockListTeamRoles: vi.fn(),
  mockListTeamBindings: vi.fn(),
  mockCreateTeamRole: vi.fn(),
  mockPatchTeamRole: vi.fn(),
  mockDeleteTeamRole: vi.fn(),
  mockNavigation: vi.fn(),
}));

vi.mock('@/pages/space/shared', () => ({
  TenantSelectionGuard: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  formatPersonLabel: (user: {
    first_name?: string;
    last_name?: string;
    username?: string;
  }) =>
    [user.first_name, user.last_name].filter(Boolean).join(' ') ||
    user.username ||
    '未知用户',
  useTenantWorkspace: () => ({
    selectedOrgSlug: 'acme',
    queryClient: { invalidateQueries: vi.fn() },
  }),
}));

vi.mock('@/services/openapi/accessPermissions', () => ({
  appsAccessApiListPermissions: mockListPermissions,
}));

vi.mock('@/services/openapi/organizationWorkspace', () => ({
  appsOrganizationsWorkspaceApiGetNavigation: mockNavigation,
}));

vi.mock('@/services/openapi/accessTeamRoles', () => ({
  appsAccessApiListTeamRoles: mockListTeamRoles,
  appsAccessApiCreateTeamRole: mockCreateTeamRole,
  appsAccessApiPatchTeamRole: mockPatchTeamRole,
  appsAccessApiDeleteTeamRole: mockDeleteTeamRole,
}));

vi.mock('@/services/openapi/accessTeamBindings', () => ({
  appsAccessApiListTeamBindingsView: mockListTeamBindings,
}));

vi.mock('@/services/openapi/teams', () => ({
  appsTeamsApiListTeams: mockListTeams,
}));

describe('TeamRolesPage', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    mockListPermissions.mockResolvedValue([
      {
        key: 'teams.member.view',
        name: '查看团队成员',
        app_label: 'teams',
        codename: 'member_view',
      },
    ]);
    mockListTeams.mockResolvedValue({
      items: [{ id: 3, name: 'Growth' }],
      total: 1,
      page: 1,
      page_size: 100,
    });
    mockListTeamRoles.mockResolvedValue([
      {
        id: 1,
        code: 'team_viewer',
        name: '团队查看',
        scope: 'team',
        is_system: true,
        is_active: true,
        permission_keys: ['teams.member.view'],
      },
      {
        id: 4,
        code: 'team_ops',
        name: '团队运营',
        scope: 'team',
        is_system: false,
        is_active: true,
        permission_keys: ['teams.member.view'],
      },
    ]);
    mockListTeamBindings.mockResolvedValue([
      {
        id: 12,
        team_id: 3,
        user: {
          id: 7,
          username: 'alice',
          first_name: 'Alice',
          last_name: 'Zhang',
        },
        role: { id: 4, name: '团队运营', code: 'team_ops', scope: 'team' },
        created_at: '2026-06-16T10:00:00+08:00',
        updated_at: '2026-06-16T10:00:00+08:00',
      },
    ]);
    mockCreateTeamRole.mockResolvedValue({});
    mockPatchTeamRole.mockResolvedValue({});
    mockDeleteTeamRole.mockResolvedValue({});
    mockNavigation.mockResolvedValue({
      teams: [
        { id: 3, name: 'Growth', member_count: 4 },
        { id: 4, name: 'Finance', member_count: 2 },
      ],
      capabilities: {
        role_view: true,
        team_role_view_ids: [3, 4],
        team_role_manage_ids: [3, 4],
      },
    });
  });

  it('loads team roles and triggers create / edit / delete actions for the selected team', async () => {
    const TeamRolesHarness = () => {
      const [teamId, setTeamId] = React.useState<number>();
      return (
        <TeamRolesPanel selectedTeamId={teamId} onTeamChange={setTeamId} />
      );
    };

    render(
      <QueryClientProvider client={queryClient}>
        <TeamRolesHarness />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(mockListTeamRoles).toHaveBeenCalledWith({ team_id: 3 });
      expect(mockListTeamBindings).toHaveBeenCalledWith({ team_id: 3 });
      expect(screen.getAllByText('团队运营').length).toBeGreaterThan(0);
    });

    expect(screen.queryByText('角色概览')).not.toBeInTheDocument();
    expect(screen.queryByText('角色覆盖情况')).not.toBeInTheDocument();
    expect(
      screen.queryByText('团队角色不是权限清单，而是团队职责的业务化映射'),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('columnheader', { name: '已授权' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: '选择 Growth 团队' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: '选择 Finance 团队' }),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: '查看团队运营的已授权成员' }),
    );
    expect(
      await screen.findByText('团队运营 · 已授权成员'),
    ).toBeInTheDocument();
    expect(screen.getByText('Alice Zhang')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Close'));

    fireEvent.click(screen.getByRole('button', { name: '选择 Finance 团队' }));
    await waitFor(() => {
      expect(mockListTeamRoles).toHaveBeenCalledWith({ team_id: 4 });
    });

    fireEvent.click(screen.getByRole('button', { name: '新建角色' }));
    fireEvent.change(screen.getByLabelText('角色名称'), {
      target: { value: '团队财务' },
    });
    clickLastOkButton();

    await waitFor(() => {
      expect(mockCreateTeamRole).toHaveBeenCalledWith(
        { team_id: 4 },
        expect.objectContaining({ name: '团队财务' }),
      );
    });

    fireEvent.click(screen.getByText('编辑'));
    fireEvent.change(screen.getByLabelText('角色名称'), {
      target: { value: '团队运营主管' },
    });
    clickLastOkButton();

    await waitFor(() => {
      expect(mockPatchTeamRole).toHaveBeenCalledWith(
        { team_id: 4, role_id: 4 },
        expect.objectContaining({ name: '团队运营主管' }),
      );
    });

    fireEvent.click(screen.getByText('删除'));
    clickLastOkButton();

    await waitFor(() => {
      expect(mockDeleteTeamRole).toHaveBeenCalledWith({
        team_id: 4,
        role_id: 4,
      });
    });
  });
});
