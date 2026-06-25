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
  mockListMembers,
  mockSearchMembers,
  mockWorkspace,
} = vi.hoisted(() => ({
  mockListInvites: vi.fn(),
  mockCreateInvite: vi.fn(),
  mockResendInvite: vi.fn(),
  mockDeleteInvite: vi.fn(),
  mockGetInvite: vi.fn(),
  mockListMembers: vi.fn(),
  mockSearchMembers: vi.fn(),
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

vi.mock('@/services/openapi/organizationMembers', () => ({
  appsOrganizationsApiListMembers: mockListMembers,
  appsOrganizationsApiSearchMembers: mockSearchMembers,
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
        {
          pk: 3,
          organization: 1,
          sender: 7,
          invitee: 8,
          invitee_email: null,
          is_owner: true,
          key: 'invite-key-2',
          created_at: '2026-06-24T11:00:00+08:00',
          updated_at: '2026-06-24T11:00:00+08:00',
        },
      ],
      total: 2,
      page: 1,
      page_size: 100,
    });
    mockListMembers.mockResolvedValue({
      items: [
        {
          pk: 1,
          organization: 1,
          is_owner: true,
          created_at: '2026-06-15T10:00:00+08:00',
          updated_at: '2026-06-15T10:00:00+08:00',
          user: { id: 7, username: 'alice', first_name: 'Alice', last_name: 'Zhang', email: 'alice@example.com' },
        },
      ],
      total: 1,
      page: 1,
      page_size: 100,
    });
    mockSearchMembers.mockResolvedValue([
      {
        pk: 8,
        username: 'bob',
        first_name: 'Bob',
        last_name: 'Li',
        email: 'bob@example.com',
      },
    ]);
    mockCreateInvite.mockResolvedValue({});
    mockResendInvite.mockResolvedValue({});
    mockDeleteInvite.mockResolvedValue({});
  });

  it('renders governance overview and triggers create / resend / delete actions', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <TenantInvitesPage />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(mockListInvites).toHaveBeenCalledWith({ page: 1, page_size: 100 });
      expect(mockListMembers).toHaveBeenCalledWith({ page: 1, page_size: 100 });
      expect(screen.getAllByText('member@example.com').length).toBeGreaterThan(0);
    });

    expect(screen.getByText('邀请治理概览')).toBeInTheDocument();
    expect(screen.getByText('当前邀请执行面')).toBeInTheDocument();
    expect(screen.getByText('闭环信号')).toBeInTheDocument();
    expect(screen.getByText('邀请治理台账')).toBeInTheDocument();
    expect(screen.getByText('1 条 Owner 预设邀请')).toBeInTheDocument();
    expect(screen.getByText('1 条长时间未处理')).toBeInTheDocument();

    fireEvent.click(screen.getAllByText('重发')[0]!);

    await waitFor(() => {
      expect(mockResendInvite).toHaveBeenCalledWith({ invite_id: 2 });
    });

    fireEvent.click(screen.getAllByText('取消')[0]!);
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));

    await waitFor(() => {
      expect(mockDeleteInvite).toHaveBeenCalledWith({ invite_id: 2 });
    });

    fireEvent.click(screen.getAllByText('新建邀请')[0]!);
    fireEvent.change(screen.getByLabelText('邀请邮箱'), {
      target: { value: 'new@example.com' },
    });
    fireEvent.click(screen.getAllByRole('button', { name: 'OK' }).at(-1)!);

    await waitFor(() => {
      expect(mockCreateInvite).toHaveBeenCalledWith({
        invitee_email: 'new@example.com',
      });
      expect(mockWorkspace.queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['tenant', 'invites'] });
    });
  });
});
