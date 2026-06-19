import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import OrganizationSettingsPage from './index';

const {
  mockListSettings,
  mockGetSetting,
  mockPutSetting,
  mockDeleteSetting,
} = vi.hoisted(() => ({
  mockListSettings: vi.fn(),
  mockGetSetting: vi.fn(),
  mockPutSetting: vi.fn(),
  mockDeleteSetting: vi.fn(),
}));

vi.mock('@/pages/tenant/shared', () => ({
  TenantSelectionGuard: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TenantSectionHint: ({ text }: { text: string }) => <div>{text}</div>,
  useTenantWorkspace: () => ({ selectedOrgSlug: 'acme', queryClient: { invalidateQueries: vi.fn() } }),
}));

vi.mock('@/services/openapi/organizationSettings', () => ({
  appsSettingsApiListOrgSettings: mockListSettings,
  appsSettingsApiGetOrgSettingView: mockGetSetting,
  appsSettingsApiPutOrgSetting: mockPutSetting,
  appsSettingsApiDeleteOrgSettingView: mockDeleteSetting,
}));

describe('OrganizationSettingsPage', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    mockListSettings.mockResolvedValue([
      { key: 'billing.enabled', value: true, value_type: 'bool', description: '启用账单', is_customized: true },
      { key: 'quota.member_limit', value: 12, value_type: 'int', description: '成员上限', is_customized: false },
    ]);
    mockGetSetting.mockResolvedValue({ key: 'billing.enabled', value: true, value_type: 'bool', description: '启用账单', is_customized: true });
    mockPutSetting.mockResolvedValue({});
    mockDeleteSetting.mockResolvedValue({});
  });

  it('loads organization settings and triggers update / restore actions', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <OrganizationSettingsPage />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(mockListSettings).toHaveBeenCalled();
      expect(screen.getByText('billing.enabled')).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByText('编辑')[0]);
    fireEvent.change(screen.getByLabelText('设置值'), { target: { value: 'false' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'OK' }).at(-1)!);

    await waitFor(() => {
      expect(mockPutSetting).toHaveBeenCalledWith({ key: 'billing.enabled' }, { value: false });
    });

    fireEvent.click(screen.getByText('恢复默认'));
    fireEvent.click(screen.getAllByRole('button', { name: 'OK' }).at(-1)!);

    await waitFor(() => {
      expect(mockDeleteSetting).toHaveBeenCalledWith({ key: 'billing.enabled' });
    });
  });
});
