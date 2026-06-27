import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import WorkbenchPage, { buildPublishWorkbenchRows, buildWorkflowTasks, getHouseTaskLink } from './workbench';

const { mockListHouses, mockListViewings, mockListLeases, mockPatchHouse } = vi.hoisted(() => ({
  ...(globalThis as typeof globalThis & {
    __frontendAdminHouseApiMocks__?: {
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
  }).__frontendAdminHouseApiMocks__ ?? ((globalThis as typeof globalThis & {
    __frontendAdminHouseApiMocks__?: {
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
  }).__frontendAdminHouseApiMocks__ = {
    listHouses: vi.fn(),
    listViewingRecords: vi.fn(),
    listLeases: vi.fn(),
    patchHouse: vi.fn(),
    listEstates: vi.fn(),
    listBuildings: vi.fn(),
    getDefaultBuilding: vi.fn(),
    setDefaultBuilding: vi.fn(),
    createBuilding: vi.fn(),
  }),
  mockListHouses: ((globalThis as typeof globalThis & { __frontendAdminHouseApiMocks__?: { listHouses: ReturnType<typeof vi.fn> } }).__frontendAdminHouseApiMocks__!).listHouses,
  mockListViewings: ((globalThis as typeof globalThis & { __frontendAdminHouseApiMocks__?: { listViewingRecords: ReturnType<typeof vi.fn> } }).__frontendAdminHouseApiMocks__!).listViewingRecords,
  mockListLeases: ((globalThis as typeof globalThis & { __frontendAdminHouseApiMocks__?: { listLeases: ReturnType<typeof vi.fn> } }).__frontendAdminHouseApiMocks__!).listLeases,
  mockPatchHouse: ((globalThis as typeof globalThis & { __frontendAdminHouseApiMocks__?: { patchHouse: ReturnType<typeof vi.fn> } }).__frontendAdminHouseApiMocks__!).patchHouse,
}));

const { mockUseTenantWorkspace } = vi.hoisted(() => ({
  mockUseTenantWorkspace:
    ((globalThis as typeof globalThis & {
      __frontendAdminTenantWorkspaceMock__?: ReturnType<typeof vi.fn>;
    }).__frontendAdminTenantWorkspaceMock__) ||
    (((globalThis as typeof globalThis & {
      __frontendAdminTenantWorkspaceMock__?: ReturnType<typeof vi.fn>;
    }).__frontendAdminTenantWorkspaceMock__ = vi.fn())),
}));

vi.mock('@/pages/tenant/shared', () => ({
  TenantSelectionGuard: ({ title, subtitle, children }: { title?: string; subtitle?: string; children: React.ReactNode }) => (
    <section>
      {title ? <h1>{title}</h1> : null}
      {subtitle ? <p>{subtitle}</p> : null}
      {children}
    </section>
  ),
  TenantSectionHint: ({ text }: { text: string }) => <div>{text}</div>,
  useTenantWorkspace: mockUseTenantWorkspace,
}));

vi.mock('@/services/manual/house', () => ({
  houseApi: {
    listHouses: mockListHouses,
    listViewingRecords: mockListViewings,
    listLeases: mockListLeases,
    patchHouse: mockPatchHouse,
    listEstates: ((globalThis as typeof globalThis & { __frontendAdminHouseApiMocks__?: { listEstates: ReturnType<typeof vi.fn> } }).__frontendAdminHouseApiMocks__!).listEstates,
    listBuildings: ((globalThis as typeof globalThis & { __frontendAdminHouseApiMocks__?: { listBuildings: ReturnType<typeof vi.fn> } }).__frontendAdminHouseApiMocks__!).listBuildings,
    getDefaultBuilding: ((globalThis as typeof globalThis & { __frontendAdminHouseApiMocks__?: { getDefaultBuilding: ReturnType<typeof vi.fn> } }).__frontendAdminHouseApiMocks__!).getDefaultBuilding,
    setDefaultBuilding: ((globalThis as typeof globalThis & { __frontendAdminHouseApiMocks__?: { setDefaultBuilding: ReturnType<typeof vi.fn> } }).__frontendAdminHouseApiMocks__!).setDefaultBuilding,
    createBuilding: ((globalThis as typeof globalThis & { __frontendAdminHouseApiMocks__?: { createBuilding: ReturnType<typeof vi.fn> } }).__frontendAdminHouseApiMocks__!).createBuilding,
  },
}));

describe('Property rental workbench', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.pushState({}, '', '/dashboard/property-rental/workbench');
    mockUseTenantWorkspace.mockImplementation(() => ({ selectedOrgSlug: 'org', queryClient: new QueryClient() }));
    mockPatchHouse.mockResolvedValue({ id: 3, publish_status: 'published' });
    mockListHouses.mockImplementation((params?: Record<string, unknown>) => {
      const blockedHouse = { id: 1, room_number: '101', estate_name: '星河湾', building_name: '1 栋', landlord_id: null, images: [], videos: [], status: 'vacant', publish_status: 'draft' };
      const publishedHouse = {
        id: 2,
        room_number: '102',
        landlord_id: 5,
        asking_rent: '4200.00',
        images: [
          { media_id: 1, media_type: 'image', image_role: 'cover' },
          { media_id: 2, media_type: 'image', image_role: 'floor_plan' },
          { media_id: 3, media_type: 'image', image_role: 'bedroom' },
        ],
        videos: [],
        status: 'vacant',
        publish_status: 'published',
      };
      const readyHouse = {
        id: 3,
        room_number: '103',
        estate_name: '星河湾',
        building_name: '2 栋',
        landlord_id: 8,
        landlord_name: '周房东',
        landlord_phone: '13600000000',
        asking_rent: '4600.00',
        images: [
          { media_id: 10, media_type: 'image', image_role: 'cover' },
          { media_id: 11, media_type: 'image', image_role: 'floor_plan' },
          { media_id: 12, media_type: 'image', image_role: 'living_room' },
        ],
        videos: [{ media_id: 13, media_type: 'video' }],
        status: 'vacant',
        publish_status: 'draft',
        available_from: '2026-07-01',
      };
      if (params?.publish_issue) return Promise.resolve({ items: [], total: 1, page: 1, page_size: 1 });
      if (params?.publish_blocked && params?.page_size === 1) return Promise.resolve({ items: [], total: 1, page: 1, page_size: 1 });
      if (params?.publish_ready && params?.page_size === 1) return Promise.resolve({ items: [], total: 1, page: 1, page_size: 1 });
      if (params?.publish_blocked) return Promise.resolve({ items: [blockedHouse], total: 1, page: 1, page_size: Number(params?.page_size || 5) });
      if (params?.publish_ready) return Promise.resolve({ items: [readyHouse], total: 1, page: 1, page_size: Number(params?.page_size || 5) });
      return Promise.resolve({
        items: [blockedHouse, publishedHouse, readyHouse],
        total: 3,
        page: 1,
        page_size: 100,
      });
    });
    mockListViewings.mockImplementation((params?: Record<string, unknown>) => {
      if (params?.contact_missing === true) {
        return Promise.resolve({
          items: [{ id: 4, house_id: 1, estate_name: '星河湾', building_name: '1 栋', room_number: '201', customer_name: '李客户', customer_phone: '13900000000', status: 'converted' }],
          total: 1,
          page: 1,
          page_size: 5,
        });
      }
      if (params?.contact_missing === false) {
        return Promise.resolve({
          items: [{ id: 6, house_id: 1, estate_name: '星河湾', building_name: '1 栋', room_number: '202', customer_name: '王客户', customer_phone: '13800000000', contact_id: 9, contact_name: '王租客', status: 'converted' }],
          total: 2,
          page: 1,
          page_size: 5,
        });
      }
      return Promise.resolve({ items: [], total: 0, page: 1, page_size: 5 });
    });
    mockListLeases.mockResolvedValue({
      items: [{ id: 5, house_id: 1, estate_name: '星河湾', building_name: '1 栋', room_number: '301', tenant_id: 6, tenant_name: '王租客', tenant_phone: '13700000000', status: 'pending', contract_files: [] }],
      total: 7,
      page: 1,
      page_size: 5,
    });
  });

  it('builds publish and workflow rows from API items without extra page wrappers', () => {
    const publishRows = buildPublishWorkbenchRows(
      [
        { id: 1, estate_name: '星河湾', building_name: '1 栋', room_number: '101', landlord_id: null, images: [], videos: [], status: 'vacant', publish_status: 'draft' },
      ] as never[],
      [
        {
          id: 3,
          estate_name: '星河湾',
          building_name: '2 栋',
          room_number: '103',
          landlord_id: 8,
          landlord_name: '周房东',
          landlord_phone: '13600000000',
          asking_rent: '4600.00',
          images: [
            { media_id: 10, media_type: 'image', image_role: 'cover' },
            { media_id: 11, media_type: 'image', image_role: 'floor_plan' },
            { media_id: 12, media_type: 'image', image_role: 'living_room' },
          ],
          videos: [{ media_id: 13, media_type: 'video' }],
          status: 'vacant',
          publish_status: 'draft',
        },
      ] as never[],
    );
    expect(publishRows).toHaveLength(2);
    expect(publishRows[0]).toMatchObject({ key: 'blocked-1', stage: 'blocked' });
    expect(publishRows[1]).toMatchObject({ key: 'ready-3', stage: 'ready' });

    const workflowRows = buildWorkflowTasks(
      [{ id: 4, house_id: 1, estate_name: '星河湾', building_name: '1 栋', room_number: '201', customer_name: '李客户', customer_phone: '13900000000', status: 'converted' }] as never[],
      [{ id: 6, house_id: 1, estate_name: '星河湾', building_name: '1 栋', room_number: '202', customer_name: '王客户', customer_phone: '13800000000', contact_id: 9, contact_name: '王租客', status: 'converted' }] as never[],
      [{ id: 5, house_id: 1, estate_name: '星河湾', building_name: '1 栋', room_number: '301', tenant_id: 6, tenant_name: '王租客', tenant_phone: '13700000000', status: 'pending', contract_files: [] }] as never[],
    );
    expect(workflowRows.map((row) => row.queueKey)).toEqual(['contact-missing', 'converted', 'contract']);
  });

  it('restores publish and workflow filters from URL search params', async () => {
    window.history.pushState({}, '', '/dashboard/property-rental/workbench?publish=blocked&workflow=contract');

    render(<QueryClientProvider client={new QueryClient()}><WorkbenchPage /></QueryClientProvider>);

    expect(await screen.findByText('星河湾 / 1 栋 / 101')).toBeInTheDocument();
    expect(screen.queryByText('星河湾 / 2 栋 / 103')).not.toBeInTheDocument();
    expect(screen.getByText('王租客 待补合同')).toBeInTheDocument();
    expect(screen.queryByText('李客户 待补租客')).not.toBeInTheDocument();
    expect(window.location.search).toBe('?publish=blocked&workflow=contract');
  });

  it('shows active workbench filters with a clear-all link', async () => {
    window.history.pushState({}, '', '/dashboard/property-rental/workbench?publish=blocked&workflow=contract');

    render(<QueryClientProvider client={new QueryClient()}><WorkbenchPage /></QueryClientProvider>);

    expect(await screen.findByText('当前只看：发布工作区：阻断发布 / 转签与合同：待补合同')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '查看全部' })).toHaveAttribute('href', '/dashboard/property-rental/workbench');
  });

  it('syncs workbench filters back to URL', async () => {
    render(<QueryClientProvider client={new QueryClient()}><WorkbenchPage /></QueryClientProvider>);

    await screen.findByText('发布工作区');
    const segmentedGroups = screen.getAllByRole('radiogroup', { name: 'segmented control' });
    const publishGroup = segmentedGroups[0];
    const workflowGroup = segmentedGroups[1];

    fireEvent.click(within(publishGroup).getByText((text) => text.startsWith('阻断发布 ')));
    await waitFor(() => expect(window.location.search).toBe('?publish=blocked'));

    fireEvent.click(within(workflowGroup).getByText((text) => text.startsWith('待补合同 ')));
    await waitFor(() => expect(window.location.search).toBe('?publish=blocked&workflow=contract'));

    fireEvent.click(within(publishGroup).getByText((text) => text.startsWith('全部 ')));
    await waitFor(() => expect(window.location.search).toBe('?workflow=contract'));
  });

  it('shows actionable house tasks', async () => {
    render(<QueryClientProvider client={new QueryClient()}><WorkbenchPage /></QueryClientProvider>);

    await waitFor(() => expect(mockListHouses).toHaveBeenCalledWith(expect.objectContaining({ page: 1, page_size: 1 })));
    await waitFor(() => expect(mockListHouses).toHaveBeenCalledWith(expect.objectContaining({ publish_blocked: true, page_size: 5 })));
    await waitFor(() => expect(mockListHouses).toHaveBeenCalledWith(expect.objectContaining({ publish_ready: true, page_size: 5 })));
    await screen.findByText('星河湾 / 1 栋 / 101');
    expect(screen.queryByText('102')).not.toBeInTheDocument();

    expect(screen.getByText('经营总览')).toBeInTheDocument();
    expect(screen.queryByText('当前建议')).not.toBeInTheDocument();
    expect(screen.queryByText('当前发布策略：标准发布')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '去空间设置调整发布规则' })).not.toBeInTheDocument();
    expect(screen.queryByText('关键提醒')).not.toBeInTheDocument();
    expect(screen.queryByText('优先处理')).not.toBeInTheDocument();
    expect(screen.queryByText('正在阻塞')).not.toBeInTheDocument();
    expect(screen.queryByText('持续监控')).not.toBeInTheDocument();
    expect(screen.getByText('在管房源')).toBeInTheDocument();
    expect(screen.getByText('可发布')).toBeInTheDocument();
    expect(screen.getAllByText('阻断发布').length).toBeGreaterThan(0);
    expect(screen.getAllByText('待补租客').length).toBeGreaterThan(1);
    expect(screen.getAllByText('待签约').length).toBeGreaterThan(0);
    expect(screen.getByText('待补合同')).toBeInTheDocument();
    expect(screen.getByText('3 套房源在当前组织内管理')).toBeInTheDocument();
    expect(screen.getByText('1 套被当前阻断规则卡住')).toBeInTheDocument();
    expect(screen.getByText('1 套已具备上架条件')).toBeInTheDocument();
    expect(screen.getByText('1 条成交待补业务主体')).toBeInTheDocument();
    expect(screen.getByText('2 条成交可直接转租约')).toBeInTheDocument();
    expect(screen.getByText('7 份合同待归档')).toBeInTheDocument();

    expect(screen.getByText('缺房东')).toBeInTheDocument();
    expect(screen.getByText('缺封面')).toBeInTheDocument();
    expect(screen.getByText('发布工作区')).toBeInTheDocument();
    expect(screen.getAllByText('空置').length).toBeGreaterThan(0);
    expect(screen.getAllByText('草稿').length).toBeGreaterThan(0);
    await waitFor(() => expect(mockListViewings).toHaveBeenCalledWith(expect.objectContaining({ pending_lease: true, contact_missing: true })));
    await waitFor(() => expect(mockListViewings).toHaveBeenCalledWith(expect.objectContaining({ pending_lease: true, contact_missing: false })));
    await waitFor(() => expect(mockListLeases).toHaveBeenCalledWith(expect.objectContaining({ contract_missing: true, page_size: 5 })));
    expect(screen.getAllByText('7').length).toBeGreaterThan(0);
    await waitFor(() => expect(screen.getAllByText('1').length).toBeGreaterThan(0));
    expect(screen.getByRole('link', { name: '处理发布问题' })).toHaveAttribute('href', '/dashboard/property-rental/houses/1?action=edit&task=landlord');
    expect(screen.getByRole('link', { name: '检查后发布' })).toHaveAttribute('href', '/dashboard/property-rental/houses/3');
    expect(screen.getByText('资料已完整，可直接发布承接带看。')).toBeInTheDocument();
    expect(screen.getByText('先补房东主体，其他媒体问题可作为发布提醒继续处理')).toBeInTheDocument();
    expect(screen.getByText('成交转签与合同')).toBeInTheDocument();
    expect(screen.getByText('先绑定租客联系人，再创建租约')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '补租客' })).toHaveAttribute('href', '/dashboard/property-rental/viewings?pending_lease=true&contact_missing=true&edit=4');
    expect(screen.getByRole('link', { name: '去签约' })).toHaveAttribute('href', '/dashboard/property-rental/leases?source_viewing_record_id=6');
    expect(screen.getByRole('link', { name: '补合同' })).toHaveAttribute('href', '/dashboard/property-rental/leases?house_id=1&task=contract&edit=5');
  });

  it('does not render standalone publish issue queues', async () => {
    mockListHouses.mockImplementation((params?: Record<string, unknown>) => {
      if (params?.publish_issue === 'video') return Promise.resolve({ items: [], total: 6, page: 1, page_size: 1 });
      return Promise.resolve({ items: [], total: 0, page: 1, page_size: 1 });
    });

    render(<QueryClientProvider client={new QueryClient()}><WorkbenchPage /></QueryClientProvider>);

    await screen.findByText('发布工作区');
    expect(screen.queryByText('待补视频')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '进入待补视频' })).not.toBeInTheDocument();
    expect(mockListHouses).not.toHaveBeenCalledWith(expect.objectContaining({ publish_issue: 'video', page_size: 1 }));
  });

  it('collapses zero-value overview items into a compact summary', async () => {
    mockListHouses.mockImplementation((params?: Record<string, unknown>) => {
      if (params?.publish_issue) return Promise.resolve({ items: [], total: 0, page: 1, page_size: 1 });
      if (params?.publish_blocked || params?.publish_ready) return Promise.resolve({ items: [], total: 0, page: 1, page_size: Number(params?.page_size || 5) });
      return Promise.resolve({ items: [], total: 0, page: 1, page_size: 100 });
    });
    mockListViewings.mockResolvedValue({ items: [], total: 0, page: 1, page_size: 5 });
    mockListLeases.mockResolvedValue({ items: [], total: 0, page: 1, page_size: 5 });

    render(<QueryClientProvider client={new QueryClient()}><WorkbenchPage /></QueryClientProvider>);

    expect(await screen.findByText('经营总览')).toBeInTheDocument();
    expect(screen.queryByText('已收起 5 个 0 项，避免把空指标和关键待办放在同一层级。')).not.toBeInTheDocument();
    expect(screen.queryByText('0 条成交待补业务主体')).not.toBeInTheDocument();
    expect(screen.queryByText('0 条成交可直接转租约')).not.toBeInTheDocument();
    expect(screen.queryByText('0 份合同待归档')).not.toBeInTheDocument();
  });

  it('does not render monitoring task summaries', async () => {
    mockListHouses.mockImplementation((params?: Record<string, unknown>) => {
      if (params?.publish_issue) return Promise.resolve({ items: [], total: 0, page: 1, page_size: 1 });
      if (params?.publish_blocked || params?.publish_ready) return Promise.resolve({ items: [], total: 0, page: 1, page_size: Number(params?.page_size || 5) });
      return Promise.resolve({ items: [], total: 0, page: 1, page_size: 100 });
    });

    render(<QueryClientProvider client={new QueryClient()}><WorkbenchPage /></QueryClientProvider>);

    await screen.findByText('发布工作区');
    expect(screen.queryByText('持续监控')).not.toBeInTheDocument();
    expect(screen.queryByText(/低优先级监控项已收起/)).not.toBeInTheDocument();
  });

  it('does not request publish issue shortcut counts', async () => {
    mockListHouses.mockImplementation((params?: Record<string, unknown>) => {
      if (params?.publish_issue === 'landlord') return Promise.resolve({ items: [], total: 123, page: 1, page_size: 1 });
      if (params?.publish_issue === 'rent') return Promise.resolve({ items: [], total: 8, page: 1, page_size: 1 });
      if (params?.publish_issue === 'cover') return Promise.resolve({ items: [], total: 9, page: 1, page_size: 1 });
      if (params?.publish_issue === 'images') return Promise.resolve({ items: [], total: 10, page: 1, page_size: 1 });
      if (params?.publish_issue === 'floor_plan') return Promise.resolve({ items: [], total: 11, page: 1, page_size: 1 });
      if (params?.publish_blocked && params?.page_size === 1) return Promise.resolve({ items: [], total: 77, page: 1, page_size: 1 });
      if (params?.publish_ready && params?.page_size === 1) return Promise.resolve({ items: [], total: 66, page: 1, page_size: 1 });
      if (params?.publish_blocked) return Promise.resolve({ items: [], total: 77, page: 1, page_size: Number(params?.page_size || 5) });
      if (params?.publish_ready) return Promise.resolve({ items: [], total: 66, page: 1, page_size: Number(params?.page_size || 5) });
      return Promise.resolve({
        items: [{ id: 1, room_number: '101', estate_name: '星河湾', building_name: '1 栋', landlord_id: null, images: [], videos: [], status: 'vacant', publish_status: 'draft' }],
        total: 101,
        page: 1,
        page_size: 100,
      });
    });

    render(<QueryClientProvider client={new QueryClient()}><WorkbenchPage /></QueryClientProvider>);

    await screen.findByText('发布工作区');
    await waitFor(() => expect(screen.getByText('77 套被当前阻断规则卡住')).toBeInTheDocument());
    expect(screen.queryByText('123')).not.toBeInTheDocument();
    expect(screen.queryByText('8')).not.toBeInTheDocument();
    expect(mockListHouses).not.toHaveBeenCalledWith(expect.objectContaining({ publish_issue: 'landlord', page_size: 1 }));
  });

  it('filters publish and workflow tables inside the page', async () => {
    render(<QueryClientProvider client={new QueryClient()}><WorkbenchPage /></QueryClientProvider>);

    expect(await screen.findByText('显示 2 / 2')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: '阻断发布 1' }));
    expect(await screen.findByText('显示 1 / 2')).toBeInTheDocument();
    expect(screen.queryByText('当前筛选下暂无房源')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('radio', { name: '待补合同 7' }));
    expect(await screen.findByText('显示 1 / 3')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '补合同' })).toHaveAttribute('href', '/dashboard/property-rental/leases?house_id=1&task=contract&edit=5');
  });

  it('routes media-only publish issues directly to album maintenance', () => {
    expect(getHouseTaskLink({
      id: 3,
      room_number: '103',
      estate_name: '星河湾',
      building_name: '1 栋',
      landlord_id: 5,
      asking_rent: '4200.00',
      images: [{ media_id: 1, media_type: 'image', image_role: 'bedroom' }],
      videos: [],
      status: 'vacant',
      publish_status: 'draft',
      publish_can_publish: true,
      publish_blocking_issues: [],
      publish_warning_issues: ['缺封面', '图片不足', '缺户型图'],
    } as never)).toEqual({
      label: '维护相册',
      path: '/property-rental/houses/3?action=media&task=cover',
    });
  });

  it('routes video-only publish warnings to album maintenance with a video task', () => {
    expect(getHouseTaskLink({
      id: 7,
      room_number: '107',
      estate_name: '星河湾',
      building_name: '1 栋',
      landlord_id: 5,
      asking_rent: '4200.00',
      images: [
        { media_id: 1, media_type: 'image', image_role: 'cover' },
        { media_id: 2, media_type: 'image', image_role: 'floor_plan' },
        { media_id: 3, media_type: 'image', image_role: 'bedroom' },
      ],
      videos: [],
      status: 'vacant',
      publish_status: 'draft',
      publish_can_publish: true,
      publish_blocking_issues: [],
      publish_warning_issues: ['视频不足'],
    } as never)).toEqual({
      label: '维护相册',
      path: '/property-rental/houses/7?action=media&task=video',
    });
  });

  it('confirms ready-house publishing from workbench before mutating status', async () => {
    render(<QueryClientProvider client={new QueryClient()}><WorkbenchPage /></QueryClientProvider>);

    fireEvent.click(await screen.findByRole('button', { name: '发布' }));
    fireEvent.click(await screen.findByRole('button', { name: '确认发布' }));

    await waitFor(() => expect(mockPatchHouse).toHaveBeenCalledWith(3, { publish_status: 'published' }));
  });

  it('shows empty workflow state when there are no signing or contract tasks', async () => {
    mockListViewings.mockResolvedValue({ items: [], total: 0, page: 1, page_size: 5 });
    mockListLeases.mockResolvedValue({ items: [], total: 0, page: 1, page_size: 5 });

    render(<QueryClientProvider client={new QueryClient()}><WorkbenchPage /></QueryClientProvider>);

    expect(await screen.findByText('暂无成交转签或合同待办')).toBeInTheDocument();
  });
});
