import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import InvitationAcceptPage from './index';

const {
  mockGetInviteByKey,
  mockAcceptInviteByKey,
  mockDeclineInviteByKey,
  mockHistoryPush,
  mockSetInitialState,
  mockSwitchList,
} = vi.hoisted(() => ({
  mockGetInviteByKey: vi.fn(),
  mockAcceptInviteByKey: vi.fn(),
  mockDeclineInviteByKey: vi.fn(),
  mockHistoryPush: vi.fn(),
  mockSetInitialState: vi.fn(),
  mockSwitchList: vi.fn(),
}));

vi.mock('@umijs/max', () => ({
  history: { push: mockHistoryPush },
  useModel: () => ({ setInitialState: mockSetInitialState }),
  useParams: () => ({ key: 'invite-key' }),
}));

vi.mock('@/components/PageContainer', () => ({
  PageContainer: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

vi.mock('@/services/openapi/publicOrganizationInvites', () => ({
  appsOrganizationsApiGetInviteByKey: mockGetInviteByKey,
  appsOrganizationsApiAcceptInviteByKey: mockAcceptInviteByKey,
  appsOrganizationsApiDeclineInviteByKey: mockDeclineInviteByKey,
}));

vi.mock('@/services/openapi/organizations', () => ({
  appsOrganizationsApiSwitchList: mockSwitchList,
}));

vi.mock('@/services/manual/navigationAccess', () => ({
  getNavigationAccessCapabilities: vi.fn().mockResolvedValue({}),
}));

vi.mock('@/services/manual/teamOperations', () => ({
  getTeamOperationsCapabilities: vi.fn().mockResolvedValue({}),
}));

describe('InvitationAcceptPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetInviteByKey.mockResolvedValue({
      organization_name: 'LAN',
      sender_name: '空间管理员',
      invitee_email: '',
      invitee_phone: '+8613800138000',
      is_expired: false,
      is_already_member: false,
    });
    mockAcceptInviteByKey.mockResolvedValue({ success: true });
    mockDeclineInviteByKey.mockResolvedValue({ success: true });
    mockSwitchList.mockResolvedValue([
      {
        id: 1,
        name: 'LAN',
        slug: 'lan',
        is_primary: false,
        is_current: true,
      },
    ]);
  });

  it('shows a phone invitation and accepts it without an invitation code', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <InvitationAcceptPage />
      </QueryClientProvider>,
    );

    expect(await screen.findByText('加入空间 LAN')).toBeInTheDocument();
    expect(screen.getByText('手机号：+8613800138000')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '接受邀请' }));

    await waitFor(() => {
      expect(mockAcceptInviteByKey).toHaveBeenCalledWith({ key: 'invite-key' });
    });
    expect(await screen.findByText('已加入空间')).toBeInTheDocument();
    expect(mockSwitchList).toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: '进入空间' }));
    expect(mockHistoryPush).toHaveBeenCalledWith('/space/organization');
  });

  it('可以拒绝邀请并展示完成状态', async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <InvitationAcceptPage />
      </QueryClientProvider>,
    );

    fireEvent.click(await screen.findByRole('button', { name: '拒绝邀请' }));
    const confirmButtons = await screen.findAllByRole('button', {
      name: '拒绝邀请',
    });
    fireEvent.click(confirmButtons.at(-1) as HTMLButtonElement);

    await waitFor(() => {
      expect(mockDeclineInviteByKey).toHaveBeenCalledWith({
        key: 'invite-key',
      });
    });
    expect(await screen.findByText('已拒绝邀请')).toBeInTheDocument();
  });

  it('未登录处理邀请时跳到登录页并保留邀请地址', async () => {
    mockAcceptInviteByKey.mockRejectedValueOnce({
      response: { status: 401 },
    });

    render(
      <QueryClientProvider client={new QueryClient()}>
        <InvitationAcceptPage />
      </QueryClientProvider>,
    );

    fireEvent.click(await screen.findByRole('button', { name: '接受邀请' }));

    await waitFor(() => {
      expect(mockHistoryPush).toHaveBeenCalledWith(
        '/user/login?redirect=%2Finvitations%2Finvite-key',
      );
    });
  });

  it('已有成员进入空间前也会同步目标空间', async () => {
    mockGetInviteByKey.mockResolvedValueOnce({
      organization_name: 'LAN',
      sender_name: '空间管理员',
      invitee_email: 'member@example.com',
      invitee_phone: '',
      is_expired: false,
      is_already_member: true,
    });

    render(
      <QueryClientProvider client={new QueryClient()}>
        <InvitationAcceptPage />
      </QueryClientProvider>,
    );

    fireEvent.click(await screen.findByRole('button', { name: '进入空间' }));

    await waitFor(() => {
      expect(mockAcceptInviteByKey).toHaveBeenCalledWith({ key: 'invite-key' });
      expect(mockSwitchList).toHaveBeenCalled();
      expect(mockHistoryPush).toHaveBeenCalledWith('/space/organization');
    });
  });
});
