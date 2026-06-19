import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import OrganizationBindingsPage from './index';

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

vi.mock('@/pages/tenant/shared', () => ({
  TenantSelectionGuard: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TenantSectionHint: ({ text }: { text: string }) => <div>{text}</div>,
  formatPersonLabel: (user: { username?: string; first_name?: string; last_name?: string }) => [user.first_name, user.last_name].filter(Boolean).join(' ') || user.username || '未知用户',
  useTenantWorkspace: () => ({ selectedOrgSlug: 'acme', queryClient: { invalidateQueries: vi.fn() } }),
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
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    mockListBindings.mockResolvedValue([{ id: 9, user: { id: 7, username: 'alice', first_name: 'Alice', last_name: 'Zhang' }, role: { id: 2, name: '运营', code: 'ops', scope: 'org' }, created_at: '2026-06-16T10:00:00+08:00', updated_at: '2026-06-16T10:00:00+08:00' }]);
    mockListRoles.mockResolvedValue([{ id: 2, name: '运营', code: 'ops', scope: 'org', is_active: true, is_system: false, permission_keys: [] }]);
    mockListMembers.mockResolvedValue({ items: [{ pk: 1, user: { id: 7, username: 'alice', first_name: 'Alice', last_name: 'Zhang' } }] });
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
      expect(screen.getByText('Alice Zhang')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: '分配角色' }));
    await waitFor(() => expect(mockListMembers).toHaveBeenCalledWith({ page: 1, page_size: 100 }));
    fireEvent.mouseDown(screen.getByLabelText('成员').closest('.ant-select')!);
    fireEvent.click(await screen.findByText('Alice Zhang (alice)'));
    fireEvent.mouseDown(screen.getByLabelText('角色').closest('.ant-select')!);
    fireEvent.click(screen.getAllByText('运营').at(-1)!);
    fireEvent.click(screen.getAllByRole('button', { name: 'OK' }).at(-1)!);

    await waitFor(() => {
      expect(mockCreateBinding).toHaveBeenCalledWith({ user: 7, role: 2 });
    });

    fireEvent.click(screen.getByText('移除'));
    fireEvent.click(screen.getAllByRole('button', { name: 'OK' }).at(-1)!);

    await waitFor(() => {
      expect(mockDeleteBinding).toHaveBeenCalledWith({ binding_id: 9 });
    });
  });
});
