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
  mockListEstates,
  mockListBuildings,
  mockGetDefaultBuilding,
  mockSetDefaultBuilding,
  mockCreateBuilding,
} = vi.hoisted(() => ({
  mockListSettings: vi.fn(),
  mockGetSetting: vi.fn(),
  mockPutSetting: vi.fn(),
  mockDeleteSetting: vi.fn(),
  mockListEstates: vi.fn(),
  mockListBuildings: vi.fn(),
  mockGetDefaultBuilding: vi.fn(),
  mockSetDefaultBuilding: vi.fn(),
  mockCreateBuilding: vi.fn(),
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

vi.mock('@/services/manual/house', () => ({
  houseApi: {
    listEstates: mockListEstates,
    listBuildings: mockListBuildings,
    getDefaultBuilding: mockGetDefaultBuilding,
    setDefaultBuilding: mockSetDefaultBuilding,
    createBuilding: mockCreateBuilding,
  },
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
    mockListEstates.mockResolvedValue({ items: [{ id: 1, name: '星河湾' }], total: 1, page: 1, page_size: 100 });
    mockListBuildings.mockResolvedValue({ items: [{ id: 10, name: '1 栋', estate_id: 1 }], total: 1, page: 1, page_size: 100 });
    mockGetDefaultBuilding.mockResolvedValue({ id: 10, name: '1 栋', estate_id: 1, estate_name: '星河湾', floors: 20, address: '' });
    mockSetDefaultBuilding.mockResolvedValue({ id: 10, name: '1 栋', estate_id: 1, estate_name: '星河湾', floors: 20, address: '' });
    mockCreateBuilding.mockResolvedValue({ id: 11, name: '2 栋', estate_id: 1 });
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

  it('saves default building from organization settings', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <OrganizationSettingsPage />
      </QueryClientProvider>,
    );

    await screen.findByText('房源租赁设置');
    await waitFor(() => expect(mockGetDefaultBuilding).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: '保存默认楼栋' }));

    await waitFor(() => expect(mockSetDefaultBuilding).toHaveBeenCalledWith(10));
  });

  it('creates building from organization settings and saves it as default', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <OrganizationSettingsPage />
      </QueryClientProvider>,
    );

    await screen.findByText('房源租赁设置');
    fireEvent.click(screen.getByRole('button', { name: '新建楼栋' }));
    fireEvent.change(screen.getByLabelText('楼栋名'), { target: { value: '2 栋' } });
    fireEvent.change(screen.getByLabelText('楼层'), { target: { value: '28' } });
    fireEvent.click(screen.getByRole('button', { name: '保存楼栋' }));

    await waitFor(() => expect(mockCreateBuilding).toHaveBeenCalledWith(expect.objectContaining({ estate_id: 1, name: '2 栋', floors: 28 })));
    expect(mockSetDefaultBuilding).toHaveBeenCalledWith(11);
  });
});
