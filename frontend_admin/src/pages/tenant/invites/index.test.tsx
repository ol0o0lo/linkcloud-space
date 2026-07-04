import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import TenantInvitesPage, { buildInvitePayload } from './index';

const {
  mockListInvites,
  mockCreateInvite,
  mockResendInvite,
  mockDeleteInvite,
  mockGetInvite,
  mockSearchMembers,
  mockListOrgRoles,
  mockWorkspace,
} = vi.hoisted(() => ({
  mockListInvites: vi.fn(),
  mockCreateInvite: vi.fn(),
  mockResendInvite: vi.fn(),
  mockDeleteInvite: vi.fn(),
  mockGetInvite: vi.fn(),
  mockSearchMembers: vi.fn(),
  mockListOrgRoles: vi.fn(),
  mockWorkspace: {
    selectedOrgSlug: 'acme',
    queryClient: { invalidateQueries: vi.fn() },
  },
}));

vi.mock('../shared', () => ({
  TenantSelectionGuard: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  tenantQueryKeys: {
    invites: (slug?: string, page?: number) => [
      'tenant',
      'invites',
      slug,
      page,
    ],
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
  appsOrganizationsApiSearchMembers: mockSearchMembers,
}));

vi.mock('@/services/openapi/accessOrganizationRoles', () => ({
  appsAccessApiListOrgRoles: mockListOrgRoles,
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
    mockSearchMembers.mockResolvedValue([
      {
        pk: 8,
        username: 'bob',
        first_name: 'Bob',
        last_name: 'Li',
        email: 'bob@example.com',
      },
    ]);
    mockListOrgRoles.mockResolvedValue([
      {
        id: 11,
        code: 'data_manager',
        name: '资料管理员',
        scope: 'org',
        is_system: true,
        is_active: true,
        organization_id: null,
        permission_keys: [],
      },
    ]);
    mockCreateInvite.mockResolvedValue({});
    mockResendInvite.mockResolvedValue({});
    mockDeleteInvite.mockResolvedValue({});
  });

  it('builds invite payloads without duplicating access role handling', () => {
    expect(
      buildInvitePayload('email', {
        invitee_email: 'member@example.com',
        access_role: 11,
      }),
    ).toEqual({
      invitee_email: 'member@example.com',
      access_role: 11,
    });
    expect(
      buildInvitePayload('internal', { invitee: 8, access_role: 11 }),
    ).toEqual({
      invitee: 8,
      access_role: 11,
    });
    expect(
      buildInvitePayload('email', { invitee_email: 'member@example.com' }),
    ).toEqual({
      invitee_email: 'member@example.com',
    });
  });

  it('renders invite tools and triggers create / resend / delete actions', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <TenantInvitesPage />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(mockListInvites).toHaveBeenCalledWith({ page: 1, page_size: 100 });
      expect(screen.getAllByText('member@example.com').length).toBeGreaterThan(
        0,
      );
    });

    expect(screen.queryByText('邀请概览')).not.toBeInTheDocument();
    expect(screen.queryByText('当前邀请')).not.toBeInTheDocument();
    expect(screen.queryByText('邀请详情')).not.toBeInTheDocument();
    expect(screen.queryByText('设为当前')).not.toBeInTheDocument();
    expect(screen.queryByText('邀请状态')).not.toBeInTheDocument();
    expect(screen.queryByText('关键提醒')).not.toBeInTheDocument();
    expect(screen.getByText('邀请列表')).toBeInTheDocument();
    expect(screen.queryByText('邀请治理概览')).not.toBeInTheDocument();
    expect(screen.queryByText('当前邀请执行面')).not.toBeInTheDocument();
    expect(screen.queryByText('闭环信号')).not.toBeInTheDocument();
    expect(screen.queryByText('邀请治理台账')).not.toBeInTheDocument();
    expect(screen.queryByText('1 条 Owner 预设邀请')).not.toBeInTheDocument();
    expect(screen.queryByText('1 条长时间未处理')).not.toBeInTheDocument();
    expect(
      screen.queryByText(
        '邀请已经发出，下一步确认对方是否加入，以及加入后进入哪个团队。',
      ),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(
        '接受后会直接成为 owner，请确认对方确实需要管理空间。',
      ),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('管理员预设邀请')).not.toBeInTheDocument();
    expect(screen.getAllByText('管理员').length).toBeGreaterThan(0);
    expect(screen.queryByText(/Owner|owner/)).not.toBeInTheDocument();

    fireEvent.click(screen.getAllByText('重发').at(0) as HTMLElement);

    await waitFor(() => {
      expect(mockResendInvite).toHaveBeenCalledWith({ invite_id: 2 });
    });

    fireEvent.click(screen.getAllByText('取消').at(0) as HTMLElement);
    fireEvent.click(
      screen.getAllByRole('button', { name: 'OK' }).at(-1) as HTMLElement,
    );

    await waitFor(() => {
      expect(mockDeleteInvite).toHaveBeenCalledWith({ invite_id: 2 });
    });

    fireEvent.click(screen.getAllByText('新建邀请').at(0) as HTMLElement);
    fireEvent.change(screen.getByLabelText('邀请邮箱'), {
      target: { value: 'new@example.com' },
    });
    expect(screen.queryByText('接受后设为管理员')).not.toBeInTheDocument();
    fireEvent.mouseDown(
      screen.getByLabelText('预设权限').closest('.ant-select') as HTMLElement,
    );
    fireEvent.click(await screen.findByText('资料管理员'));
    fireEvent.click(
      screen.getAllByRole('button', { name: 'OK' }).at(-1) as HTMLElement,
    );

    await waitFor(() => {
      expect(mockCreateInvite).toHaveBeenCalledWith({
        invitee_email: 'new@example.com',
        access_role: 11,
      });
      expect(mockWorkspace.queryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: ['tenant', 'invites'],
      });
    });
  });

  it('searches candidates when the internal invite select opens', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <TenantInvitesPage />
      </QueryClientProvider>,
    );

    fireEvent.click(screen.getAllByText('新建邀请').at(0) as HTMLElement);
    fireEvent.click(screen.getByText('站内用户邀请'));

    expect(screen.queryByText('搜索候选用户')).not.toBeInTheDocument();
    fireEvent.mouseDown(
      screen.getByLabelText('邀请人员').closest('.ant-select') as HTMLElement,
    );

    await waitFor(() => {
      expect(mockSearchMembers).toHaveBeenCalledWith({ keyword: '' });
    });

    fireEvent.change(screen.getByLabelText('邀请人员'), {
      target: { value: 'bob' },
    });

    await waitFor(() => {
      expect(mockSearchMembers).toHaveBeenCalledWith({ keyword: 'bob' });
    });
    expect(
      screen.queryByText(
        '点开后显示候选用户，也可输入姓名、用户名或邮箱搜索。',
      ),
    ).not.toBeInTheDocument();
  });
});
