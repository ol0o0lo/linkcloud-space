import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import TenantInvitesPage from './index';

const {
  mockListInvites,
  mockCreateInvite,
  mockResendInvite,
  mockDeleteInvite,
  mockGetInvite,
  mockWorkspace,
} = vi.hoisted(() => ({
  mockListInvites: vi.fn(),
  mockCreateInvite: vi.fn(),
  mockResendInvite: vi.fn(),
  mockDeleteInvite: vi.fn(),
  mockGetInvite: vi.fn(),
  mockWorkspace: {
    selectedOrgSlug: 'acme',
    queryClient: { invalidateQueries: vi.fn() },
  },
}));

vi.mock('../shared', () => ({
  TenantSelectionGuard: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TenantSectionHint: ({ text }: { text: string }) => <div>{text}</div>,
  tenantQueryKeys: {
    invites: (slug?: string, page?: number) => ['tenant', 'invites', slug, page],
  },
  useTenantWorkspace: () => mockWorkspace,
}));

vi.mock('@/services/openapi/organizationInvites', () => ({
  appsOrganizationsApiListInvites: mockListInvites,
  appsOrganizationsApiCreateInvite: mockCreateInvite,
  appsOrganizationsApiResendInvite: mockResendInvite,
  appsOrganizationsApiDeleteInvite: mockDeleteInvite,
  appsOrganizationsApiGetInvite: mockGetInvite,
}));

describe('TenantInvitesPage', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    mockGetInvite.mockResolvedValue({
      pk: 2,
      organization: 1,
      sender: 7,
      invitee: null,
      invitee_email: 'member@example.com',
      is_owner: false,
      key: 'invite-key',
      created_at: '2026-06-15T11:00:00+08:00',
      updated_at: '2026-06-15T11:00:00+08:00',
    });

    mockListInvites.mockResolvedValue({
      items: [
        {
          pk: 2,
          organization: 1,
          sender: 7,
          invitee: null,
          invitee_email: 'member@example.com',
          is_owner: false,
          key: 'invite-key',
          created_at: '2026-06-15T11:00:00+08:00',
          updated_at: '2026-06-15T11:00:00+08:00',
        },
      ],
      total: 1,
      page: 1,
      page_size: 10,
    });
    mockCreateInvite.mockResolvedValue({});
    mockResendInvite.mockResolvedValue({});
    mockDeleteInvite.mockResolvedValue({});
  });

  it('loads invites and triggers create / resend / delete actions', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <TenantInvitesPage />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(mockListInvites).toHaveBeenCalledWith({ page: 1, page_size: 10 });
      expect(screen.getByText('member@example.com')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('重发'));

    await waitFor(() => {
      expect(mockResendInvite).toHaveBeenCalledWith({ invite_id: 2 });
    });

    fireEvent.click(screen.getByText('取消'));
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));

    await waitFor(() => {
      expect(mockDeleteInvite).toHaveBeenCalledWith({ invite_id: 2 });
    });

    fireEvent.click(screen.getByText('新建邀请'));
    fireEvent.change(screen.getByLabelText('邀请邮箱'), {
      target: { value: 'new@example.com' },
    });
    fireEvent.click(screen.getAllByRole('button', { name: 'OK' }).at(-1)!);

    await waitFor(() => {
      expect(mockCreateInvite).toHaveBeenCalledWith({
        invitee_email: 'new@example.com',
      });
    });
  });
});
