import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import OrganizationRolesPage from './index';

const {
  mockListPermissions,
  mockListOrgRoles,
  mockCreateOrgRole,
  mockPatchOrgRole,
  mockDeleteOrgRole,
} = vi.hoisted(() => ({
  mockListPermissions: vi.fn(),
  mockListOrgRoles: vi.fn(),
  mockCreateOrgRole: vi.fn(),
  mockPatchOrgRole: vi.fn(),
  mockDeleteOrgRole: vi.fn(),
}));

vi.mock('@/pages/tenant/shared', () => ({
  TenantSelectionGuard: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TenantSectionHint: ({ text }: { text: string }) => <div>{text}</div>,
  useTenantWorkspace: () => ({ selectedOrgSlug: 'acme', queryClient: { invalidateQueries: vi.fn() } }),
}));

vi.mock('@/services/openapi/accessPermissions', () => ({
  appsAccessApiListPermissions: mockListPermissions,
}));

vi.mock('@/services/openapi/accessOrganizationRoles', () => ({
  appsAccessApiListOrgRoles: mockListOrgRoles,
  appsAccessApiCreateOrgRole: mockCreateOrgRole,
  appsAccessApiPatchOrgRole: mockPatchOrgRole,
  appsAccessApiDeleteOrgRole: mockDeleteOrgRole,
}));

describe('OrganizationRolesPage', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    mockListPermissions.mockResolvedValue([{ key: 'organizations.member.view', name: '查看成员', app_label: 'organizations', codename: 'member_view' }]);
    mockListOrgRoles.mockResolvedValue([
      { id: 1, code: 'owner', name: 'Owner', scope: 'org', is_system: true, is_active: true, permission_keys: ['organizations.member.view'] },
      { id: 2, code: 'ops', name: '运营', scope: 'org', is_system: false, is_active: true, permission_keys: [] },
    ]);
    mockCreateOrgRole.mockResolvedValue({});
    mockPatchOrgRole.mockResolvedValue({});
    mockDeleteOrgRole.mockResolvedValue({});
  });

  it('loads organization roles and triggers create / edit / delete actions', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <OrganizationRolesPage />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(mockListPermissions).toHaveBeenCalled();
      expect(mockListOrgRoles).toHaveBeenCalled();
      expect(screen.getByText('运营')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: '新建角色' }));
    fireEvent.change(screen.getByLabelText('角色名称'), { target: { value: '财务' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'OK' }).at(-1)!);

    await waitFor(() => {
      expect(mockCreateOrgRole).toHaveBeenCalledWith(expect.objectContaining({ name: '财务' }));
    });

    fireEvent.click(screen.getByText('编辑'));
    fireEvent.change(screen.getByLabelText('角色名称'), { target: { value: '运营主管' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'OK' }).at(-1)!);

    await waitFor(() => {
      expect(mockPatchOrgRole).toHaveBeenCalledWith({ role_id: 2 }, expect.objectContaining({ name: '运营主管' }));
    });

    fireEvent.click(screen.getByText('删除'));
    fireEvent.click(screen.getAllByRole('button', { name: 'OK' }).at(-1)!);

    await waitFor(() => {
      expect(mockDeleteOrgRole).toHaveBeenCalledWith({ role_id: 2 });
    });
  });
});
