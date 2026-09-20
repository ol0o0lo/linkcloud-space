import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import OrganizationBindingsPage from './index';

function requireElement<T>(value: T | null | undefined, message: string): T {
  if (!value) throw new Error(message);
  return value;
}

const {
  mockListBindings,
  mockCreateBinding,
  mockDeleteBinding,
  mockListMembers,
  mockListRoles,
} = vi.hoisted(() => ({
  mockListBindings: vi.fn(),
  mockCreateBinding: vi.fn(),
  mockDeleteBinding: vi.fn(),
  mockListMembers: vi.fn(),
  mockListRoles: vi.fn(),
}));

vi.mock('@/pages/space/shared', () => ({
  TenantSelectionGuard: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  formatPersonLabel: (user: {
    username?: string;
    first_name?: string;
    last_name?: string;
  }) =>
    [user.first_name, user.last_name].filter(Boolean).join(' ') ||
    user.username ||
    '未知用户',
  useTenantWorkspace: () => ({
    selectedOrgSlug: 'acme',
    queryClient: { invalidateQueries: vi.fn() },
  }),
}));

vi.mock('@/services/openapi/accessOrganizationBindings', () => ({
  appsAccessApiListOrganizationBindings: mockListBindings,
  appsAccessApiCreateOrganizationBinding: mockCreateBinding,
  appsAccessApiDeleteOrganizationBinding: mockDeleteBinding,
}));

vi.mock('@/services/openapi/accessOrganizationRoles', () => ({
  appsAccessApiListOrgRoles: mockListRoles,
}));

vi.mock('@/services/openapi/organizationMembers', () => ({
  appsOrganizationsApiListMembers: mockListMembers,
}));

describe('OrganizationBindingsPage', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    mockListBindings.mockResolvedValue([
      {
        id: 9,
        user: {
          id: 7,
          username: 'alice',
          first_name: 'Alice',
          last_name: 'Zhang',
        },
        role: { id: 2, name: '运营', code: 'ops', scope: 'org' },
        created_at: '2026-06-16T10:00:00+08:00',
        updated_at: '2026-06-16T10:00:00+08:00',
      },
    ]);
    mockListRoles.mockResolvedValue([
      {
        id: 2,
        name: '运营',
        code: 'ops',
        scope: 'org',
        is_active: true,
        is_system: false,
        permission_keys: [],
      },
    ]);
    mockListMembers.mockResolvedValue({
      items: [
        {
          pk: 1,
          user: {
            id: 7,
            username: 'alice',
            first_name: 'Alice',
            last_name: 'Zhang',
          },
        },
      ],
    });
    mockCreateBinding.mockResolvedValue({});
    mockDeleteBinding.mockResolvedValue({});
  });

  it('loads organization bindings and triggers assign / delete actions', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <OrganizationBindingsPage />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(mockListBindings).toHaveBeenCalled();
      expect(mockListRoles).toHaveBeenCalled();
      expect(mockListMembers).toHaveBeenCalledWith({ page: 1, page_size: 100 });
      expect(screen.getAllByText('Alice Zhang').length).toBeGreaterThan(0);
    });

    expect(screen.queryByText('授权概览')).not.toBeInTheDocument();
    expect(screen.queryByText('覆盖情况')).not.toBeInTheDocument();
    expect(
      screen.queryByText('空间授权决定谁能统筹全局规则、跨团队协同和异常收口'),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('columnheader', { name: '授权时间' }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '分配角色' }));
    fireEvent.mouseDown(
      requireElement(
        screen.getByLabelText('成员').closest('.ant-select'),
        '未找到成员选择器',
      ),
    );
    fireEvent.click(await screen.findByText('Alice Zhang (alice)'));
    fireEvent.mouseDown(
      requireElement(
        screen.getByLabelText('角色').closest('.ant-select'),
        '未找到角色选择器',
      ),
    );
    fireEvent.click(
      requireElement(screen.getAllByText('运营').at(-1), '未找到运营角色'),
    );
    fireEvent.click(
      requireElement(
        screen.getAllByRole('button', { name: 'OK' }).at(-1),
        '未找到分配确认按钮',
      ),
    );

    await waitFor(() => {
      expect(mockCreateBinding).toHaveBeenCalledWith({ user: 7, role: 2 });
    });

    fireEvent.click(screen.getByRole('button', { name: '移除' }));
    fireEvent.click(
      requireElement(
        screen.getAllByRole('button', { name: 'OK' }).at(-1),
        '未找到移除确认按钮',
      ),
    );

    await waitFor(() => {
      expect(mockDeleteBinding).toHaveBeenCalledWith({ binding_id: 9 });
    });
  });
});
