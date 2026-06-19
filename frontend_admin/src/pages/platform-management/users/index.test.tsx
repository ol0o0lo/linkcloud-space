import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PlatformUsersPage from './index';

const {
  mockListUsers,
  mockPatchStatus,
  mockForceLogout,
  mockResetMfa,
  mockCreateUser,
  mockPatchUser,
  mockSetPassword,
  mockUnbindPhone,
  mockUnbindWechat,
} = vi.hoisted(() => ({
  mockListUsers: vi.fn(),
  mockPatchStatus: vi.fn(),
  mockForceLogout: vi.fn(),
  mockResetMfa: vi.fn(),
  mockCreateUser: vi.fn(),
  mockPatchUser: vi.fn(),
  mockSetPassword: vi.fn(),
  mockUnbindPhone: vi.fn(),
  mockUnbindWechat: vi.fn(),
}));

vi.mock('@/services/openapi/userAdmin', () => ({
  appsAccountsApiListAdminUsers: mockListUsers,
  appsAccountsApiCreateAdminUser: mockCreateUser,
  appsAccountsApiPatchAdminUser: mockPatchUser,
  appsAccountsApiPatchUserStatus: mockPatchStatus,
  appsAccountsApiForceLogoutUser: mockForceLogout,
  appsAccountsApiResetUserMfa: mockResetMfa,
  appsAccountsApiSetAdminUserPassword: mockSetPassword,
  appsAccountsApiUnbindUserPhone: mockUnbindPhone,
  appsAccountsApiUnbindUserWechat: mockUnbindWechat,
}));

describe('PlatformUsersPage', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    mockListUsers.mockResolvedValue({
      items: [{ id: 7, username: 'alice', email: 'alice@example.com', first_name: 'Alice', last_name: 'Zhang', timezone: 'Asia/Shanghai', phone_verified: true, is_active: true, is_staff: true, is_superuser: false }],
      total: 1,
      page: 1,
      page_size: 10,
    });
    mockPatchStatus.mockResolvedValue({});
    mockForceLogout.mockResolvedValue({});
    mockResetMfa.mockResolvedValue({});
    mockCreateUser.mockResolvedValue({});
    mockPatchUser.mockResolvedValue({});
    mockSetPassword.mockResolvedValue({});
    mockUnbindPhone.mockResolvedValue({});
    mockUnbindWechat.mockResolvedValue({});
  });

  it('loads admin users and triggers lifecycle actions', async () => {
    render(<QueryClientProvider client={queryClient}><PlatformUsersPage /></QueryClientProvider>);

    await waitFor(() => {
      expect(mockListUsers).toHaveBeenCalledWith({ page: 1, page_size: 10 });
      expect(screen.getByText('alice')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('禁用'));
    await waitFor(() => expect(mockPatchStatus).toHaveBeenCalledWith({ user_id: 7 }, { is_active: false }));

    fireEvent.click(screen.getByText('强退'));
    await waitFor(() => expect(mockForceLogout).toHaveBeenCalledWith({ user_id: 7 }));

    fireEvent.click(screen.getByText('重置 MFA'));
    await waitFor(() => expect(mockResetMfa).toHaveBeenCalledWith({ user_id: 7 }));
  });
});
