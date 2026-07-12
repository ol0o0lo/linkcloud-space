import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import OrganizationSettingsPage from './index';

const {
  mockListHouses,
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
} = vi.hoisted(() => {
  type HouseApiMocks = {
    listHouses: ReturnType<typeof vi.fn>;
    listViewingRecords: ReturnType<typeof vi.fn>;
    listLeases: ReturnType<typeof vi.fn>;
    patchHouse: ReturnType<typeof vi.fn>;
    listEstates: ReturnType<typeof vi.fn>;
    listBuildings: ReturnType<typeof vi.fn>;
    getDefaultBuilding: ReturnType<typeof vi.fn>;
    setDefaultBuilding: ReturnType<typeof vi.fn>;
    createBuilding: ReturnType<typeof vi.fn>;
  };
  const globals = globalThis as typeof globalThis & {
    __frontendAdminHouseApiMocks__?: HouseApiMocks;
    __frontendAdminTenantWorkspaceMock__?: ReturnType<typeof vi.fn>;
  };
  const houseApiMocks =
    globals.__frontendAdminHouseApiMocks__ ||
    ({
      listHouses: vi.fn(),
      listViewingRecords: vi.fn(),
      listLeases: vi.fn(),
      patchHouse: vi.fn(),
      listEstates: vi.fn(),
      listBuildings: vi.fn(),
      getDefaultBuilding: vi.fn(),
      setDefaultBuilding: vi.fn(),
      createBuilding: vi.fn(),
    } satisfies HouseApiMocks);
  globals.__frontendAdminHouseApiMocks__ = houseApiMocks;
  const tenantWorkspaceMock = globals.__frontendAdminTenantWorkspaceMock__ || vi.fn();
  globals.__frontendAdminTenantWorkspaceMock__ = tenantWorkspaceMock;
  return {
    mockListHouses: houseApiMocks.listHouses,
    mockListSettings: vi.fn(),
    mockGetSetting: vi.fn(),
    mockPutSetting: vi.fn(),
    mockDeleteSetting: vi.fn(),
    mockListEstates: houseApiMocks.listEstates,
    mockListBuildings: houseApiMocks.listBuildings,
    mockGetDefaultBuilding: houseApiMocks.getDefaultBuilding,
    mockSetDefaultBuilding: houseApiMocks.setDefaultBuilding,
    mockCreateBuilding: houseApiMocks.createBuilding,
    mockUseTenantWorkspace: tenantWorkspaceMock,
  };
});

vi.mock('@/pages/tenant/shared', () => ({
  TenantSelectionGuard: ({ title, children }: { title: string; children: React.ReactNode }) => (
    <section>
      <h1>{title}</h1>
      {children}
    </section>
  ),
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
    listHouses: mockListHouses,
    listViewingRecords: vi.fn(),
    listLeases: vi.fn(),
    patchHouse: vi.fn(),
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
      key: 'property_rental.publish_rules',
      label: '房源发布规则',
      value: {
        landlord: { mode: 'required' },
        rent: { mode: 'required' },
        cover: { mode: 'warn' },
        images: { mode: 'warn', min_count: 3 },
        floor_plan: { mode: 'warn' },
        video: { mode: 'off', min_count: 1 },
      },
      value_type: 'json',
      description: '房源发布规则',
      widget: 'json_editor',
      ui: { options_source: 'house.publish_rules' },
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
    mockListHouses.mockResolvedValue({ items: [], total: 9, page: 1, page_size: 1 });
    const estate = { id: 1, name: '星河湾', display_name: '星河湾' };
    const building = { id: 10, name: '1 栋', estate_id: 1, estate, floors: 20, address: '' };
    mockListEstates.mockResolvedValue({ items: [estate], total: 1, page: 1, page_size: 100 });
    mockListBuildings.mockResolvedValue({ items: [building], total: 1, page: 1, page_size: 100 });
    mockGetDefaultBuilding.mockResolvedValue(building);
    mockSetDefaultBuilding.mockResolvedValue(building);
    mockCreateBuilding.mockResolvedValue({ id: 11, name: '2 栋', estate_id: 1, estate });
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
    expect(screen.queryByText('按业务功能管理当前空间的设置。')).not.toBeInTheDocument();
    expect(screen.queryByText('这组设置会同步影响房源详情、新建房源和工作台的发布判断')).not.toBeInTheDocument();
    expect(screen.queryByText('当前发布策略')).not.toBeInTheDocument();
    expect(screen.queryByText('当前策略：标准发布')).not.toBeInTheDocument();
    expect(screen.queryByText('已自定义')).not.toBeInTheDocument();
    expect(screen.getByText('阻断发布：房东主体、租金')).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: '设置项' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '新建楼栋' })).not.toBeInTheDocument();
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
    expect(within(settingsPanel!).getByRole('tablist')).toHaveAttribute('aria-orientation', 'vertical');

    fireEvent.click(within(settingsPanel!).getByRole('tab', { name: '通用设置' }));
    expect(screen.getByLabelText('未知设置')).toHaveProperty('tagName', 'TEXTAREA');
    expect(within(settingsPanel!).getByLabelText('未知分类设置')).toBeInTheDocument();
  });

  it('renders a standalone default building without an estate', async () => {
    mockListBuildings.mockResolvedValue({
      items: [{ id: 10, name: '独栋', estate_id: null, estate: null, floors: 3, address: '科技路 88 号' }],
      total: 1,
      page: 1,
      page_size: 100,
    });

    render(
      <QueryClientProvider client={queryClient}>
        <OrganizationSettingsPage />
      </QueryClientProvider>,
    );

    await screen.findByText('房源租赁设置');
    expect(screen.getByLabelText('默认楼栋')).toBeInTheDocument();
  });

  it('does not render the old strategy overview on organization settings page', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <OrganizationSettingsPage />
      </QueryClientProvider>,
    );

    await screen.findByText('房源租赁设置');
    expect(screen.queryByText('策略概览')).not.toBeInTheDocument();
    expect(screen.queryByText('这组设置会同步影响房源详情、新建房源和工作台的发布判断')).not.toBeInTheDocument();
    expect(screen.getAllByText('默认楼栋').length).toBeGreaterThan(0);
    expect(screen.queryByText('在管楼栋')).not.toBeInTheDocument();
    expect(screen.getAllByText('阻断发布').length).toBeGreaterThan(0);
    expect(screen.queryByText('可发布')).not.toBeInTheDocument();
    expect(screen.queryByText('库存影响')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '查看默认楼栋' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '查看发布规则' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '查看库存影响' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '补楼栋供给' })).not.toBeInTheDocument();
    expect(mockListHouses).not.toHaveBeenCalled();
  });

  it('saves text-like setting drafts on blur through organization settings api', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <OrganizationSettingsPage />
      </QueryClientProvider>,
    );

    await screen.findByText('通用设置');
    fireEvent.click(screen.getByRole('tab', { name: '通用设置' }));
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
    fireEvent.click(screen.getByRole('tab', { name: '通用设置' }));
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
    fireEvent.click(screen.getByRole('tab', { name: '通用设置' }));
    fireEvent.change(screen.getByLabelText('成员上限'), { target: { value: '18' } });

    selectedOrgSlug = 'beta';
    rerender(
      <QueryClientProvider client={queryClient}>
        <OrganizationSettingsPage />
      </QueryClientProvider>,
    );

    await waitFor(() => expect(mockListSettings).toHaveBeenCalledTimes(2));
    fireEvent.click(await screen.findByRole('tab', { name: '通用设置' }));
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
    fireEvent.mouseDown(screen.getByLabelText('项目小区'));
    fireEvent.click((await screen.findAllByText('星河湾')).at(-1) as HTMLElement);
    fireEvent.change(screen.getByLabelText('楼栋名'), { target: { value: '2 栋' } });
    fireEvent.change(screen.getByLabelText('楼层'), { target: { value: '28' } });
    fireEvent.click(screen.getByRole('button', { name: '保存楼栋' }));

    await waitFor(() => expect(mockCreateBuilding).toHaveBeenCalled());
    await waitFor(() => expect(container.querySelector('[title="星河湾 / 2 栋"]')).toBeInTheDocument());

    selectedOrgSlug = 'beta';
    rerender(
      <QueryClientProvider client={queryClient}>
        <OrganizationSettingsPage />
      </QueryClientProvider>,
    );

    await waitFor(() => expect(mockListSettings.mock.calls.length).toBeGreaterThanOrEqual(3));
    await waitFor(() => expect(container.querySelector('[title="星河湾 / 2 栋"]')).not.toBeInTheDocument());
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
    fireEvent.click(await screen.findByText('星河湾 / 2 栋'));

    await waitFor(() => expect(mockPutSetting).toHaveBeenCalledWith({ key: 'property_rental.default_building_id' }, { value: 12 }));
    expect(mockSetDefaultBuilding).not.toHaveBeenCalled();
  });

  it('saves property rental publish rules through organization settings api', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <OrganizationSettingsPage />
      </QueryClientProvider>,
    );

    await screen.findByText('房源租赁设置');
    expect(screen.getByLabelText('视频最少视频数')).toBeDisabled();
    fireEvent.mouseDown(screen.getByLabelText('视频'));
    fireEvent.click((await screen.findAllByText('仅提醒')).at(-1) as HTMLElement);
    expect(screen.getByLabelText('视频最少视频数')).toBeEnabled();
    fireEvent.mouseDown(screen.getByLabelText('封面图'));
    fireEvent.click((await screen.findAllByText('阻断发布')).at(-1) as HTMLElement);

    await waitFor(() =>
      expect(mockPutSetting).toHaveBeenCalledWith(
        { key: 'property_rental.publish_rules' },
        {
          value: expect.objectContaining({
            cover: { mode: 'required' },
            images: { mode: 'warn', min_count: 3 },
          }),
        },
      ),
    );
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
    fireEvent.mouseDown(screen.getByLabelText('项目小区'));
    fireEvent.click((await screen.findAllByText('星河湾')).at(-1) as HTMLElement);
    fireEvent.change(screen.getByLabelText('楼栋名'), { target: { value: '2 栋' } });
    fireEvent.change(screen.getByLabelText('楼层'), { target: { value: '28' } });
    fireEvent.click(screen.getByRole('button', { name: '保存楼栋' }));

    await waitFor(() => expect(mockCreateBuilding).toHaveBeenCalledWith(expect.objectContaining({ estate_id: 1, name: '2 栋', floors: 28 })));
    expect(mockSetDefaultBuilding).not.toHaveBeenCalled();

    await waitFor(() => expect(mockPutSetting).toHaveBeenCalledWith({ key: 'property_rental.default_building_id' }, { value: 11 }));
  });
});
