import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import HouseDetailPage from '../detail';

const {
  mockUseParams,
  mockGetHouse,
  mockListBuildings,
  mockListContacts,
  mockListLeases,
  mockListViewings,
  mockPatchHouse,
} = vi.hoisted(() => ({
  mockUseParams: vi.fn(),
  mockGetHouse: vi.fn(),
  mockListBuildings: vi.fn(),
  mockListContacts: vi.fn(),
  mockListLeases: vi.fn(),
  mockListViewings: vi.fn(),
  mockPatchHouse: vi.fn(),
}));

vi.mock('@umijs/max', () => ({
  useParams: mockUseParams,
}));

vi.mock('@/pages/tenant/shared', () => ({
  TenantSelectionGuard: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  useTenantWorkspace: () => ({
    selectedOrgSlug: 'org',
    queryClient: new QueryClient(),
  }),
}));

vi.mock('@/services/manual/house', () => ({
  houseApi: {
    getHouse: mockGetHouse,
    listBuildings: mockListBuildings,
    listContacts: mockListContacts,
    listLeases: mockListLeases,
    listViewingRecords: mockListViewings,
    patchHouse: mockPatchHouse,
  },
}));

const estateSummary = { id: 1, name: 'xinghewan', display_name: '星河湾' };
const buildingSummary = { id: 10, estate_id: 1, estate: estateSummary, name: '1 栋' };
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
  publish_status: 'draft',
};

describe('House detail page', () => {
  beforeEach(() => {
    mockUseParams.mockReturnValue({ id: '99' });
    window.history.pushState({}, '', '/');
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
    mockGetHouse.mockReset();
    mockListBuildings.mockResolvedValue({
      items: [buildingSummary],
      total: 1,
      page: 1,
      page_size: 100,
    });
    mockListContacts.mockResolvedValue({
      items: [
        { id: 20, name: '张房东', phone: '13800000000', roles: ['landlord'] },
      ],
      total: 1,
      page: 1,
      page_size: 100,
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
    mockPatchHouse.mockResolvedValue({
      ...completeHouse,
      publish_status: 'published',
    });
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
    expect(screen.getByRole('button', { name: '待补齐后发布' })).toBeDisabled();
  });

  it('opens media section directly for video maintenance tasks', async () => {
    mockGetHouse.mockResolvedValue({ ...completeHouse, videos: [] });

    window.history.pushState(
      {},
      '',
      '/property-rental/houses/99?action=media&task=video',
    );

    render(
      <QueryClientProvider client={new QueryClient()}>
        <HouseDetailPage />
      </QueryClientProvider>,
    );

    expect(await screen.findByText('媒体相册')).toBeInTheDocument();
    await waitFor(() =>
      expect(window.HTMLElement.prototype.scrollIntoView).toHaveBeenCalled(),
    );
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
    await waitFor(() =>
      expect(screen.getByRole('button', { name: '发布房源' })).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole('button', { name: '发布房源' }));
    fireEvent.click(await screen.findByRole('button', { name: '确认发布' }));
    await waitFor(() =>
      expect(mockPatchHouse).toHaveBeenCalledWith(99, {
        publish_status: 'published',
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

  it('shows the complete house layout in detail summary', async () => {
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

    expect(
      await screen.findByText('2室 / 1厅 / 1卫 / 1厨 / 1阳台'),
    ).toBeInTheDocument();
  });

  it('shows interior area in detail summary', async () => {
    mockGetHouse.mockResolvedValue({
      ...completeHouse,
      interior_area: '68.00',
    });

    render(
      <QueryClientProvider client={new QueryClient()}>
        <HouseDetailPage />
      </QueryClientProvider>,
    );

    expect(await screen.findByText('套内面积')).toBeInTheDocument();
    expect(screen.getByText('68.00')).toBeInTheDocument();
  });

  it('publishes a complete house', async () => {
    mockGetHouse.mockResolvedValue(completeHouse);

    render(
      <QueryClientProvider client={new QueryClient()}>
        <HouseDetailPage />
      </QueryClientProvider>,
    );

    await screen.findAllByText('1801');
    fireEvent.click(screen.getByRole('button', { name: '发布房源' }));
    fireEvent.click(await screen.findByRole('button', { name: '确认发布' }));

    await waitFor(() =>
      expect(mockPatchHouse).toHaveBeenCalledWith(99, {
        publish_status: 'published',
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
    expect(screen.getByText('展示与内部说明')).toBeInTheDocument();
    expect(screen.queryByText('保存影响')).not.toBeInTheDocument();
    expect(screen.queryByText('保存后仍有提醒项')).not.toBeInTheDocument();
    expect(screen.queryByText('当前仍有待补阻断项')).not.toBeInTheDocument();
    expect(screen.queryByText('阻断：缺房东')).not.toBeInTheDocument();
    expect(
      screen.queryByText('当前重点是补齐房东主体，保存后就能清掉这一条阻断。'),
    ).not.toBeInTheDocument();
  });

  it('unpublishes an already published house', async () => {
    mockGetHouse.mockResolvedValue({
      ...completeHouse,
      publish_status: 'published',
    });

    render(
      <QueryClientProvider client={new QueryClient()}>
        <HouseDetailPage />
      </QueryClientProvider>,
    );

    await screen.findAllByText('1801');
    expect(
      screen.queryByRole('button', { name: '待补齐后发布' }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '下架房源' }));
    fireEvent.click(await screen.findByRole('button', { name: '确认下架' }));

    await waitFor(() =>
      expect(mockPatchHouse).toHaveBeenCalledWith(99, {
        publish_status: 'unpublished',
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
    expect((await screen.findAllByText('李客户')).length).toBeGreaterThan(0);
    expect(await screen.findByText('租约记录')).toBeInTheDocument();
    expect((await screen.findAllByText(/王租客/)).length).toBeGreaterThan(0);
    expect(
      screen
        .getAllByRole('link', { name: '查看租约' })
        .some(
          (link) =>
            link.getAttribute('href') ===
            '/dashboard/property-rental/leases?house_id=99&edit=2',
        ),
    ).toBe(true);
    expect(
      screen
        .getAllByRole('link', { name: '补合同' })
        .some(
          (link) =>
            link.getAttribute('href') ===
            '/dashboard/property-rental/leases?house_id=99&task=contract&edit=2',
        ),
    ).toBe(true);
    expect(screen.getAllByText('待补合同').length).toBeGreaterThan(0);
    expect(mockListViewings).toHaveBeenCalledWith({
      page: 1,
      page_size: 5,
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
    expect(screen.getByText('媒体相册')).toBeInTheDocument();
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
    expect(screen.getByText('1 份')).toBeInTheDocument();
  });

  it('splits media management into image and video sections', async () => {
    mockGetHouse.mockResolvedValue(completeHouse);

    render(
      <QueryClientProvider client={new QueryClient()}>
        <HouseDetailPage />
      </QueryClientProvider>,
    );

    expect(await screen.findByText('媒体相册')).toBeInTheDocument();
    expect(screen.getByText('图片资料')).toBeInTheDocument();
    expect(screen.getByText('视频资料')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /上传图片/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /上传视频/ }),
    ).toBeInTheDocument();
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
          '/dashboard/property-rental/leases?source_viewing_record_id=1',
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
          '/dashboard/property-rental/viewings?pending_lease=true&contact_missing=true&edit=1',
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
            '/dashboard/property-rental/viewings?house_id=99',
        ),
    ).toBe(true);
    expect(
      screen
        .getAllByRole('link', { name: '创建首份租约' })
        .some(
          (link) =>
            link.getAttribute('href') ===
            '/dashboard/property-rental/leases?house_id=99',
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
            '/dashboard/property-rental/viewings?house_id=99',
        ),
    ).toBe(true);
    expect(screen.getAllByText('暂无租约记录').length).toBeGreaterThan(0);
    expect(
      screen
        .getAllByRole('link', { name: '创建首份租约' })
        .some(
          (link) =>
            link.getAttribute('href') ===
            '/dashboard/property-rental/leases?house_id=99',
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
    window.history.pushState({}, '', '/property-rental/houses/99?action=edit');
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

  it('shows landlord-fix context when opened from the house issue queue', async () => {
    window.history.pushState(
      {},
      '',
      '/property-rental/houses/99?action=edit&task=landlord',
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
      '/property-rental/houses/99?action=edit&task=landlord',
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
    window.history.pushState({}, '', '/property-rental/houses/99?action=media');
    mockGetHouse.mockResolvedValue(completeHouse);

    render(
      <QueryClientProvider client={new QueryClient()}>
        <HouseDetailPage />
      </QueryClientProvider>,
    );

    expect(await screen.findByText('媒体相册')).toBeInTheDocument();
    await waitFor(() =>
      expect(window.HTMLElement.prototype.scrollIntoView).toHaveBeenCalled(),
    );
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
    fireEvent.change(screen.getByLabelText('室'), { target: { value: '3' } });
    fireEvent.change(screen.getByLabelText('厅'), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText('卫'), { target: { value: '2' } });
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

  it('edits interior area from the detail drawer', async () => {
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
      target: { value: '70.00' },
    });
    fireEvent.click(screen.getByRole('button', { name: /保\s*存/ }));

    await waitFor(() =>
      expect(mockPatchHouse).toHaveBeenCalledWith(
        99,
        expect.objectContaining({
          interior_area: '70.00',
        }),
      ),
    );
  });
});
