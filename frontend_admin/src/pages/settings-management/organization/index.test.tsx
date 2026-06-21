import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
  mockUseTenantWorkspace,
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
  mockUseTenantWorkspace: vi.fn(),
}));

vi.mock('@/pages/tenant/shared', () => ({
  TenantSelectionGuard: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TenantSectionHint: ({ text }: { text: string }) => <div>{text}</div>,
  useTenantWorkspace: mockUseTenantWorkspace,
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
  let selectedOrgSlug: string;

  const buildSettingsFixture = (overrides?: Partial<Record<'memberLimit', number>>) => [
    {
      key: 'billing.enabled',
      label: '启用账单',
      value: true,
      value_type: 'boolean',
      description: '启用账单',
      widget: 'switch',
      ui: {},
      category: 'general',
      is_customized: true,
    },
    {
      key: 'quota.member_limit',
      label: '成员上限',
      value: overrides?.memberLimit ?? 12,
      value_type: 'integer',
      description: '成员上限',
      widget: 'input_number',
      ui: {},
      category: 'general',
      is_customized: false,
    },
    {
      key: 'property_rental.default_building_id',
      label: '默认楼栋',
      value: 10,
      value_type: 'integer',
      description: '默认楼栋',
      widget: 'select',
      ui: { options_source: 'house.buildings' },
      category: 'property_rental',
      is_customized: true,
    },
    {
      key: 'unknown.raw',
      label: '未知设置',
      value: { a: 1 },
      value_type: 'json',
      description: '未知设置',
      widget: 'not_real',
      ui: {},
      category: '',
      is_customized: false,
    },
    {
      key: 'unknown.category.setting',
      label: '未知分类设置',
      value: 'abc',
      value_type: 'text',
      description: '未知分类设置',
      widget: 'input',
      ui: {},
      category: 'unknown_category',
      is_customized: false,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    selectedOrgSlug = 'acme';
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    mockUseTenantWorkspace.mockImplementation(() => ({ selectedOrgSlug, queryClient }));
    mockListSettings.mockImplementation(() => Promise.resolve(buildSettingsFixture()));
    mockGetSetting.mockResolvedValue({
      key: 'billing.enabled',
      label: '启用账单',
      value: true,
      value_type: 'boolean',
      description: '启用账单',
      widget: 'switch',
      ui: {},
      category: 'general',
      is_customized: true,
    });
    mockPutSetting.mockResolvedValue({});
    mockDeleteSetting.mockResolvedValue({});
    mockListEstates.mockResolvedValue({ items: [{ id: 1, name: '星河湾' }], total: 1, page: 1, page_size: 100 });
    mockListBuildings.mockResolvedValue({ items: [{ id: 10, name: '1 栋', estate_id: 1 }], total: 1, page: 1, page_size: 100 });
    mockGetDefaultBuilding.mockResolvedValue({ id: 10, name: '1 栋', estate_id: 1, estate_name: '星河湾', floors: 20, address: '' });
    mockSetDefaultBuilding.mockResolvedValue({ id: 10, name: '1 栋', estate_id: 1, estate_name: '星河湾', floors: 20, address: '' });
    mockCreateBuilding.mockResolvedValue({ id: 11, name: '2 栋', estate_id: 1 });
  });

  it('renders organization settings as business sections with schema controls', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <OrganizationSettingsPage />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(mockListSettings).toHaveBeenCalled();
      expect(screen.getByText('房源租赁设置')).toBeInTheDocument();
      expect(screen.getByText('通用设置')).toBeInTheDocument();
    });

    expect(screen.queryByRole('columnheader', { name: '设置项' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '新建楼栋' })).toBeInTheDocument();
    expect(screen.getByLabelText('未知设置')).toHaveProperty('tagName', 'TEXTAREA');

    const generalSection = screen.getByText('通用设置').closest('.ant-card') as HTMLElement | null;
    expect(generalSection).not.toBeNull();
    expect(within(generalSection!).getByLabelText('未知分类设置')).toBeInTheDocument();
  });

  it('saves and restores setting drafts through organization settings api', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <OrganizationSettingsPage />
      </QueryClientProvider>,
    );

    await screen.findByText('通用设置');
    fireEvent.change(screen.getByLabelText('成员上限'), { target: { value: '18' } });
    fireEvent.click(screen.getByRole('button', { name: '保存成员上限' }));

    await waitFor(() => {
      expect(mockPutSetting).toHaveBeenCalledWith({ key: 'quota.member_limit' }, { value: 18 });
    });

    fireEvent.click(screen.getByRole('button', { name: '恢复启用账单默认值' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'OK' }).at(-1)!);

    await waitFor(() => {
      expect(mockDeleteSetting).toHaveBeenCalledWith({ key: 'billing.enabled' });
    });
  });

  it('keeps unsaved drafts when another setting save refetches settings', async () => {
    let listCalls = 0;
    mockListSettings.mockImplementation(() => {
      listCalls += 1;
      const settings = buildSettingsFixture();
      if (listCalls > 1) {
        settings.push({
          key: 'refetched.setting',
          label: '刷新后设置',
          value: 'refetched',
          value_type: 'text',
          description: '刷新后设置',
          widget: 'input',
          ui: {},
          category: 'general',
          is_customized: false,
        });
      }
      return Promise.resolve(settings);
    });

    render(
      <QueryClientProvider client={queryClient}>
        <OrganizationSettingsPage />
      </QueryClientProvider>,
    );

    await screen.findByText('通用设置');
    fireEvent.change(screen.getByLabelText('成员上限'), { target: { value: '18' } });
    fireEvent.click(screen.getByRole('button', { name: '保存启用账单' }));

    await waitFor(() => expect(mockListSettings).toHaveBeenCalledTimes(2));
    await screen.findByLabelText('刷新后设置');
    expect(screen.getByLabelText('成员上限')).toHaveValue('18');
  });

  it('resets setting drafts when switching organizations', async () => {
    mockListSettings.mockImplementation(() => Promise.resolve(buildSettingsFixture({ memberLimit: selectedOrgSlug === 'acme' ? 12 : 30 })));

    const { rerender } = render(
      <QueryClientProvider client={queryClient}>
        <OrganizationSettingsPage />
      </QueryClientProvider>,
    );

    await screen.findByText('通用设置');
    fireEvent.change(screen.getByLabelText('成员上限'), { target: { value: '18' } });

    selectedOrgSlug = 'beta';
    rerender(
      <QueryClientProvider client={queryClient}>
        <OrganizationSettingsPage />
      </QueryClientProvider>,
    );

    await waitFor(() => expect(mockListSettings).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByLabelText('成员上限')).toHaveValue('30'));
  });

  it('saves default building through organization settings api', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <OrganizationSettingsPage />
      </QueryClientProvider>,
    );

    await screen.findByText('房源租赁设置');
    fireEvent.click(screen.getByRole('button', { name: '保存默认楼栋' }));

    await waitFor(() => expect(mockPutSetting).toHaveBeenCalledWith({ key: 'property_rental.default_building_id' }, { value: 10 }));
    expect(mockSetDefaultBuilding).not.toHaveBeenCalled();
  });

  it('creates building from organization settings and updates default building draft', async () => {
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
    expect(mockSetDefaultBuilding).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: '保存默认楼栋' }));

    await waitFor(() => expect(mockPutSetting).toHaveBeenCalledWith({ key: 'property_rental.default_building_id' }, { value: 11 }));
  });
});
