import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import InvitationAcceptPage from './index';

const { mockGetInviteByKey, mockAcceptInviteByKey } = vi.hoisted(() => ({
  mockGetInviteByKey: vi.fn(),
  mockAcceptInviteByKey: vi.fn(),
}));

vi.mock('@umijs/max', () => ({
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
  });
});
