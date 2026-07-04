import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import TenantSettingsPage from './index';

const {
  mockGetOrganization,
  mockGetOrganizationUsage,
  mockGetSettings,
  mockUpdateSettings,
  mockPatchOrganization,
  mockPatchOrganizationStatus,
  mockTransferOwner,
  mockListMembers,
  mockWorkspace,
} = vi.hoisted(() => ({
  mockGetOrganization: vi.fn(),
  mockGetOrganizationUsage: vi.fn(),
  mockGetSettings: vi.fn(),
  mockUpdateSettings: vi.fn(),
  mockPatchOrganization: vi.fn(),
  mockPatchOrganizationStatus: vi.fn(),
  mockTransferOwner: vi.fn(),
  mockListMembers: vi.fn(),
  mockWorkspace: {
    selectedOrgSlug: 'acme',
    appContext: { org: { id: 1, name: 'Acme', slug: 'acme', is_owner: true } },
    queryClient: { invalidateQueries: vi.fn() },
    setInitialState: vi.fn(),
  },
}));

vi.mock('../shared', () => ({
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
  requireTenantSlug: (slug?: string) => slug || 'missing',
  tenantQueryKeys: {
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
    appContext: (slug?: string) => ['tenant', 'app-context', slug],
    organizations: ['tenant', 'organizations'],
    usage: (slug?: string) => ['tenant', 'usage', slug],
  },
  useTenantWorkspace: () => mockWorkspace,
}));

vi.mock('@/services/openapi/organizations', () => ({
  appsOrganizationsApiGetOrganization: mockGetOrganization,
  appsOrganizationsApiGetOrganizationUsage: mockGetOrganizationUsage,
  appsOrganizationsApiPatchOrganization: mockPatchOrganization,
  appsOrganizationsApiPatchOrganizationStatus: mockPatchOrganizationStatus,
  appsOrganizationsApiTransferOwner: mockTransferOwner,
}));

vi.mock('@/services/openapi/organizationProfile', () => ({
  appsOrganizationsApiGetSettings: mockGetSettings,
  appsOrganizationsApiUpdateSettings: mockUpdateSettings,
}));

vi.mock('@/services/openapi/organizationMembers', () => ({
  appsOrganizationsApiListMembers: mockListMembers,
}));

describe('TenantSettingsPage', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    mockGetOrganization.mockResolvedValue({
      id: 1,
      name: 'Acme Updated',
      slug: 'acme',
      billing_email: 'billing@example.com',
      is_active: false,
      member_limit: 12,
      team_limit: 3,
    });
    mockGetOrganizationUsage.mockResolvedValue({
      member_count: 2,
      team_count: 1,
      member_limit: 12,
      team_limit: 3,
    });
    mockGetSettings.mockResolvedValue({
      billing_email: 'billing@example.com',
    });
    mockPatchOrganization.mockResolvedValue({
      id: 1,
      name: 'Acme Saved',
      slug: 'acme',
      billing_email: 'saved@example.com',
      is_active: false,
      member_limit: 20,
      team_limit: 5,
    });
    mockPatchOrganizationStatus.mockResolvedValue({
      id: 1,
      name: 'Acme Updated',
      slug: 'acme',
      billing_email: 'billing@example.com',
      is_active: true,
      member_limit: 12,
      team_limit: 3,
    });
    mockTransferOwner.mockResolvedValue({ success: true });
    mockUpdateSettings.mockResolvedValue({});
    mockListMembers.mockResolvedValue({
      items: [
        {
          pk: 2,
          user: { id: 8, username: 'bob', first_name: 'Bob', last_name: 'Li' },
        },
      ],
    });
  });

  it('loads real organization detail and profile data into the form', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <TenantSettingsPage />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(mockGetOrganization).toHaveBeenCalledWith({ slug: 'acme' });
      expect(mockGetSettings).toHaveBeenCalled();
      expect(mockGetOrganizationUsage).toHaveBeenCalledWith({ slug: 'acme' });
      expect(mockListMembers).toHaveBeenCalledWith({ page: 1, page_size: 100 });
    });

    await waitFor(() => {
      expect(screen.getByDisplayValue('Acme Updated')).toBeInTheDocument();
      expect(
        screen.getByDisplayValue('billing@example.com'),
      ).toBeInTheDocument();
    });

    expect(screen.queryByText('空间概览')).not.toBeInTheDocument();
    expect(screen.queryByText('名额使用情况')).not.toBeInTheDocument();
    expect(screen.queryByText('Owner 治理')).not.toBeInTheDocument();
    expect(screen.queryByText('业务策略')).not.toBeInTheDocument();
    expect(screen.queryByText('房源发布规则')).not.toBeInTheDocument();
    expect(screen.queryByText('执行与配置分工')).not.toBeInTheDocument();
    expect(screen.getByText('基础资料')).toBeInTheDocument();
    expect(screen.getByText('风险操作')).toBeInTheDocument();
    expect(screen.getByText('Owner 转移')).toBeInTheDocument();
    expect(screen.queryByText('关键提醒')).not.toBeInTheDocument();
    expect(screen.queryByText('容量与水位')).not.toBeInTheDocument();
    expect(screen.queryByText('容量水位')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: '去空间设置调整发布规则' }),
    ).not.toBeInTheDocument();

    await waitFor(() => {
      const spinButtons = screen.getAllByRole('spinbutton');
      expect(spinButtons[0]).toHaveValue('12');
      expect(spinButtons[1]).toHaveValue('3');
      expect(screen.getByRole('switch')).toHaveAttribute(
        'aria-checked',
        'false',
      );
    });

    expect(screen.getByText('当前使用：成员 2 / 12')).toBeInTheDocument();
    expect(screen.getByText('当前使用：团队 1 / 3')).toBeInTheDocument();
  });

  it('saves organization profile and toggles archive status', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <TenantSettingsPage />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue('Acme Updated')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText('空间名称'), {
      target: { value: 'Acme Saved' },
    });
    fireEvent.change(screen.getByLabelText('账单邮箱'), {
      target: { value: 'saved@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: '保存空间资料' }));

    await waitFor(() => {
      expect(mockPatchOrganization).toHaveBeenCalledWith(
        { slug: 'acme' },
        expect.objectContaining({
          name: 'Acme Saved',
          billing_email: 'saved@example.com',
        }),
      );
      expect(mockUpdateSettings).toHaveBeenCalledWith({
        billing_email: 'saved@example.com',
      });
    });

    fireEvent.click(screen.getByRole('switch'));

    await waitFor(() => {
      expect(mockPatchOrganizationStatus).toHaveBeenCalledWith(
        { slug: 'acme' },
        { is_active: true },
      );
      expect(mockWorkspace.queryClient.invalidateQueries).toHaveBeenCalled();
    });
  });
});
