import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AccessOverviewPage from './index';

const {
  mockListOrgRoles,
  mockListOrgBindings,
  mockListTeams,
  mockListMembers,
} = vi.hoisted(() => ({
  mockListOrgRoles: vi.fn(),
  mockListOrgBindings: vi.fn(),
  mockListTeams: vi.fn(),
  mockListMembers: vi.fn(),
}));

vi.mock('@/pages/tenant/shared', () => ({
  TenantSelectionGuard: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useTenantWorkspace: () => ({ selectedOrgSlug: 'acme', queryClient: { invalidateQueries: vi.fn() } }),
}));

vi.mock('@/services/openapi/accessOrganizationRoles', () => ({
  appsAccessApiListOrgRoles: mockListOrgRoles,
}));

vi.mock('@/services/openapi/accessOrganizationBindings', () => ({
  appsAccessApiListOrganizationBindings: mockListOrgBindings,
}));

vi.mock('@/services/openapi/teams', () => ({
  appsTeamsApiListTeams: mockListTeams,
}));

vi.mock('@/services/openapi/organizationMembers', () => ({
  appsOrganizationsApiListMembers: mockListMembers,
}));

describe('AccessOverviewPage', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    mockListOrgRoles.mockResolvedValue([
      { id: 1, code: 'owner', name: 'Owner', scope: 'org', is_system: true, is_active: true, permission_keys: ['organizations.member.view'] },
      { id: 2, code: 'ops', name: '运营', scope: 'org', is_system: false, is_active: true, permission_keys: [] },
    ]);
    mockListOrgBindings.mockResolvedValue([
      { id: 9, user: { id: 7, username: 'alice', first_name: 'Alice', last_name: 'Zhang' }, role: { id: 2, name: '运营', code: 'ops', scope: 'org' }, created_at: '2026-06-16T10:00:00+08:00', updated_at: '2026-06-16T10:00:00+08:00' },
    ]);
    mockListTeams.mockResolvedValue({
      items: [
        { id: 3, name: 'Growth', members: [7, 8], member_details: [] },
        { id: 4, name: 'Supply', members: [9], member_details: [] },
      ],
      total: 2,
      page: 1,
      page_size: 100,
    });
    mockListMembers.mockResolvedValue({
      items: [
        { pk: 1, user: { id: 7, username: 'alice', first_name: 'Alice', last_name: 'Zhang' } },
        { pk: 2, user: { id: 8, username: 'bob', first_name: 'Bob', last_name: 'Li' } },
      ],
      total: 2,
      page: 1,
      page_size: 100,
    });
  });

  it('renders the access governance overview with space and team governance sections', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <AccessOverviewPage />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(mockListOrgRoles).toHaveBeenCalled();
      expect(mockListOrgBindings).toHaveBeenCalled();
      expect(mockListTeams).toHaveBeenCalledWith({ page: 1, page_size: 100 });
      expect(mockListMembers).toHaveBeenCalledWith({ page: 1, page_size: 100 });
      expect(screen.getByText('权限概览')).toBeInTheDocument();
    });

    expect(screen.getByText('空间级治理')).toBeInTheDocument();
    expect(screen.getByText('团队级治理')).toBeInTheDocument();
    expect(screen.queryByText('关键提醒')).not.toBeInTheDocument();
    expect(screen.getAllByText('空间角色').length).toBeGreaterThan(0);
    expect(screen.getAllByText('空间授权').length).toBeGreaterThan(0);
    expect(screen.getAllByText('团队角色').length).toBeGreaterThan(0);
    expect(screen.getAllByText('团队授权').length).toBeGreaterThan(0);
  });
});
