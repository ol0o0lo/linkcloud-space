import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import OverviewPage from './index';

const {
  mockCreateOrganization,
  mockGetOrganizationUsage,
  mockSetPrimary,
  mockWorkspace,
} = vi.hoisted(() => ({
  mockCreateOrganization: vi.fn(),
  mockGetOrganizationUsage: vi.fn(),
  mockSetPrimary: vi.fn(),
  mockWorkspace: {
    organizations: [
      { id: 1, name: 'Acme', slug: 'acme', is_current: true, is_primary: false },
      { id: 2, name: 'Beta', slug: 'beta', is_current: false, is_primary: false },
    ],
    selectedOrgSlug: 'acme',
    selectedOrganization: { id: 1, name: 'Acme', slug: 'acme', is_current: true, is_primary: false },
    signoutOrg: vi.fn().mockResolvedValue({ success: true }),
    selectOrg: vi.fn().mockResolvedValue(undefined),
    queryClient: { invalidateQueries: vi.fn() },
  },
}));

vi.mock('../shared', () => ({
  TenantSectionHint: ({ text }: { text: string }) => <div>{text}</div>,
  requireTenantSlug: (slug?: string) => slug || 'missing',
  useTenantWorkspace: () => mockWorkspace,
}));

vi.mock('@/services/openapi/organizations', () => ({
  appsOrganizationsApiCreateOrganization: mockCreateOrganization,
  appsOrganizationsApiGetOrganizationUsage: mockGetOrganizationUsage,
  appsOrganizationsApiSetPrimary: mockSetPrimary,
}));

describe('OverviewPage', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    mockGetOrganizationUsage.mockResolvedValue({
      member_count: 2,
      team_count: 1,
      member_limit: 12,
      team_limit: 3,
    });
    mockCreateOrganization.mockResolvedValue({
      id: 3,
      name: 'Gamma',
      slug: 'gamma',
    });
    mockSetPrimary.mockResolvedValue({ success: true, is_primary: true });
  });

  it('loads organizations and triggers create / set-primary / signout actions', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <OverviewPage />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(mockGetOrganizationUsage).toHaveBeenCalledWith({ slug: 'acme' });
      expect(screen.getAllByText('Acme').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Beta').length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getAllByText('设为主租户')[0]);

    await waitFor(() => {
      expect(mockSetPrimary).toHaveBeenCalledWith({ slug: 'acme' });
    });

    fireEvent.click(screen.getByText('退出当前租户'));

    await waitFor(() => {
      expect(mockWorkspace.signoutOrg).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByText('创建租户'));
    fireEvent.change(screen.getByLabelText('租户名称'), {
      target: { value: 'Gamma' },
    });
    fireEvent.change(screen.getByLabelText('租户 Slug'), {
      target: { value: 'gamma' },
    });
    fireEvent.click(screen.getAllByRole('button', { name: 'OK' }).at(-1)!);

    await waitFor(() => {
      expect(mockCreateOrganization).toHaveBeenCalledWith({
        name: 'Gamma',
        slug: 'gamma',
      });
      expect(mockWorkspace.selectOrg).toHaveBeenCalledWith('gamma');
    });
  });
});
