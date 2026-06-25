import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import TeamBindingsPage from './index';

const {
  mockListTeams,
  mockListMembers,
  mockListRoles,
  mockListBindings,
  mockCreateBinding,
  mockDeleteBinding,
} = vi.hoisted(() => ({
  mockListTeams: vi.fn(),
  mockListMembers: vi.fn(),
  mockListRoles: vi.fn(),
  mockListBindings: vi.fn(),
  mockCreateBinding: vi.fn(),
  mockDeleteBinding: vi.fn(),
}));

vi.mock('@/pages/tenant/shared', () => ({
  TenantSelectionGuard: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TenantSectionHint: ({ text }: { text: string }) => <div>{text}</div>,
  formatPersonLabel: (user: { username?: string; first_name?: string; last_name?: string }) => [user.first_name, user.last_name].filter(Boolean).join(' ') || user.username || '未知用户',
  useTenantWorkspace: () => ({ selectedOrgSlug: 'acme', queryClient: { invalidateQueries: vi.fn() } }),
}));

vi.mock('@/services/openapi/teams', () => ({
  appsTeamsApiListTeams: mockListTeams,
}));

vi.mock('@/services/openapi/organizationMembers', () => ({
  appsOrganizationsApiListMembers: mockListMembers,
}));

vi.mock('@/services/openapi/accessTeamRoles', () => ({
  appsAccessApiListTeamRoles: mockListRoles,
}));

vi.mock('@/services/openapi/accessTeamBindings', () => ({
  appsAccessApiListTeamBindingsView: mockListBindings,
  appsAccessApiCreateTeamBinding: mockCreateBinding,
  appsAccessApiDeleteTeamBinding: mockDeleteBinding,
}));

describe('TeamBindingsPage', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    mockListTeams.mockResolvedValue({ items: [{ id: 3, name: 'Growth' }], total: 1, page: 1, page_size: 100 });
    mockListRoles.mockResolvedValue([{ id: 4, name: '团队运营', code: 'team_ops', scope: 'team', is_active: true, is_system: false, permission_keys: [] }]);
    mockListMembers.mockResolvedValue({ items: [{ pk: 1, user: { id: 7, username: 'alice', first_name: 'Alice', last_name: 'Zhang' } }] });
    mockListBindings.mockResolvedValue([{ id: 12, user: { id: 7, username: 'alice', first_name: 'Alice', last_name: 'Zhang' }, role: { id: 4, name: '团队运营', code: 'team_ops', scope: 'team' }, created_at: '2026-06-16T10:00:00+08:00', updated_at: '2026-06-16T10:00:00+08:00' }]);
    mockCreateBinding.mockResolvedValue({});
    mockDeleteBinding.mockResolvedValue({});
  });

  it('loads team bindings and triggers assign / delete actions for the selected team', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <TeamBindingsPage />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(mockListBindings).toHaveBeenCalledWith({ team_id: 3 });
      expect(mockListRoles).toHaveBeenCalledWith({ team_id: 3 });
      expect(mockListMembers).toHaveBeenCalledWith({ page: 1, page_size: 100 });
      expect(screen.getAllByText('Alice Zhang').length).toBeGreaterThan(0);
    });

    expect(screen.getByText('授权概览')).toBeInTheDocument();
    expect(screen.getByText('角色覆盖与待分配')).toBeInTheDocument();
    expect(screen.getByText('闭环信号')).toBeInTheDocument();
    expect(screen.getByText('团队授权台账')).toBeInTheDocument();
    expect(screen.getAllByText('待分配成员').length).toBeGreaterThan(0);
    expect(screen.getByText('执行承接')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '分配角色' }));
    fireEvent.mouseDown(screen.getByLabelText('成员').closest('.ant-select')!);
    fireEvent.click(await screen.findByText('Alice Zhang (alice)'));
    fireEvent.mouseDown(screen.getByLabelText('角色').closest('.ant-select')!);
    fireEvent.click(screen.getAllByText('团队运营').at(-1)!);
    fireEvent.click(screen.getAllByRole('button', { name: 'OK' }).at(-1)!);

    await waitFor(() => {
      expect(mockCreateBinding).toHaveBeenCalledWith({ team_id: 3 }, { user: 7, role: 4 });
    });

    fireEvent.click(screen.getByText('移除'));
    fireEvent.click(screen.getAllByRole('button', { name: 'OK' }).at(-1)!);

    await waitFor(() => {
      expect(mockDeleteBinding).toHaveBeenCalledWith({ team_id: 3, binding_id: 12 });
    });
  });
});
