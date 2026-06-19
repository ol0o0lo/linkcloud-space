import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import TeamRolesPage from './index';

const {
  mockListPermissions,
  mockListTeams,
  mockListTeamRoles,
  mockCreateTeamRole,
  mockPatchTeamRole,
  mockDeleteTeamRole,
} = vi.hoisted(() => ({
  mockListPermissions: vi.fn(),
  mockListTeams: vi.fn(),
  mockListTeamRoles: vi.fn(),
  mockCreateTeamRole: vi.fn(),
  mockPatchTeamRole: vi.fn(),
  mockDeleteTeamRole: vi.fn(),
}));

vi.mock('@/pages/tenant/shared', () => ({
  TenantSelectionGuard: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TenantSectionHint: ({ text }: { text: string }) => <div>{text}</div>,
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
      { id: 4, code: 'team_ops', name: '团队运营', scope: 'team', is_system: false, is_active: true, permission_keys: [] },
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
      expect(screen.getByText('团队运营')).toBeInTheDocument();
    });

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
