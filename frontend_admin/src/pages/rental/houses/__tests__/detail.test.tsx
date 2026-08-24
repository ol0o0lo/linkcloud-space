import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import HouseDetailPage from '../detail';

const {
  mockUseParams,
  mockGetHouse,
  mockListBuildings,
  mockListContacts,
  mockListLeases,
  mockListViewings,
  mockPatchHouse,
  mockGetTagSuggestions,
  mockUseAmap,
  mockGetFavorites,
  mockPutFavorite,
  mockRemoveFavorite,
} = vi.hoisted(() => ({
  mockUseParams: vi.fn(),
  mockGetHouse: vi.fn(),
  mockListBuildings: vi.fn(),
  mockListContacts: vi.fn(),
  mockListLeases: vi.fn(),
  mockListViewings: vi.fn(),
  mockPatchHouse: vi.fn(),
  mockGetTagSuggestions: vi.fn(),
  mockUseAmap: vi.fn(),
  mockGetFavorites: vi.fn(),
  mockPutFavorite: vi.fn(),
  mockRemoveFavorite: vi.fn(),
}));

vi.mock('@umijs/max', () => ({
  useParams: mockUseParams,
}));

vi.mock('@/pages/rental/useHousePublishRules', () => ({
  useHousePublishRules: () => ({ rules: {}, isPending: false }),
}));

vi.mock('@/services/manual/enums', () => ({
  enumMapping: (value?: string | null, mapping?: string | null) =>
    mapping || value || '-',
  enumSelectOptions: (
    enumMap:
      | Record<string, Array<{ label: string; value: string }>>
      | undefined,
    key: string,
  ) => enumMap?.[key] || [],
  useEnums: () => ({
    data: {
      'house.house_status': [
        { label: '空置', value: 'vacant' },
        { label: '招租', value: 'listed' },
      ],
      'house.house_orientation': [
        { label: '朝南', value: 'south' },
        { label: '南北', value: 'south_north' },
      ],
      'house.house_decoration': [
        { label: '简装', value: 'simple' },
        { label: '精装修', value: 'fine' },
      ],
    },
    isError: false,
  }),
}));

vi.mock('@/pages/space/shared', () => ({
  TenantSelectionGuard: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  useTenantWorkspace: () => ({
    selectedOrgSlug: 'org',
    queryClient: new QueryClient(),
  }),
}));

vi.mock('@/components/EntityPreview', () => {
  const preview =
    (type: string) =>
    ({ id, children }: { id?: number | null; children: React.ReactNode }) => (
      <span data-preview={type} data-id={id}>
        {children}
      </span>
    );
  return {
    BuildingPreview: preview('building'),
    ContactPreview: preview('contact'),
    EstatePreview: preview('estate'),
    HousePreview: preview('house'),
    LeasePreview: preview('lease'),
    ViewingPreview: preview('viewing'),
  };
});

vi.mock('@/services/manual/house', () => ({
  houseApi: {
    getHouse: mockGetHouse,
    listBuildings: mockListBuildings,
    listContacts: mockListContacts,
    listLeases: mockListLeases,
    listViewingRecords: mockListViewings,
    patchHouse: mockPatchHouse,
    getTagSuggestions: mockGetTagSuggestions,
  },
}));

vi.mock('@/services/manual/amap', () => ({
  useAmap: mockUseAmap,
}));

vi.mock('@/services/manual/favorites', () => ({
  getMyFavorites: mockGetFavorites,
  putFavorite: mockPutFavorite,
  removeFavorite: mockRemoveFavorite,
}));

const estateSummary = { id: 1, name: 'xinghewan', display_name: '星河湾' };
const buildingSummary = {
  id: 10,
  estate_id: 1,
  estate: estateSummary,
  name: '1 栋',
  elevator: true,
  tags: ['近地铁', '有电梯'],
};
const landlordSummary = { id: 20, name: '张房东', phone: '13800000000' };
const tenantSummary = { id: 6, name: '王租客', phone: '13700000000' };
const houseSummary = {
  id: 99,
  label: '星河湾 / 1 栋 / 1801',
  room_number: '1801',
  building_id: 10,
  building: buildingSummary,
};

const completeHouse = {
  id: 99,
  building_id: 10,
  building: buildingSummary,
  landlord_id: 20,
  landlord: landlordSummary,
  room_number: '1801',
  asking_rent: '4200.00',
  deposit_amount: '4200.00',
  area: '80.00',
  images: [
    {
      media_id: 1,
      media_type: 'image',
      image_role: 'cover',
      url: '/cover.jpg',
    },
    {
      media_id: 2,
      media_type: 'image',
      image_role: 'floor_plan',
      url: '/plan.jpg',
    },
    {
      media_id: 3,
      media_type: 'image',
      image_role: 'bedroom',
      url: '/room.jpg',
    },
  ],
  videos: [],
  status: 'vacant',
};

const originalMatchMedia = window.matchMedia;

async function openQuickActions() {
  fireEvent.click(screen.getByRole('button', { name: '更多快捷操作' }));
  return screen.findByRole('menu');
}

describe('House detail page', () => {
  afterEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: originalMatchMedia,
    });
  });

  beforeEach(() => {
    mockUseParams.mockReturnValue({ id: '99' });
    window.history.pushState({}, '', '/');
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
    mockGetHouse.mockReset();
    mockListBuildings.mockResolvedValue({
      items: [buildingSummary],
      total: 1,
      page: 1,
      page_size: 20,
    });
    mockListContacts.mockResolvedValue({
      items: [
        { id: 20, name: '张房东', phone: '13800000000', roles: ['landlord'] },
      ],
      total: 1,
      page: 1,
      page_size: 20,
    });
    mockListLeases.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      page_size: 5,
    });
    mockListViewings.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      page_size: 5,
    });
    mockPatchHouse.mockReset();
    mockPatchHouse.mockResolvedValue({
      ...completeHouse,
      status: 'listed',
    });
    mockGetFavorites.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      page_size: 1,
    });
    mockPutFavorite.mockResolvedValue({});
    mockRemoveFavorite.mockResolvedValue({ success: true });
    mockGetTagSuggestions.mockResolvedValue({ tags: ['采光好', '南北通透'] });
    mockUseAmap.mockReturnValue({
      AMap: null,
      loading: true,
      error: null,
      reload: vi.fn(),
    });
  });

  it('uses the matching preview type for estate building and house fields', async () => {
    mockGetHouse.mockResolvedValue(completeHouse);

    render(
      <QueryClientProvider client={new QueryClient()}>
        <HouseDetailPage />
      </QueryClientProvider>,
    );

    expect(await screen.findByText('房源资料')).toBeInTheDocument();
    await waitFor(() => {
      expect(
        document.querySelector('[data-preview="estate"][data-id="1"]'),
      ).toHaveTextContent('星河湾');
      expect(
        document.querySelector('[data-preview="building"][data-id="10"]'),
      ).toHaveTextContent('1 栋');
      expect(
        document.querySelector('[data-preview="house"][data-id="99"]'),
      ).toHaveTextContent('1801');
    });
  });

  it('offers the approved desktop inline fields and saves the area in place', async () => {
    const house = {
      ...completeHouse,
      bedrooms: 2,
      living_rooms: 1,
      bathrooms: 1,
      floor: 12,
      orientation: 'south',
      orientation__mapping: '朝南',
      decoration: 'fine',
      decoration__mapping: '精装修',
    };
    mockGetHouse.mockResolvedValue(house);
    mockPatchHouse.mockImplementation(async (_id, payload) => ({
      ...house,
      ...payload,
    }));

    render(
      <QueryClientProvider client={new QueryClient()}>
        <HouseDetailPage />
      </QueryClientProvider>,
    );

    await screen.findByText('房源资料');
    [
      '编辑挂牌租金',
      '编辑押金',
      '编辑户型',
      '编辑建筑面积',
      '编辑楼层',
      '编辑房号',
      '编辑房东',
      '编辑卫生间',
      '编辑厨房',
      '编辑阳台',
      '编辑朝向',
      '编辑装修',
      '编辑对外描述',
      '编辑内部备注',
      '编辑房源标签',
    ].forEach((name) => {
      expect(screen.getByRole('button', { name })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: '编辑建筑面积' }));
    const areaInput = screen.getByRole('spinbutton', { name: '建筑面积' });
    fireEvent.change(areaInput, { target: { value: '85.5' } });
    fireEvent.keyDown(areaInput, { key: 'Enter' });

    await waitFor(() =>
      expect(mockPatchHouse).toHaveBeenCalledWith(99, { area: 85.5 }),
    );
    expect(await screen.findByText('85.5 ㎡')).toBeInTheDocument();
  });

  it('updates only rooms and living rooms from the inline layout editor', async () => {
    const house = {
      ...completeHouse,
      bedrooms: 2,
      living_rooms: 1,
      bathrooms: 1,
    };
    mockGetHouse.mockResolvedValue(house);
    mockPatchHouse.mockImplementation(async (_id, payload) => ({
      ...house,
      ...payload,
    }));

    render(
      <QueryClientProvider client={new QueryClient()}>
        <HouseDetailPage />
      </QueryClientProvider>,
    );

    await screen.findByText('房源资料');
    expect(screen.getByText('2房1厅')).toBeInTheDocument();
    expect(screen.queryByText('2房1厅1卫')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '编辑户型' }));
    const bedrooms = screen.getByRole('spinbutton', { name: '室' });
    const livingRooms = screen.getByRole('spinbutton', { name: '厅' });
    fireEvent.change(bedrooms, { target: { value: '1' } });
    fireEvent.change(livingRooms, { target: { value: '0' } });
    fireEvent.keyDown(livingRooms, { key: 'Enter' });

    await waitFor(() =>
      expect(mockPatchHouse).toHaveBeenCalledWith(99, {
        bedrooms: 1,
        living_rooms: 0,
      }),
    );
    expect(await screen.findByText('单间')).toBeInTheDocument();
  });

  it('edits bathroom, kitchen, and balcony independently in house properties', async () => {
    const house = {
      ...completeHouse,
      bathrooms: 1,
      kitchens: 1,
      balconies: 2,
    };
    mockGetHouse.mockResolvedValue(house);
    mockPatchHouse.mockImplementation(async (_id, payload) => ({
      ...house,
      ...payload,
    }));

    render(
      <QueryClientProvider client={new QueryClient()}>
        <HouseDetailPage />
      </QueryClientProvider>,
    );

    const properties = await screen.findByLabelText('房源属性');
    expect(within(properties).getByText('1卫')).toBeInTheDocument();
    expect(within(properties).getByText('1厨')).toBeInTheDocument();
    expect(within(properties).getByText('2阳台')).toBeInTheDocument();

    fireEvent.click(
      within(properties).getByRole('button', { name: '编辑卫生间' }),
    );
    const bathroom = within(properties).getByRole('spinbutton', {
      name: '卫生间',
    });
    fireEvent.change(bathroom, { target: { value: '2' } });
    fireEvent.pointerDown(document.body);
    await waitFor(() =>
      expect(mockPatchHouse).toHaveBeenLastCalledWith(99, { bathrooms: 2 }),
    );

    fireEvent.click(
      within(properties).getByRole('button', { name: '编辑厨房' }),
    );
    const kitchen = within(properties).getByRole('spinbutton', {
      name: '厨房',
    });
    fireEvent.change(kitchen, { target: { value: '2' } });
    fireEvent.keyDown(kitchen, { key: 'Enter' });
    await waitFor(() =>
      expect(mockPatchHouse).toHaveBeenLastCalledWith(99, { kitchens: 2 }),
    );

    fireEvent.click(
      within(properties).getByRole('button', { name: '编辑阳台' }),
    );
    const balcony = within(properties).getByRole('spinbutton', {
      name: '阳台',
    });
    fireEvent.change(balcony, { target: { value: '3' } });
    fireEvent.keyDown(balcony, { key: 'Enter' });
    await waitFor(() =>
      expect(mockPatchHouse).toHaveBeenLastCalledWith(99, { balconies: 3 }),
    );
  });

  it('edits descriptions and notes inline without treating Enter as save', async () => {
    const house = {
      ...completeHouse,
      public_description: '原对外描述',
      internal_notes: '原内部备注',
    };
    mockGetHouse.mockResolvedValue(house);
    mockPatchHouse.mockImplementation(async (_id, payload) => ({
      ...house,
      ...payload,
    }));

    render(
      <QueryClientProvider client={new QueryClient()}>
        <HouseDetailPage />
      </QueryClientProvider>,
    );

    await screen.findByText('房源资料');
    fireEvent.click(screen.getByRole('button', { name: '编辑对外描述' }));
    const description = screen.getByRole('textbox', { name: '对外描述' });
    fireEvent.change(description, { target: { value: '第一行\n第二行' } });
    fireEvent.keyDown(description, { key: 'Enter' });
    expect(mockPatchHouse).not.toHaveBeenCalled();

    fireEvent.keyDown(description, { ctrlKey: true, key: 'Enter' });
    await waitFor(() =>
      expect(mockPatchHouse).toHaveBeenCalledWith(99, {
        public_description: '第一行\n第二行',
      }),
    );

    fireEvent.click(screen.getByRole('button', { name: '编辑内部备注' }));
    const notes = screen.getByRole('textbox', { name: '内部备注' });
    fireEvent.change(notes, { target: { value: '新的内部备注' } });
    fireEvent.pointerDown(document.body);

    await waitFor(() =>
      expect(mockPatchHouse).toHaveBeenCalledWith(99, {
        internal_notes: '新的内部备注',
      }),
    );
  });

  it('edits only house tags inline and explains inherited building tags', async () => {
    const house = {
      ...completeHouse,
      tags: ['采光好'],
      effective_tags: ['采光好', '近地铁', '有电梯'],
      building: {
        ...buildingSummary,
        tags: ['近地铁', '有电梯'],
      },
    };
    mockGetHouse.mockResolvedValue(house);
    mockPatchHouse.mockImplementation(async (_id, payload) => ({
      ...house,
      ...payload,
    }));

    render(
      <QueryClientProvider client={new QueryClient()}>
        <HouseDetailPage />
      </QueryClientProvider>,
    );

    const materialTitle = await screen.findByText('房源资料');
    const materialCard = materialTitle.closest('.ant-card') as HTMLElement;
    const tagsRegion = within(materialCard).getByRole('region', {
      name: '房源标签',
    });
    expect(
      within(tagsRegion).getByText('采光好').closest('.ant-tag'),
    ).toHaveClass('ant-tag-purple');
    const buildingTag = within(tagsRegion)
      .getByText('近地铁')
      .closest('.ant-tag');
    expect(buildingTag).toHaveClass('ant-tag-blue');
    fireEvent.mouseEnter(buildingTag as HTMLElement);
    expect(
      await screen.findByText('该标签来自楼栋，暂不可修改'),
    ).toBeInTheDocument();

    fireEvent.click(
      within(materialCard).getByRole('button', { name: '编辑房源标签' }),
    );
    expect(
      within(materialCard).queryByText(
        '蓝色标签继承自楼栋，仅可在楼栋资料中修改',
      ),
    ).not.toBeInTheDocument();
    expect(
      within(materialCard).queryByText(
        '选择常用标签，或输入后按回车；逗号可批量添加。',
      ),
    ).not.toBeInTheDocument();
    expect(
      within(materialCard).queryByText('将从当前楼栋继承：'),
    ).not.toBeInTheDocument();
    expect(
      within(materialCard).queryByLabelText('常用标签'),
    ).not.toBeInTheDocument();
    const tagInput = within(materialCard).getByRole('combobox', {
      name: '房源标签',
    });
    fireEvent.change(tagInput, { target: { value: '南向阳台,' } });
    fireEvent.pointerDown(document.body);

    await waitFor(() =>
      expect(mockPatchHouse).toHaveBeenCalledWith(99, {
        tags: ['采光好', '南向阳台'],
      }),
    );
  });

  it('edits text and object extension fields while preserving siblings', async () => {
    const extra = {
      门锁品牌: '凯迪仕',
      钥匙数量: 3,
      需要预约: true,
      配套: ['空调', '冰箱'],
      验房信息: { 水表读数: 12, 正常: true },
    };
    const house = { ...completeHouse, extra };
    mockGetHouse.mockResolvedValue(house);
    mockPatchHouse.mockImplementation(async (_id, payload) => ({
      ...house,
      ...payload,
    }));

    render(
      <QueryClientProvider client={new QueryClient()}>
        <HouseDetailPage />
      </QueryClientProvider>,
    );

    await screen.findByText('房源资料');
    fireEvent.click(
      screen.getByRole('button', { name: '编辑扩展字段门锁品牌' }),
    );
    const brand = screen.getByRole('textbox', { name: '扩展字段门锁品牌' });
    fireEvent.change(brand, { target: { value: '德施曼' } });
    fireEvent.keyDown(brand, { key: 'Enter' });

    await waitFor(() =>
      expect(mockPatchHouse).toHaveBeenCalledWith(99, {
        extra: { ...extra, 门锁品牌: '德施曼' },
      }),
    );

    fireEvent.click(
      screen.getByRole('button', { name: '编辑扩展字段验房信息' }),
    );
    const inspection = screen.getByRole('textbox', {
      name: '扩展字段验房信息',
    });
    fireEvent.change(inspection, { target: { value: '{' } });
    fireEvent.keyDown(inspection, { ctrlKey: true, key: 'Enter' });
    expect(await screen.findByText('JSON 格式不正确')).toBeInTheDocument();
    expect(mockPatchHouse).toHaveBeenCalledTimes(1);

    fireEvent.change(inspection, {
      target: { value: '{"水表读数":18,"正常":false}' },
    });
    fireEvent.keyDown(inspection, { ctrlKey: true, key: 'Enter' });

    await waitFor(() =>
      expect(mockPatchHouse).toHaveBeenCalledWith(99, {
        extra: {
          ...extra,
          门锁品牌: '德施曼',
          验房信息: { 水表读数: 18, 正常: false },
        },
      }),
    );
  });

  it('edits number and boolean extension fields with their original types', async () => {
    const extra = {
      钥匙数量: 3,
      需要预约: true,
      验房信息: { 水表读数: 12 },
    };
    const house = { ...completeHouse, extra };
    mockGetHouse.mockResolvedValue(house);
    mockPatchHouse.mockImplementation(async (_id, payload) => ({
      ...house,
      ...payload,
    }));

    render(
      <QueryClientProvider client={new QueryClient()}>
        <HouseDetailPage />
      </QueryClientProvider>,
    );

    await screen.findByText('房源资料');
    fireEvent.click(
      screen.getByRole('button', { name: '编辑扩展字段钥匙数量' }),
    );
    const keyCount = screen.getByRole('spinbutton', {
      name: '扩展字段钥匙数量',
    });
    fireEvent.change(keyCount, { target: { value: '5' } });
    fireEvent.keyDown(keyCount, { key: 'Enter' });

    await waitFor(() =>
      expect(mockPatchHouse).toHaveBeenCalledWith(99, {
        extra: { ...extra, 钥匙数量: 5 },
      }),
    );

    fireEvent.click(
      screen.getByRole('button', { name: '编辑扩展字段需要预约' }),
    );
    fireEvent.mouseDown(
      screen.getByRole('combobox', { name: '扩展字段需要预约' }),
    );
    fireEvent.click((await screen.findAllByText('否')).at(-1) as HTMLElement);

    await waitFor(() =>
      expect(mockPatchHouse).toHaveBeenCalledWith(99, {
        extra: { ...extra, 钥匙数量: 5, 需要预约: false },
      }),
    );
  });

  it('edits array extension fields without changing existing item types', async () => {
    const extra = {
      配套: ['空调', 2],
      来源: '导入',
    };
    const house = { ...completeHouse, extra };
    mockGetHouse.mockResolvedValue(house);
    mockPatchHouse.mockImplementation(async (_id, payload) => ({
      ...house,
      ...payload,
    }));

    render(
      <QueryClientProvider client={new QueryClient()}>
        <HouseDetailPage />
      </QueryClientProvider>,
    );

    await screen.findByText('房源资料');

    fireEvent.click(screen.getByRole('button', { name: '编辑扩展字段配套' }));
    const facilities = screen.getByRole('combobox', {
      name: '扩展字段配套',
    });
    fireEvent.change(facilities, { target: { value: '洗衣机,' } });
    fireEvent.pointerDown(document.body);

    await waitFor(() =>
      expect(mockPatchHouse).toHaveBeenCalledWith(99, {
        extra: {
          ...extra,
          配套: ['空调', 2, '洗衣机'],
        },
      }),
    );
  });

  it('keeps touch devices on the full edit drawer without inline actions', async () => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        addEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
        matches: false,
        media: query,
        onchange: null,
        removeEventListener: vi.fn(),
      })),
    });
    mockGetHouse.mockResolvedValue(completeHouse);

    render(
      <QueryClientProvider client={new QueryClient()}>
        <HouseDetailPage />
      </QueryClientProvider>,
    );

    await screen.findByText('房源资料');
    expect(
      screen.queryByRole('button', { name: '编辑挂牌租金' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: '编辑资料' }),
    ).toBeInTheDocument();
  });

  it('renders a complete read-only house overview', async () => {
    mockGetHouse.mockResolvedValue({
      ...completeHouse,
      floor: 18,
      bedrooms: 2,
      living_rooms: 1,
      bathrooms: 1,
      kitchens: 1,
      balconies: 1,
      orientation: 'south',
      orientation__mapping: '朝南',
      decoration: 'fine',
      decoration__mapping: '精装修',
      has_elevator_access: true,
      public_description: '采光通透，适合长期居住。',
      internal_notes: '交付前确认钥匙数量。',
      tags: ['采光好', '近地铁'],
      effective_tags: ['采光好', '近地铁', '成熟配套'],
      extra: {
        门锁品牌: '凯迪仕',
        key_count: 3,
      },
      building: {
        ...buildingSummary,
        address: '广州市天河区云栖路88号 1栋',
        lat: 23.137313,
        lng: 113.34392,
      },
    });

    render(
      <QueryClientProvider client={new QueryClient()}>
        <HouseDetailPage />
      </QueryClientProvider>,
    );

    expect(await screen.findByText('星河湾 · 1 栋 · 1801')).toBeInTheDocument();
    expect((await screen.findAllByText('18 层')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('朝南').length).toBeGreaterThan(0);
    expect(screen.getAllByText('精装修').length).toBeGreaterThan(0);
    expect(screen.getByText('采光通透，适合长期居住。')).toBeInTheDocument();
    expect(screen.getByText('交付前确认钥匙数量。')).toBeInTheDocument();
    expect(screen.getByText('近地铁')).toBeInTheDocument();
    expect(screen.getByText('采光好')).toBeInTheDocument();
    expect(screen.getByText('成熟配套')).toBeInTheDocument();
    expect(screen.getByText('位置与周边')).toBeInTheDocument();
    expect(screen.getByText('门锁品牌')).toBeInTheDocument();
    expect(screen.getByText('key count')).toBeInTheDocument();
    expect(screen.queryByText('自定义')).not.toBeInTheDocument();
    expect(screen.getByText('凯迪仕')).toBeInTheDocument();

    const detailCard = screen.getByText('房源资料').closest('.ant-card');
    expect(detailCard).not.toBeNull();
    expect(
      within(detailCard as HTMLElement).getByRole('region', {
        name: '房源标签',
      }),
    ).toBeInTheDocument();
    expect(
      within(detailCard as HTMLElement).getByRole('region', {
        name: '房源字段',
      }),
    ).toBeInTheDocument();
    expect(
      within(detailCard as HTMLElement).getByText('房东信息'),
    ).toBeInTheDocument();
    expect(
      within(detailCard as HTMLElement).getByText('张房东 / 13800000000'),
    ).toBeInTheDocument();
    expect(
      within(detailCard as HTMLElement).getByText('广州市天河区云栖路88号 1栋'),
    ).toBeInTheDocument();
    const heroCard = screen
      .getByRole('heading', { name: '¥4,200' })
      .closest('.ant-card');
    expect(heroCard).not.toBeNull();
    expect(
      within(heroCard as HTMLElement).getByText('押金'),
    ).toBeInTheDocument();
    expect(
      within(heroCard as HTMLElement).getByText('¥4,200', {
        selector: ':not(h2)',
      }),
    ).toBeInTheDocument();
    expect(
      within(heroCard as HTMLElement).queryByText('房东'),
    ).not.toBeInTheDocument();
    expect(
      within(detailCard as HTMLElement).queryByText('所在楼层'),
    ).not.toBeInTheDocument();
    expect(
      within(detailCard as HTMLElement).queryByText('挂牌租金'),
    ).not.toBeInTheDocument();
  });

  it('toggles the favorite icon and turns it red after favoriting', async () => {
    mockGetHouse.mockResolvedValue({ ...completeHouse, status: 'listed' });
    mockGetFavorites.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      page_size: 1,
    });

    render(
      <QueryClientProvider client={new QueryClient()}>
        <HouseDetailPage />
      </QueryClientProvider>,
    );

    const favoriteButton = await screen.findByRole('button', {
      name: '收藏房源',
    });
    await waitFor(() => expect(favoriteButton).toBeEnabled());
    fireEvent.click(favoriteButton);

    await waitFor(() =>
      expect(mockPutFavorite).toHaveBeenCalledWith('house', '99'),
    );
    const activeButton = await screen.findByRole('button', {
      name: '取消收藏',
    });
    expect(activeButton).toHaveStyle({ color: '#ff4d4f' });

    fireEvent.click(activeButton);
    await waitFor(() =>
      expect(mockRemoveFavorite).toHaveBeenCalledWith('house', '99'),
    );
  });

  it('groups house fields and places tags after internal notes in the material card', async () => {
    mockGetHouse.mockResolvedValue({
      ...completeHouse,
      bathrooms: 1,
      kitchens: 1,
      balconies: 1,
      interior_area: '63.20',
      orientation: 'south',
      orientation__mapping: '朝南',
      decoration: 'fine',
      decoration__mapping: '精装修',
      public_description: '采光通透，适合长期居住。',
      internal_notes: '交付前确认钥匙数量。',
      tags: ['采光好'],
      effective_tags: ['采光好', '近地铁'],
      extra: { source: 'codex_demo_seed' },
      building: {
        ...buildingSummary,
        address: '广州市天河区云栖路88号 1栋',
      },
    });

    render(
      <QueryClientProvider client={new QueryClient()}>
        <HouseDetailPage />
      </QueryClientProvider>,
    );

    const materialTitle = await screen.findByText('房源资料');
    const materialCard = materialTitle.closest('.ant-card');
    expect(materialCard).not.toBeNull();

    const material = within(materialCard as HTMLElement);
    const introduction = material.getByText('采光通透，适合长期居住。');
    const noteLabel = material.getByText('内部备注：');
    const ownTag = material.getByText('采光好');
    expect(
      introduction.compareDocumentPosition(noteLabel) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      noteLabel.compareDocumentPosition(ownTag) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(material.queryByText('房源介绍')).not.toBeInTheDocument();
    expect(material.queryByText('房源标签')).not.toBeInTheDocument();
    expect(material.queryByText('房源字段')).not.toBeInTheDocument();
    expect(material.getByText('归属信息')).toBeInTheDocument();
    const propertyFields = material.getByRole('region', {
      name: '房源属性',
    });
    expect(within(propertyFields).getByText('厨房')).toBeInTheDocument();
    expect(within(propertyFields).getByText('阳台')).toBeInTheDocument();
    expect(within(propertyFields).getByText('source')).toBeInTheDocument();
    expect(material.queryByText('户型配置')).not.toBeInTheDocument();
    expect(material.queryByText('扩展字段')).not.toBeInTheDocument();
    expect(ownTag).toBeInTheDocument();
    expect(material.getByText('近地铁')).toBeInTheDocument();
    expect(material.queryByText('档案状态')).not.toBeInTheDocument();
  });

  it('shows an explicit invalid-id state without requesting a house', async () => {
    mockUseParams.mockReturnValue({ id: 'invalid' });

    render(
      <QueryClientProvider client={new QueryClient()}>
        <HouseDetailPage />
      </QueryClientProvider>,
    );

    expect(await screen.findByText('房源地址无效')).toBeInTheDocument();
    expect(mockGetHouse).not.toHaveBeenCalled();
  });

  it('shows an explicit not-found state for missing houses', async () => {
    mockGetHouse.mockRejectedValue({ info: { code: 404 } });

    render(
      <QueryClientProvider client={new QueryClient()}>
        <HouseDetailPage />
      </QueryClientProvider>,
    );

    expect(await screen.findByText('未找到房源')).toBeInTheDocument();
    expect(
      screen.getByText('房源不存在，或不属于当前空间。'),
    ).toBeInTheDocument();
  });

  it('keeps secondary house actions in the header shortcut menu', async () => {
    mockGetHouse.mockResolvedValue(completeHouse);

    render(
      <QueryClientProvider client={new QueryClient()}>
        <HouseDetailPage />
      </QueryClientProvider>,
    );

    await screen.findAllByText('1801');
    expect(screen.getAllByRole('button', { name: '编辑资料' })).toHaveLength(1);
    await openQuickActions();
    expect(screen.getByRole('link', { name: '登记带看' })).toHaveAttribute(
      'href',
      '/dashboard/rental/viewings?house_id=99',
    );
    expect(screen.getByRole('link', { name: '新建租约' })).toHaveAttribute(
      'href',
      '/dashboard/rental/leases?house_id=99',
    );
    fireEvent.click(screen.getByRole('menuitem', { name: /修改房态/ }));
    expect(await screen.findByText('编辑房源资料')).toBeInTheDocument();
    expect(screen.getByLabelText('房态')).toBeInTheDocument();
  });

  it('keeps publishing disabled when required fields are missing', async () => {
    mockGetHouse.mockResolvedValue({
      ...completeHouse,
      landlord_id: null,
      images: [],
    });

    render(
      <QueryClientProvider client={new QueryClient()}>
        <HouseDetailPage />
      </QueryClientProvider>,
    );

    expect(await screen.findByText('房源资料')).toBeInTheDocument();
    expect(screen.queryByText('缺房东')).not.toBeInTheDocument();
    expect(screen.queryByText('缺封面')).not.toBeInTheDocument();
    await openQuickActions();
    expect(
      screen.getByRole('menuitem', { name: '待补齐后发布' }),
    ).toHaveAttribute('aria-disabled', 'true');
  });

  it('opens media management directly for video maintenance tasks', async () => {
    mockGetHouse.mockResolvedValue({ ...completeHouse, videos: [] });

    window.history.pushState(
      {},
      '',
      '/rental/properties/99?action=media&task=video',
    );

    render(
      <QueryClientProvider client={new QueryClient()}>
        <HouseDetailPage />
      </QueryClientProvider>,
    );

    expect(await screen.findByText('编辑房源资料')).toBeInTheDocument();
    expect(screen.getByText('图片与视频')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /上传视频/ }),
    ).toBeInTheDocument();
  });

  it('allows publishing when only warning issues remain', async () => {
    mockGetHouse.mockResolvedValue({
      ...completeHouse,
      images: [],
      publish_can_publish: true,
      publish_blocking_issues: [],
      publish_warning_issues: ['缺封面', '图片不足', '缺户型图'],
    });

    render(
      <QueryClientProvider client={new QueryClient()}>
        <HouseDetailPage />
      </QueryClientProvider>,
    );

    await screen.findAllByText('1801');
    expect(screen.queryByText('缺封面')).not.toBeInTheDocument();
    expect(screen.queryByText('图片不足')).not.toBeInTheDocument();
    await openQuickActions();
    fireEvent.click(screen.getByRole('menuitem', { name: '发布房源' }));
    fireEvent.click(await screen.findByRole('button', { name: '确认发布' }));
    await waitFor(() =>
      expect(mockPatchHouse).toHaveBeenCalledWith(99, {
        status: 'listed',
      }),
    );
    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: '确认发布房源' }),
      ).not.toBeInTheDocument(),
    );
  });

  it('does not render missing layout as zero rooms', async () => {
    mockGetHouse.mockResolvedValue({
      ...completeHouse,
      bedrooms: null,
      living_rooms: null,
      bathrooms: null,
    });

    render(
      <QueryClientProvider client={new QueryClient()}>
        <HouseDetailPage />
      </QueryClientProvider>,
    );

    await screen.findAllByText('1801');
    expect(screen.queryByText('0 / 0 / 0')).not.toBeInTheDocument();
  });

  it('keeps the room summary to bedrooms and living rooms and moves secondary layout below', async () => {
    mockGetHouse.mockResolvedValue({
      ...completeHouse,
      bedrooms: 2,
      living_rooms: 1,
      bathrooms: 1,
      kitchens: 1,
      balconies: 1,
    });

    render(
      <QueryClientProvider client={new QueryClient()}>
        <HouseDetailPage />
      </QueryClientProvider>,
    );

    expect((await screen.findAllByText('2房1厅')).length).toBeGreaterThan(0);
    expect(screen.queryByText('2房1厅1卫')).not.toBeInTheDocument();
    const properties = await screen.findByLabelText('房源属性');
    expect(within(properties).getByText('卫生间')).toBeInTheDocument();
    expect(within(properties).getByText('1卫')).toBeInTheDocument();
    expect(await screen.findByText('厨房')).toBeInTheDocument();
    expect(screen.getByText('1厨')).toBeInTheDocument();
    expect(screen.getByText('阳台')).toBeInTheDocument();
    expect(screen.getByText('1阳台')).toBeInTheDocument();
    expect(
      screen.queryByText('2房1厅 / 1卫 / 1厨 / 1阳台'),
    ).not.toBeInTheDocument();
  });

  it('keeps building area in summary and moves secondary facts below', async () => {
    mockGetHouse.mockResolvedValue({
      ...completeHouse,
      interior_area: '68.00',
      orientation: 'south_north',
      orientation__mapping: '南北',
      decoration: 'simple',
      decoration__mapping: '简装',
      has_elevator_access: true,
    });

    render(
      <QueryClientProvider client={new QueryClient()}>
        <HouseDetailPage />
      </QueryClientProvider>,
    );

    expect(await screen.findByText('面积')).toBeInTheDocument();
    expect(screen.getByText('80.00 ㎡')).toBeInTheDocument();
    expect(screen.queryByText('建筑 / 套内')).not.toBeInTheDocument();
    expect(screen.getByText('套内面积')).toBeInTheDocument();
    expect(screen.getByText('68.00 ㎡')).toBeInTheDocument();
    expect(screen.getByText('朝向')).toBeInTheDocument();
    expect(screen.getByText('南北')).toBeInTheDocument();
    expect(screen.getByText('装修')).toBeInTheDocument();
    expect(screen.getByText('简装')).toBeInTheDocument();
    expect(screen.getByText('楼栋电梯')).toBeInTheDocument();
    expect(screen.getByText('有')).toBeInTheDocument();
  });

  it('publishes a complete house', async () => {
    mockGetHouse.mockResolvedValue(completeHouse);

    render(
      <QueryClientProvider client={new QueryClient()}>
        <HouseDetailPage />
      </QueryClientProvider>,
    );

    await screen.findAllByText('1801');
    await openQuickActions();
    fireEvent.click(screen.getByRole('menuitem', { name: '发布房源' }));
    fireEvent.click(await screen.findByRole('button', { name: '确认发布' }));

    await waitFor(() =>
      expect(mockPatchHouse).toHaveBeenCalledWith(99, {
        status: 'listed',
      }),
    );
  });

  it('renders grouped edit drawer without duplicate impact summary', async () => {
    mockGetHouse.mockResolvedValue({ ...completeHouse, images: [] });

    render(
      <QueryClientProvider client={new QueryClient()}>
        <HouseDetailPage />
      </QueryClientProvider>,
    );

    await screen.findAllByText('1801');
    fireEvent.click(screen.getByRole('button', { name: '编辑资料' }));

    expect(await screen.findByText('归属与发布基础')).toBeInTheDocument();
    expect(screen.getByText('户型与面积')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '基础资料' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    fireEvent.click(screen.getByRole('tab', { name: '展示说明' }));
    expect(screen.getByText('展示与内部说明')).toBeInTheDocument();
    expect(screen.queryByText('保存影响')).not.toBeInTheDocument();
    expect(screen.queryByText('保存后仍有提醒项')).not.toBeInTheDocument();
    expect(screen.queryByText('当前仍有待补阻断项')).not.toBeInTheDocument();
    expect(screen.queryByText('阻断：缺房东')).not.toBeInTheDocument();
    expect(
      screen.queryByText('当前重点是补齐房东主体，保存后就能清掉这一条阻断。'),
    ).not.toBeInTheDocument();
  });

  it('keeps inherited building tags out of the house update payload', async () => {
    mockGetHouse.mockResolvedValue({
      ...completeHouse,
      tags: ['采光好'],
      effective_tags: ['采光好', '近地铁', '有电梯'],
    });

    render(
      <QueryClientProvider client={new QueryClient()}>
        <HouseDetailPage />
      </QueryClientProvider>,
    );

    await screen.findAllByText('1801');
    fireEvent.click(screen.getByRole('button', { name: '编辑资料' }));
    fireEvent.click(screen.getByRole('tab', { name: '展示说明' }));

    const inherited = await screen.findByLabelText('继承标签');
    expect(within(inherited).getByText('近地铁')).toBeInTheDocument();
    expect(within(inherited).getByText('有电梯')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('combobox', { name: '房源标签' }), {
      target: { value: '南北通透,' },
    });
    fireEvent.click(screen.getByRole('button', { name: /保\s*存/ }));

    await waitFor(() =>
      expect(mockPatchHouse).toHaveBeenCalledWith(
        99,
        expect.objectContaining({ tags: ['采光好', '南北通透'] }),
      ),
    );
  });

  it('keeps existing custom fields read-only in the edit drawer', async () => {
    mockGetHouse.mockResolvedValue({
      ...completeHouse,
      extra: {
        门锁品牌: '凯迪仕',
        钥匙数量: 3,
      },
    });

    render(
      <QueryClientProvider client={new QueryClient()}>
        <HouseDetailPage />
      </QueryClientProvider>,
    );

    await screen.findAllByText('1801');
    fireEvent.click(screen.getByRole('button', { name: '编辑资料' }));
    fireEvent.click(screen.getByRole('tab', { name: '展示说明' }));
    expect(screen.queryByLabelText('门锁品牌')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('钥匙数量')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /保\s*存/ }));

    await waitFor(() => expect(mockPatchHouse).toHaveBeenCalled());
    expect(mockPatchHouse.mock.calls[0]?.[1]).not.toHaveProperty('extra');
  });

  it('moves a listed house back to vacant when unpublishing', async () => {
    mockGetHouse.mockResolvedValue({
      ...completeHouse,
      status: 'listed',
      status__mapping: '招租',
    });

    render(
      <QueryClientProvider client={new QueryClient()}>
        <HouseDetailPage />
      </QueryClientProvider>,
    );

    await screen.findAllByText('1801');
    await openQuickActions();
    fireEvent.click(screen.getByRole('menuitem', { name: '下架房源' }));
    fireEvent.click(await screen.findByRole('button', { name: '确认下架' }));

    await waitFor(() =>
      expect(mockPatchHouse).toHaveBeenCalledWith(99, {
        status: 'vacant',
      }),
    );
    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: '确认发布房源' }),
      ).not.toBeInTheDocument(),
    );
  });

  it('shows viewing and lease context for the house', async () => {
    mockGetHouse.mockResolvedValue(completeHouse);
    mockListViewings.mockResolvedValue({
      items: [
        {
          id: 1,
          house_id: 99,
          house: houseSummary,
          contact_id: null,
          contact: null,
          customer_name: '李客户',
          customer_phone: '13900000000',
          scheduled_at: '2026-07-01T10:00:00+08:00',
          status: 'converted',
          signed_lease_id: 2,
        },
      ],
      total: 1,
      page: 1,
      page_size: 5,
    });
    mockListLeases.mockResolvedValue({
      items: [
        {
          id: 2,
          house_id: 99,
          house: houseSummary,
          tenant_id: 6,
          tenant: tenantSummary,
          start_date: '2026-07-01',
          end_date: '2027-06-30',
          monthly_rent: '4200.00',
          deposit: '4200.00',
          status: 'active',
          contract_files: [],
        },
      ],
      total: 1,
      page: 1,
      page_size: 5,
    });

    render(
      <QueryClientProvider client={new QueryClient()}>
        <HouseDetailPage />
      </QueryClientProvider>,
    );

    expect(await screen.findByText('带看记录')).toBeInTheDocument();
    expect(screen.getByText('最近 10 条')).toBeInTheDocument();
    expect(screen.getAllByRole('columnheader', { name: '状态' })).toHaveLength(
      2,
    );
    expect(
      screen.queryByRole('columnheader', { name: '客户 / 状态' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('columnheader', { name: '租客 / 状态' }),
    ).not.toBeInTheDocument();
    expect((await screen.findAllByText('李客户')).length).toBeGreaterThan(0);
    expect(await screen.findByText('租约记录')).toBeInTheDocument();
    expect((await screen.findAllByText(/王租客/)).length).toBeGreaterThan(0);
    expect(
      document.querySelector('[data-preview="viewing"][data-id="1"]'),
    ).toBeInTheDocument();
    expect(
      document.querySelector('[data-preview="contact"][data-id="6"]'),
    ).toHaveTextContent('王租客');
    expect(
      document.querySelector('[data-preview="contact"][data-id="6"]'),
    ).not.toHaveTextContent('13700000000');
    expect(screen.getAllByText('13700000000').length).toBeGreaterThan(0);
    expect(screen.getByText('押金 ¥4,200')).toBeInTheDocument();
    expect(document.querySelectorAll('.ant-table-body')).toHaveLength(0);
    expect(
      document.querySelector('[data-preview="lease"][data-id="2"]'),
    ).toHaveTextContent('租约 #2');
    expect(
      screen
        .getAllByRole('link', { name: '查看租约' })
        .some(
          (link) =>
            link.getAttribute('href') ===
            '/dashboard/rental/leases?house_id=99&edit=2',
        ),
    ).toBe(true);
    expect(
      screen
        .getAllByRole('link', { name: '编辑租约' })
        .some(
          (link) =>
            link.getAttribute('href') ===
            '/dashboard/rental/leases?house_id=99&edit=2',
        ),
    ).toBe(true);
    expect(screen.queryByText('待补合同')).not.toBeInTheDocument();
    expect(mockListViewings).toHaveBeenCalledWith({
      page: 1,
      page_size: 10,
      house_id: 99,
    });
    expect(mockListLeases).toHaveBeenCalledWith({
      page: 1,
      page_size: 5,
      house_id: 99,
    });
  });

  it('keeps blocked house detail compact', async () => {
    mockGetHouse.mockResolvedValue({
      ...completeHouse,
      landlord_id: null,
      images: [],
    });

    render(
      <QueryClientProvider client={new QueryClient()}>
        <HouseDetailPage />
      </QueryClientProvider>,
    );

    expect(await screen.findByText('房源资料')).toBeInTheDocument();
    expect(
      screen.getByRole('region', { name: '房源媒体' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('媒体相册')).not.toBeInTheDocument();
    expect(screen.queryByText('0 图 / 0 视频')).not.toBeInTheDocument();
    expect(screen.queryByText('缺房东')).not.toBeInTheDocument();
    expect(screen.queryByText('闭环工作台')).not.toBeInTheDocument();
    expect(screen.queryByText('发布缺口')).not.toBeInTheDocument();
    expect(screen.queryByText('优先动作')).not.toBeInTheDocument();
  });

  it('does not repeat the scoped house label above house detail', async () => {
    mockGetHouse.mockResolvedValue(completeHouse);

    render(
      <QueryClientProvider client={new QueryClient()}>
        <HouseDetailPage />
      </QueryClientProvider>,
    );

    expect(await screen.findByText('房源资料')).toBeInTheDocument();
    expect(screen.queryByText('星河湾 / 1 栋 / 1801')).not.toBeInTheDocument();
  });

  it('shows latest progress snapshot for viewing and lease workflow', async () => {
    mockGetHouse.mockResolvedValue(completeHouse);
    mockListViewings.mockResolvedValue({
      items: [
        {
          id: 1,
          house_id: 99,
          customer_name: '李客户',
          customer_phone: '13900000000',
          scheduled_at: '2026-07-01T10:00:00+08:00',
          status: 'scheduled',
          status__mapping: '已预约',
          signed_lease_id: null,
        },
      ],
      total: 1,
      page: 1,
      page_size: 5,
    });
    mockListLeases.mockResolvedValue({
      items: [
        {
          id: 2,
          house_id: 99,
          house: houseSummary,
          tenant_id: 6,
          tenant: tenantSummary,
          start_date: '2026-07-01',
          end_date: '2027-06-30',
          monthly_rent: '4200.00',
          status: 'active',
          status__mapping: '生效中',
          contract_files: [{ media_id: 9 }],
        },
      ],
      total: 1,
      page: 1,
      page_size: 5,
    });

    render(
      <QueryClientProvider client={new QueryClient()}>
        <HouseDetailPage />
      </QueryClientProvider>,
    );

    expect(await screen.findByText('带看记录')).toBeInTheDocument();
    expect(screen.queryByText('闭环工作台')).not.toBeInTheDocument();
    expect(screen.queryByText('最近带看')).not.toBeInTheDocument();
    expect(screen.queryByText('当前租约状态')).not.toBeInTheDocument();
    expect((await screen.findAllByText('李客户')).length).toBeGreaterThan(0);
    expect((await screen.findAllByText('已预约')).length).toBeGreaterThan(0);
    expect((await screen.findAllByText(/王租客/)).length).toBeGreaterThan(0);
    expect((await screen.findAllByText('生效中')).length).toBeGreaterThan(0);
    expect(screen.queryByText('合同已归档')).not.toBeInTheDocument();
    expect(screen.getByText('租约 #2 · 1 份合同')).toBeInTheDocument();
  });

  it('keeps hero media read-only until the edit drawer is opened', async () => {
    mockGetHouse.mockResolvedValue(completeHouse);

    render(
      <QueryClientProvider client={new QueryClient()}>
        <HouseDetailPage />
      </QueryClientProvider>,
    );

    expect(
      await screen.findByRole('region', { name: '房源媒体' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /上传图片/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /上传视频/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /移除/ }),
    ).not.toBeInTheDocument();

    expect(
      screen.queryByRole('button', { name: '管理媒体' }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '编辑资料' }));

    expect(await screen.findByText('编辑房源资料')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: '图片视频' }));
    expect(screen.getByText('图片与视频')).toBeInTheDocument();
    expect(screen.getByText('图片资料')).toBeInTheDocument();
    expect(screen.getByText('视频资料')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /上传图片/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /上传视频/ }),
    ).toBeInTheDocument();
  });

  it('saves media changes together with the edit form', async () => {
    mockGetHouse.mockResolvedValue(completeHouse);

    render(
      <QueryClientProvider client={new QueryClient()}>
        <HouseDetailPage />
      </QueryClientProvider>,
    );

    await screen.findAllByText('1801');
    fireEvent.click(screen.getByRole('button', { name: '编辑资料' }));
    fireEvent.click(screen.getByRole('tab', { name: '图片视频' }));
    fireEvent.click(await screen.findByRole('button', { name: '移除#1' }));

    expect(mockPatchHouse).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /保\s*存/ }));

    await waitFor(() => expect(mockPatchHouse).toHaveBeenCalled());
    expect(mockPatchHouse.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({
        images: [
          { media_id: 2, media_type: 'image', image_role: 'floor_plan' },
          { media_id: 3, media_type: 'image', image_role: 'bedroom' },
        ],
        videos: [],
      }),
    );
  });

  it('links converted unsigned viewing to lease creation', async () => {
    mockGetHouse.mockResolvedValue(completeHouse);
    mockListViewings.mockResolvedValue({
      items: [
        {
          id: 1,
          house_id: 99,
          contact_id: 6,
          house: houseSummary,
          contact: tenantSummary,
          customer_name: '李客户',
          customer_phone: '13900000000',
          scheduled_at: '2026-07-01T10:00:00+08:00',
          status: 'converted',
          signed_lease_id: null,
        },
      ],
      total: 1,
      page: 1,
      page_size: 5,
    });

    render(
      <QueryClientProvider client={new QueryClient()}>
        <HouseDetailPage />
      </QueryClientProvider>,
    );

    const signLeaseTexts = await screen.findAllByText('去签约');
    expect(
      signLeaseTexts.some(
        (node) =>
          node.closest('a')?.getAttribute('href') ===
          '/dashboard/rental/leases?source_viewing_record_id=1',
      ),
    ).toBe(true);
  });

  it('routes converted viewings without contacts to the contact-fix workflow', async () => {
    mockGetHouse.mockResolvedValue(completeHouse);
    mockListViewings.mockResolvedValue({
      items: [
        {
          id: 1,
          house_id: 99,
          customer_name: '李客户',
          customer_phone: '13900000000',
          scheduled_at: '2026-07-01T10:00:00+08:00',
          status: 'converted',
          signed_lease_id: null,
        },
      ],
      total: 1,
      page: 1,
      page_size: 5,
    });

    render(
      <QueryClientProvider client={new QueryClient()}>
        <HouseDetailPage />
      </QueryClientProvider>,
    );

    const fixContactTexts = await screen.findAllByText('补租客');
    expect(
      fixContactTexts.some(
        (node) =>
          node.closest('a')?.getAttribute('href') ===
          '/dashboard/rental/viewings?pending_lease=true&contact_missing=true&edit=1',
      ),
    ).toBe(true);
  });

  it('links to viewing and lease creation for the house', async () => {
    mockGetHouse.mockResolvedValue(completeHouse);

    render(
      <QueryClientProvider client={new QueryClient()}>
        <HouseDetailPage />
      </QueryClientProvider>,
    );

    await screen.findAllByText('1801');
    expect(
      screen.queryByRole('link', { name: '登记带看' }),
    ).not.toBeInTheDocument();
    expect(
      screen
        .getAllByRole('link', { name: '登记首条带看' })
        .some(
          (link) =>
            link.getAttribute('href') ===
            '/dashboard/rental/viewings?house_id=99',
        ),
    ).toBe(true);
    expect(
      screen
        .getAllByRole('link', { name: '创建首份租约' })
        .some(
          (link) =>
            link.getAttribute('href') ===
            '/dashboard/rental/leases?house_id=99',
        ),
    ).toBe(true);
  });

  it('shows actionable empty states for viewing and lease tables', async () => {
    mockGetHouse.mockResolvedValue(completeHouse);

    render(
      <QueryClientProvider client={new QueryClient()}>
        <HouseDetailPage />
      </QueryClientProvider>,
    );

    await screen.findAllByText('1801');
    expect(screen.getAllByText('暂无带看记录').length).toBeGreaterThan(0);
    expect(
      screen
        .getAllByRole('link', { name: '登记首条带看' })
        .some(
          (link) =>
            link.getAttribute('href') ===
            '/dashboard/rental/viewings?house_id=99',
        ),
    ).toBe(true);
    expect(screen.getAllByText('暂无租约记录').length).toBeGreaterThan(0);
    expect(
      screen
        .getAllByRole('link', { name: '创建首份租约' })
        .some(
          (link) =>
            link.getAttribute('href') ===
            '/dashboard/rental/leases?house_id=99',
        ),
    ).toBe(true);
  });

  it('shows estate context in building options when editing', async () => {
    mockGetHouse.mockResolvedValue(completeHouse);

    render(
      <QueryClientProvider client={new QueryClient()}>
        <HouseDetailPage />
      </QueryClientProvider>,
    );

    await screen.findAllByText('1801');
    fireEvent.click(screen.getByRole('button', { name: '编辑资料' }));
    fireEvent.mouseDown(screen.getByLabelText('楼栋'));

    expect(
      (await screen.findAllByText('星河湾 / 1 栋')).length,
    ).toBeGreaterThan(0);
  });

  it('opens edit drawer directly from workbench task link', async () => {
    window.history.pushState({}, '', '/rental/properties/99?action=edit');
    mockGetHouse.mockResolvedValue(completeHouse);

    render(
      <QueryClientProvider client={new QueryClient()}>
        <HouseDetailPage />
      </QueryClientProvider>,
    );

    expect(await screen.findByText('编辑房源资料')).toBeInTheDocument();
    expect(screen.getByLabelText('楼栋')).toBeInTheDocument();
    expect(
      screen.queryByText('当前操作：补齐发布资料'),
    ).not.toBeInTheDocument();
  });

  it('resets the edit form when switching to another house route', async () => {
    const nextHouse = {
      ...completeHouse,
      id: 100,
      room_number: '1902',
    };
    mockGetHouse.mockImplementation((id: number) =>
      Promise.resolve(id === 99 ? completeHouse : nextHouse),
    );
    mockPatchHouse.mockImplementation(
      (id: number, values: Record<string, unknown>) =>
        Promise.resolve({ ...nextHouse, ...values, id }),
    );
    const queryClient = new QueryClient();
    const view = render(
      <QueryClientProvider client={queryClient}>
        <HouseDetailPage />
      </QueryClientProvider>,
    );

    await screen.findAllByText('1801');
    fireEvent.click(screen.getByRole('button', { name: '编辑资料' }));
    fireEvent.change(await screen.findByLabelText('房号'), {
      target: { value: '旧房源草稿' },
    });

    mockUseParams.mockReturnValue({ id: '100' });
    window.history.pushState({}, '', '/rental/properties/100');
    view.rerender(
      <QueryClientProvider client={queryClient}>
        <HouseDetailPage />
      </QueryClientProvider>,
    );

    expect(await screen.findByText('星河湾 · 1 栋 · 1902')).toBeInTheDocument();
    expect(screen.queryByText('编辑房源资料')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '编辑资料' }));

    expect(await screen.findByDisplayValue('1902')).toBeInTheDocument();
    expect(screen.queryByDisplayValue('旧房源草稿')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('房号'), {
      target: { value: '2001' },
    });
    fireEvent.click(screen.getByRole('button', { name: /保\s*存/ }));

    await waitFor(() =>
      expect(mockPatchHouse).toHaveBeenCalledWith(
        100,
        expect.objectContaining({ room_number: '2001' }),
      ),
    );
  });

  it('shows landlord-fix context when opened from the house issue queue', async () => {
    window.history.pushState(
      {},
      '',
      '/rental/properties/99?action=edit&task=landlord',
    );
    mockGetHouse.mockResolvedValue(completeHouse);

    render(
      <QueryClientProvider client={new QueryClient()}>
        <HouseDetailPage />
      </QueryClientProvider>,
    );

    expect(await screen.findByText('编辑房源资料')).toBeInTheDocument();
    expect(
      screen.queryByText('当前操作：补齐房东资料'),
    ).not.toBeInTheDocument();
  });

  it('clears focused edit context when the edit drawer closes', async () => {
    window.history.pushState(
      {},
      '',
      '/rental/properties/99?action=edit&task=landlord',
    );
    mockGetHouse.mockResolvedValue(completeHouse);

    render(
      <QueryClientProvider client={new QueryClient()}>
        <HouseDetailPage />
      </QueryClientProvider>,
    );

    expect(await screen.findByText('编辑房源资料')).toBeInTheDocument();
    const closeButton = document.querySelector('.ant-drawer-close');
    expect(closeButton).not.toBeNull();
    fireEvent.click(closeButton as Element);

    await waitFor(() => expect(window.location.search).toBe(''));
    expect(screen.queryByText('编辑房源资料')).not.toBeInTheDocument();
  });

  it('shows media maintenance context when opened from the workbench album task', async () => {
    window.history.pushState({}, '', '/rental/properties/99?action=media');
    mockGetHouse.mockResolvedValue(completeHouse);

    render(
      <QueryClientProvider client={new QueryClient()}>
        <HouseDetailPage />
      </QueryClientProvider>,
    );

    expect(await screen.findByText('编辑房源资料')).toBeInTheDocument();
    expect(screen.getByText('图片与视频')).toBeInTheDocument();
    expect(screen.getByText('图片资料')).toBeInTheDocument();
    expect(
      screen.queryByText('当前操作：维护媒体相册'),
    ).not.toBeInTheDocument();
  });

  it('edits house layout fields from the detail drawer', async () => {
    mockGetHouse.mockResolvedValue(completeHouse);

    render(
      <QueryClientProvider client={new QueryClient()}>
        <HouseDetailPage />
      </QueryClientProvider>,
    );

    await screen.findAllByText('1801');
    fireEvent.click(screen.getByRole('button', { name: '编辑资料' }));
    fireEvent.change(screen.getByLabelText('卧室'), { target: { value: '3' } });
    fireEvent.change(screen.getByLabelText('客厅'), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText('卫生间'), {
      target: { value: '2' },
    });
    fireEvent.click(screen.getByRole('button', { name: /保\s*存/ }));

    await waitFor(() =>
      expect(mockPatchHouse).toHaveBeenCalledWith(
        99,
        expect.objectContaining({
          bedrooms: '3',
          living_rooms: '2',
          bathrooms: '2',
        }),
      ),
    );
  });

  it('normalizes a cleared numeric field to zero', async () => {
    mockGetHouse.mockResolvedValue({
      ...completeHouse,
      interior_area: '68.00',
    });

    render(
      <QueryClientProvider client={new QueryClient()}>
        <HouseDetailPage />
      </QueryClientProvider>,
    );

    await screen.findAllByText('1801');
    fireEvent.click(screen.getByRole('button', { name: '编辑资料' }));
    fireEvent.change(screen.getByLabelText('套内面积'), {
      target: { value: '' },
    });
    fireEvent.click(screen.getByRole('button', { name: /保\s*存/ }));

    await waitFor(() =>
      expect(mockPatchHouse).toHaveBeenCalledWith(
        99,
        expect.objectContaining({
          interior_area: 0,
        }),
      ),
    );
  });
});
