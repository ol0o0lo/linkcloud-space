import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React, { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  PropertyAssetWorkspace,
  type PropertyAssetWorkspaceTab,
} from './PropertyAssetWorkspace';

const {
  mockCreateBuilding,
  mockCreateEstate,
  mockGetBuilding,
  mockGetEstate,
  mockGetTagSuggestions,
  mockHistoryPush,
  mockListBuildings,
  mockListEstates,
  mockListHouses,
  mockPatchBuilding,
  mockPatchEstate,
} = vi.hoisted(() => ({
  mockCreateBuilding: vi.fn(),
  mockCreateEstate: vi.fn(),
  mockGetBuilding: vi.fn(),
  mockGetEstate: vi.fn(),
  mockGetTagSuggestions: vi.fn(),
  mockHistoryPush: vi.fn(),
  mockListBuildings: vi.fn(),
  mockListEstates: vi.fn(),
  mockListHouses: vi.fn(),
  mockPatchBuilding: vi.fn(),
  mockPatchEstate: vi.fn(),
}));

vi.mock('@umijs/max', () => ({
  history: { push: mockHistoryPush },
}));

vi.mock('@ant-design/pro-components', () => ({
  ListToolBar: ({
    actions,
    title,
  }: {
    actions?: React.ReactNode[];
    title?: React.ReactNode;
  }) => (
    <div>
      {title}
      <div>{actions}</div>
    </div>
  ),
}));

vi.mock('@/components/AppIcon', () => ({
  AppIcon: ({ name, state }: { name: string; state?: string }) =>
    `${name}:${state || 'default'}`,
}));

vi.mock('@/pages/space/shared', () => ({
  useTenantWorkspace: () => ({ selectedOrgSlug: 'lan' }),
}));

vi.mock('@/components/LocationPicker', () => ({
  LocationPicker: ({
    ariaLabel,
    onChange,
  }: {
    ariaLabel: string;
    onChange: (value: { address: string; lat: number; lng: number }) => void;
  }) => (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={() =>
        onChange({ address: '科技园路 99 号', lat: 22.5, lng: 113.9 })
      }
    >
      选择位置
    </button>
  ),
}));

vi.mock('../components/MediaRefsUpload', () => ({
  default: ({ onChange }: { onChange?: (value: unknown[]) => void }) => (
    <button
      type="button"
      aria-label="楼栋图片"
      onClick={() => onChange?.([{ media_id: 9 }])}
    >
      添加楼栋图片
    </button>
  ),
}));

vi.mock('../components/PropertyTagSelect', () => ({
  PropertyTagSelect: ({
    onChange,
  }: {
    onChange?: (value: string[]) => void;
  }) => (
    <button
      type="button"
      aria-label="楼栋标签"
      onClick={() => onChange?.(['近地铁'])}
    >
      选择楼栋标签
    </button>
  ),
}));

vi.mock('../estates/ResourceDeleteModal', () => ({
  ResourceDeleteModal: ({
    onDeleted,
    open,
    target,
  }: {
    onDeleted: () => void;
    open: boolean;
    target?: { label?: string } | null;
  }) =>
    open ? (
      <div role="dialog" aria-label="删除确认">
        <span>{target?.label}</span>
        <button type="button" onClick={onDeleted}>
          确认删除测试
        </button>
      </div>
    ) : null,
}));

vi.mock('@/services/openapi/organizationSettings', () => ({
  appsSettingsApiListOrgSettings: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/services/manual/enums', () => ({
  enumMapping: (value?: string, mapping?: string) => mapping || value || '-',
  enumSelectOptions: () => [{ label: '住宅', value: 'residential' }],
  useEnums: () => ({
    data: {
      'house.estate_property_type': [{ label: '住宅', value: 'residential' }],
    },
  }),
}));

vi.mock('@/services/manual/house', () => ({
  houseApi: {
    createBuilding: mockCreateBuilding,
    createEstate: mockCreateEstate,
    getBuilding: mockGetBuilding,
    getEstate: mockGetEstate,
    getTagSuggestions: mockGetTagSuggestions,
    listBuildings: mockListBuildings,
    listEstates: mockListEstates,
    listHouses: mockListHouses,
    patchBuilding: mockPatchBuilding,
    patchEstate: mockPatchEstate,
  },
}));

const estate = {
  id: 11,
  name: '云栖花园',
  display_name: '云栖花园',
  property_type: 'residential',
  property_type__mapping: '住宅',
  province: '广东省',
  city: '深圳市',
  district: '南山区',
  address: '科技园路 88 号',
  lat: null,
  lng: null,
  images: [],
  building_count: 2,
  counts: { total: 6, listed: 4, rented: 2, vacant: 0, renovating: 0 },
};

const building = {
  id: 21,
  estate_id: 11,
  estate: { id: 11, name: '云栖花园', display_name: '云栖花园' },
  name: '1栋',
  floors: 18,
  under_floors: 1,
  year_built: 2022,
  elevator: true,
  lat: null,
  lng: null,
  address: '科技园路 88 号 1 栋',
  images: [],
  tags: [],
  counts: { total: 3, listed: 2, rented: 1, vacant: 0, renovating: 0 },
};

function renderWorkspace(
  props: Partial<React.ComponentProps<typeof PropertyAssetWorkspace>> = {},
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const defaultProps: React.ComponentProps<typeof PropertyAssetWorkspace> = {
    activeTab: 'houses',
    estateId: 11,
    onAction: vi.fn(),
    onScopeChange: vi.fn(),
    onTabChange: vi.fn(),
    children: <div>房源表格</div>,
  };
  return render(
    <QueryClientProvider client={queryClient}>
      <PropertyAssetWorkspace {...defaultProps} {...props} />
    </QueryClientProvider>,
  );
}

describe('PropertyAssetWorkspace', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/rental/properties/list');
    mockHistoryPush.mockReset();
    mockGetEstate.mockReset().mockResolvedValue(estate);
    mockGetBuilding.mockReset().mockResolvedValue(building);
    mockCreateEstate.mockReset().mockResolvedValue(estate);
    mockCreateBuilding.mockReset().mockResolvedValue(building);
    mockGetTagSuggestions.mockReset().mockResolvedValue({ tags: ['近地铁'] });
    mockListEstates.mockReset().mockResolvedValue({
      items: [estate],
      total: 1,
      page: 1,
      page_size: 100,
    });
    mockListBuildings.mockReset().mockResolvedValue({
      items: [building],
      total: 1,
      page: 1,
      page_size: 500,
    });
    mockListHouses.mockReset().mockResolvedValue({
      items: [],
      total: 3,
      page: 1,
      page_size: 1,
    });
    mockPatchEstate.mockReset().mockResolvedValue(estate);
    mockPatchBuilding.mockReset().mockResolvedValue(building);
  });

  it('在小区上下文中提供房源、楼栋和项目资料 Tab', async () => {
    const EstateHarness = () => {
      const [activeTab, setActiveTab] =
        useState<PropertyAssetWorkspaceTab>('houses');
      return (
        <PropertyAssetWorkspace
          activeTab={activeTab}
          estateId={11}
          onAction={vi.fn()}
          onScopeChange={vi.fn()}
          onTabChange={setActiveTab}
        >
          <div>房源表格</div>
        </PropertyAssetWorkspace>
      );
    };
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <EstateHarness />
      </QueryClientProvider>,
    );

    fireEvent.click(await screen.findByRole('tab', { name: '楼栋（2）' }));

    await waitFor(() =>
      expect(mockListBuildings).toHaveBeenCalledWith({
        estate_id: 11,
        page: 1,
        page_size: 500,
      }),
    );
    const buildingLink = await screen.findByRole('link', {
      name: '查看楼栋',
    });
    expect(buildingLink).toHaveAttribute(
      'href',
      '/dashboard/rental/properties/buildings/21',
    );
    expect(buildingLink).toHaveAttribute('target', '_blank');
    expect(buildingLink).toHaveAttribute('rel', 'noreferrer');

    const searchInput = screen.getByPlaceholderText('搜索楼栋名称或地址');
    fireEvent.change(searchInput, { target: { value: '科技园路' } });
    fireEvent.keyDown(searchInput, { key: 'Enter', code: 'Enter' });
    await waitFor(() =>
      expect(mockListBuildings).toHaveBeenLastCalledWith({
        estate_id: 11,
        keyword: '科技园路',
        page: 1,
        page_size: 500,
      }),
    );
  });

  it('对象资料加载失败时在房源筛选上方显示重试提示', async () => {
    mockGetEstate.mockRejectedValueOnce(new Error('对象资料加载失败'));

    renderWorkspace({
      children: <div data-testid="house-filters">房源筛选</div>,
    });

    const alertText = await screen.findByText(
      '对象资料暂时无法加载，房源筛选仍可继续使用',
    );
    const alert = alertText.closest('.ant-alert');
    const filters = screen.getByTestId('house-filters');
    expect(alert).not.toBeNull();
    expect(
      (alert as HTMLElement).compareDocumentPosition(filters) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /重\s*试/ }));

    await waitFor(() => expect(mockGetEstate).toHaveBeenCalledTimes(2));
  });

  it('在新标签页打开项目和楼栋详情', async () => {
    const projectView = renderWorkspace({ activeTab: 'profile' });
    const projectLink = await screen.findByRole('link', { name: /查看详情/ });
    expect(projectLink).toHaveAttribute(
      'href',
      '/dashboard/rental/properties/estates/11',
    );
    expect(projectLink).toHaveAttribute('target', '_blank');
    expect(projectLink).toHaveAttribute('rel', 'noreferrer');
    projectView.unmount();

    renderWorkspace({
      activeTab: 'profile',
      buildingId: 21,
      estateId: undefined,
    });
    const buildingLink = await screen.findByRole('link', { name: /查看详情/ });
    expect(buildingLink).toHaveAttribute(
      'href',
      '/dashboard/rental/properties/buildings/21',
    );
    expect(buildingLink).toHaveAttribute('target', '_blank');
    expect(buildingLink).toHaveAttribute('rel', 'noreferrer');
  });

  it('在当前工作区编辑小区资料并在编辑时锁定其他 Tab', async () => {
    renderWorkspace({ activeTab: 'profile' });

    await waitFor(() =>
      expect(screen.getByText('科技园路 88 号')).toBeVisible(),
    );
    expect(
      screen.queryByRole('button', { name: /完整管理/ }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '编辑项目资料' }));

    expect(screen.getByRole('tab', { name: '房源（6）' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    fireEvent.change(screen.getByLabelText('项目名称'), {
      target: { value: '云栖花园二期' },
    });
    fireEvent.click(screen.getByRole('button', { name: '项目位置' }));
    fireEvent.click(screen.getByRole('button', { name: /保存/ }));

    await waitFor(() =>
      expect(mockPatchEstate).toHaveBeenCalledWith(
        11,
        expect.objectContaining({
          name: '云栖花园二期',
          address: '科技园路 99 号',
          lat: 22.5,
          lng: 113.9,
        }),
      ),
    );
  });

  it('在当前工作区编辑楼栋资料', async () => {
    renderWorkspace({
      activeTab: 'profile',
      estateId: undefined,
      buildingId: 21,
    });

    await waitFor(() => expect(screen.getByText('18 层')).toBeVisible());
    fireEvent.click(screen.getByRole('button', { name: '编辑楼栋资料' }));
    fireEvent.change(screen.getByLabelText('楼栋名'), {
      target: { value: 'A座' },
    });
    fireEvent.click(screen.getByRole('button', { name: '楼栋位置' }));
    fireEvent.click(screen.getByRole('button', { name: '楼栋图片' }));
    fireEvent.click(screen.getByRole('button', { name: '楼栋标签' }));
    fireEvent.click(screen.getByRole('button', { name: /保存/ }));

    await waitFor(() =>
      expect(mockPatchBuilding).toHaveBeenCalledWith(
        21,
        expect.objectContaining({
          name: 'A座',
          address: '科技园路 99 号',
          images: [{ media_id: 9 }],
          lat: 22.5,
          lng: 113.9,
          tags: ['近地铁'],
        }),
      ),
    );
  });

  it('修改楼栋名称时同步更新以旧楼栋名结尾的详细地址', async () => {
    const addressBuilding = {
      ...building,
      address: '广州市天河区云栖路88号 1栋',
    };
    let currentBuilding = addressBuilding;
    mockGetBuilding.mockImplementation(async () => currentBuilding);
    mockPatchBuilding.mockImplementation(
      async (_buildingId: number, values: Record<string, unknown>) => {
        currentBuilding = { ...currentBuilding, ...values };
        return currentBuilding;
      },
    );
    renderWorkspace({
      activeTab: 'profile',
      estateId: undefined,
      buildingId: 21,
    });

    fireEvent.click(
      await screen.findByRole('button', { name: '编辑楼栋资料' }),
    );
    fireEvent.change(screen.getByLabelText('楼栋名'), {
      target: { value: '1栋1' },
    });
    expect(screen.getByLabelText('详细地址')).toHaveValue(
      '广州市天河区云栖路88号 1栋1',
    );
    fireEvent.click(screen.getByRole('button', { name: /保存/ }));

    await waitFor(() =>
      expect(mockPatchBuilding).toHaveBeenCalledWith(
        21,
        expect.objectContaining({
          name: '1栋1',
          address: '广州市天河区云栖路88号 1栋1',
        }),
      ),
    );
    expect(await screen.findByRole('heading', { name: '1栋1' })).toBeVisible();
    expect(
      screen.getAllByText('广州市天河区云栖路88号 1栋1').length,
    ).toBeGreaterThan(0);
  });

  it('楼栋归属变化时确认受影响房源后再保存', async () => {
    const otherEstate = {
      ...estate,
      id: 12,
      name: '滨江公馆',
      display_name: '滨江公馆',
    };
    mockListEstates.mockResolvedValue({
      items: [estate, otherEstate],
      total: 2,
      page: 1,
      page_size: 100,
    });
    renderWorkspace({
      activeTab: 'profile',
      estateId: undefined,
      buildingId: 21,
    });

    fireEvent.click(
      await screen.findByRole('button', { name: '编辑楼栋资料' }),
    );
    fireEvent.mouseDown(screen.getByLabelText('所属项目'));
    fireEvent.click(await screen.findByText('滨江公馆'));
    fireEvent.click(screen.getByRole('button', { name: /保存/ }));

    expect(
      await screen.findByRole('dialog', { name: '确认调整楼栋归属' }),
    ).toBeInTheDocument();
    expect(mockPatchBuilding).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(mockListHouses).toHaveBeenCalledWith({
        building_id: 21,
        page: 1,
        page_size: 1,
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: '确认调整' }));

    await waitFor(() =>
      expect(mockPatchBuilding).toHaveBeenCalledWith(
        21,
        expect.objectContaining({ estate_id: 12 }),
      ),
    );
  });

  it('从地图编辑楼栋后返回并重新选中楼栋', async () => {
    window.history.replaceState(
      {},
      '',
      '/rental/properties/list?building_id=21&asset_tab=profile&asset_action=edit-building&return_to=%2Fdashboard%2Frental%2Fproperties%2Fmap%3Fzoom%3D16',
    );
    renderWorkspace({
      action: { type: 'edit-building', buildingId: 21 },
      activeTab: 'profile',
      estateId: undefined,
      buildingId: 21,
    });

    fireEvent.change(await screen.findByLabelText('楼栋名'), {
      target: { value: 'A座' },
    });
    fireEvent.click(screen.getByRole('button', { name: /保存/ }));

    await waitFor(() =>
      expect(mockHistoryPush).toHaveBeenCalledWith(
        '/rental/properties/map?zoom=16&selected_building_id=21',
      ),
    );
  });

  it('在右侧工作区创建项目并进入新项目上下文', async () => {
    const onAssetSaved = vi.fn();
    renderWorkspace({
      action: { type: 'create-estate' },
      estateId: undefined,
      onAssetSaved,
    });

    expect(
      await screen.findByRole('heading', { name: '新建项目' }),
    ).toBeVisible();
    fireEvent.change(screen.getByLabelText('项目名称'), {
      target: { value: '未来社区' },
    });
    fireEvent.change(screen.getByLabelText('省份'), {
      target: { value: '广东省' },
    });
    fireEvent.change(screen.getByLabelText('城市'), {
      target: { value: '深圳市' },
    });
    fireEvent.change(screen.getByLabelText('区域'), {
      target: { value: '南山区' },
    });
    fireEvent.click(screen.getByRole('button', { name: /创建项目/ }));

    await waitFor(() =>
      expect(mockCreateEstate).toHaveBeenCalledWith(
        expect.objectContaining({ name: '未来社区' }),
      ),
    );
    expect(onAssetSaved).toHaveBeenCalledWith('estate', estate);
  });

  it('在项目上下文创建楼栋并继承项目位置', async () => {
    mockGetEstate.mockResolvedValue({
      ...estate,
      address: '科技园路 88 号',
      lat: '22.4',
      lng: '113.8',
    });
    const onAssetSaved = vi.fn();
    renderWorkspace({
      action: { type: 'create-building', estateId: 11 },
      onAssetSaved,
    });

    expect(
      await screen.findByRole('heading', { name: '新建楼栋' }),
    ).toBeVisible();
    fireEvent.change(screen.getByLabelText('楼栋名'), {
      target: { value: '3栋' },
    });
    fireEvent.change(screen.getByLabelText('详细地址'), {
      target: { value: '科技园路 88 号 3 栋' },
    });
    fireEvent.click(screen.getByRole('button', { name: /创建楼栋/ }));

    await waitFor(() =>
      expect(mockCreateBuilding).toHaveBeenCalledWith(
        expect.objectContaining({
          estate_id: 11,
          lat: 22.4,
          lng: 113.8,
          name: '3栋',
        }),
      ),
    );
    expect(onAssetSaved).toHaveBeenCalledWith('building', building);
  });

  it('在资料页完成楼栋删除闭环', async () => {
    const onAssetDeleted = vi.fn();
    renderWorkspace({
      activeTab: 'profile',
      buildingId: 21,
      estateId: undefined,
      onAssetDeleted,
    });

    fireEvent.click(await screen.findByRole('button', { name: '删除楼栋' }));
    expect(screen.getByRole('dialog', { name: '删除确认' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: '确认删除测试' }));

    await waitFor(() =>
      expect(onAssetDeleted).toHaveBeenCalledWith('building', 21),
    );
  });
});
