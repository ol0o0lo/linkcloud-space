import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import TenantTeamsPage from './index';

const {
  mockListTeams,
  mockCreateTeam,
  mockPatchTeam,
  mockDeleteTeam,
  mockGetTeam,
  mockListMembers,
  mockWorkspace,
} = vi.hoisted(() => ({
  mockListTeams: vi.fn(),
  mockCreateTeam: vi.fn(),
  mockPatchTeam: vi.fn(),
  mockDeleteTeam: vi.fn(),
  mockGetTeam: vi.fn(),
  mockListMembers: vi.fn(),
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
    teams: (slug?: string, page?: number, q?: string) => ['tenant', 'teams', slug, page, q],
    usage: (slug?: string) => ['tenant', 'usage', slug],
  },
  useTenantWorkspace: () => mockWorkspace,
}));

vi.mock('@/services/openapi/teams', () => ({
  appsTeamsApiListTeams: mockListTeams,
  appsTeamsApiCreateTeam: mockCreateTeam,
  appsTeamsApiPatchTeam: mockPatchTeam,
  appsTeamsApiDeleteTeam: mockDeleteTeam,
  appsTeamsApiGetTeam: mockGetTeam,
}));

vi.mock('@/services/openapi/organizationMembers', () => ({
  appsOrganizationsApiListMembers: mockListMembers,
}));

describe('TenantTeamsPage', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    mockGetTeam.mockResolvedValue({
      id: 3,
      name: 'Growth',
      members: [7],
      member_details: [{ id: 7, username: 'alice', first_name: 'Alice', last_name: 'Zhang' }],
      created_at: '2026-06-15T12:00:00+08:00',
      updated_at: '2026-06-15T12:00:00+08:00',
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
      page_size: 10,
    });
    mockListMembers.mockResolvedValue({
      items: [
        {
          pk: 1,
          user: { id: 7, username: 'alice', first_name: 'Alice', last_name: 'Zhang' },
        },
      ],
    });
    mockCreateTeam.mockResolvedValue({});
    mockPatchTeam.mockResolvedValue({});
    mockDeleteTeam.mockResolvedValue({});
  });

  it('loads teams and triggers create / edit / delete actions', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <TenantTeamsPage />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(mockListTeams).toHaveBeenCalledWith({ page: 1, page_size: 10, q: undefined });
      expect(screen.getByText('Growth')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('新建团队'));
    fireEvent.change(screen.getByLabelText('团队名称'), {
      target: { value: 'Support' },
    });
    fireEvent.click(screen.getAllByRole('button', { name: 'OK' }).at(-1)!);

    await waitFor(() => {
      expect(mockCreateTeam).toHaveBeenCalledWith(expect.objectContaining({ name: 'Support' }));
      expect(mockWorkspace.queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['tenant', 'teams'] });
      expect(mockWorkspace.queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['tenant', 'usage', 'acme'] });
    });

    fireEvent.click(screen.getByText('编辑'));
    fireEvent.change(screen.getByLabelText('团队名称'), {
      target: { value: 'Growth 2' },
    });
    fireEvent.click(screen.getAllByRole('button', { name: 'OK' }).at(-1)!);

    await waitFor(() => {
      expect(mockPatchTeam).toHaveBeenCalledWith({ team_id: 3 }, expect.objectContaining({ name: 'Growth 2' }));
    });

    fireEvent.click(screen.getByText('删除'));
    fireEvent.click(screen.getAllByRole('button', { name: 'OK' }).at(-1)!);

    await waitFor(() => {
      expect(mockDeleteTeam).toHaveBeenCalledWith({ team_id: 3 });
      expect(mockWorkspace.queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['tenant', 'usage', 'acme'] });
    });
  });
});
