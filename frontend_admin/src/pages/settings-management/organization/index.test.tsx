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
  TenantSelectionGuard: ({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) => (
    <section>
      <h1>{title}</h1>
      {subtitle ? <p>{subtitle}</p> : null}
      {children}
    </section>
  ),
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

  it('renders organization settings as user-friendly business sections with schema controls', async () => {
    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <OrganizationSettingsPage />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(mockListSettings).toHaveBeenCalled();
      expect(screen.getByText('房源租赁设置')).toBeInTheDocument();
      expect(screen.getByText('通用设置')).toBeInTheDocument();
    });

    expect(screen.getByRole('heading', { name: '空间设置' })).toBeInTheDocument();
    expect(screen.getByText('按业务功能管理当前空间的设置。')).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: '设置项' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '新建楼栋' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('未知设置')).toHaveProperty('tagName', 'TEXTAREA');
    expect(screen.queryByText('保存设置')).not.toBeInTheDocument();
    expect(screen.queryByText('恢复默认值')).not.toBeInTheDocument();
    fireEvent.mouseDown(screen.getByLabelText('默认楼栋'));
    expect(await screen.findByRole('button', { name: '新建楼栋' })).toBeInTheDocument();

    expect(container.querySelectorAll('.ant-card')).toHaveLength(1);
    expect(screen.queryByText('租户设置')).not.toBeInTheDocument();
    const settingsPanel = container.querySelector('.ant-card') as HTMLElement | null;
    expect(settingsPanel).not.toBeNull();
    expect(within(settingsPanel!).getByText('房源租赁设置')).toBeInTheDocument();
    expect(within(settingsPanel!).getByText('通用设置')).toBeInTheDocument();
    expect(within(settingsPanel!).getByLabelText('未知分类设置')).toBeInTheDocument();
  });

  it('saves text-like setting drafts on blur through organization settings api', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <OrganizationSettingsPage />
      </QueryClientProvider>,
    );

    await screen.findByText('通用设置');
    fireEvent.change(screen.getByLabelText('成员上限'), { target: { value: '18' } });
    fireEvent.blur(screen.getByLabelText('成员上限'));

    await waitFor(() => {
      expect(mockPutSetting).toHaveBeenCalledWith({ key: 'quota.member_limit' }, { value: 18 });
    });
    expect(mockDeleteSetting).not.toHaveBeenCalled();
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
    fireEvent.click(screen.getByRole('switch', { name: '启用账单' }));

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

  it('clears locally created building options when switching organizations', async () => {
    const { container, rerender } = render(
      <QueryClientProvider client={queryClient}>
        <OrganizationSettingsPage />
      </QueryClientProvider>,
    );

    await screen.findByText('房源租赁设置');
    fireEvent.mouseDown(screen.getByLabelText('默认楼栋'));
    fireEvent.click(screen.getByRole('button', { name: '新建楼栋' }));
    fireEvent.change(screen.getByLabelText('楼栋名'), { target: { value: '2 栋' } });
    fireEvent.change(screen.getByLabelText('楼层'), { target: { value: '28' } });
    fireEvent.click(screen.getByRole('button', { name: '保存楼栋' }));

    await waitFor(() => expect(mockCreateBuilding).toHaveBeenCalled());
    await waitFor(() => expect(container.querySelector('[title="2 栋"]')).toBeInTheDocument());

    selectedOrgSlug = 'beta';
    rerender(
      <QueryClientProvider client={queryClient}>
        <OrganizationSettingsPage />
      </QueryClientProvider>,
    );

    await waitFor(() => expect(mockListSettings.mock.calls.length).toBeGreaterThanOrEqual(3));
    await waitFor(() => expect(container.querySelector('[title="2 栋"]')).not.toBeInTheDocument());
  });

  it('saves default building through organization settings api', async () => {
    mockListBuildings.mockResolvedValue({ items: [{ id: 10, name: '1 栋', estate_id: 1 }, { id: 12, name: '2 栋', estate_id: 1 }], total: 2, page: 1, page_size: 100 });

    render(
      <QueryClientProvider client={queryClient}>
        <OrganizationSettingsPage />
      </QueryClientProvider>,
    );

    await screen.findByText('房源租赁设置');
    fireEvent.mouseDown(screen.getByLabelText('默认楼栋'));
    fireEvent.click(await screen.findByText('2 栋'));

    await waitFor(() => expect(mockPutSetting).toHaveBeenCalledWith({ key: 'property_rental.default_building_id' }, { value: 12 }));
    expect(mockSetDefaultBuilding).not.toHaveBeenCalled();
  });

  it('creates building from organization settings and updates default building draft', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <OrganizationSettingsPage />
      </QueryClientProvider>,
    );

    await screen.findByText('房源租赁设置');
    fireEvent.mouseDown(screen.getByLabelText('默认楼栋'));
    fireEvent.click(screen.getByRole('button', { name: '新建楼栋' }));
    fireEvent.change(screen.getByLabelText('楼栋名'), { target: { value: '2 栋' } });
    fireEvent.change(screen.getByLabelText('楼层'), { target: { value: '28' } });
    fireEvent.click(screen.getByRole('button', { name: '保存楼栋' }));

    await waitFor(() => expect(mockCreateBuilding).toHaveBeenCalledWith(expect.objectContaining({ estate_id: 1, name: '2 栋', floors: 28 })));
    expect(mockSetDefaultBuilding).not.toHaveBeenCalled();

    await waitFor(() => expect(mockPutSetting).toHaveBeenCalledWith({ key: 'property_rental.default_building_id' }, { value: 11 }));
  });
});
