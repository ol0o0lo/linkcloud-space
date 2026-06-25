import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import TenantMembersPage from './index';

const {
  mockListMembers,
  mockCreateMember,
  mockPatchMember,
  mockDeleteMember,
  mockSearchMembers,
  mockGetMember,
  mockListTeams,
  mockListOrganizationBindings,
  mockListTeamBindings,
  mockWorkspace,
} = vi.hoisted(() => ({
  mockListMembers: vi.fn(),
  mockCreateMember: vi.fn(),
  mockPatchMember: vi.fn(),
  mockDeleteMember: vi.fn(),
  mockSearchMembers: vi.fn(),
  mockGetMember: vi.fn(),
  mockListTeams: vi.fn(),
  mockListOrganizationBindings: vi.fn(),
  mockListTeamBindings: vi.fn(),
  mockWorkspace: {
    selectedOrgSlug: 'acme',
    queryClient: { invalidateQueries: vi.fn() },
  },
}));

vi.mock('../shared', () => ({
  TenantSelectionGuard: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TenantSectionHint: ({ text }: { text: string }) => <div>{text}</div>,
  formatPersonLabel: (user: { username?: string; first_name?: string; last_name?: string }) =>
    [user.first_name, user.last_name].filter(Boolean).join(' ') || user.username || '未知用户',
  tenantQueryKeys: {
    members: (slug?: string, page?: number, q?: string) => ['tenant', 'members', slug, page, q],
  },
  useTenantWorkspace: () => mockWorkspace,
}));

vi.mock('@/services/openapi/teams', () => ({
  appsTeamsApiListTeams: mockListTeams,
}));

vi.mock('@/services/openapi/accessOrganizationBindings', () => ({
  appsAccessApiListOrganizationBindings: mockListOrganizationBindings,
}));

vi.mock('@/services/openapi/accessTeamBindings', () => ({
  appsAccessApiListTeamBindingsView: mockListTeamBindings,
}));

vi.mock('@/services/openapi/organizationMembers', () => ({
  appsOrganizationsApiListMembers: mockListMembers,
  appsOrganizationsApiCreateMember: mockCreateMember,
  appsOrganizationsApiPatchMember: mockPatchMember,
  appsOrganizationsApiDeleteMember: mockDeleteMember,
  appsOrganizationsApiSearchMembers: mockSearchMembers,
  appsOrganizationsApiGetMember: mockGetMember,
}));

describe('TenantMembersPage', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    mockListMembers.mockResolvedValue({
      items: [
        {
          pk: 1,
          organization: 1,
          is_owner: true,
          created_at: '2026-06-15T10:00:00+08:00',
          updated_at: '2026-06-15T10:00:00+08:00',
          user: {
            id: 7,
            username: 'alice',
            first_name: 'Alice',
            last_name: 'Zhang',
            email: 'alice@example.com',
          },
        },
        {
          pk: 2,
          organization: 1,
          is_owner: false,
          created_at: '2026-06-16T11:00:00+08:00',
          updated_at: '2026-06-16T11:00:00+08:00',
          user: {
            id: 8,
            username: 'bob',
            first_name: 'Bob',
            last_name: 'Li',
            email: 'bob@example.com',
          },
        },
      ],
      total: 2,
      page: 1,
      page_size: 100,
    });
    mockSearchMembers.mockResolvedValue([]);
    mockGetMember.mockResolvedValue({
      pk: 1,
      organization: 1,
      is_owner: true,
      created_at: '2026-06-15T10:00:00+08:00',
      updated_at: '2026-06-15T10:00:00+08:00',
      user: { id: 7, username: 'alice', first_name: 'Alice', last_name: 'Zhang', email: 'alice@example.com' },
    });
    mockListTeams.mockResolvedValue({
      items: [
        {
          id: 3,
          name: 'Growth',
          members: [7],
          member_details: [{ id: 7, username: 'alice', first_name: 'Alice', last_name: 'Zhang' }],
          created_at: '2026-06-15T12:00:00+08:00',
          updated_at: '2026-06-15T12:00:00+08:00',
        },
      ],
      total: 1,
      page: 1,
      page_size: 100,
    });
    mockListOrganizationBindings.mockResolvedValue([
      {
        id: 9,
        organization_id: 1,
        user: { id: 7, username: 'alice', first_name: 'Alice', last_name: 'Zhang' },
        role: { id: 1, code: 'owner', name: 'Owner', scope: 'org' },
        created_at: '2026-06-16T09:00:00+08:00',
        updated_at: '2026-06-16T09:00:00+08:00',
      },
    ]);
    mockListTeamBindings.mockResolvedValue([
      {
        id: 11,
        team_id: 3,
        user: { id: 7, username: 'alice', first_name: 'Alice', last_name: 'Zhang' },
        role: { id: 2, code: 'ops', name: '资料运营', scope: 'team' },
        created_at: '2026-06-16T10:00:00+08:00',
        updated_at: '2026-06-16T10:00:00+08:00',
      },
    ]);
    mockPatchMember.mockResolvedValue({});
    mockDeleteMember.mockResolvedValue({});
    mockCreateMember.mockResolvedValue({});
  });

  it('renders governance overview and triggers owner toggle / delete actions', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <TenantMembersPage />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(mockListMembers).toHaveBeenCalledWith({ page: 1, page_size: 100 });
      expect(mockListTeams).toHaveBeenCalledWith({ page: 1, page_size: 100 });
      expect(screen.getByText('Alice Zhang')).toBeInTheDocument();
    });

    expect(screen.getByText('成员治理概览')).toBeInTheDocument();
    expect(screen.getAllByText('当前成员执行面').length).toBeGreaterThan(0);
    expect(screen.getByText('闭环信号')).toBeInTheDocument();
    expect(screen.getByText('成员治理台账')).toBeInTheDocument();
    expect(screen.getByText('1 人未纳入团队')).toBeInTheDocument();
    expect(screen.getByText('1 人待补职责')).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('switch')[0]!);

    await waitFor(() => {
      expect(mockPatchMember).toHaveBeenCalledWith({ member_id: 1 }, { is_owner: false });
      expect(mockWorkspace.queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['tenant', 'members'] });
    });

    fireEvent.click(screen.getAllByText('移除')[0]!);
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));

    await waitFor(() => {
      expect(mockDeleteMember).toHaveBeenCalledWith({ member_id: 1 });
      expect(mockWorkspace.queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['tenant', 'members'] });
    });
  });
});
