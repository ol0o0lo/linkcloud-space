import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
      items: [
        {
          id: 7,
          username: 'alice',
          email: 'alice@example.com',
          first_name: 'Alice',
          last_name: 'Zhang',
          timezone: 'Asia/Shanghai',
          real_name_status: 'approved',
          phone_country_code: '+86',
          phone_national_number: '13800138000',
          phone_verified: true,
          is_active: true,
          is_staff: true,
          is_superuser: false,
        },
        {
          id: 8,
          username: 'bob',
          email: 'bob@example.com',
          first_name: 'Bob',
          last_name: 'Li',
          timezone: 'Asia/Shanghai',
          real_name_status: 'pending',
          phone_verified: false,
          is_active: true,
          is_staff: false,
          is_superuser: false,
        },
      ],
      total: 2,
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

  it('renders governance layout and triggers lifecycle actions', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <PlatformUsersPage />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(mockListUsers).toHaveBeenCalledWith({ page: 1, page_size: 10, q: undefined });
      expect(screen.getByText('用户概览')).toBeInTheDocument();
      expect(screen.getByText('用户详情')).toBeInTheDocument();
      expect(screen.queryByText('关键提醒')).not.toBeInTheDocument();
      expect(screen.getByText('用户列表')).toBeInTheDocument();
      expect(screen.getAllByText('高权限账号').length).toBeGreaterThan(0);
      expect(screen.getByText('资料待补账号')).toBeInTheDocument();
      expect(screen.getAllByText('账号状态').length).toBeGreaterThan(0);
      expect(screen.queryByText('治理状态')).not.toBeInTheDocument();
      expect(screen.queryByText('高权限治理')).not.toBeInTheDocument();
      expect(screen.queryByText('实名承接')).not.toBeInTheDocument();
      expect(screen.queryByText('停用收口')).not.toBeInTheDocument();
      expect(screen.getByText('alice')).toBeInTheDocument();
      expect(screen.getByText('bob')).toBeInTheDocument();
    });

    const userRow = screen.getByText('alice').closest('tr');
    expect(userRow).not.toBeNull();
    expect(within(userRow!).getByText('Staff')).toBeInTheDocument();

    fireEvent.click(within(userRow!).getByRole('switch'));
    await waitFor(() => expect(mockPatchStatus).toHaveBeenCalledWith({ user_id: 7 }, { is_active: false }));

    fireEvent.click(within(userRow!).getByText('强退'));
    await waitFor(() => expect(mockForceLogout).toHaveBeenCalledWith({ user_id: 7 }));

    fireEvent.click(within(userRow!).getByText('重置 MFA'));
    await waitFor(() => expect(mockResetMfa).toHaveBeenCalledWith({ user_id: 7 }));

    fireEvent.click(within(userRow!).getByText('设密码'));
    const passwordDialog = screen.getByRole('dialog', { name: '设置 alice 的密码' });
    fireEvent.change(within(passwordDialog).getByLabelText('新密码'), { target: { value: 'NewPass123' } });
    fireEvent.click(within(passwordDialog).getByRole('button', { name: 'OK' }));
    await waitFor(() => expect(mockSetPassword).toHaveBeenCalledWith({ user_id: 7 }, { password: 'NewPass123' }));

    fireEvent.click(screen.getByRole('button', { name: '新建用户' }));
    const createDialog = screen.getAllByRole('dialog').at(-1)!;
    fireEvent.change(within(createDialog).getByLabelText('用户名'), { target: { value: 'new-user' } });
    fireEvent.change(within(createDialog).getByLabelText('邮箱'), { target: { value: 'new@example.com' } });
    fireEvent.change(within(createDialog).getByLabelText('初始密码'), { target: { value: 'InitPass123' } });
    fireEvent.click(within(createDialog).getByRole('button', { name: 'OK' }));
    await waitFor(() => expect(mockCreateUser).toHaveBeenCalled());

    const searchBox = screen.getByPlaceholderText('按用户名、邮箱搜索');
    fireEvent.change(searchBox, { target: { value: 'alice' } });
    fireEvent.keyDown(searchBox, { key: 'Enter', code: 'Enter' });
    await waitFor(() => expect(mockListUsers).toHaveBeenLastCalledWith({ page: 1, page_size: 10, q: 'alice' }));
  });
});
