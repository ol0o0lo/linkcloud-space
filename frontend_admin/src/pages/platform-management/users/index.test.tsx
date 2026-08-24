import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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
  mockUseEnums,
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
  mockUseEnums: vi.fn(),
}));

vi.mock('@ant-design/pro-components', () => ({
  PageContainer: ({ children, title, subTitle }: any) => (
    <section>
      <h1>{title}</h1>
      <p>{subTitle}</p>
      {children}
    </section>
  ),
  ProTable: ({ actionRef, columns, headerTitle, options, pagination, request, search, toolBarRender }: any) => {
    const [data, setData] = React.useState<any[]>([]);
    const [keyword, setKeyword] = React.useState('');
    const pageSize = pagination?.defaultPageSize || 10;

    const load = async (params: Record<string, unknown>) => {
      const result = await request?.(params);
      setData(result?.data || []);
    };

    React.useEffect(() => {
      if (actionRef) {
        actionRef.current = { reload: () => void load({ current: 1, pageSize }) };
      }
      void load({ current: 1, pageSize });
    }, []);

    const tableColumns = columns.filter((column: any) => !column.hideInTable);
    const searchColumns = search === false ? [] : columns.filter((column: any) => column.hideInTable);

    return (
      <div>
        <h2>{headerTitle}</h2>
        {searchColumns.map((column: any) => (
          <input key={column.dataIndex} aria-label={column.title} placeholder={column.fieldProps?.placeholder} />
        ))}
        {options?.search ? (
          <input
            placeholder={options.search.placeholder}
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                void load({ current: 1, pageSize, [options.search.name]: keyword });
              }
            }}
          />
        ) : null}
        {toolBarRender ? <div>{toolBarRender()}</div> : null}
        <table>
          <thead>
            <tr>
              {tableColumns.map((column: any) => (
                <th key={column.dataIndex}>{column.title}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((record, rowIndex) => (
              <tr key={record.id}>
                {tableColumns.map((column: any) => (
                  <td key={column.dataIndex}>
                    {column.render ? column.render(undefined, record, rowIndex) : record[column.dataIndex]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  },
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
  enumMapping: (value?: string | null, mapping?: string | null) => mapping || value || '-',
  enumSelectOptions: (enumMap: Record<string, { label: string; value: string }[]> | undefined, key: string) => enumMap?.[key] || [],
  useEnums: mockUseEnums,
}));

import PlatformUsersPage from './index';

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
          avatar_url: '/alice.png',
          first_name: 'Alice',
          last_name: 'Zhang',
          timezone: 'Asia/Shanghai',
          real_name_status: 'rejected',
          real_name_status__mapping: '已驳回',
          real_name_masked: '张*',
          id_number_masked: '440***********2936',
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
          avatar_url: '',
          first_name: 'Bob',
          last_name: 'Li',
          timezone: 'Asia/Shanghai',
          real_name_status: 'unverified',
          real_name_status__mapping: '未实名',
          real_name_masked: '',
          id_number_masked: '',
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
    mockUseEnums.mockReturnValue({
      data: {
        'accounts.admin_user_role': [
          { label: '超级管理员', value: 'superuser' },
          { label: '后台账号', value: 'staff' },
          { label: '普通账号', value: 'user' },
        ],
        'accounts.phone_country_code': [{ label: '+86 (中国)', value: '+86' }],
        'accounts.real_name_status': [
          { label: '未实名', value: 'unverified' },
          { label: '已驳回', value: 'rejected' },
          { label: '待校验', value: 'pending' },
        ],
      },
    });
  });

  it('renders governance layout and triggers lifecycle actions', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <PlatformUsersPage />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(mockUseEnums).toHaveBeenCalledWith(['accounts.real_name_status', 'accounts.admin_user_role', 'accounts.phone_country_code']);
      expect(mockListUsers).toHaveBeenCalledWith(expect.objectContaining({ page: 1, page_size: 10, keyword: undefined }));
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
      expect(screen.getByText('未实名')).toHaveClass('ant-typography-secondary');
      expect(screen.queryByText('该账号拥有平台级最高权限，安全、实名和联系方式都应该保持清晰可控。')).not.toBeInTheDocument();
      expect(screen.queryByText('高权限账号需要重点确认权限边界、可追溯性和安全恢复能力。')).not.toBeInTheDocument();
      expect(screen.queryByText('手机号缺失或未验证，会让找回、安全校验和业务联系链路都变得脆弱。')).not.toBeInTheDocument();
      expect(screen.queryByText('这类账号权限不高，但资料完整性仍然影响后续业务处理。')).not.toBeInTheDocument();
      expect(screen.queryByText('强退')).not.toBeInTheDocument();
      expect(screen.queryByText('重置 MFA')).not.toBeInTheDocument();
      expect(screen.queryByPlaceholderText('按用户名搜索')).not.toBeInTheDocument();
      expect(screen.queryByPlaceholderText('按手机号搜索')).not.toBeInTheDocument();
    });

    const userRow = screen.getByText('alice').closest('tr');
    if (!userRow) {
      throw new Error('未找到 alice 用户行');
    }
    expect(within(userRow).getByText('后台账号')).toBeInTheDocument();
    expect(within(userRow).getByText('7')).toBeInTheDocument();
    expect(within(userRow).getByText('+86 13800138000')).toBeInTheDocument();
    expect(within(userRow).queryByText('手机已验证')).not.toBeInTheDocument();
    expect(within(userRow).queryByText('手机未验证')).not.toBeInTheDocument();
    expect(within(userRow).queryByText('已驳回')).not.toBeInTheDocument();
    expect(within(userRow).getByText('张*')).toBeInTheDocument();
    expect(within(userRow).getByText('440***********2936')).toBeInTheDocument();
    expect(within(userRow).queryByText('实名状态 已驳回')).not.toBeInTheDocument();
    expect(within(userRow).queryByText('高权限账号')).not.toBeInTheDocument();
    expect(within(userRow).getByText('编辑')).toBeInTheDocument();
    expect(within(userRow).getByText('设密码')).toBeInTheDocument();

    const unverifiedRow = screen.getByText('bob').closest('tr');
    if (!unverifiedRow) {
      throw new Error('未找到 bob 用户行');
    }
    expect(within(unverifiedRow).getByText('未绑定')).toHaveClass('ant-typography-secondary');
    expect(within(unverifiedRow).getByText('未实名')).toHaveClass('ant-typography-secondary');

    fireEvent.click(within(userRow).getByRole('switch'));
    await waitFor(() => expect(mockPatchStatus).toHaveBeenCalledWith({ user_id: 7 }, { is_active: false }));

    fireEvent.click(within(userRow).getByRole('button', { name: '更多操作' }));
    fireEvent.click(screen.getByText('强退'));
    await waitFor(() => expect(mockForceLogout).toHaveBeenCalledWith({ user_id: 7 }));

    fireEvent.click(within(userRow).getByRole('button', { name: '更多操作' }));
    fireEvent.click(screen.getByText('重置 MFA'));
    await waitFor(() => expect(mockResetMfa).toHaveBeenCalledWith({ user_id: 7 }));

    fireEvent.click(within(userRow).getByText('设密码'));
    const passwordDialog = screen.getByRole('dialog', { name: '设置 alice 的密码' });
    fireEvent.change(within(passwordDialog).getByLabelText('新密码'), { target: { value: 'NewPass123' } });
    fireEvent.click(within(passwordDialog).getByRole('button', { name: 'OK' }));
    await waitFor(() => expect(mockSetPassword).toHaveBeenCalledWith({ user_id: 7 }, { password: 'NewPass123' }));

    fireEvent.click(screen.getByRole('button', { name: '新建用户' }));
    const createDialog = screen.getAllByRole('dialog').at(-1);
    if (!createDialog) {
      throw new Error('未找到新建用户弹窗');
    }
    fireEvent.change(within(createDialog).getByLabelText('用户名'), { target: { value: 'new-user' } });
    fireEvent.change(within(createDialog).getByLabelText('邮箱'), { target: { value: 'new@example.com' } });
    fireEvent.change(within(createDialog).getByLabelText('初始密码'), { target: { value: 'InitPass123' } });
    fireEvent.change(within(createDialog).getByLabelText('手机号区号'), { target: { value: '+86' } });
    fireEvent.change(within(createDialog).getByLabelText('手机号'), { target: { value: '138-0013-8000' } });
    fireEvent.click(within(createDialog).getByRole('button', { name: 'OK' }));
    await waitFor(() => expect(mockCreateUser).toHaveBeenCalledWith(expect.objectContaining({
      phone_country_code: '+86',
      phone_national_number: '13800138000',
    })));

    const searchBox = screen.getByPlaceholderText('按用户名、邮箱搜索');
    fireEvent.change(searchBox, { target: { value: 'alice' } });
    fireEvent.keyDown(searchBox, { key: 'Enter', code: 'Enter' });
    await waitFor(() => expect(mockListUsers).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, page_size: 10, keyword: 'alice' })));
  });
});
