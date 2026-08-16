import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import TeamRolesPage from './index';

const {
  mockListPermissions,
  mockListTeams,
  mockListTeamRoles,
  mockListTeamBindings,
  mockCreateTeamRole,
  mockPatchTeamRole,
  mockDeleteTeamRole,
} = vi.hoisted(() => ({
  mockListPermissions: vi.fn(),
  mockListTeams: vi.fn(),
  mockListTeamRoles: vi.fn(),
  mockListTeamBindings: vi.fn(),
  mockCreateTeamRole: vi.fn(),
  mockPatchTeamRole: vi.fn(),
  mockDeleteTeamRole: vi.fn(),
}));

vi.mock('@/pages/space/shared', () => ({
  TenantSelectionGuard: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useTenantWorkspace: () => ({ selectedOrgSlug: 'acme', queryClient: { invalidateQueries: vi.fn() } }),
}));

vi.mock('@/services/openapi/accessPermissions', () => ({
  appsAccessApiListPermissions: mockListPermissions,
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
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    mockListPermissions.mockResolvedValue([{ key: 'teams.member.view', name: '查看团队成员', app_label: 'teams', codename: 'member_view' }]);
    mockListTeams.mockResolvedValue({ items: [{ id: 3, name: 'Growth' }], total: 1, page: 1, page_size: 100 });
    mockListTeamRoles.mockResolvedValue([
      { id: 1, code: 'team_viewer', name: '团队查看', scope: 'team', is_system: true, is_active: true, permission_keys: ['teams.member.view'] },
      { id: 4, code: 'team_ops', name: '团队运营', scope: 'team', is_system: false, is_active: true, permission_keys: ['teams.member.view'] },
    ]);
    mockListTeamBindings.mockResolvedValue([
      { id: 12, team_id: 3, user: { id: 7, username: 'alice', first_name: 'Alice', last_name: 'Zhang' }, role: { id: 4, name: '团队运营', code: 'team_ops', scope: 'team' }, created_at: '2026-06-16T10:00:00+08:00', updated_at: '2026-06-16T10:00:00+08:00' },
    ]);
    mockCreateTeamRole.mockResolvedValue({});
    mockPatchTeamRole.mockResolvedValue({});
    mockDeleteTeamRole.mockResolvedValue({});
  });

  it('loads team roles and triggers create / edit / delete actions for the selected team', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <TeamRolesPage />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(mockListTeams).toHaveBeenCalledWith({ page: 1, page_size: 100 });
      expect(mockListTeamRoles).toHaveBeenCalledWith({ team_id: 3 });
      expect(mockListTeamBindings).toHaveBeenCalledWith({ team_id: 3 });
      expect(screen.getAllByText('团队运营').length).toBeGreaterThan(0);
    });

    expect(screen.queryByText('角色概览')).not.toBeInTheDocument();
    expect(screen.queryByText('角色覆盖情况')).not.toBeInTheDocument();
    expect(screen.queryByText('团队角色不是权限清单，而是团队职责的业务化映射')).not.toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: '授权' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '新建角色' }));
    fireEvent.change(screen.getByLabelText('角色名称'), { target: { value: '团队财务' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'OK' }).at(-1)!);

    await waitFor(() => {
      expect(mockCreateTeamRole).toHaveBeenCalledWith({ team_id: 3 }, expect.objectContaining({ name: '团队财务' }));
    });

    fireEvent.click(screen.getByText('编辑'));
    fireEvent.change(screen.getByLabelText('角色名称'), { target: { value: '团队运营主管' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'OK' }).at(-1)!);

    await waitFor(() => {
      expect(mockPatchTeamRole).toHaveBeenCalledWith({ team_id: 3, role_id: 4 }, expect.objectContaining({ name: '团队运营主管' }));
    });

    fireEvent.click(screen.getByText('删除'));
    fireEvent.click(screen.getAllByRole('button', { name: 'OK' }).at(-1)!);

    await waitFor(() => {
      expect(mockDeleteTeamRole).toHaveBeenCalledWith({ team_id: 3, role_id: 4 });
    });
  });
});
