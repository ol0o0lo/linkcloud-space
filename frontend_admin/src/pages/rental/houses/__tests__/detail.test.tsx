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

declare const __TEST_SUITE_SHARD__: string | undefined;

function registerTestShard(name: string, register: () => void) {
  if (
    typeof __TEST_SUITE_SHARD__ === 'undefined' ||
    __TEST_SUITE_SHARD__ === name
  ) {
    register();
  }
}

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

vi.mock('../../components/MediaRefsUpload', () => ({
  default: ({
    mediaType,
    onChange,
    title,
    value = [],
  }: {
    mediaType: 'file' | 'image' | 'video';
    onChange?: (value: unknown[]) => void;
    title?: string;
    value?: Array<{ media_id: number }>;
  }) => (
    <section>
      <span>{title}</span>
      <button type="button">
        上传
        {mediaType === 'image'
          ? '图片'
          : mediaType === 'video'
            ? '视频'
            : '文件'}
      </button>
      {value.map((item) => (
        <button
          key={item.media_id}
          type="button"
          aria-label={`移除#${item.media_id}`}
          onClick={() =>
            onChange?.(
              value.filter((candidate) => candidate.media_id !== item.media_id),
            )
          }
        >
          移除
        </button>
      ))}
    </section>
  ),
}));

vi.mock('../../components/PropertyTagSelect', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../components/PropertyTagSelect')>();

  return {
    ...actual,
    PropertyTagSelect: ({
      disabled,
      inheritedTags = [],
      onChange,
      value = [],
    }: {
      disabled?: boolean;
      inheritedTags?: string[];
      onChange?: (value: string[]) => void;
      value?: string[];
    }) => {
      const visibleInheritedTags = actual.getInheritedPropertyTags(
        value,
        inheritedTags,
      );

      return (
        <div>
          <input
            aria-expanded="false"
            aria-label="房源标签"
            disabled={disabled}
            role="combobox"
            value={value.join(',')}
            onChange={(event) => {
              const additions = event.currentTarget.value
                .split(/[,，;；、]/)
                .map((tag) => tag.trim())
                .filter(Boolean);
              onChange?.(
                actual.normalizePropertyTags([...value, ...additions]),
              );
            }}
          />
          {visibleInheritedTags.length ? (
            <section aria-label="继承标签">
              {visibleInheritedTags.map((tag) => (
                <span key={tag}>{tag}</span>
              ))}
            </section>
          ) : null}
        </div>
      );
    },
  };
});

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

  registerTestShard('house-detail-inline', () => {
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
      const buildingTag = within(tagsRegion)
        .getByText('近地铁')
        .closest('.ant-tag');
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

  });

  registerTestShard('house-detail-overview', () => {
    it('toggles the favorite mutation', async () => {
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
      fireEvent.click(activeButton);
      await waitFor(() =>
        expect(mockRemoveFavorite).toHaveBeenCalledWith('house', '99'),
      );
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
  });

  registerTestShard('house-detail-workflows', () => {
    it('loads viewing and lease context with house-scoped parameters', async () => {
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

      await waitFor(() =>
        expect(mockListViewings).toHaveBeenCalledWith({
          page: 1,
          page_size: 10,
          house_id: 99,
        }),
      );
      await waitFor(() =>
        expect(mockListLeases).toHaveBeenCalledWith({
          page: 1,
          page_size: 5,
          house_id: 99,
        }),
      );
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

  });

  registerTestShard('house-detail-routing', () => {
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

      expect(
        await screen.findByText('星河湾 · 1 栋 · 1902'),
      ).toBeInTheDocument();
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
      fireEvent.change(screen.getByLabelText('卧室'), {
        target: { value: '3' },
      });
      fireEvent.change(screen.getByLabelText('客厅'), {
        target: { value: '2' },
      });
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
});
