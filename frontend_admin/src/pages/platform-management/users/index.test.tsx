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
  mockGetEnumRegistry,
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
  mockGetEnumRegistry: vi.fn(),
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

vi.mock('@/services/manual/enums', () => ({
  getEnumRegistry: mockGetEnumRegistry,
  enumMapping: (value?: string | null, mapping?: string | null) => mapping || value || '-',
  toSelectOptions: (items?: Array<{ value: string; mapping: string }>) => (items || []).map((item) => ({ value: item.value, label: item.mapping })),
}));

describe('PlatformUsersPage', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    mockGetEnumRegistry.mockResolvedValue({
      'accounts.real_name_status': [
        { value: 'unverified', mapping: '未实名' },
        { value: 'pending', mapping: '待校验' },
        { value: 'verified', mapping: '已实名' },
      ],
      'accounts.admin_user_role': [
        { value: 'superuser', mapping: '超级管理员' },
        { value: 'staff', mapping: '后台账号' },
        { value: 'user', mapping: '普通账号' },
      ],
    });
    mockListUsers.mockResolvedValue({
      items: [
        {
          id: 7,
          username: 'alice',
          email: 'alice@example.com',
          first_name: 'Alice',
          last_name: 'Zhang',
          timezone: 'Asia/Shanghai',
          real_name_status: 'verified',
          real_name_status__mapping: '已实名',
          role: 'staff',
          role__mapping: '后台账号',
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
          real_name_status__mapping: '待校验',
          role: 'user',
          role__mapping: '普通账号',
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
      expect(mockListUsers).toHaveBeenCalledWith({ page: 1, page_size: 10, keyword: undefined });
      expect(screen.queryByText('用户概览')).not.toBeInTheDocument();
      expect(screen.queryByText('用户详情')).not.toBeInTheDocument();
      expect(screen.queryByText('关键提醒')).not.toBeInTheDocument();
      expect(screen.getByText('用户列表')).toBeInTheDocument();
      expect(screen.queryByText('高权限账号')).not.toBeInTheDocument();
      expect(screen.queryByText('资料待补账号')).not.toBeInTheDocument();
      expect(screen.queryByText('查看实名状态')).not.toBeInTheDocument();
      expect(screen.queryByText('继续处理')).not.toBeInTheDocument();
      expect(screen.queryByText('进入实名管理')).not.toBeInTheDocument();
      expect(screen.queryByText('查看通知')).not.toBeInTheDocument();
      expect(screen.queryByText('账号状态')).not.toBeInTheDocument();
      expect(screen.queryByText('联系方式待补')).not.toBeInTheDocument();
      expect(screen.queryByText('治理状态')).not.toBeInTheDocument();
      expect(screen.queryByText('高权限治理')).not.toBeInTheDocument();
      expect(screen.queryByText('实名承接')).not.toBeInTheDocument();
      expect(screen.queryByText('停用收口')).not.toBeInTheDocument();
      expect(screen.getByText('alice')).toBeInTheDocument();
      expect(screen.getByText('bob')).toBeInTheDocument();
      expect(screen.queryByText('该账号拥有平台级最高权限，安全、实名和联系方式都应该保持清晰可控。')).not.toBeInTheDocument();
      expect(screen.queryByText('高权限账号需要重点确认权限边界、可追溯性和安全恢复能力。')).not.toBeInTheDocument();
      expect(screen.queryByText('手机号缺失或未验证，会让找回、安全校验和业务联系链路都变得脆弱。')).not.toBeInTheDocument();
      expect(screen.queryByText('这类账号权限不高，但资料完整性仍然影响后续业务处理。')).not.toBeInTheDocument();
      expect(screen.queryByText('强退')).not.toBeInTheDocument();
      expect(screen.queryByText('重置 MFA')).not.toBeInTheDocument();
    });

    const userRow = screen.getByText('alice').closest('tr');
    expect(userRow).not.toBeNull();
    expect(within(userRow!).getByText('后台账号')).toBeInTheDocument();
    expect(within(userRow!).getByText('实名状态 已实名')).toBeInTheDocument();
    expect(within(userRow!).queryByText('高权限账号')).not.toBeInTheDocument();
    expect(within(userRow!).getByText('编辑')).toBeInTheDocument();
    expect(within(userRow!).getByText('设密码')).toBeInTheDocument();

    fireEvent.click(within(userRow!).getByRole('switch'));
    await waitFor(() => expect(mockPatchStatus).toHaveBeenCalledWith({ user_id: 7 }, { is_active: false }));

    fireEvent.click(within(userRow!).getByRole('button', { name: '更多操作' }));
    fireEvent.click(screen.getByText('强退'));
    await waitFor(() => expect(mockForceLogout).toHaveBeenCalledWith({ user_id: 7 }));

    fireEvent.click(within(userRow!).getByRole('button', { name: '更多操作' }));
    fireEvent.click(screen.getByText('重置 MFA'));
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
    await waitFor(() => expect(mockListUsers).toHaveBeenLastCalledWith({ page: 1, page_size: 10, keyword: 'alice' }));
  });
});
