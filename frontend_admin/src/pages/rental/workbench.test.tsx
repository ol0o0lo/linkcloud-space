import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildPublishWorkbenchRows,
  buildWorkflowTasks,
  getHouseTaskLink,
} from '@/pages/team-operations/workbench/widgets/space/model';
import WorkbenchPage from './workbench';

const {
  mockListHouses,
  mockListViewings,
  mockListLeases,
  mockPatchHouse,
  mockListEstates,
  mockListBuildings,
  mockGetDefaultBuilding,
  mockSetDefaultBuilding,
  mockCreateBuilding,
} = vi.hoisted(() => {
  const state = globalThis as typeof globalThis & {
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
  };
  if (!state.__frontendAdminHouseApiMocks__) {
    state.__frontendAdminHouseApiMocks__ = {
      listHouses: vi.fn(),
      listViewingRecords: vi.fn(),
      listLeases: vi.fn(),
      patchHouse: vi.fn(),
      listEstates: vi.fn(),
      listBuildings: vi.fn(),
      getDefaultBuilding: vi.fn(),
      setDefaultBuilding: vi.fn(),
      createBuilding: vi.fn(),
    };
  }
  const mocks = state.__frontendAdminHouseApiMocks__;
  return {
    mockListHouses: mocks.listHouses,
    mockListViewings: mocks.listViewingRecords,
    mockListLeases: mocks.listLeases,
    mockPatchHouse: mocks.patchHouse,
    mockListEstates: mocks.listEstates,
    mockListBuildings: mocks.listBuildings,
    mockGetDefaultBuilding: mocks.getDefaultBuilding,
    mockSetDefaultBuilding: mocks.setDefaultBuilding,
    mockCreateBuilding: mocks.createBuilding,
  };
});

const { mockUseTenantWorkspace } = vi.hoisted(() => {
  const state = globalThis as typeof globalThis & {
    __frontendAdminTenantWorkspaceMock__?: ReturnType<typeof vi.fn>;
  };
  if (!state.__frontendAdminTenantWorkspaceMock__) {
    state.__frontendAdminTenantWorkspaceMock__ = vi.fn();
  }
  return { mockUseTenantWorkspace: state.__frontendAdminTenantWorkspaceMock__ };
});

vi.mock('@umijs/max', () => ({
  history: {
    push: vi.fn(),
  },
}));

vi.mock('@/pages/rental/useHousePublishRules', () => ({
  useHousePublishRules: () => ({ rules: {}, isPending: false }),
}));

vi.mock('@ant-design/pro-components', () => ({
  ProTable: ({ columns, dataSource = [], loading, locale }: any) => {
    const tableColumns = columns.filter((column: any) => !column.hideInTable);
    return (
      <div>
        {loading ? <span>加载中</span> : null}
        <table>
          <thead>
            <tr>
              {tableColumns.map((column: any) => (
                <th key={column.dataIndex}>{column.title}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dataSource.map((record: any, rowIndex: number) => (
              <tr key={record.key || record.id}>
                {tableColumns.map((column: any) => (
                  <td key={column.dataIndex}>
                    {column.render ? column.render(record[column.dataIndex], record, rowIndex) : record[column.dataIndex]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && !dataSource.length ? <div>{locale?.emptyText || '暂无数据'}</div> : null}
      </div>
    );
  },
}));

vi.mock('@/pages/space/shared', () => ({
  TenantSelectionGuard: ({ title, children }: { title?: string; children: React.ReactNode }) => (
    <section>
      {title ? <h1>{title}</h1> : null}
      {children}
    </section>
  ),
  useTenantWorkspace: mockUseTenantWorkspace,
}));

vi.mock('@/components/EntityPreview', () => ({
  HousePreview: ({ id, children }: { id?: number | null; children: React.ReactNode }) => <span data-preview="house" data-id={id}>{children}</span>,
}));

vi.mock('@/services/manual/house', () => ({
  houseApi: {
    listHouses: mockListHouses,
    listViewingRecords: mockListViewings,
    listLeases: mockListLeases,
    patchHouse: mockPatchHouse,
    listEstates: mockListEstates,
    listBuildings: mockListBuildings,
    getDefaultBuilding: mockGetDefaultBuilding,
    setDefaultBuilding: mockSetDefaultBuilding,
    createBuilding: mockCreateBuilding,
  },
}));

const estateSummary = { id: 1, name: 'xinghewan', display_name: '星河湾' };
const building1 = { id: 10, name: '1 栋', estate_id: 1, estate: estateSummary };
const building2 = { id: 11, name: '2 栋', estate_id: 1, estate: estateSummary };
const landlord = { id: 8, name: '周房东', phone: '13600000000' };
const tenant = { id: 9, name: '王租客', phone: '13800000000' };
const houseSummary = (options: { id: number; roomNumber: string; building?: typeof building1 }) => ({
  id: options.id,
  label: `${options.building?.estate.display_name || '星河湾'} / ${options.building?.name || '1 栋'} / ${options.roomNumber}`,
  room_number: options.roomNumber,
  building_id: options.building?.id || building1.id,
  building: options.building || building1,
});

describe('Property rental workbench', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.pushState({}, '', '/dashboard/rental/workbench/overview');
    mockUseTenantWorkspace.mockImplementation(() => ({ selectedOrgSlug: 'org', queryClient: new QueryClient() }));
    mockPatchHouse.mockResolvedValue({ id: 3, status: 'listed' });
    mockListHouses.mockImplementation((params?: Record<string, unknown>) => {
      const blockedHouse = { ...houseSummary({ id: 1, roomNumber: '101' }), landlord_id: null, landlord: null, images: [], videos: [], status: 'vacant', status__mapping: '空置' };
      const publishedHouse = {
        ...houseSummary({ id: 2, roomNumber: '102' }),
        id: 2,
        landlord_id: 5,
        landlord: { id: 5, name: '已发布房东', phone: '13500000000' },
        asking_rent: '4200.00',
        images: [
          { media_id: 1, media_type: 'image', image_role: 'cover' },
          { media_id: 2, media_type: 'image', image_role: 'floor_plan' },
          { media_id: 3, media_type: 'image', image_role: 'bedroom' },
        ],
        videos: [],
        status: 'listed',
        status__mapping: '招租',
      };
      const readyHouse = {
        ...houseSummary({ id: 3, roomNumber: '103', building: building2 }),
        id: 3,
        landlord_id: 8,
        landlord,
        asking_rent: '4600.00',
        images: [
          { media_id: 10, media_type: 'image', image_role: 'cover' },
          { media_id: 11, media_type: 'image', image_role: 'floor_plan' },
          { media_id: 12, media_type: 'image', image_role: 'living_room' },
        ],
        videos: [{ media_id: 13, media_type: 'video' }],
        status: 'vacant',
        status__mapping: '空置',
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
          items: [{ id: 4, house_id: 1, house: houseSummary({ id: 1, roomNumber: '201' }), contact_id: null, contact: null, customer_name: '李客户', customer_phone: '13900000000', status: 'converted' }],
          total: 1,
          page: 1,
          page_size: 5,
        });
      }
      if (params?.contact_missing === false) {
        return Promise.resolve({
          items: [{ id: 6, house_id: 1, house: houseSummary({ id: 1, roomNumber: '202' }), customer_name: '王客户', customer_phone: '13800000000', contact_id: 9, contact: tenant, status: 'converted' }],
          total: 2,
          page: 1,
          page_size: 5,
        });
      }
      return Promise.resolve({ items: [], total: 0, page: 1, page_size: 5 });
    });
    mockListLeases.mockResolvedValue({
      items: [{ id: 5, house_id: 1, house: houseSummary({ id: 1, roomNumber: '301' }), tenant_id: 6, tenant: { id: 6, name: '王租客', phone: '13700000000' }, status: 'pending', contract_files: [] }],
      total: 7,
      page: 1,
      page_size: 5,
    });
  });

  it('builds publish and workflow rows from API items without extra page wrappers', () => {
    const publishRows = buildPublishWorkbenchRows(
      [
        { ...houseSummary({ id: 1, roomNumber: '101' }), landlord_id: null, landlord: null, images: [], videos: [], status: 'vacant' },
      ] as never[],
      [
        {
          ...houseSummary({ id: 3, roomNumber: '103', building: building2 }),
          landlord_id: 8,
          landlord,
          asking_rent: '4600.00',
          images: [
            { media_id: 10, media_type: 'image', image_role: 'cover' },
            { media_id: 11, media_type: 'image', image_role: 'floor_plan' },
            { media_id: 12, media_type: 'image', image_role: 'living_room' },
          ],
          videos: [{ media_id: 13, media_type: 'video' }],
          status: 'vacant',
        },
      ] as never[],
    );
    expect(publishRows).toHaveLength(2);
    expect(publishRows[0]).toMatchObject({ key: 'blocked-1', stage: 'blocked' });
    expect(publishRows[1]).toMatchObject({ key: 'ready-3', stage: 'ready' });

    const workflowRows = buildWorkflowTasks(
      [{ id: 4, house_id: 1, house: houseSummary({ id: 1, roomNumber: '201' }), contact_id: null, contact: null, customer_name: '李客户', customer_phone: '13900000000', status: 'converted' }] as never[],
      [{ id: 6, house_id: 1, house: houseSummary({ id: 1, roomNumber: '202' }), customer_name: '王客户', customer_phone: '13800000000', contact_id: 9, contact: tenant, status: 'converted' }] as never[],
    );
    expect(workflowRows.map((row) => row.queueKey)).toEqual(['contact-missing', 'converted']);
  });

  it('restores publish and workflow filters from URL search params', async () => {
    window.history.pushState({}, '', '/dashboard/rental/workbench/overview?publish=blocked&workflow=contract');

    render(<QueryClientProvider client={new QueryClient()}><WorkbenchPage /></QueryClientProvider>);

    expect(await screen.findByText('星河湾 / 1 栋 / 101')).toBeInTheDocument();
    expect(screen.queryByText('星河湾 / 2 栋 / 103')).not.toBeInTheDocument();
    expect(screen.getByText('李客户 待补租客')).toBeInTheDocument();
    expect(screen.queryByText('王租客 待补合同')).not.toBeInTheDocument();
    expect(window.location.search).toBe('?publish=blocked');
  });

  it('shows active workbench filters with a clear-all link', async () => {
    window.history.pushState({}, '', '/dashboard/rental/workbench/overview?publish=blocked&workflow=contract');

    render(<QueryClientProvider client={new QueryClient()}><WorkbenchPage /></QueryClientProvider>);

    expect(await screen.findByText('当前只看：发布工作区：阻断发布')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '查看全部' })).toHaveAttribute('href', '/dashboard/rental/workbench/overview');
  });

  it('syncs workbench filters back to URL', async () => {
    render(<QueryClientProvider client={new QueryClient()}><WorkbenchPage /></QueryClientProvider>);

    await screen.findByText('发布工作区');
    const segmentedGroups = screen.getAllByRole('radiogroup', { name: 'segmented control' });
    const publishGroup = segmentedGroups[0];
    const workflowGroup = segmentedGroups[1];

    fireEvent.click(within(publishGroup).getByText((text) => text.startsWith('阻断发布 ')));
    await waitFor(() => expect(window.location.search).toBe('?publish=blocked'));

    fireEvent.click(within(workflowGroup).getByText((text) => text.startsWith('待签约 ')));
    await waitFor(() => expect(window.location.search).toBe('?publish=blocked&workflow=converted'));

    fireEvent.click(within(publishGroup).getByText((text) => text.startsWith('全部 ')));
    await waitFor(() => expect(window.location.search).toBe('?workflow=converted'));
  });

  it('shows actionable house tasks', async () => {
    render(<QueryClientProvider client={new QueryClient()}><WorkbenchPage /></QueryClientProvider>);

    await waitFor(() => expect(mockListHouses).toHaveBeenCalledWith(expect.objectContaining({ page: 1, page_size: 100 })));
    expect(mockListHouses).not.toHaveBeenCalledWith(expect.objectContaining({ publish_blocked: true }));
    expect(mockListHouses).not.toHaveBeenCalledWith(expect.objectContaining({ publish_ready: true }));
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
    expect(screen.getAllByText('待补租客').length).toBeGreaterThan(0);
    expect(screen.getAllByText('待签约').length).toBeGreaterThan(0);
    expect(screen.getByRole('radio', { name: '阻断发布 1' })).toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: /待补合同/ })).not.toBeInTheDocument();

    expect(screen.getByText('缺房东')).toBeInTheDocument();
    expect(screen.getByText('缺封面')).toBeInTheDocument();
    expect(screen.getByText('发布工作区')).toBeInTheDocument();
    await waitFor(() => expect(mockListViewings).toHaveBeenCalledWith(expect.objectContaining({ pending_lease: true, contact_missing: true })));
    await waitFor(() => expect(mockListViewings).toHaveBeenCalledWith(expect.objectContaining({ pending_lease: true, contact_missing: false })));
    expect(mockListLeases).not.toHaveBeenCalledWith(expect.objectContaining({ contract_missing: true, page_size: 5 }));
    await waitFor(() => expect(screen.getAllByText('1').length).toBeGreaterThan(0));
    expect(screen.getByRole('link', { name: '处理发布问题' })).toHaveAttribute('href', '/dashboard/rental/properties/1?action=edit&task=landlord');
    expect(screen.getByRole('link', { name: '检查后发布' })).toHaveAttribute('href', '/dashboard/rental/properties/3');
    expect(screen.getByText('资料已完整，可直接发布承接带看。')).toBeInTheDocument();
    expect(screen.getByText('先补房东主体，其他媒体问题可作为发布提醒继续处理')).toBeInTheDocument();
    expect(screen.getByText('成交转签')).toBeInTheDocument();
    expect(screen.getByText('先绑定租客联系人，再创建租约')).toBeInTheDocument();
    expect(screen.getByText('星河湾 / 1 栋 / 201')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '补租客' })).toHaveAttribute('href', '/dashboard/rental/viewings?pending_lease=true&contact_missing=true&edit=4');
    expect(screen.getByRole('link', { name: '去签约' })).toHaveAttribute('href', '/dashboard/rental/leases?source_viewing_record_id=6');
    expect(screen.queryByRole('link', { name: '补合同' })).not.toBeInTheDocument();
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
        items: [{ ...houseSummary({ id: 1, roomNumber: '101' }), landlord_id: null, landlord: null, images: [], videos: [], status: 'vacant' }],
        total: 101,
        page: 1,
        page_size: 100,
      });
    });

    render(<QueryClientProvider client={new QueryClient()}><WorkbenchPage /></QueryClientProvider>);

    await screen.findByText('发布工作区');
    await waitFor(() => expect(screen.getByRole('radio', { name: '阻断发布 1' })).toBeInTheDocument());
    expect(screen.queryByText('123')).not.toBeInTheDocument();
    expect(screen.queryByText('8')).not.toBeInTheDocument();
    expect(mockListHouses).not.toHaveBeenCalledWith(expect.objectContaining({ publish_issue: 'landlord', page_size: 1 }));
    expect(mockListHouses).not.toHaveBeenCalledWith(expect.objectContaining({ publish_blocked: true }));
    expect(mockListHouses).not.toHaveBeenCalledWith(expect.objectContaining({ publish_ready: true }));
  });

  it('filters publish and workflow tables inside the page', async () => {
    render(<QueryClientProvider client={new QueryClient()}><WorkbenchPage /></QueryClientProvider>);

    expect((await screen.findAllByText((text) => text.startsWith('显示 2 / 2'))).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('radio', { name: '阻断发布 1' }));
    expect((await screen.findAllByText((text) => text.startsWith('显示 1 / 2'))).length).toBeGreaterThan(0);
    expect(screen.queryByText('当前筛选下暂无房源')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('radio', { name: '待签约 2' }));
    expect((await screen.findAllByText((text) => text.startsWith('显示 1 / 2'))).length).toBeGreaterThan(0);
    expect(screen.queryByRole('link', { name: '补合同' })).not.toBeInTheDocument();
  });

  it('routes media-only publish issues directly to album maintenance', () => {
    expect(getHouseTaskLink({
      ...houseSummary({ id: 3, roomNumber: '103' }),
      landlord_id: 5,
      landlord: { id: 5, name: '张房东', phone: '13800000000' },
      asking_rent: '4200.00',
      images: [{ media_id: 1, media_type: 'image', image_role: 'bedroom' }],
      videos: [],
      status: 'vacant',
      publish_can_publish: true,
      publish_blocking_issues: [],
      publish_warning_issues: ['缺封面', '图片不足', '缺户型图'],
    } as never)).toEqual({
      label: '维护相册',
      path: '/rental/properties/3?action=media&task=cover',
    });
  });

  it('routes video-only publish warnings to album maintenance with a video task', () => {
    expect(getHouseTaskLink(
      {
        ...houseSummary({ id: 7, roomNumber: '107' }),
        landlord_id: 5,
        landlord: { id: 5, name: '张房东', phone: '13800000000' },
        asking_rent: '4200.00',
        images: [
          { media_id: 1, media_type: 'image', image_role: 'cover' },
          { media_id: 2, media_type: 'image', image_role: 'floor_plan' },
          { media_id: 3, media_type: 'image', image_role: 'bedroom' },
        ],
        videos: [],
        status: 'vacant',
      } as never,
      {
        landlord: { mode: 'required' },
        rent: { mode: 'required' },
        cover: { mode: 'warn' },
        images: { mode: 'warn', min_count: 3 },
        floor_plan: { mode: 'warn' },
        video: { mode: 'warn', min_count: 1 },
      },
    )).toEqual({
      label: '维护相册',
      path: '/rental/properties/7?action=media&task=video',
    });
  });

  it('confirms ready-house publishing from workbench before mutating status', async () => {
    render(<QueryClientProvider client={new QueryClient()}><WorkbenchPage /></QueryClientProvider>);

    fireEvent.click(await screen.findByRole('button', { name: '发布' }));
    fireEvent.click(await screen.findByRole('button', { name: '确认发布' }));

    await waitFor(() => expect(mockPatchHouse).toHaveBeenCalledWith(3, { status: 'listed' }));
  });

  it('shows empty workflow state when there are no signing tasks', async () => {
    mockListViewings.mockResolvedValue({ items: [], total: 0, page: 1, page_size: 5 });
    mockListLeases.mockResolvedValue({ items: [], total: 0, page: 1, page_size: 5 });

    render(<QueryClientProvider client={new QueryClient()}><WorkbenchPage /></QueryClientProvider>);

    expect(await screen.findByText('暂无成交转签待办')).toBeInTheDocument();
  });
});
