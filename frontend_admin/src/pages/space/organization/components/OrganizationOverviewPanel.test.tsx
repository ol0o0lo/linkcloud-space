import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OrganizationOverviewPanel } from './OrganizationOverviewPanel';

const {
  mockGetOrganization,
  mockGetSettings,
  mockListMembers,
  mockPatchOrganization,
  mockPatchOrganizationStatus,
  mockSetSelectedOrgSlug,
  mockTransferOwner,
  mockUpdateSettings,
  mockWorkspace,
} = vi.hoisted(() => ({
  mockGetOrganization: vi.fn(),
  mockGetSettings: vi.fn(),
  mockListMembers: vi.fn(),
  mockPatchOrganization: vi.fn(),
  mockPatchOrganizationStatus: vi.fn(),
  mockSetSelectedOrgSlug: vi.fn((slug: string) => slug),
  mockTransferOwner: vi.fn(),
  mockUpdateSettings: vi.fn(),
  mockWorkspace: {
    appContext: {
      org: { id: 1, name: 'Acme', slug: 'acme', is_owner: true },
      user: { id: 1 },
    },
    queryClient: { invalidateQueries: vi.fn().mockResolvedValue(undefined) },
    selectedOrgSlug: 'acme',
    setInitialState: vi.fn(),
  },
}));

vi.mock('@/components/AppIcon', () => ({
  AppIcon: () => <span aria-hidden="true" />,
}));

vi.mock('@/pages/space/shared', () => ({
  formatPersonLabel: (user: { username?: string }) => user.username || '成员',
  requireTenantSlug: (slug?: string) => slug || 'missing',
  tenantQueryKeys: {
    appContext: (slug?: string) => ['tenant', 'app-context', slug],
    organizationDetail: (slug?: string) => [
      'tenant',
      'organization-detail',
      slug,
    ],
    organizationProfile: (slug?: string) => [
      'tenant',
      'organization-profile',
      slug,
    ],
    organizations: ['tenant', 'organizations'],
  },
  useTenantWorkspace: () => mockWorkspace,
}));

vi.mock('@/services/openapi/organizationMembers', () => ({
  appsOrganizationsApiListMembers: mockListMembers,
}));

vi.mock('@/services/openapi/organizationProfile', () => ({
  appsOrganizationsApiGetSettings: mockGetSettings,
  appsOrganizationsApiUpdateSettings: mockUpdateSettings,
}));

vi.mock('@/services/openapi/organizations', () => ({
  appsOrganizationsApiGetOrganization: mockGetOrganization,
  appsOrganizationsApiPatchOrganization: mockPatchOrganization,
  appsOrganizationsApiPatchOrganizationStatus: mockPatchOrganizationStatus,
  appsOrganizationsApiTransferOwner: mockTransferOwner,
}));

vi.mock('@/utils/orgSelection', () => ({
  setSelectedOrgSlug: mockSetSelectedOrgSlug,
}));

const navigation = {
  organization: { id: 1, name: 'Acme', slug: 'acme' },
  member_count: 2,
  owner_count: 1,
  pending_invite_count: 1,
  team_count: 1,
  teams: [{ id: 2, name: '运营组', member_count: 1 }],
  unassigned_responsibility_count: 1,
  ungrouped_member_count: 1,
  capabilities: {
    member_manage: true,
    invite_manage: true,
    role_view: true,
    role_manage: true,
    team_create: true,
    responsibility_manage: true,
    team_update_ids: [2],
    team_delete_ids: [2],
    team_member_manage_ids: [2],
    team_role_view_ids: [2],
    team_role_manage_ids: [2],
  },
} as API.OrganizationNavigationOut;

function renderPanel(onDirtyStateChange = vi.fn()) {
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false },
    },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <OrganizationOverviewPanel
        canCreateTeam
        navigation={navigation}
        onCreateTeam={vi.fn()}
        onDirtyStateChange={onDirtyStateChange}
        onInvite={vi.fn()}
        onOpen={vi.fn()}
        workspaceCard={{
          canManageInvites: true,
          title: 'Acme',
        }}
      />
    </QueryClientProvider>,
  );

  return { onDirtyStateChange };
}

describe('OrganizationOverviewPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWorkspace.appContext.org.is_owner = true;
    mockGetOrganization.mockResolvedValue({
      id: 1,
      name: 'Acme',
      slug: 'acme',
      billing_email: 'billing@example.com',
      is_active: true,
    });
    mockGetSettings.mockResolvedValue({
      billing_email: 'billing@example.com',
    });
    mockPatchOrganization.mockResolvedValue({
      id: 1,
      name: 'Acme 新组织',
      slug: 'acme-new',
      billing_email: 'new@example.com',
      is_active: true,
    });
    mockUpdateSettings.mockResolvedValue({
      billing_email: 'new@example.com',
    });
    mockPatchOrganizationStatus.mockResolvedValue({});
    mockTransferOwner.mockResolvedValue({ success: true });
    mockListMembers.mockResolvedValue({
      items: [
        { pk: 1, user: { id: 1, username: 'owner' } },
        { pk: 2, user: { id: 2, username: 'new-owner' } },
      ],
      total: 2,
      page: 1,
      page_size: 100,
    });
  });

  it('默认只读，点击按钮后进入编辑并可取消恢复', async () => {
    const onDirtyStateChange = vi.fn();
    renderPanel(onDirtyStateChange);

    expect(await screen.findByText('billing@example.com')).toBeInTheDocument();
    expect(screen.queryByLabelText('组织名称')).not.toBeInTheDocument();
    expect(
      screen.queryByText('归档后组织将视为停用，但不会删除已有数据。'),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /编辑资料/ }));
    fireEvent.change(screen.getByLabelText('组织名称'), {
      target: { value: '临时名称' },
    });

    await waitFor(() => {
      expect(onDirtyStateChange).toHaveBeenLastCalledWith(
        expect.objectContaining({ dirty: true }),
      );
    });

    fireEvent.click(screen.getByRole('button', { name: /取\s*消/ }));
    expect(screen.queryByLabelText('组织名称')).not.toBeInTheDocument();
    expect(screen.getAllByText('Acme').length).toBeGreaterThan(0);
  });

  it('保存资料后更新组织上下文并退出编辑状态', async () => {
    renderPanel();
    await screen.findByText('billing@example.com');
    fireEvent.click(screen.getByRole('button', { name: /编辑资料/ }));

    fireEvent.change(screen.getByLabelText('组织名称'), {
      target: { value: 'Acme 新组织' },
    });
    fireEvent.change(screen.getByLabelText('组织标识'), {
      target: { value: 'acme-new' },
    });
    fireEvent.change(screen.getByLabelText('账单邮箱'), {
      target: { value: 'new@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: '保存资料' }));

    await waitFor(() => {
      expect(mockPatchOrganization).toHaveBeenCalledWith(
        { slug: 'acme' },
        {
          billing_email: 'new@example.com',
          name: 'Acme 新组织',
          slug: 'acme-new',
        },
      );
      expect(mockUpdateSettings).toHaveBeenCalledWith({
        billing_email: 'new@example.com',
      });
      expect(mockSetSelectedOrgSlug).toHaveBeenCalledWith('acme-new');
    });

    expect(screen.queryByLabelText('组织名称')).not.toBeInTheDocument();
  });

  it('危险操作默认收起，展开后才加载 Owner 候选成员', async () => {
    renderPanel();
    await screen.findByText('billing@example.com');

    expect(mockListMembers).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('危险操作'));

    await waitFor(() => expect(mockListMembers).toHaveBeenCalled());
    expect(
      screen.getByText('归档后组织将视为停用，但不会删除已有数据。'),
    ).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('普通成员只看摘要且不会请求 Owner 管理接口', async () => {
    mockWorkspace.appContext.org.is_owner = false;
    renderPanel();

    expect((await screen.findAllByText('仅 Owner 可查看')).length).toBe(2);
    expect(
      screen.queryByRole('button', { name: /编辑资料/ }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('危险操作')).not.toBeInTheDocument();
    expect(mockGetOrganization).not.toHaveBeenCalled();
    expect(mockGetSettings).not.toHaveBeenCalled();
  });
});
