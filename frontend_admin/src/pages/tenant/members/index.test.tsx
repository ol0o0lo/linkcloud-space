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
  mockWorkspace,
} = vi.hoisted(() => ({
  mockListMembers: vi.fn(),
  mockCreateMember: vi.fn(),
  mockPatchMember: vi.fn(),
  mockDeleteMember: vi.fn(),
  mockSearchMembers: vi.fn(),
  mockGetMember: vi.fn(),
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
      ],
      total: 1,
      page: 1,
      page_size: 10,
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
    mockPatchMember.mockResolvedValue({});
    mockDeleteMember.mockResolvedValue({});
    mockCreateMember.mockResolvedValue({});
  });

  it('loads member rows and triggers owner toggle / delete actions', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <TenantMembersPage />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(mockListMembers).toHaveBeenCalledWith({ page: 1, page_size: 10, q: undefined });
      expect(screen.getByText('Alice Zhang')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('switch'));

    await waitFor(() => {
      expect(mockPatchMember).toHaveBeenCalledWith({ member_id: 1 }, { is_owner: false });
    });

    fireEvent.click(screen.getByText('移除'));
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));

    await waitFor(() => {
      expect(mockDeleteMember).toHaveBeenCalledWith({ member_id: 1 });
    });
  });
});
