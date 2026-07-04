import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { message } from 'antd';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ContactsPage from '../contacts';
import EstatesPage from '../estates';
import HousesPage from '../houses';
import LeasesPage from '../leases';
import ViewingsPage from '../viewings';

const {
  mockCreateBuilding,
  mockCreateContact,
  mockCreateLease,
  mockCreateViewingRecord,
  mockGetLease,
  mockHistoryPush,
  mockListBuildings,
  mockListContacts,
  mockListEstates,
  mockListHouses,
  mockListLeases,
  mockListViewings,
  mockPatchContact,
  mockPatchHouse,
  mockPatchLease,
  mockPatchViewingRecord,
} = vi.hoisted(() => ({
  mockCreateBuilding: vi.fn(),
  mockCreateContact: vi.fn(),
  mockCreateLease: vi.fn(),
  mockCreateViewingRecord: vi.fn(),
  mockGetLease: vi.fn(),
  mockHistoryPush: vi.fn(),
  mockListEstates: vi.fn(),
  mockListBuildings: vi.fn(),
  mockListContacts: vi.fn(),
  mockListHouses: vi.fn(),
  mockListViewings: vi.fn(),
  mockListLeases: vi.fn(),
  mockPatchContact: vi.fn(),
  mockPatchHouse: vi.fn(),
  mockPatchLease: vi.fn(),
  mockPatchViewingRecord: vi.fn(),
}));

vi.mock('@umijs/max', () => ({
  history: {
    push: mockHistoryPush,
  },
}));

vi.mock('@/pages/tenant/shared', () => ({
  TenantSelectionGuard: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useTenantWorkspace: () => ({ selectedOrgSlug: 'org', queryClient: new QueryClient() }),
}));

vi.mock('@/services/manual/house', () => ({
  houseApi: {
    createBuilding: mockCreateBuilding,
    createContact: mockCreateContact,
    createLease: mockCreateLease,
    createViewingRecord: mockCreateViewingRecord,
    getLease: mockGetLease,
    listEstates: mockListEstates,
    listBuildings: mockListBuildings,
    listContacts: mockListContacts,
    listHouses: mockListHouses,
    listViewingRecords: mockListViewings,
    listLeases: mockListLeases,
    patchContact: mockPatchContact,
    patchHouse: mockPatchHouse,
    patchLease: mockPatchLease,
    patchViewingRecord: mockPatchViewingRecord,
  },
}));

const enumData = {
  'house.contact_role': [
    { label: '房东', value: 'landlord' },
    { label: '租客', value: 'tenant' },
  ],
  'house.estate_property_type': [{ label: '住宅', value: 'residential' }],
  'house.house_status': [{ label: '空置', value: 'vacant' }],
  'house.house_publish_status': [{ label: '草稿', value: 'draft' }],
  'house.viewing_record_status': [
    { label: '已预约', value: 'scheduled' },
    { label: '已带看', value: 'viewed' },
    { label: '已成交', value: 'converted' },
    { label: '已取消', value: 'canceled' },
    { label: '爽约', value: 'no_show' },
  ],
  'house.lease_status': [
    { label: '待生效', value: 'pending' },
    { label: '生效中', value: 'active' },
    { label: '已到期', value: 'expired' },
    { label: '已终止', value: 'terminated' },
  ],
};

vi.mock('@/services/manual/enums', () => ({
  enumMapping: (value?: string | null, mapping?: string | null) => mapping || value || '-',
  enumOptionMapping: (enumMap: typeof enumData | undefined, key: keyof typeof enumData, value?: string | null) =>
    value ? enumMap?.[key]?.find((item) => item.value === value)?.label || value : '-',
  enumSelectOptions: (enumMap: typeof enumData | undefined, key: keyof typeof enumData) => enumMap?.[key] || [],
  useEnums: () => ({ data: enumData }),
}));

const renderPage = (node: React.ReactNode) => render(<QueryClientProvider client={new QueryClient()}>{node}</QueryClientProvider>);

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

describe('Property rental domain list pages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.pushState({}, '', '/');
    mockListEstates.mockResolvedValue({ items: [{ id: 1, name: '星河湾', city: '深圳', district: '南山', address: '科技路' }], total: 1, page: 1, page_size: 100 });
    mockListBuildings.mockResolvedValue({ items: [{ id: 2, estate_id: 1, name: '1 栋', floors: 32, elevator: true }], total: 1, page: 1, page_size: 100 });
    mockListContacts.mockResolvedValue({ items: [{ id: 3, name: '张房东', phone: '13800000000', roles: ['landlord'] }], total: 1, page: 1, page_size: 100 });
    mockListHouses.mockResolvedValue({ items: [{ id: 99, room_number: 'A-101' }], total: 1, page: 1, page_size: 100 });
    mockListViewings.mockResolvedValue({ items: [{ id: 4, house_id: 99, house_label: 'A-101', customer_name: '李客户', customer_phone: '13900000000', scheduled_at: '2026-07-01T10:00:00+08:00', status: 'scheduled' }], total: 1, page: 1, page_size: 100 });
    mockListLeases.mockResolvedValue({ items: [{ id: 5, house_id: 99, house_label: 'A-101', tenant_id: 6, tenant_name: '王租客', tenant_phone: '13700000000', start_date: '2026-07-01', end_date: '2027-06-30', monthly_rent: '4200.00', status: 'active', contract_files: [] }], total: 1, page: 1, page_size: 100 });
    mockCreateBuilding.mockResolvedValue({ id: 7, estate_id: 1, name: '2 栋', floors: 28, elevator: false, address: '' });
    mockCreateContact.mockResolvedValue({ id: 8, name: '王租客', phone: '13700000000', roles: ['tenant'] });
    mockCreateLease.mockResolvedValue({ id: 10, house_id: 99, tenant_id: 6, status: 'pending' });
    mockCreateViewingRecord.mockResolvedValue({ id: 9, house_id: 99, customer_name: '赵客户', customer_phone: '13600000000', scheduled_at: '2026-07-02T10:00:00+08:00', status: 'scheduled' });
    mockGetLease.mockResolvedValue({ id: 5, house_id: 99, house_label: 'A-101', tenant_id: 6, tenant_name: '王租客', tenant_phone: '13700000000', start_date: '2026-07-01', end_date: '2027-06-30', monthly_rent: '4200.00', status: 'active', contract_files: [] });
    mockPatchContact.mockResolvedValue({ id: 3, name: '张房东', phone: '13800000000', roles: ['landlord'], is_active: true });
    mockPatchLease.mockResolvedValue({ id: 5, status: 'expired' });
    mockPatchViewingRecord.mockResolvedValue({ id: 4, house_id: 99, customer_name: '李客户', customer_phone: '13900000000', scheduled_at: '2026-07-01T10:00:00+08:00', status: 'viewed' });
  });

  afterEach(() => {
    message.destroy();
    window.history.pushState({}, '', '/');
  });

  it('shows estate and building rows', async () => {
    mockListEstates.mockResolvedValue({ items: [{ id: 1, name: 'xinghewan', display_name: '星河湾花园', city: '深圳', district: '南山', address: '科技路' }], total: 1, page: 1, page_size: 100 });

    renderPage(<EstatesPage />);

    expect(await screen.findByText('星河湾花园')).toBeInTheDocument();
    expect(await screen.findByText('1 栋')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: '编辑' })).toHaveLength(2);
  });

  it('uses estate display names when selecting a building estate', async () => {
    mockListEstates.mockResolvedValue({ items: [{ id: 1, name: 'xinghewan', display_name: '星河湾花园', city: '深圳', district: '南山', address: '科技路' }], total: 1, page: 1, page_size: 100 });

    renderPage(<EstatesPage />);

    fireEvent.click(await screen.findByRole('button', { name: 'plus 新建楼栋' }));
    fireEvent.mouseDown(screen.getByLabelText('所属项目'));

    expect((await screen.findAllByText('星河湾花园')).at(-1)).toBeDefined();
    expect(screen.queryByText('xinghewan')).not.toBeInTheDocument();
  });

  it('shows estate and building active states', async () => {
    mockListEstates.mockResolvedValue({ items: [{ id: 1, name: 'xinghewan', display_name: '星河湾花园', city: '深圳', district: '南山', address: '科技路', is_active: false }], total: 1, page: 1, page_size: 100 });
    mockListBuildings.mockResolvedValue({ items: [{ id: 2, estate_id: 1, name: '1 栋', floors: 32, elevator: true, is_active: true }], total: 1, page: 1, page_size: 100 });

    renderPage(<EstatesPage />);

    expect(await screen.findByText('停用')).toBeInTheDocument();
    expect(await screen.findByText('启用')).toBeInTheDocument();
  });

  it('shows estate supply overview and register hints', async () => {
    mockListEstates.mockResolvedValue({
      items: [
        { id: 1, name: 'xinghewan', display_name: '星河湾花园', city: '深圳', district: '南山', address: '科技路', is_active: true, property_type: 'residential', province: '广东' },
        { id: 2, name: 'oldtown', display_name: '旧改公寓', city: '深圳', district: '宝安', address: '', is_active: false, property_type: 'residential', province: '广东' },
      ],
      total: 2,
      page: 1,
      page_size: 100,
    });
    mockListBuildings.mockResolvedValue({
      items: [
        { id: 2, estate_id: 1, estate_name: '星河湾花园', name: '1 栋', floors: 32, elevator: true, address: '科技路 1 栋', is_active: true },
        { id: 3, estate_id: 2, estate_name: '旧改公寓', name: '2 栋', floors: 18, elevator: false, address: '', is_active: false },
      ],
      total: 2,
      page: 1,
      page_size: 100,
    });

    renderPage(<EstatesPage />);

    expect(await screen.findByText('项目供给概览')).toBeInTheDocument();
    expect(screen.queryByText('当前建议')).not.toBeInTheDocument();
    expect(screen.getAllByText('项目台账').length).toBeGreaterThan(0);
    expect(screen.getAllByText('楼栋台账').length).toBeGreaterThan(0);
    expect(screen.queryByText('基础治理队列')).not.toBeInTheDocument();
    expect(screen.queryByText('已收起 1 个 0 项，避免把空队列和当前重点放在同一层级。')).not.toBeInTheDocument();
    expect(await screen.findByText('1 栋 / 1 栋启用')).toBeInTheDocument();
    expect((await screen.findAllByText('停用中，暂停新增房源')).length).toBeGreaterThan(0);
    expect(await screen.findByText('有电梯，可优先承接高层房源')).toBeInTheDocument();
    expect(await screen.findByText('缺地址，先补楼栋资料')).toBeInTheDocument();
  });

  it('starts building creation from an estate row and preselects that estate', async () => {
    mockListEstates.mockResolvedValue({ items: [{ id: 1, name: 'xinghewan', display_name: '星河湾花园', city: '深圳', district: '南山', address: '科技路' }], total: 1, page: 1, page_size: 100 });

    renderPage(<EstatesPage />);

    fireEvent.click(await screen.findByRole('button', { name: /新建楼栋/ }));
    fireEvent.change(screen.getByLabelText('楼栋名'), { target: { value: '2 栋' } });
    fireEvent.change(screen.getByLabelText('楼层'), { target: { value: '28' } });
    fireEvent.click(screen.getByRole('button', { name: /保\s*存/ }));

    await waitFor(() => expect(mockCreateBuilding).toHaveBeenCalledWith(expect.objectContaining({
      estate_id: 1,
      name: '2 栋',
      floors: 28,
    })));
  });

  it('links active buildings directly to house registration', async () => {
    mockListEstates.mockResolvedValue({ items: [{ id: 1, name: 'xinghewan', display_name: '星河湾花园', city: '深圳', district: '南山', address: '科技路' }], total: 1, page: 1, page_size: 100 });
    mockListBuildings.mockResolvedValue({ items: [{ id: 2, estate_id: 1, estate_name: '星河湾花园', name: '1 栋', floors: 32, elevator: true, is_active: true }], total: 1, page: 1, page_size: 100 });

    renderPage(<EstatesPage />);

    expect(await screen.findByRole('link', { name: '登记房源' })).toHaveAttribute('href', '/dashboard/property-rental/houses/new?building_id=2');
  });

  it('avoids inactive cleanup advice when estate data is incomplete but still active', async () => {
    mockListEstates.mockResolvedValue({
      items: [
        { id: 1, name: 'default-estate', display_name: '默认项目', city: '默认', district: '默认', address: '默认', is_active: true, property_type: 'residential', province: '默认' },
      ],
      total: 1,
      page: 1,
      page_size: 100,
    });
    mockListBuildings.mockResolvedValue({
      items: [
        { id: 2, estate_id: 1, estate_name: '默认项目', name: '默认楼栋', floors: 1, elevator: false, address: '', is_active: true },
      ],
      total: 1,
      page: 1,
      page_size: 100,
    });

    renderPage(<EstatesPage />);

    expect(await screen.findByText('项目供给概览')).toBeInTheDocument();
    expect(screen.queryByText('当前建议')).not.toBeInTheDocument();
    expect(screen.queryByText('优先清理停用项目/楼栋，并补齐项目地址和楼栋资料，避免房源建档时挂到无效基础数据。')).not.toBeInTheDocument();
  });

  it('scopes estate overview when searching by keyword', async () => {
    mockListEstates.mockImplementation((params?: Record<string, unknown>) => {
      if (params?.keyword === '旧改') {
        return Promise.resolve({
          items: [
            { id: 2, name: 'legacy-estate', display_name: '旧改公寓', city: '上海', district: '浦东', address: '张杨路 1 号', is_active: true, property_type: 'apartment', province: '上海' },
          ],
          total: 1,
          page: 1,
          page_size: Number(params?.page_size || 20),
        });
      }
      return Promise.resolve({
        items: [
          { id: 1, name: 'default-estate', display_name: '默认项目', city: '默认', district: '默认', address: '默认', is_active: true, property_type: 'residential', province: '默认' },
          { id: 2, name: 'legacy-estate', display_name: '旧改公寓', city: '上海', district: '浦东', address: '张杨路 1 号', is_active: true, property_type: 'apartment', province: '上海' },
          { id: 3, name: 'archive-estate', display_name: '停用项目', city: '上海', district: '徐汇', address: '', is_active: false, property_type: 'office', province: '上海' },
        ],
        total: 3,
        page: 1,
        page_size: Number(params?.page_size || 20),
      });
    });
    mockListBuildings.mockImplementation((params?: Record<string, unknown>) => {
      if (params?.keyword === '旧改') {
        return Promise.resolve({
          items: [
            { id: 3, estate_id: 2, estate_name: '旧改公寓', name: '2 栋', floors: 18, elevator: true, address: '张杨路 1 号', is_active: true },
          ],
          total: 1,
          page: 1,
          page_size: Number(params?.page_size || 20),
        });
      }
      return Promise.resolve({
        items: [
          { id: 1, estate_id: 1, estate_name: '默认项目', name: '1 栋', floors: 30, elevator: true, address: '默认', is_active: true },
          { id: 3, estate_id: 2, estate_name: '旧改公寓', name: '2 栋', floors: 18, elevator: true, address: '张杨路 1 号', is_active: true },
          { id: 4, estate_id: 3, estate_name: '停用项目', name: '老楼栋', floors: 6, elevator: false, address: '', is_active: false },
        ],
        total: 3,
        page: 1,
        page_size: Number(params?.page_size || 20),
      });
    });

    renderPage(<EstatesPage />);

    fireEvent.change(screen.getByPlaceholderText('项目 / 楼栋名称'), { target: { value: '旧改' } });
    fireEvent.click(screen.getByRole('button', { name: 'search' }));

    expect(await screen.findByText('当前筛选概览')).toBeInTheDocument();
    expect(screen.getByText('当前只看：搜索：旧改')).toBeInTheDocument();
    expect(screen.queryByText('当前建议')).not.toBeInTheDocument();
    await waitFor(() => expect(mockListEstates).toHaveBeenCalledWith(expect.objectContaining({ keyword: '旧改' })));
    await waitFor(() => expect(mockListBuildings).toHaveBeenCalledWith(expect.objectContaining({ keyword: '旧改' })));
  });

  it('restores estate search state from URL', async () => {
    window.history.pushState({}, '', '/property-rental/estates?keyword=%E6%97%A7%E6%94%B9&view=buildings&estate_page=2&building_page=3');

    renderPage(<EstatesPage />);

    expect(await screen.findByDisplayValue('旧改')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'plus 新建项目' })).not.toBeInTheDocument();
    expect(screen.getByRole('radio', { name: '楼栋台账' })).toBeInTheDocument();
    await waitFor(() => expect(mockListEstates).toHaveBeenCalledWith(expect.objectContaining({ page: 2, keyword: '旧改' })));
    await waitFor(() => expect(mockListBuildings).toHaveBeenCalledWith(expect.objectContaining({ page: 3, keyword: '旧改' })));
  });

  it('syncs estate search state back to URL', async () => {
    renderPage(<EstatesPage />);

    fireEvent.change(screen.getByPlaceholderText('项目 / 楼栋名称'), { target: { value: '旧改' } });
    fireEvent.click(screen.getByRole('button', { name: 'search' }));

    await waitFor(() => expect(window.location.search).toBe('?keyword=%E6%97%A7%E6%94%B9'));
  });

  it('switches between estate and building ledger views', async () => {
    renderPage(<EstatesPage />);

    expect(await screen.findByRole('button', { name: 'plus 新建项目' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'plus 新建楼栋' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('radio', { name: '楼栋台账' }));

    await waitFor(() => expect(screen.queryByRole('button', { name: 'plus 新建项目' })).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'plus 新建楼栋' })).toBeInTheDocument();
  });

  it('filters estate governance queue for building address issues from URL', async () => {
    window.history.pushState({}, '', '/property-rental/estates?task=building_address');
    mockListEstates.mockResolvedValue({
      items: [{ id: 1, name: 'default-estate', display_name: '默认项目', city: '默认', district: '默认', address: '默认', is_active: true, property_type: 'residential', province: '默认' }],
      total: 1,
      page: 1,
      page_size: 100,
    });
    mockListBuildings.mockResolvedValue({
      items: [
        { id: 2, estate_id: 1, estate_name: '默认项目', name: '默认楼栋', floors: 1, elevator: false, address: '', is_active: true },
        { id: 3, estate_id: 1, estate_name: '默认项目', name: '完整楼栋', floors: 18, elevator: true, address: '科技路 1 号', is_active: true },
      ],
      total: 2,
      page: 1,
      page_size: 100,
    });

    renderPage(<EstatesPage />);

    expect(await screen.findByText('当前只看：待补楼栋地址')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: '楼栋台账' })).toBeInTheDocument();
    expect(screen.queryByText('完整楼栋')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'plus 新建项目' })).not.toBeInTheDocument();
  });

  it('filters estate governance queue for estate address issues from URL', async () => {
    window.history.pushState({}, '', '/property-rental/estates?task=estate_address');
    mockListEstates.mockResolvedValue({
      items: [
        { id: 1, name: 'pending-estate', display_name: '待补地址项目', city: '深圳', district: '南山', address: '', is_active: true, property_type: 'residential', province: '广东' },
        { id: 2, name: 'ready-estate', display_name: '完整项目', city: '深圳', district: '福田', address: '深南大道 1 号', is_active: true, property_type: 'residential', province: '广东' },
      ],
      total: 2,
      page: 1,
      page_size: 100,
    });
    mockListBuildings.mockResolvedValue({
      items: [{ id: 2, estate_id: 2, estate_name: '完整项目', name: '1 栋', floors: 18, elevator: true, address: '深南大道 1 号', is_active: true }],
      total: 1,
      page: 1,
      page_size: 100,
    });

    renderPage(<EstatesPage />);

    expect(await screen.findByText('当前只看：待补项目地址')).toBeInTheDocument();
    expect(await screen.findByText('待补地址项目')).toBeInTheDocument();
    expect(screen.queryByText('完整项目')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '补项目地址' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'plus 新建楼栋' })).not.toBeInTheDocument();
  });

  it('does not render estate governance queue shortcuts', async () => {
    mockListEstates.mockResolvedValue({
      items: [{ id: 1, name: 'pending-estate', display_name: '待补首栋项目', city: '深圳', district: '南山', address: '科技路 1 号', is_active: true, property_type: 'residential', province: '广东' }],
      total: 1,
      page: 1,
      page_size: 100,
    });
    mockListBuildings.mockResolvedValue({ items: [], total: 0, page: 1, page_size: 100 });

    renderPage(<EstatesPage />);

    expect(await screen.findByText('待补首栋项目')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /待补首栋楼/ })).not.toBeInTheDocument();
    expect(window.location.search).toBe('');
  });

  it('does not render closure signal shortcuts on the estate board', async () => {
    renderPage(<EstatesPage />);

    expect(await screen.findByText('项目供给概览')).toBeInTheDocument();
    expect(screen.queryByText('关键提醒')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '进入项目地址队列' })).not.toBeInTheDocument();
  });

  it('opens building creation drawer directly from the no-building queue context and clears edit state on close', async () => {
    window.history.pushState({}, '', '/property-rental/estates?task=no_building&building_create=1');
    mockListEstates.mockResolvedValue({
      items: [{ id: 1, name: 'default-estate', display_name: '默认项目', city: '默认', district: '默认', address: '默认', is_active: true, property_type: 'residential', province: '默认' }],
      total: 1,
      page: 1,
      page_size: 100,
    });
    mockListBuildings.mockResolvedValue({ items: [], total: 0, page: 1, page_size: 100 });

    renderPage(<EstatesPage />);

    expect(await screen.findByText('当前操作：为项目补首栋楼')).toBeInTheDocument();
    expect(screen.getByText('当前入口来自待补首栋楼队列，先为项目补齐第一栋可用楼栋，再继续登记房源。')).toBeInTheDocument();
    expect(await screen.findByText('新建楼栋')).toBeInTheDocument();
    await waitFor(() => {
      const params = new URLSearchParams(window.location.search);
      expect(params.get('task')).toBe('no_building');
      expect(params.get('building_create')).toBe('1');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));

    await waitFor(() => expect(window.location.search).toBe('?task=no_building'));
  });

  it('shows contact rows', async () => {
    renderPage(<ContactsPage />);

    expect((await screen.findAllByText('张房东 / 13800000000')).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'plus 新建房东' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'plus 新建租客' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'plus 新建联系人' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '编辑' })).toBeInTheDocument();
  });

  it('keeps the contact list compact with grouped subject information', async () => {
    mockListContacts.mockResolvedValue({
      items: [{ id: 3, name: '张房东', phone: '13800000000', email: 'landlord@example.com', roles: ['landlord'], notes: '优先房源主体', is_active: true }],
      total: 1,
      page: 1,
      page_size: 100,
    });

    renderPage(<ContactsPage />);

    expect(await screen.findByRole('columnheader', { name: '主体信息' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: '角色' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: '业务阶段' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: '状态' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: '操作' })).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: '邮箱' })).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: '备注' })).not.toBeInTheDocument();
  });

  it('shows contact operational overview and business hints', async () => {
    mockListContacts.mockImplementation((params?: Record<string, unknown>) => {
      if (params?.keyword && !params?.role && !params?.task) {
        return Promise.resolve({
          items: [
            { id: 3, name: '张房东', phone: '13800000000', email: 'landlord@example.com', roles: ['landlord'], is_active: true },
            { id: 6, name: '王租客', phone: '13700000000', email: 'tenant@example.com', roles: ['tenant'], is_active: true },
            { id: 8, name: '陈客户', phone: '13600000000', email: '', roles: ['landlord', 'tenant'], is_active: false },
            { id: 9, name: '待分类联系人', phone: '13500000000', email: '', roles: [], is_active: true, notes: '待确认角色' },
          ],
          total: 4,
          page: 1,
          page_size: 100,
        });
      }
      if (params?.page_size === 100) {
        return Promise.resolve({
          items: [
            { id: 3, name: '张房东', phone: '13800000000', email: 'landlord@example.com', roles: ['landlord'], is_active: true },
            { id: 6, name: '王租客', phone: '13700000000', email: 'tenant@example.com', roles: ['tenant'], is_active: true },
            { id: 8, name: '陈客户', phone: '13600000000', email: '', roles: ['landlord', 'tenant'], is_active: false },
            { id: 9, name: '待分类联系人', phone: '13500000000', email: '', roles: [], is_active: true, notes: '待确认角色' },
          ],
          total: 4,
          page: 1,
          page_size: 100,
        });
      }
      return Promise.resolve({
        items: [
          { id: 3, name: '张房东', phone: '13800000000', email: 'landlord@example.com', roles: ['landlord'], is_active: true },
          { id: 6, name: '王租客', phone: '13700000000', email: 'tenant@example.com', roles: ['tenant'], is_active: true },
          { id: 8, name: '陈客户', phone: '13600000000', email: '', roles: ['landlord', 'tenant'], is_active: false },
          { id: 9, name: '待分类联系人', phone: '13500000000', email: '', roles: [], is_active: true, notes: '待确认角色' },
        ],
        total: 4,
        page: 1,
        page_size: 20,
      });
    });

    renderPage(<ContactsPage />);

    expect(await screen.findByText('联系人概览')).toBeInTheDocument();
    expect(screen.queryByText('当前建议')).not.toBeInTheDocument();
    expect(screen.getByText('联系人业务台账')).toBeInTheDocument();
    expect(screen.queryByText('联系人治理队列')).not.toBeInTheDocument();
    expect(await screen.findByText('房东档案')).toBeInTheDocument();
    expect(await screen.findByText('租客档案')).toBeInTheDocument();
    expect(await screen.findByText('双角色')).toBeInTheDocument();
    expect(await screen.findByText('停用联系人')).toBeInTheDocument();
    expect(screen.getByText('已停用，不参与新业务流程')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '进入角色补齐队列' })).not.toBeInTheDocument();
  });

  it('does not render contact queue buttons', async () => {
    mockListContacts.mockImplementation((params?: Record<string, unknown>) => {
      if (params?.page_size === 100) {
        return Promise.resolve({
          items: [{ id: 9, name: '待分类联系人', phone: '13500000000', email: '', roles: [], is_active: true, notes: '待确认角色' }],
          total: 1,
          page: 1,
          page_size: 100,
        });
      }
      return Promise.resolve({
        items: [{ id: 9, name: '待分类联系人', phone: '13500000000', email: '', roles: [], is_active: true, notes: '待确认角色' }],
        total: 1,
        page: 1,
        page_size: 20,
      });
    });

    renderPage(<ContactsPage />);

    expect(screen.queryByText('联系人治理队列')).not.toBeInTheDocument();
    expect(await screen.findByText(/待分类联系人/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '全部 1' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '缺角色主体 1' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '停用联系人 0' })).not.toBeInTheDocument();
    expect(screen.queryByText('已收起 4 个 0 项，避免把空队列和关键治理项放在同一层级。')).not.toBeInTheDocument();
  });

  it('shows an actionable empty state for contacts', async () => {
    mockListContacts.mockResolvedValue({ items: [], total: 0, page: 1, page_size: 100 });

    renderPage(<ContactsPage />);

    expect(await screen.findByText('暂无联系人')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '新建房东' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '新建租客' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '新建联系人' })).toBeInTheDocument();
  });

  it('creates contacts from the list page', async () => {
    renderPage(<ContactsPage />);

    fireEvent.click(await screen.findByRole('button', { name: 'plus 新建联系人' }));
    fireEvent.change(screen.getByLabelText('姓名'), { target: { value: '王租客' } });
    fireEvent.change(screen.getByLabelText('手机'), { target: { value: '13700000000' } });
    fireEvent.mouseDown(screen.getByLabelText('角色'));
    const tenantOption = (await screen.findAllByText('租客')).at(-1);
    expect(tenantOption).toBeDefined();
    fireEvent.click(tenantOption as HTMLElement);
    fireEvent.click(screen.getByRole('button', { name: /保\s*存/ }));

    await waitFor(() => expect(mockCreateContact).toHaveBeenCalledWith(expect.objectContaining({
      name: '王租客',
      phone: '13700000000',
      roles: ['tenant'],
    })));
  });

  it('prefills landlord role when creating from the landlord shortcut', async () => {
    renderPage(<ContactsPage />);

    fireEvent.click(await screen.findByRole('button', { name: 'plus 新建房东' }));
    fireEvent.change(screen.getByLabelText('姓名'), { target: { value: '李房东' } });
    fireEvent.change(screen.getByLabelText('手机'), { target: { value: '13811111111' } });
    fireEvent.click(screen.getByRole('button', { name: /保\s*存/ }));

    await waitFor(() => expect(mockCreateContact).toHaveBeenCalledWith(expect.objectContaining({
      name: '李房东',
      phone: '13811111111',
      roles: ['landlord'],
    })));
  });

  it('updates contact active state from the edit drawer', async () => {
    mockListContacts.mockResolvedValue({ items: [{ id: 3, name: '张房东', phone: '13800000000', roles: ['landlord'], is_active: false }], total: 1, page: 1, page_size: 100 });

    renderPage(<ContactsPage />);

    expect(await screen.findByText('停用')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '编辑' }));
    fireEvent.click(screen.getByRole('switch', { name: '启用' }));
    fireEvent.click(screen.getByRole('button', { name: /保\s*存/ }));

    await waitFor(() => expect(mockPatchContact).toHaveBeenCalledWith(3, expect.objectContaining({ is_active: true })));
  });

  it('toggles contact active state directly from the row action', async () => {
    mockListContacts.mockResolvedValue({ items: [{ id: 3, name: '张房东', phone: '13800000000', roles: ['landlord'], is_active: true }], total: 1, page: 1, page_size: 100 });

    renderPage(<ContactsPage />);

    expect(await screen.findByText('启用')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '停用' }));

    await waitFor(() => expect(mockPatchContact).toHaveBeenCalledWith(3, { is_active: false }));
  });

  it('does not offer new business actions for inactive contacts', async () => {
    mockListContacts.mockResolvedValue({
      items: [{ id: 3, name: '停用房东', phone: '13800000000', email: 'off@example.com', roles: ['landlord', 'tenant'], is_active: false }],
      total: 1,
      page: 1,
      page_size: 100,
    });

    renderPage(<ContactsPage />);

    expect(await screen.findByText(/停用房东/)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '登记房源' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '登记带看' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '启用' })).toBeInTheDocument();
  });

  it('scopes contact overview when filtering by role', async () => {
    mockListContacts.mockImplementation((params?: Record<string, unknown>) => {
      if (params?.role === 'tenant') {
        return Promise.resolve({
          items: [{ id: 6, name: '王租客', phone: '13700000000', email: 'tenant@example.com', roles: ['tenant'], is_active: true }],
          total: 1,
          page: 1,
          page_size: 100,
        });
      }
      return Promise.resolve({
        items: [
          { id: 3, name: '张房东', phone: '13800000000', email: 'landlord@example.com', roles: ['landlord'], is_active: true },
          { id: 6, name: '王租客', phone: '13700000000', email: 'tenant@example.com', roles: ['tenant'], is_active: true },
          { id: 8, name: '陈客户', phone: '13600000000', email: '', roles: ['landlord', 'tenant'], is_active: false },
        ],
        total: 3,
        page: 1,
        page_size: 100,
      });
    });

    renderPage(<ContactsPage />);

    fireEvent.mouseDown(screen.getAllByRole('combobox')[0]);
    fireEvent.click((await screen.findAllByText('租客')).at(-1) as HTMLElement);

    expect(screen.getByText('当前只看：角色：租客')).toBeInTheDocument();
    expect(screen.queryByText('当前建议')).not.toBeInTheDocument();
    await waitFor(() => expect(mockListContacts).toHaveBeenCalledWith(expect.objectContaining({ role: 'tenant' })));
  });

  it('scopes contacts when filtering dual-role contacts', async () => {
    mockListContacts.mockImplementation((params?: Record<string, unknown>) => {
      if (params?.task === 'dual_role') {
        return Promise.resolve({
          items: [{ id: 8, name: '陈客户', phone: '13600000000', email: '', roles: ['landlord', 'tenant'], is_active: false, notes: '需要确认身份' }],
          total: 1,
          page: 1,
          page_size: Number(params?.page_size || 20),
        });
      }
      return Promise.resolve({
        items: [
          { id: 3, name: '张房东', phone: '13800000000', email: 'landlord@example.com', roles: ['landlord'], is_active: true },
          { id: 6, name: '王租客', phone: '13700000000', email: 'tenant@example.com', roles: ['tenant'], is_active: true },
          { id: 8, name: '陈客户', phone: '13600000000', email: '', roles: ['landlord', 'tenant'], is_active: false, notes: '需要确认身份' },
        ],
        total: 3,
        page: 1,
        page_size: Number(params?.page_size || 20),
      });
    });

    renderPage(<ContactsPage />);

    fireEvent.mouseDown(screen.getAllByRole('combobox')[1]);
    fireEvent.click((await screen.findAllByText('双角色待确认')).at(-1) as HTMLElement);

    expect(await screen.findByText('当前只看：队列：双角色待确认')).toBeInTheDocument();
    expect(await screen.findByText(/陈客户/)).toBeInTheDocument();
    await waitFor(() => expect(mockListContacts).toHaveBeenCalledWith(expect.objectContaining({ task: 'dual_role' })));
  });

  it('does not render closure signal shortcuts on the contact board', async () => {
    renderPage(<ContactsPage />);

    expect(await screen.findByText('联系人概览')).toBeInTheDocument();
    expect(screen.queryByText('关键提醒')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '进入房东供给台账' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '进入双角色治理队列' })).not.toBeInTheDocument();
  });

  it('restores contact filters from URL search params', async () => {
    window.history.pushState({}, '', '/property-rental/contacts?role=tenant&keyword=%E7%8E%8B%E7%A7%9F%E5%AE%A2&page=2');
    mockListContacts.mockImplementation((params?: Record<string, unknown>) => {
      if (params?.role === 'tenant' && params?.keyword === '王租客' && params?.page === 1 && params?.page_size === 100) {
        return Promise.resolve({
          items: [{ id: 6, name: '王租客', phone: '13700000000', email: 'tenant@example.com', roles: ['tenant'], is_active: true }],
          total: 21,
          page: 1,
          page_size: 100,
        });
      }
      if (params?.role === 'tenant' && params?.keyword === '王租客' && params?.page === 2 && params?.page_size === 20) {
        return Promise.resolve({
          items: [{ id: 6, name: '王租客', phone: '13700000000', email: 'tenant@example.com', roles: ['tenant'], is_active: true }],
          total: 21,
          page: 2,
          page_size: 20,
        });
      }
      return Promise.resolve({
        items: [],
        total: 0,
        page: Number(params?.page || 1),
        page_size: Number(params?.page_size || 20),
      });
    });

    renderPage(<ContactsPage />);

    expect(screen.getByText('当前只看：角色：租客 / 搜索：王租客')).toBeInTheDocument();
    expect(screen.queryByText('当前建议')).not.toBeInTheDocument();
    await waitFor(() => expect(mockListContacts).toHaveBeenCalledWith(expect.objectContaining({ role: 'tenant', keyword: '王租客', page: 2 })));
  });

  it('restores contact task filters from URL search params', async () => {
    window.history.pushState({}, '', '/property-rental/contacts?task=inactive&keyword=%E5%81%9C%E7%94%A8&page=2');
    mockListContacts.mockImplementation((params?: Record<string, unknown>) => {
      if (params?.keyword === '停用' && !params?.task && params?.page_size === 100) {
        return Promise.resolve({
          items: [{ id: 8, name: '停用联系人', phone: '13600000000', email: '', roles: ['landlord'], is_active: false }],
          total: 1,
          page: 1,
          page_size: 100,
        });
      }
      if (params?.task === 'inactive' && params?.keyword === '停用' && params?.page === 1 && params?.page_size === 100) {
        return Promise.resolve({
          items: [{ id: 8, name: '停用联系人', phone: '13600000000', email: '', roles: ['landlord'], is_active: false }],
          total: 21,
          page: 1,
          page_size: 100,
        });
      }
      if (params?.task === 'inactive' && params?.keyword === '停用' && params?.page === 2 && params?.page_size === 20) {
        return Promise.resolve({
          items: [{ id: 8, name: '停用联系人', phone: '13600000000', email: '', roles: ['landlord'], is_active: false }],
          total: 21,
          page: 2,
          page_size: 20,
        });
      }
      return Promise.resolve({
        items: [],
        total: 0,
        page: Number(params?.page || 1),
        page_size: Number(params?.page_size || 20),
      });
    });

    renderPage(<ContactsPage />);

    expect(screen.getByText('当前只看：队列：停用联系人 / 搜索：停用')).toBeInTheDocument();
    expect(screen.queryByText('当前建议')).not.toBeInTheDocument();
    await waitFor(() => expect(mockListContacts).toHaveBeenCalledWith(expect.objectContaining({ task: 'inactive', keyword: '停用', page: 2 })));
  });

  it('shows viewing rows', async () => {
    renderPage(<ViewingsPage />);

    expect(await screen.findByText(/李客户/)).toBeInTheDocument();
    expect(await screen.findByText(/A-101/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '编辑' })).toBeInTheDocument();
  });

  it('does not render quick queue links for viewing workflows', async () => {
    mockListViewings.mockImplementation((params?: Record<string, unknown>) => {
      if (params?.status === 'scheduled') {
        return Promise.resolve({ items: [{ id: 4, house_id: 99, house_label: 'A-101', customer_name: '李客户', customer_phone: '13900000000', scheduled_at: '2026-07-01T10:00:00+08:00', status: 'scheduled' }], total: 1, page: 1, page_size: 1 });
      }
      if (params?.status === 'viewed' || params?.status === 'converted' || params?.status === 'canceled' || params?.status === 'no_show' || params?.pending_lease) {
        return Promise.resolve({ items: [], total: 0, page: 1, page_size: 1 });
      }
      return Promise.resolve({
        items: [{ id: 4, house_id: 99, house_label: 'A-101', customer_name: '李客户', customer_phone: '13900000000', scheduled_at: '2026-07-01T10:00:00+08:00', status: 'scheduled' }],
        total: 1,
        page: 1,
        page_size: 20,
      });
    });

    renderPage(<ViewingsPage />);

    expect(await screen.findByText(/李客户/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /全\s*部 1/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /已预约 1/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /待回访 0/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /已成交 0/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /待签约 0/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /待补租客 0/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /可签约 0/ })).not.toBeInTheDocument();
    expect(screen.queryByText('已收起 5 个 0 项，避免把空队列和高优先级跟进入口放在同一层级。')).not.toBeInTheDocument();
  });

  it('shows viewing operational overview and queue hints', async () => {
    mockListViewings.mockImplementation((params?: Record<string, unknown>) => {
      if (params?.pending_lease) {
        return Promise.resolve({ items: [{ id: 6, house_id: 99, house_label: 'A-101', customer_name: '成交客户', customer_phone: '13600000000', scheduled_at: '2026-07-02T10:00:00+08:00', status: 'converted', signed_lease_id: null }], total: 1, page: 1, page_size: 1 });
      }
      if (params?.status === 'scheduled') {
        return Promise.resolve({ items: [], total: 1, page: 1, page_size: 1 });
      }
      if (params?.status === 'viewed') {
        return Promise.resolve({ items: [], total: 1, page: 1, page_size: 1 });
      }
      if (params?.status === 'canceled') {
        return Promise.resolve({ items: [], total: 0, page: 1, page_size: 1 });
      }
      if (params?.status === 'no_show') {
        return Promise.resolve({ items: [], total: 1, page: 1, page_size: 1 });
      }
      return Promise.resolve({
        items: [
          { id: 4, house_id: 99, house_label: 'A-101', customer_name: '预约客户', customer_phone: '13900000000', scheduled_at: '2026-07-01T10:00:00+08:00', status: 'scheduled' },
          { id: 5, house_id: 99, house_label: 'A-101', customer_name: '回访客户', customer_phone: '13800000000', scheduled_at: '2026-07-01T12:00:00+08:00', status: 'viewed' },
          { id: 6, house_id: 99, house_label: 'A-101', customer_name: '成交客户', customer_phone: '13600000000', scheduled_at: '2026-07-02T10:00:00+08:00', status: 'converted', signed_lease_id: null },
          { id: 7, house_id: 99, house_label: 'A-101', customer_name: '爽约客户', customer_phone: '13500000000', scheduled_at: '2026-07-02T12:00:00+08:00', status: 'no_show' },
        ],
        total: 4,
        page: 1,
        page_size: 20,
      });
    });

    renderPage(<ViewingsPage />);

    expect(await screen.findByText('带看概览')).toBeInTheDocument();
    expect(screen.queryByText('当前建议')).not.toBeInTheDocument();
    expect(screen.queryByText('带看跟进队列')).not.toBeInTheDocument();
    expect(screen.queryByText('队列摘要')).not.toBeInTheDocument();
    expect(screen.getByText('已预约', { selector: '.ant-statistic-title' })).toBeInTheDocument();
    expect(screen.getByText('待回访', { selector: '.ant-statistic-title' })).toBeInTheDocument();
    expect(screen.getByText('待签约', { selector: '.ant-statistic-title' })).toBeInTheDocument();
    expect(screen.getByText('异常记录', { selector: '.ant-statistic-title' })).toBeInTheDocument();
    expect(screen.getAllByText('已预约').length).toBeGreaterThan(0);
    expect(screen.getAllByText('待回访').length).toBeGreaterThan(0);
    expect(screen.getAllByText('待签约').length).toBeGreaterThan(0);
    expect(screen.getByText('异常记录')).toBeInTheDocument();
    const summaryAlert = screen.getAllByRole('alert').find((element) => element.textContent?.includes('低优先级队列已收起'));
    expect(summaryAlert).toBeUndefined();
    expect(await screen.findByText(/预约客户/)).toBeInTheDocument();
    expect(await screen.findByText(/成交客户/)).toBeInTheDocument();
  });

  it('updates viewing status directly from the row action', async () => {
    mockListViewings.mockResolvedValue({
      items: [{ id: 4, house_id: 99, house_label: 'A-101', customer_name: '李客户', customer_phone: '13900000000', scheduled_at: '2026-07-01T10:00:00+08:00', status: 'scheduled' }],
      total: 1,
      page: 1,
      page_size: 100,
    });

    renderPage(<ViewingsPage />);

    const row = (await screen.findByText('李客户 / 13900000000')).closest('tr');
    expect(row).not.toBeNull();
    fireEvent.click(within(row as HTMLElement).getByRole('button', { name: '完成带看' }));

    await waitFor(() => expect(mockPatchViewingRecord).toHaveBeenCalledWith(4, { status: 'viewed' }));
  });

  it('keeps the viewing list compact with a grouped business-info column', async () => {
    mockListViewings.mockResolvedValue({
      items: [{ id: 4, house_id: 99, house_label: 'A-101', contact_id: 6, contact_name: '王租客', customer_name: '李客户', customer_phone: '13900000000', scheduled_at: '2026-07-01T10:00:00+08:00', status: 'converted', signed_lease_id: null }],
      total: 1,
      page: 1,
      page_size: 100,
    });

    renderPage(<ViewingsPage />);

    expect(await screen.findByRole('columnheader', { name: '客户信息' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: '状态' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: '下一步动作' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: '操作' })).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: '手机' })).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: '关联联系人' })).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: '预约时间' })).not.toBeInTheDocument();
  });

  it('shows an actionable empty state for viewings', async () => {
    mockListViewings.mockResolvedValue({ items: [], total: 0, page: 1, page_size: 100 });

    renderPage(<ViewingsPage />);

    expect(await screen.findByText('暂无带看记录')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '新建带看' })).toBeInTheDocument();
  });

  it('filters house publish issues through API params', async () => {
    window.history.pushState({}, '', '/property-rental/houses?task=landlord');

    renderPage(<HousesPage />);

    expect(await screen.findByText('当前只看：待补房东')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '查看全部' })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: '补房东' })).toHaveAttribute('href', '/dashboard/property-rental/houses/99?action=edit&task=landlord');
    await waitFor(() => expect(mockListHouses).toHaveBeenCalledWith(expect.objectContaining({ publish_issue: 'landlord' })));
  });

  it('shows house operational overview and publishing guidance', async () => {
    mockListHouses.mockImplementation((params?: Record<string, unknown>) => {
      if (params?.publish_blocked) {
        return Promise.resolve({ items: [], total: 2, page: 1, page_size: 1 });
      }
      if (params?.publish_ready) {
        return Promise.resolve({ items: [], total: 3, page: 1, page_size: 1 });
      }
      if (params?.publish_status === 'published') {
        return Promise.resolve({ items: [], total: 4, page: 1, page_size: 1 });
      }
      return Promise.resolve({
        items: [{
          id: 99,
          building_id: 2,
          room_number: 'A-101',
          estate_name: '星河湾花园',
          building_name: '1 栋',
          landlord_id: 3,
          landlord_name: '张房东',
          landlord_phone: '13800000000',
          asking_rent: '4200.00',
          available_from: '2026-07-01',
          status: 'vacant',
          publish_status: 'draft',
          images: [
            { media_id: 1, media_type: 'image', image_role: 'cover', url: '/cover.jpg' },
            { media_id: 2, media_type: 'image', image_role: 'floor_plan', url: '/plan.jpg' },
            { media_id: 3, media_type: 'image', image_role: 'bedroom', url: '/bedroom.jpg' },
          ],
          videos: [{ media_id: 4, media_type: 'video' }],
        }],
        total: 9,
        page: 1,
        page_size: 20,
      });
    });

    renderPage(<HousesPage />);

    expect(await screen.findByText('房源概览')).toBeInTheDocument();
    expect(screen.queryByText('当前建议')).not.toBeInTheDocument();
    expect(screen.getByText('在管房源')).toBeInTheDocument();
    expect(screen.getByText('阻断发布')).toBeInTheDocument();
    expect(screen.getAllByText('可发布').length).toBeGreaterThan(0);
    expect(screen.getAllByText('已发布').length).toBeGreaterThan(0);
    await waitFor(() => expect(mockListHouses).toHaveBeenCalledWith(expect.objectContaining({ publish_blocked: true })));
    await waitFor(() => expect(mockListHouses).toHaveBeenCalledWith(expect.objectContaining({ publish_ready: true })));
    await waitFor(() => expect(mockListHouses).toHaveBeenCalledWith(expect.objectContaining({ publish_status: 'published' })));
  });

  it('does not render closure signal shortcuts on the house board', async () => {
    renderPage(<HousesPage />);

    expect(await screen.findByText('房源概览')).toBeInTheDocument();
    expect(screen.queryByText('关键提醒')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '进入待补资料队列' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '进入可发布队列' })).not.toBeInTheDocument();
  });

  it('does not render quick queue links for house workflows', async () => {
    mockListHouses.mockResolvedValue({
      items: [
        { id: 1, building_id: 2, room_number: 'A-101', landlord_id: null, asking_rent: null, status: 'vacant', publish_status: 'draft', images: [], videos: [] },
        { id: 2, building_id: 2, room_number: 'A-102', landlord_id: 3, landlord_name: '张房东', landlord_phone: '13800000000', asking_rent: '4200.00', status: 'vacant', publish_status: 'draft', images: [{ media_id: 1, media_type: 'image', image_role: 'cover' }], videos: [] },
        { id: 3, building_id: 2, room_number: 'A-103', landlord_id: 3, landlord_name: '张房东', landlord_phone: '13800000000', asking_rent: '4200.00', status: 'vacant', publish_status: 'draft', images: [{ media_id: 1, media_type: 'image', image_role: 'cover' }, { media_id: 2, media_type: 'image', image_role: 'bedroom' }], videos: [] },
      ],
      total: 3,
      page: 1,
      page_size: 20,
    });

    renderPage(<HousesPage />);

    expect(await screen.findByText('房源经营台账')).toBeInTheDocument();
    expect(screen.queryByText('经营队列')).not.toBeInTheDocument();
    expect(screen.queryByText('发布缺口')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '待补资料' })).not.toBeInTheDocument();
    expect(screen.queryByText('缺户型图 0')).not.toBeInTheDocument();
    expect(screen.queryByText('待补视频 0')).not.toBeInTheDocument();
  });

  it('does not request issue queue counts for house workflows', async () => {
    mockListHouses.mockImplementation((params?: Record<string, unknown>) => {
      if (params?.publish_issue === 'landlord') return Promise.resolve({ items: [], total: 12, page: 1, page_size: 1 });
      if (params?.publish_issue === 'rent') return Promise.resolve({ items: [], total: 7, page: 1, page_size: 1 });
      if (params?.publish_issue === 'cover') return Promise.resolve({ items: [], total: 0, page: 1, page_size: 1 });
      if (params?.publish_issue === 'images') return Promise.resolve({ items: [], total: 4, page: 1, page_size: 1 });
      if (params?.publish_issue === 'floor_plan') return Promise.resolve({ items: [], total: 3, page: 1, page_size: 1 });
      if (params?.publish_issue === 'video') return Promise.resolve({ items: [], total: 0, page: 1, page_size: 1 });
      return Promise.resolve({
        items: [{
          id: 99,
          building_id: 2,
          room_number: 'A-101',
          estate_name: '星河湾花园',
          building_name: '1 栋',
          landlord_id: 3,
          landlord_name: '张房东',
          landlord_phone: '13800000000',
          asking_rent: '4200.00',
          available_from: '2026-07-01',
          status: 'vacant',
          publish_status: 'draft',
          images: [
            { media_id: 1, media_type: 'image', image_role: 'cover', url: '/cover.jpg' },
            { media_id: 2, media_type: 'image', image_role: 'floor_plan', url: '/plan.jpg' },
            { media_id: 3, media_type: 'image', image_role: 'bedroom', url: '/bedroom.jpg' },
          ],
          videos: [{ media_id: 4, media_type: 'video' }],
        }],
        total: 9,
        page: 1,
        page_size: 20,
      });
    });

    renderPage(<HousesPage />);

    expect(await screen.findByText('房源经营台账')).toBeInTheDocument();
    expect(screen.queryByText('发布缺口')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '待补房东 12' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '待补租金 7' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '待补封面 0' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '图片少于 3 张 4' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '缺户型图 3' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '待补视频 0' })).not.toBeInTheDocument();
    expect(screen.queryByText('已收起 2 个 0 项，缺口只突出当前需要处理的房源。')).not.toBeInTheDocument();
    expect(mockListHouses).not.toHaveBeenCalledWith(expect.objectContaining({ publish_issue: 'video', page_size: 1 }));
  });

  it('renders house row actions as semantic controls', async () => {
    mockListHouses.mockResolvedValue({
      items: [{
        id: 99,
        building_id: 2,
        room_number: 'A-101',
        estate_name: '星河湾花园',
        building_name: '1 栋',
        landlord_id: 3,
        landlord_name: '张房东',
        landlord_phone: '13800000000',
        asking_rent: '4200.00',
        available_from: '2026-07-01',
        status: 'vacant',
        publish_status: 'draft',
        images: [
          { media_id: 1, media_type: 'image', image_role: 'cover', url: '/cover.jpg' },
          { media_id: 2, media_type: 'image', image_role: 'floor_plan', url: '/plan.jpg' },
          { media_id: 3, media_type: 'image', image_role: 'bedroom', url: '/bedroom.jpg' },
        ],
        videos: [{ media_id: 4, media_type: 'video' }],
      }],
      total: 1,
      page: 1,
      page_size: 100,
    });

    renderPage(<HousesPage />);

    expect(await screen.findByText(/4200/)).toBeInTheDocument();
    expect(screen.getByText('张房东 / 13800000000')).toBeInTheDocument();
    expect(screen.getByText('2026-07-01')).toBeInTheDocument();
    expect(screen.getByText(/3 图 \/ 1 视频.*资料完整，可直接发布/)).toBeInTheDocument();
    expect(screen.getByText('资料完整')).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: '检查后发布' })).toHaveAttribute('href', '/dashboard/property-rental/houses/99');
    expect(screen.getByRole('button', { name: '发布' })).toBeInTheDocument();
  });

  it('requires confirmation before publishing a house from the list', async () => {
    mockPatchHouse.mockResolvedValue({
      id: 99,
      building_id: 2,
      room_number: 'A-101',
      estate_name: '星河湾花园',
      building_name: '1 栋',
      landlord_id: 3,
      landlord_name: '张房东',
      landlord_phone: '13800000000',
      asking_rent: '4200.00',
      available_from: '2026-07-01',
      status: 'vacant',
      publish_status: 'published',
      images: [
        { media_id: 1, media_type: 'image', image_role: 'cover', url: '/cover.jpg' },
        { media_id: 2, media_type: 'image', image_role: 'floor_plan', url: '/plan.jpg' },
        { media_id: 3, media_type: 'image', image_role: 'bedroom', url: '/bedroom.jpg' },
      ],
      videos: [{ media_id: 4, media_type: 'video' }],
    });
    mockListHouses.mockResolvedValue({
      items: [{
        id: 99,
        building_id: 2,
        room_number: 'A-101',
        estate_name: '星河湾花园',
        building_name: '1 栋',
        landlord_id: 3,
        landlord_name: '张房东',
        landlord_phone: '13800000000',
        asking_rent: '4200.00',
        available_from: '2026-07-01',
        status: 'vacant',
        publish_status: 'draft',
        images: [
          { media_id: 1, media_type: 'image', image_role: 'cover', url: '/cover.jpg' },
          { media_id: 2, media_type: 'image', image_role: 'floor_plan', url: '/plan.jpg' },
          { media_id: 3, media_type: 'image', image_role: 'bedroom', url: '/bedroom.jpg' },
        ],
        videos: [{ media_id: 4, media_type: 'video' }],
      }],
      total: 1,
      page: 1,
      page_size: 100,
    });

    renderPage(<HousesPage />);

    const publishRow = (await screen.findByText(/张房东/)).closest('tr');
    expect(publishRow).not.toBeNull();
    fireEvent.click(within(publishRow as HTMLElement).getByRole('button', { name: '发布' }));

    expect(await screen.findByText('确认后会把这套房源切换为已发布状态，继续承接带看。')).toBeInTheDocument();
    expect(mockPatchHouse).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: '确认发布' }));

    await waitFor(() => expect(mockPatchHouse).toHaveBeenCalledWith(99, expect.objectContaining({ publish_status: 'published' })));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('routes house issue rows to the most direct fix action', async () => {
    mockListHouses.mockResolvedValue({
      items: [{
        id: 99,
        building_id: 2,
        room_number: 'A-101',
        landlord_id: 3,
        landlord_name: '张房东',
        landlord_phone: '13800000000',
        asking_rent: '4200.00',
        status: 'vacant',
        publish_status: 'draft',
        images: [{ media_id: 3, media_type: 'image', image_role: 'bedroom', url: '/bedroom.jpg' }],
        videos: [],
      }],
      total: 1,
      page: 1,
      page_size: 100,
    });

    renderPage(<HousesPage />);

    expect(await screen.findByRole('link', { name: '维护相册' })).toHaveAttribute('href', '/dashboard/property-rental/houses/99?action=media&task=cover');
  });

  it('labels blocked house publish actions as pending completion', async () => {
    mockListHouses.mockResolvedValue({
      items: [{
        id: 99,
        building_id: 2,
        room_number: 'A-101',
        landlord_id: null,
        landlord_name: null,
        landlord_phone: null,
        asking_rent: null,
        status: 'vacant',
        publish_status: 'draft',
        images: [],
        videos: [],
      }],
      total: 1,
      page: 1,
      page_size: 100,
    });

    renderPage(<HousesPage />);

    expect((await screen.findByText('待补齐')).closest('button')).toBeDisabled();
  });

  it('keeps missing cover as a publish issue without a cover column', async () => {
    mockListHouses.mockResolvedValue({
      items: [{
        id: 99,
        building_id: 2,
        room_number: 'A-101',
        landlord_id: 3,
        landlord_name: '张房东',
        landlord_phone: '13800000000',
        asking_rent: '4200.00',
        status: 'vacant',
        publish_status: 'draft',
        images: [{ media_id: 3, media_type: 'image', image_role: 'bedroom', url: '/bedroom.jpg' }],
        videos: [],
      }],
      total: 1,
      page: 1,
      page_size: 100,
    });

    renderPage(<HousesPage />);

    expect(await screen.findByText('缺封面')).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: '封面' })).not.toBeInTheDocument();
  });

  it('keeps the house list focused on operational readiness columns', async () => {
    mockListHouses.mockResolvedValue({
      items: [{
        id: 99,
        building_id: 2,
        room_number: 'A-101',
        landlord_id: null,
        asking_rent: '4200.00',
        status: 'vacant',
        publish_status: 'draft',
        images: [],
        videos: [],
      }],
      total: 1,
      page: 1,
      page_size: 100,
    });

    renderPage(<HousesPage />);

    expect(await screen.findByRole('columnheader', { name: '房源' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: '房东' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: '挂牌租金' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: '可租日期' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: '发布准备' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: '当前动作' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: '状态' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: '资料问题' })).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: '面积' })).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: '发布' })).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: '媒体' })).not.toBeInTheDocument();
  });

  it('filters houses by estate and building params', async () => {
    mockListEstates.mockResolvedValue({ items: [{ id: 1, name: 'xinghewan', display_name: '星河湾花园', city: '深圳', district: '南山', address: '科技路' }], total: 1, page: 1, page_size: 100 });
    mockListBuildings.mockResolvedValue({ items: [{ id: 2, estate_id: 1, estate_name: '星河湾花园', name: '1 栋', floors: 32, elevator: true }], total: 1, page: 1, page_size: 100 });

    renderPage(<HousesPage />);

    fireEvent.mouseDown(await screen.findByText('项目'));
    const estateOption = (await screen.findAllByText('星河湾花园')).at(-1);
    expect(estateOption).toBeDefined();
    fireEvent.click(estateOption as HTMLElement);

    expect(screen.getByText('当前只看：项目：星河湾花园')).toBeInTheDocument();
    await waitFor(() => expect(mockListBuildings).toHaveBeenCalledWith(expect.objectContaining({ estate_id: 1 })));
    await waitFor(() => expect(mockListHouses).toHaveBeenCalledWith(expect.objectContaining({ estate_id: 1 })));

    fireEvent.mouseDown(await screen.findByText('楼栋'));
    const buildingOption = (await screen.findAllByText('星河湾花园 / 1 栋')).at(-1);
    expect(buildingOption).toBeDefined();
    fireEvent.click(buildingOption as HTMLElement);

    expect(await screen.findByText('当前只看：项目：星河湾花园 / 楼栋：星河湾花园 / 1 栋')).toBeInTheDocument();
    await waitFor(() => expect(mockListHouses).toHaveBeenCalledWith(expect.objectContaining({ estate_id: 1, building_id: 2 })));
  });

  it('restores house filters from URL search params', async () => {
    window.history.pushState({}, '', '/property-rental/houses?task=rent&estate_id=1&building_id=2&status=vacant&publish_status=draft&keyword=A-101&page=2');
    mockListEstates.mockResolvedValue({ items: [{ id: 1, name: 'xinghewan', display_name: '星河湾花园', city: '深圳', district: '南山', address: '科技路' }], total: 1, page: 1, page_size: 100 });
    mockListBuildings.mockResolvedValue({ items: [{ id: 2, estate_id: 1, estate_name: '星河湾花园', name: '1 栋', floors: 32, elevator: true }], total: 1, page: 1, page_size: 100 });

    renderPage(<HousesPage />);

    expect(await screen.findByText(/当前只看：待补租金/)).toBeInTheDocument();
    expect(screen.getByDisplayValue('A-101')).toBeInTheDocument();
    await waitFor(() => expect(mockListHouses).toHaveBeenCalledWith(expect.objectContaining({
      page: 2,
      estate_id: 1,
      building_id: 2,
      status: 'vacant',
      publish_status: 'draft',
      publish_issue: 'rent',
      keyword: 'A-101',
    })));
  });

  it('syncs house search state back to URL', async () => {
    renderPage(<HousesPage />);

    fireEvent.change(screen.getByPlaceholderText('房号搜索'), { target: { value: 'A-101' } });
    fireEvent.click(screen.getByRole('button', { name: 'search' }));

    await waitFor(() => expect(window.location.search).toBe('?keyword=A-101'));
  });

  it('restores house task and search state on browser popstate', async () => {
    renderPage(<HousesPage />);

    window.history.pushState({}, '', '/property-rental/houses?task=ready&keyword=QA-104');
    window.dispatchEvent(new PopStateEvent('popstate'));

    expect(await screen.findByText('当前只看：可发布 / 搜索：QA-104')).toBeInTheDocument();
    expect(screen.getByDisplayValue('QA-104')).toBeInTheDocument();
  });

  it('shows an empty-state suggestion when a house search scope returns no results', async () => {
    mockListHouses.mockImplementation((params?: Record<string, unknown>) => {
      if (params?.keyword === '不存在') {
        return Promise.resolve({ items: [], total: 0, page: 1, page_size: Number(params?.page_size || 20) });
      }
      return Promise.resolve({
        items: [{
          id: 99,
          building_id: 2,
          room_number: 'A-101',
          estate_name: '星河湾花园',
          building_name: '1 栋',
          landlord_id: 3,
          landlord_name: '张房东',
          landlord_phone: '13800000000',
          asking_rent: '4200.00',
          available_from: '2026-07-01',
          status: 'vacant',
          publish_status: 'draft',
          images: [],
          videos: [],
        }],
        total: 1,
        page: 1,
        page_size: Number(params?.page_size || 20),
      });
    });

    renderPage(<HousesPage />);

    fireEvent.change(screen.getByPlaceholderText('房号搜索'), { target: { value: '不存在' } });
    fireEvent.click(screen.getByRole('button', { name: 'search' }));

    expect(screen.getByText('当前只看：搜索：不存在')).toBeInTheDocument();
    expect(await screen.findByText('暂无数据')).toBeInTheDocument();
  });

  it('filters converted viewings from URL and links to lease creation', async () => {
    window.history.pushState({}, '', '/property-rental/viewings?status=converted');
    mockListViewings.mockResolvedValue({
      items: [{ id: 4, house_id: 99, house_label: 'A-101', contact_id: 6, contact_name: '王租客', customer_name: '李客户', customer_phone: '13900000000', scheduled_at: '2026-07-01T10:00:00+08:00', status: 'converted', signed_lease_id: null }],
      total: 1,
      page: 1,
      page_size: 100,
    });

    renderPage(<ViewingsPage />);

    expect(await screen.findByText('当前只看：已成交')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '查看全部' })).toHaveAttribute('href', '/dashboard/property-rental/viewings');
    await waitFor(() => expect(mockListViewings).toHaveBeenCalledWith(expect.objectContaining({ status: 'converted' })));
    expect(screen.getByRole('link', { name: '签约' })).toHaveAttribute('href', '/dashboard/property-rental/leases?source_viewing_record_id=4');
  });

  it('does not render closure signal shortcuts on the viewing board', async () => {
    renderPage(<ViewingsPage />);

    expect(await screen.findByText('带看概览')).toBeInTheDocument();
    expect(screen.queryByText('关键提醒')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '进入预约队列' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '进入补主体队列' })).not.toBeInTheDocument();
  });

  it('requires contact completion before offering lease creation for converted viewings', async () => {
    mockListViewings.mockResolvedValue({
      items: [{ id: 4, house_id: 99, house_label: 'A-101', customer_name: '李客户', customer_phone: '13900000000', scheduled_at: '2026-07-01T10:00:00+08:00', status: 'converted', signed_lease_id: null }],
      total: 1,
      page: 1,
      page_size: 100,
    });

    renderPage(<ViewingsPage />);

    const row = (await screen.findByText('李客户 / 13900000000')).closest('tr') as HTMLElement;
    expect(row).toHaveTextContent(/未绑定租客/);
    expect(within(row).getByRole('button', { name: '补租客' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '签约' })).not.toBeInTheDocument();
  });

  it('opens edit drawer with a warning when fixing converted viewings without linked contacts', async () => {
    mockListViewings.mockResolvedValue({
      items: [{ id: 4, house_id: 99, house_label: 'A-101', customer_name: '李客户', customer_phone: '13900000000', scheduled_at: '2026-07-01T10:00:00+08:00', status: 'converted', signed_lease_id: null }],
      total: 1,
      page: 1,
      page_size: 100,
    });

    renderPage(<ViewingsPage />);

    const row = (await screen.findByText('李客户 / 13900000000')).closest('tr') as HTMLElement;
    fireEvent.click(within(row).getByRole('button', { name: '补租客' }));

    expect(await screen.findByText(/该成交记录尚未绑定租客联系人/)).toBeInTheDocument();
    expect(screen.getByLabelText('关联联系人')).toBeInTheDocument();
  });

  it('hides sign action after a converted viewing already has a lease', async () => {
    mockListViewings.mockResolvedValue({
      items: [{ id: 4, house_id: 99, house_label: 'A-101', contact_id: 6, contact_name: '王租客', customer_name: '李客户', customer_phone: '13900000000', scheduled_at: '2026-07-01T10:00:00+08:00', status: 'converted', signed_lease_id: 10 }],
      total: 1,
      page: 1,
      page_size: 100,
    });

    renderPage(<ViewingsPage />);

    expect(await screen.findByText(/李客户/)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '签约' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: '查看租约' })).toHaveAttribute('href', '/dashboard/property-rental/leases?house_id=99&edit=10');
  });

  it('filters pending lease viewings from URL', async () => {
    window.history.pushState({}, '', '/property-rental/viewings?pending_lease=true');
    const readyViewing = { id: 4, house_id: 99, house_label: 'A-101', contact_id: 6, contact_name: '王租客', customer_name: '李客户', customer_phone: '13900000000', scheduled_at: '2026-07-01T10:00:00+08:00', status: 'converted', signed_lease_id: null };
    mockListViewings.mockImplementation((params?: Record<string, unknown>) => {
      if (params?.pending_lease && params?.contact_missing === true) {
        return Promise.resolve({ items: [], total: 0, page: 1, page_size: Number(params?.page_size || 20) });
      }
      if (params?.pending_lease) {
        return Promise.resolve({ items: [readyViewing], total: 1, page: 1, page_size: Number(params?.page_size || 20) });
      }
      return Promise.resolve({ items: [], total: 0, page: 1, page_size: Number(params?.page_size || 20) });
    });

    renderPage(<ViewingsPage />);

    expect(await screen.findByText('当前只看：已成交待签约')).toBeInTheDocument();
    expect(screen.queryByText('当前建议')).not.toBeInTheDocument();
    await waitFor(() => expect(mockListViewings).toHaveBeenCalledWith(expect.objectContaining({ pending_lease: true })));
  });

  it('restores viewing status and page filters from URL search params', async () => {
    window.history.pushState({}, '', '/property-rental/viewings?status=viewed&page=2');
    mockListViewings.mockImplementation((params?: Record<string, unknown>) => {
      if (params?.status === 'scheduled') {
        return Promise.resolve({ items: [], total: 0, page: 1, page_size: 1 });
      }
      if (params?.status === 'viewed' && params?.page === 1 && params?.page_size === 1) {
        return Promise.resolve({ items: [], total: 3, page: 1, page_size: 1 });
      }
      if (params?.pending_lease) {
        return Promise.resolve({ items: [], total: 0, page: 1, page_size: 1 });
      }
      if (params?.status === 'canceled') {
        return Promise.resolve({ items: [], total: 0, page: 1, page_size: 1 });
      }
      if (params?.status === 'no_show') {
        return Promise.resolve({ items: [], total: 0, page: 1, page_size: 1 });
      }
      if (params?.status === 'viewed' && params?.page === 2 && params?.page_size === 20) {
        return Promise.resolve({
          items: [{ id: 5, house_id: 99, house_label: 'A-101', customer_name: '回访客户', customer_phone: '13800000000', scheduled_at: '2026-07-01T12:00:00+08:00', status: 'viewed' }],
          total: 21,
          page: 2,
          page_size: 20,
        });
      }
      return Promise.resolve({ items: [], total: 0, page: Number(params?.page || 1), page_size: Number(params?.page_size || 20) });
    });

    renderPage(<ViewingsPage />);

    expect(screen.getByText('当前只看：已带看')).toBeInTheDocument();
    expect(screen.queryByText('当前建议')).not.toBeInTheDocument();
    await waitFor(() => expect(mockListViewings).toHaveBeenCalledWith(expect.objectContaining({ status: 'viewed', page: 2 })));
  });

  it('syncs viewing status filter back to URL', async () => {
    renderPage(<ViewingsPage />);

    fireEvent.mouseDown(screen.getAllByRole('combobox')[0]);
    fireEvent.click((await screen.findAllByText('已带看')).at(-1) as HTMLElement);

    expect(await screen.findByText('当前只看：已带看')).toBeInTheDocument();
    expect(window.location.search).toBe('?status=viewed');
  });

  it('filters converted viewings missing contacts from URL', async () => {
    window.history.pushState({}, '', '/property-rental/viewings?pending_lease=true&contact_missing=true');
    const missingContactViewing = { id: 4, house_id: 99, house_label: 'A-101', customer_name: '李客户', customer_phone: '13900000000', scheduled_at: '2026-07-01T10:00:00+08:00', status: 'converted', signed_lease_id: null };
    mockListViewings.mockImplementation((params?: Record<string, unknown>) => {
      if (params?.pending_lease && params?.contact_missing === false) {
        return Promise.resolve({ items: [], total: 0, page: 1, page_size: Number(params?.page_size || 20) });
      }
      if (params?.pending_lease || params?.status === 'converted') {
        return Promise.resolve({ items: [missingContactViewing], total: 1, page: 1, page_size: Number(params?.page_size || 20) });
      }
      return Promise.resolve({ items: [], total: 0, page: 1, page_size: Number(params?.page_size || 20) });
    });

    renderPage(<ViewingsPage />);

    expect(await screen.findByText('当前只看：已成交待补租客')).toBeInTheDocument();
    expect(screen.queryByText('当前建议')).not.toBeInTheDocument();
    expect(screen.queryByText('可签约')).not.toBeInTheDocument();
    expect(await screen.findByRole('button', { name: '补租客' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '签约' })).not.toBeInTheDocument();
    await waitFor(() => expect(mockListViewings).toHaveBeenCalledWith(expect.objectContaining({ pending_lease: true, contact_missing: true })));
  });

  it('filters ready-to-lease converted viewings from URL', async () => {
    window.history.pushState({}, '', '/property-rental/viewings?pending_lease=true&contact_missing=false');
    const readyViewing = { id: 4, house_id: 99, house_label: 'A-101', contact_id: 6, contact_name: '王租客', customer_name: '李客户', customer_phone: '13900000000', scheduled_at: '2026-07-01T10:00:00+08:00', status: 'converted', signed_lease_id: null };
    mockListViewings.mockImplementation((params?: Record<string, unknown>) => {
      if (params?.pending_lease && params?.contact_missing === true) {
        return Promise.resolve({ items: [], total: 0, page: 1, page_size: Number(params?.page_size || 20) });
      }
      if (params?.pending_lease || params?.status === 'converted') {
        return Promise.resolve({ items: [readyViewing], total: 1, page: 1, page_size: Number(params?.page_size || 20) });
      }
      return Promise.resolve({ items: [], total: 0, page: 1, page_size: Number(params?.page_size || 20) });
    });

    renderPage(<ViewingsPage />);

    expect(await screen.findByText('当前只看：已成交可签约')).toBeInTheDocument();
    expect(screen.queryByText('当前建议')).not.toBeInTheDocument();
    expect(await screen.findByRole('link', { name: '签约' })).toHaveAttribute('href', '/dashboard/property-rental/leases?source_viewing_record_id=4');
    expect(screen.queryByRole('button', { name: '补租客' })).not.toBeInTheDocument();
    await waitFor(() => expect(mockListViewings).toHaveBeenCalledWith(expect.objectContaining({ pending_lease: true, contact_missing: false })));
  });

  it('keeps ready-to-lease overview aligned with the filtered queue', async () => {
    window.history.pushState({}, '', '/property-rental/viewings?pending_lease=true&contact_missing=false');
    mockListViewings.mockImplementation((params?: Record<string, unknown>) => {
      if (params?.pending_lease && params?.contact_missing === false) {
        return Promise.resolve({ items: [], total: 0, page: 1, page_size: 20 });
      }
      if (params?.pending_lease) {
        return Promise.resolve({
          items: [{ id: 4, house_id: 99, house_label: 'A-101', customer_name: '李客户', customer_phone: '13900000000', scheduled_at: '2026-07-01T10:00:00+08:00', status: 'converted', signed_lease_id: null }],
          total: 1,
          page: 1,
          page_size: 1,
        });
      }
      return Promise.resolve({ items: [], total: 0, page: 1, page_size: 20 });
    });

    renderPage(<ViewingsPage />);

    expect(await screen.findByText('当前只看：已成交可签约')).toBeInTheDocument();
    expect(await screen.findByText('当前可签约队列为空')).toBeInTheDocument();
    expect(await screen.findByText('当前没有主体完整且可直接签约的成交记录，先回到待补租客补齐主体，再继续签约。')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText('查看待补租客').closest('a')).toHaveAttribute('href', '/dashboard/property-rental/viewings?pending_lease=true&contact_missing=true');
      expect(screen.getByText('查看待签约').closest('a')).toHaveAttribute('href', '/dashboard/property-rental/viewings?pending_lease=true');
    });
  });

  it('keeps missing-contact overview aligned with the filtered queue', async () => {
    window.history.pushState({}, '', '/property-rental/viewings?pending_lease=true&contact_missing=true');
    mockListViewings.mockImplementation((params?: Record<string, unknown>) => {
      if (params?.pending_lease && params?.contact_missing === true) {
        return Promise.resolve({ items: [], total: 0, page: 1, page_size: 20 });
      }
      if (params?.pending_lease) {
        return Promise.resolve({
          items: [{ id: 4, house_id: 99, house_label: 'A-101', customer_name: '李客户', customer_phone: '13900000000', scheduled_at: '2026-07-01T10:00:00+08:00', status: 'converted', signed_lease_id: null }],
          total: 1,
          page: 1,
          page_size: 1,
        });
      }
      if (params?.status === 'converted') {
        return Promise.resolve({
          items: [{ id: 4, house_id: 99, house_label: 'A-101', customer_name: '李客户', customer_phone: '13900000000', scheduled_at: '2026-07-01T10:00:00+08:00', status: 'converted', signed_lease_id: null }],
          total: 1,
          page: 1,
          page_size: 1,
        });
      }
      return Promise.resolve({ items: [], total: 0, page: 1, page_size: 20 });
    });

    renderPage(<ViewingsPage />);

    expect(await screen.findByText('当前只看：已成交待补租客')).toBeInTheDocument();
    expect(await screen.findByText('待补租客队列已处理完成')).toBeInTheDocument();
    expect(await screen.findByText('当前筛选下已没有缺租客主体的成交记录，继续处理可签约或全部待签约队列。')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText('查看可签约').closest('a')).toHaveAttribute('href', '/dashboard/property-rental/viewings?pending_lease=true&contact_missing=false');
      expect(screen.getByText('查看待签约').closest('a')).toHaveAttribute('href', '/dashboard/property-rental/viewings?pending_lease=true');
    });
  });

  it('creates viewing records without sending status', async () => {
    renderPage(<ViewingsPage />);

    fireEvent.click(await screen.findByRole('button', { name: 'plus 新建带看' }));
    expect(screen.getByLabelText('房源')).toBeInTheDocument();
    expect(screen.queryByLabelText('状态')).not.toBeInTheDocument();

    fireEvent.mouseDown(screen.getByLabelText('房源'));
    const houseOption = (await screen.findAllByText('A-101')).at(-1);
    expect(houseOption).toBeDefined();
    fireEvent.click(houseOption as HTMLElement);
    fireEvent.change(screen.getByLabelText('客户姓名'), { target: { value: '赵客户' } });
    fireEvent.change(screen.getByLabelText('客户手机'), { target: { value: '13600000000' } });
    fireEvent.change(screen.getByLabelText('预约时间'), { target: { value: '2026-07-02T10:00' } });
    fireEvent.click(screen.getByRole('button', { name: /保\s*存/ }));

    await waitFor(() => expect(mockCreateViewingRecord).toHaveBeenCalled());
    expect(mockCreateViewingRecord.mock.calls[0][0]).toEqual({
      house_id: 99,
      customer_name: '赵客户',
      customer_phone: '13600000000',
      scheduled_at: '2026-07-02T10:00',
    });
  });

  it('fills viewing customer fields from the selected contact', async () => {
    mockListContacts.mockResolvedValue({ items: [{ id: 6, name: '王租客', phone: '13700000000', roles: ['tenant'] }], total: 1, page: 1, page_size: 100 });

    renderPage(<ViewingsPage />);

    fireEvent.click(await screen.findByRole('button', { name: 'plus 新建带看' }));
    fireEvent.mouseDown(screen.getByLabelText('关联联系人'));
    const contactOption = (await screen.findAllByText('王租客 / 13700000000')).at(-1);
    expect(contactOption).toBeDefined();
    fireEvent.click(contactOption as HTMLElement);

    expect(screen.getByLabelText('客户姓名')).toHaveValue('王租客');
    expect(screen.getByLabelText('客户手机')).toHaveValue('13700000000');
  });

  it('clears viewing draft values when reopening the create drawer', async () => {
    renderPage(<ViewingsPage />);

    fireEvent.click(await screen.findByRole('button', { name: 'plus 新建带看' }));
    fireEvent.change(screen.getByLabelText('客户姓名'), { target: { value: '赵客户' } });
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    fireEvent.click(await screen.findByRole('button', { name: 'plus 新建带看' }));

    expect(screen.getByLabelText('客户姓名')).toHaveValue('');
  });

  it('opens viewing creation drawer from house source', async () => {
    window.history.pushState({}, '', '/property-rental/viewings?house_id=99');

    renderPage(<ViewingsPage />);

    expect(await screen.findByText(/已带入房源/)).toBeInTheDocument();
    expect(screen.getByText('带看归属')).toBeInTheDocument();
    expect((await screen.findAllByText('客户信息')).length).toBeGreaterThan(0);
    expect(screen.getByText('预约与结果')).toBeInTheDocument();
    expect(screen.getByText('带看摘要')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('客户姓名'), { target: { value: '赵客户' } });
    fireEvent.change(screen.getByLabelText('客户手机'), { target: { value: '13600000000' } });
    fireEvent.change(screen.getByLabelText('预约时间'), { target: { value: '2026-07-02T10:00' } });
    fireEvent.click(screen.getByRole('button', { name: /保\s*存/ }));

    await waitFor(() => expect(mockCreateViewingRecord).toHaveBeenCalledWith(expect.objectContaining({
      house_id: 99,
      customer_name: '赵客户',
    })));
    await waitFor(() => expect(mockListViewings).toHaveBeenCalledWith(expect.objectContaining({ house_id: 99 })));
  });

  it('clears source house context when closing the viewing creation drawer', async () => {
    window.history.pushState({}, '', '/property-rental/viewings?house_id=99');

    renderPage(<ViewingsPage />);

    expect(await screen.findByText(/已带入房源/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));

    await waitFor(() => expect(window.location.search).toBe(''));
  });

  it('opens viewing creation drawer from tenant contact source', async () => {
    window.history.pushState({}, '', '/property-rental/viewings?contact_id=3');
    mockListContacts.mockResolvedValue({ items: [{ id: 3, name: '王租客', phone: '13700000000', roles: ['tenant'] }], total: 1, page: 1, page_size: 100 });

    renderPage(<ViewingsPage />);

    expect(await screen.findByText('已带入联系人，补齐房源和预约时间后保存。')).toBeInTheDocument();
    expect(screen.getByLabelText('客户姓名')).toHaveValue('王租客');
    expect(screen.getByLabelText('客户手机')).toHaveValue('13700000000');
  });

  it('opens viewing edit drawer directly from URL query', async () => {
    window.history.pushState({}, '', '/property-rental/viewings?pending_lease=true&edit=4');
    mockListViewings.mockResolvedValue({
      items: [{ id: 4, house_id: 99, house_label: 'A-101', customer_name: '李客户', customer_phone: '13900000000', scheduled_at: '2026-07-01T10:00:00+08:00', status: 'converted', signed_lease_id: null }],
      total: 1,
      page: 1,
      page_size: 100,
    });

    renderPage(<ViewingsPage />);

    expect(await screen.findByText('编辑带看')).toBeInTheDocument();
    expect(await screen.findByText(/该成交记录尚未绑定租客联系人/)).toBeInTheDocument();
    expect(screen.getByLabelText('客户姓名')).toHaveValue('李客户');
  });

  it('writes missing-contact task context to URL when opening the viewing drawer from the queue', async () => {
    window.history.pushState({}, '', '/property-rental/viewings?pending_lease=true&contact_missing=true');
    mockListViewings.mockResolvedValue({
      items: [{ id: 4, house_id: 99, house_label: 'A-101', customer_name: '李客户', customer_phone: '13900000000', scheduled_at: '2026-07-01T10:00:00+08:00', status: 'converted', signed_lease_id: null }],
      total: 1,
      page: 1,
      page_size: 100,
    });

    renderPage(<ViewingsPage />);

    expect(await screen.findByText(/李客户/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '补租客' }));

    expect(await screen.findByText('当前操作：补齐租客主体')).toBeInTheDocument();
    expect(screen.getByText(/当前入口来自待补租客队列/)).toBeInTheDocument();
    await waitFor(() => expect(window.location.search).toBe('?pending_lease=true&contact_missing=true&edit=4&task=contact'));
  });

  it('clears focused viewing edit context when the drawer closes', async () => {
    window.history.pushState({}, '', '/property-rental/viewings?pending_lease=true&contact_missing=true&edit=4&task=contact');
    mockListViewings.mockResolvedValue({
      items: [{ id: 4, house_id: 99, house_label: 'A-101', customer_name: '李客户', customer_phone: '13900000000', scheduled_at: '2026-07-01T10:00:00+08:00', status: 'converted', signed_lease_id: null }],
      total: 1,
      page: 1,
      page_size: 100,
    });

    renderPage(<ViewingsPage />);

    expect(await screen.findByText('编辑带看')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));

    await waitFor(() => expect(window.location.search).toBe('?pending_lease=true&contact_missing=true'));
  });

  it('creates a tenant directly from the missing-contact viewing drawer and selects it', async () => {
    window.history.pushState({}, '', '/property-rental/viewings?pending_lease=true&edit=4');
    mockListContacts.mockResolvedValue({ items: [], total: 0, page: 1, page_size: 100 });
    mockListViewings.mockResolvedValue({
      items: [{ id: 4, house_id: 99, house_label: 'A-101', customer_name: '李客户', customer_phone: '13900000000', scheduled_at: '2026-07-01T10:00:00+08:00', status: 'converted', signed_lease_id: null }],
      total: 1,
      page: 1,
      page_size: 100,
    });
    mockCreateContact.mockResolvedValue({ id: 8, name: '李客户', phone: '13900000000', roles: ['tenant'], is_active: true });

    renderPage(<ViewingsPage />);

    expect(await screen.findByText('编辑带看')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '新建租客' }));

    expect(screen.getByLabelText('姓名')).toHaveValue('李客户');
    expect(screen.getByLabelText('手机')).toHaveValue('13900000000');
    fireEvent.click(screen.getByRole('button', { name: '保存租客' }));

    await waitFor(() => expect(mockCreateContact).toHaveBeenCalledWith(expect.objectContaining({
      name: '李客户',
      phone: '13900000000',
      roles: ['tenant'],
      is_active: true,
    })));
    expect((await screen.findAllByText('李客户 / 13900000000')).at(-1)).toBeDefined();
  });

  it('shows contact business actions for landlord and tenant roles', async () => {
    mockListContacts.mockResolvedValue({
      items: [
        { id: 3, name: '张房东', phone: '13800000000', roles: ['landlord'] },
        { id: 6, name: '王租客', phone: '13700000000', roles: ['tenant'] },
      ],
      total: 2,
      page: 1,
      page_size: 100,
    });

    renderPage(<ContactsPage />);

    expect(await screen.findByRole('link', { name: '登记房源' })).toHaveAttribute('href', '/dashboard/property-rental/houses/new?landlord_id=3');
    expect(screen.getByRole('link', { name: '登记带看' })).toHaveAttribute('href', '/dashboard/property-rental/viewings?contact_id=6');
  });

  it('shows lease rows', async () => {
    renderPage(<LeasesPage />);

    expect(await screen.findByText(/4200/)).toBeInTheDocument();
  });

  it('shows lease operational overview and workflow hints', async () => {
    mockListLeases.mockImplementation((params?: Record<string, unknown>) => {
      if (params?.contract_missing) {
        return Promise.resolve({ items: [], total: 2, page: 1, page_size: 1 });
      }
      if (params?.status === 'pending') {
        return Promise.resolve({ items: [], total: 1, page: 1, page_size: 1 });
      }
      if (params?.status === 'active') {
        return Promise.resolve({ items: [], total: 1, page: 1, page_size: 1 });
      }
      if (params?.status === 'expired') {
        return Promise.resolve({ items: [], total: 1, page: 1, page_size: 1 });
      }
      if (params?.status === 'terminated') {
        return Promise.resolve({ items: [], total: 0, page: 1, page_size: 1 });
      }
      return Promise.resolve({
        items: [
          { id: 5, house_id: 99, house_label: 'A-101', tenant_id: 6, tenant_name: '王租客', tenant_phone: '13700000000', start_date: '2026-07-01', end_date: '2027-06-30', monthly_rent: '4200.00', status: 'pending', contract_files: [] },
          { id: 6, house_id: 100, house_label: 'A-102', tenant_id: 7, tenant_name: '李租客', tenant_phone: '13600000000', start_date: '2026-06-01', end_date: '2027-05-31', monthly_rent: '4500.00', status: 'active', contract_files: [{ media_id: 9 }] },
          { id: 7, house_id: 101, house_label: 'A-103', tenant_id: 8, tenant_name: '赵租客', tenant_phone: '13500000000', start_date: '2025-06-01', end_date: '2026-05-31', monthly_rent: '4000.00', status: 'expired', contract_files: [] },
        ],
        total: 3,
        page: 1,
        page_size: 20,
      });
    });

    renderPage(<LeasesPage />);

    expect(await screen.findByText('签约概览')).toBeInTheDocument();
    expect(screen.queryByText('当前建议')).not.toBeInTheDocument();
    expect(screen.getByText('履约队列')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /全部 3/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /待生效 1/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /生效中 1/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /待补合同 2/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /已到期 1/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /已终止 0/ })).toBeInTheDocument();
    expect(screen.getAllByText('待合同归档').length).toBeGreaterThan(0);
    expect(screen.getByText('履约跟进')).toBeInTheDocument();
    expect(screen.getByText('待退租归档')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '去待签约带看' })).toHaveAttribute('href', '/dashboard/property-rental/viewings?pending_lease=true&contact_missing=false');
    expect(screen.getByRole('link', { name: '去待补租客' })).toHaveAttribute('href', '/dashboard/property-rental/viewings?pending_lease=true&contact_missing=true');
  });

  it('shows quick queue links for lease workflows', async () => {
    const { container } = renderPage(<LeasesPage />);

    await waitFor(() => expect(container.textContent?.replace(/\s+/g, '')).toContain('全部'));

    const quickQueueButtons = Array.from(container.querySelectorAll('button')).filter((button) =>
      ['全部', '待生效', '生效中', '待补合同', '已到期', '已终止'].some((label) => (button.textContent || '').replace(/\s+/g, '').startsWith(label)),
    );

    expect(quickQueueButtons.map((button) => (button.textContent || '').replace(/\s+/g, ''))).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^全部\d+$/),
        expect.stringMatching(/^待生效\d+$/),
        expect.stringMatching(/^生效中\d+$/),
        expect.stringMatching(/^待补合同\d+$/),
        expect.stringMatching(/^已到期\d+$/),
        expect.stringMatching(/^已终止\d+$/),
      ]),
    );

    const contractMissingButton = quickQueueButtons.find((button) => (button.textContent || '').replace(/\s+/g, '').startsWith('待补合同'));
    expect(contractMissingButton).toBeDefined();

    fireEvent.click(contractMissingButton as HTMLButtonElement);

    expect(mockHistoryPush).toHaveBeenCalledWith('/property-rental/leases?task=contract');
  });

  it('restores lease status and page filters from URL search params', async () => {
    window.history.pushState({}, '', '/property-rental/leases?status=active&page=2');
    mockListLeases.mockImplementation((params?: Record<string, unknown>) => {
      if (params?.status === 'pending') {
        return Promise.resolve({ items: [], total: 1, page: 1, page_size: 1 });
      }
      if (params?.status === 'active' && params?.page === 1 && params?.page_size === 1) {
        return Promise.resolve({ items: [], total: 3, page: 1, page_size: 1 });
      }
      if (params?.status === 'expired') {
        return Promise.resolve({ items: [], total: 0, page: 1, page_size: 1 });
      }
      if (params?.status === 'active' && params?.page === 2 && params?.page_size === 20) {
        return Promise.resolve({
          items: [{ id: 6, house_id: 100, house_label: 'A-102', tenant_id: 7, tenant_name: '李租客', tenant_phone: '13600000000', start_date: '2026-06-01', end_date: '2027-05-31', monthly_rent: '4500.00', status: 'active', contract_files: [{ media_id: 9 }] }],
          total: 21,
          page: 2,
          page_size: 20,
        });
      }
      return Promise.resolve({ items: [], total: 0, page: Number(params?.page || 1), page_size: Number(params?.page_size || 20) });
    });

    renderPage(<LeasesPage />);

    expect(screen.getByText('当前只看：生效中')).toBeInTheDocument();
    expect(screen.queryByText('当前建议')).not.toBeInTheDocument();
    await waitFor(() => expect(mockListLeases).toHaveBeenCalledWith(expect.objectContaining({ status: 'active', page: 2 })));
  });

  it('syncs lease status filter back to URL', async () => {
    renderPage(<LeasesPage />);

    fireEvent.mouseDown(screen.getAllByRole('combobox')[0]);
    fireEvent.click((await screen.findAllByText('生效中')).at(-1) as HTMLElement);

    expect(await screen.findByText('当前只看：生效中')).toBeInTheDocument();
    expect(window.location.search).toBe('?status=active');
  });

  it('restores lease filters on browser popstate', async () => {
    renderPage(<LeasesPage />);

    window.history.pushState({}, '', '/property-rental/leases?status=active&page=2');
    window.dispatchEvent(new PopStateEvent('popstate'));

    expect(await screen.findByText('当前只看：生效中')).toBeInTheDocument();
  });

  it('shows an actionable empty state for leases', async () => {
    mockListLeases.mockResolvedValue({ items: [], total: 0, page: 1, page_size: 100 });

    renderPage(<LeasesPage />);

    expect(await screen.findByText('暂无租约')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '新建租约' })).toBeInTheDocument();
  });

  it('shows a task-aware empty state when the contract queue is cleared', async () => {
    window.history.pushState({}, '', '/property-rental/leases?task=contract');
    mockListLeases.mockImplementation((params?: Record<string, unknown>) => {
      if (params?.contract_missing) {
        return Promise.resolve({ items: [], total: 0, page: Number(params?.page || 1), page_size: Number(params?.page_size || 20) });
      }
      if (params?.status === 'pending') {
        return Promise.resolve({ items: [], total: 1, page: 1, page_size: 1 });
      }
      if (params?.status === 'active') {
        return Promise.resolve({ items: [], total: 2, page: 1, page_size: 1 });
      }
      if (params?.status === 'expired') {
        return Promise.resolve({ items: [], total: 0, page: 1, page_size: 1 });
      }
      return Promise.resolve({ items: [], total: 3, page: 1, page_size: 1 });
    });

    renderPage(<LeasesPage />);

    expect(await screen.findByText('当前只看：合同缺失')).toBeInTheDocument();
    expect(await screen.findByText('合同缺失队列已处理完成')).toBeInTheDocument();
    expect(screen.getByText('当前筛选下已没有待补合同租约，可返回全部租约继续检查待生效或履约中的记录。')).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: '查看全部租约' })).toHaveAttribute('href', '/dashboard/property-rental/leases');
    expect(screen.getByRole('button', { name: '新建租约' })).toBeInTheDocument();
  });

  it('updates lease status from the row action', async () => {
    mockListLeases.mockResolvedValue({
      items: [{ id: 5, house_id: 1, estate_name: '星河湾', building_name: '1 栋', room_number: '301', tenant_id: 6, tenant_name: '王租客', tenant_phone: '13700000000', status: 'active', contract_files: [{ media_id: 1, media_type: 'file' }] }],
      total: 1,
      page: 1,
      page_size: 100,
    });

    renderPage(<LeasesPage />);

    const row = (await screen.findByText(/星河湾 \/ 1 栋 \/ 301/)).closest('tr');
    expect(row).not.toBeNull();
    fireEvent.click(within(row as HTMLElement).getByRole('button', { name: '到期' }));

    await waitFor(() => expect(mockPatchLease).toHaveBeenCalledWith(5, { status: 'expired' }));
  });

  it('keeps the lease list compact with grouped lease information', async () => {
    mockListLeases.mockResolvedValue({
      items: [{ id: 5, house_id: 1, house_label: 'A-101', tenant_id: 6, tenant_name: '王租客', tenant_phone: '13700000000', start_date: '2026-07-01', end_date: '2027-06-30', monthly_rent: '4200.00', status: 'active', contract_files: [{ media_id: 1, media_type: 'file' }] }],
      total: 1,
      page: 1,
      page_size: 100,
    });

    renderPage(<LeasesPage />);

    expect(await screen.findByRole('columnheader', { name: '租约信息' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: '状态' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: '当前动作' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: '合同' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: '操作' })).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: '起租' })).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: '到期' })).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: '月租' })).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: '履约建议' })).not.toBeInTheDocument();
  });

  it('does not render closure signal shortcuts on the lease board', async () => {
    renderPage(<LeasesPage />);

    expect(await screen.findByText('签约概览')).toBeInTheDocument();
    expect(screen.queryByText('关键提醒')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '查看待生效' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '查看待补合同' })).not.toBeInTheDocument();
  });

  it('filters leases by missing contract task and exposes contract upload field', async () => {
    window.history.pushState({}, '', '/property-rental/leases?task=contract');
    mockListLeases.mockResolvedValue({
      items: [
        { id: 5, house_id: 99, house_label: 'A-101', tenant_id: 6, tenant_name: '王租客', tenant_phone: '13700000000', start_date: '2026-07-01', end_date: '2027-06-30', monthly_rent: '4200.00', status: 'active', contract_files: [] },
      ],
      total: 1,
      page: 1,
      page_size: 100,
    });

    renderPage(<LeasesPage />);

    expect(await screen.findByText('当前只看：合同缺失')).toBeInTheDocument();
    expect(screen.queryByText('当前建议')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: '查看全部' })).toHaveAttribute('href', '/dashboard/property-rental/leases');
    expect(await screen.findByText(/A-101/)).toBeInTheDocument();
    await waitFor(() => expect(mockListLeases).toHaveBeenCalledWith(expect.objectContaining({ contract_missing: true })));
    expect(screen.getAllByText('待补合同').length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: '补合同' })).toHaveAttribute('href', '/dashboard/property-rental/leases?house_id=99&task=contract&edit=5');

    const leaseRow = (await screen.findByText(/A-101/)).closest('tr');
    expect(leaseRow).not.toBeNull();
    expect(within(leaseRow as HTMLElement).queryByRole('button', { name: '生效' })).not.toBeInTheDocument();
    expect(within(leaseRow as HTMLElement).queryByRole('button', { name: '终止' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'plus 新建租约' }));
    expect((await screen.findAllByText('合同文件')).length).toBeGreaterThan(0);
  });

  it('surfaces combined contract and status scope when leases are filtered by both', async () => {
    window.history.pushState({}, '', '/property-rental/leases?task=contract&status=pending');
    mockListLeases.mockImplementation((params?: Record<string, unknown>) => {
      if (params?.contract_missing && params?.status === 'pending') {
        return Promise.resolve({
          items: [
            { id: 5, house_id: 99, house_label: 'A-101', tenant_id: 6, tenant_name: '王租客', tenant_phone: '13700000000', start_date: '2026-07-01', end_date: '2027-06-30', monthly_rent: '4200.00', status: 'pending', contract_files: [] },
          ],
          total: 1,
          page: 1,
          page_size: 100,
        });
      }
      if (params?.contract_missing || params?.status === 'pending') {
        return Promise.resolve({ items: [], total: 1, page: 1, page_size: 1 });
      }
      return Promise.resolve({ items: [], total: 0, page: 1, page_size: 1 });
    });

    renderPage(<LeasesPage />);

    expect(await screen.findByText('当前只看：合同缺失 / 待生效')).toBeInTheDocument();
    expect(screen.queryByText('当前建议')).not.toBeInTheDocument();
  });

  it('opens lease creation drawer from converted viewing source', async () => {
    window.history.pushState({}, '', '/property-rental/leases?source_viewing_record_id=4');
    mockListViewings.mockImplementation((params?: Record<string, unknown>) => {
      if (params?.contact_missing === false) {
        return Promise.resolve({
          items: [{ id: 4, house_id: 99, house_label: 'A-101', contact_id: 6, contact_name: '王租客', customer_name: '李客户', customer_phone: '13900000000', scheduled_at: '2026-07-01T10:00:00+08:00', status: 'converted', signed_lease_id: null }],
          total: 1,
          page: 1,
          page_size: 100,
        });
      }
      return Promise.resolve({
        items: [{ id: 4, house_id: 99, house_label: 'A-101', contact_id: 6, contact_name: '王租客', customer_name: '李客户', customer_phone: '13900000000', scheduled_at: '2026-07-01T10:00:00+08:00', status: 'converted', signed_lease_id: null }],
        total: 1,
        page: 1,
        page_size: 100,
      });
    });

    renderPage(<LeasesPage />);

    expect(await screen.findByText('已带入成交带看，补齐租期和金额后保存。')).toBeInTheDocument();
    expect(screen.getByLabelText('房源')).toBeInTheDocument();
    expect(screen.getByLabelText('成交带看')).toBeInTheDocument();
    await waitFor(() => expect(mockListViewings).toHaveBeenCalledWith(expect.objectContaining({ pending_lease: true, contact_missing: false })));
    await waitFor(() => expect(mockListViewings).toHaveBeenCalledWith(expect.objectContaining({ pending_lease: true })));
  });

  it('opens lease edit drawer from edit query param', async () => {
    window.history.pushState({}, '', '/property-rental/leases?house_id=99&edit=5');

    renderPage(<LeasesPage />);

    expect(await screen.findByText('编辑租约')).toBeInTheDocument();
    expect(screen.getByLabelText('房源')).toBeInTheDocument();
    expect(screen.getByDisplayValue('2026-07-01')).toBeInTheDocument();
  });

  it('clears edit query params when closing the lease edit drawer', async () => {
    window.history.pushState({}, '', '/property-rental/leases?house_id=99&task=contract&edit=5');

    renderPage(<LeasesPage />);

    expect(await screen.findByText('编辑租约')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));

    await waitFor(() => expect(window.location.search).toBe('?house_id=99&task=contract'));
  });

  it('keeps contract queue context when opening a lease edit drawer from the contract task', async () => {
    window.history.pushState({}, '', '/property-rental/leases?house_id=99&task=contract&edit=5');
    mockListLeases.mockResolvedValue({
      items: [
        { id: 5, house_id: 99, house_label: 'A-101', tenant_id: 6, tenant_name: '王租客', tenant_phone: '13700000000', start_date: '2026-07-01', end_date: '2027-06-30', monthly_rent: '4200.00', status: 'active', contract_files: [] },
      ],
      total: 1,
      page: 1,
      page_size: 100,
    });

    renderPage(<LeasesPage />);

    expect(await screen.findByText('当前只看：房源：A-101 / 合同缺失')).toBeInTheDocument();
    expect(await screen.findByText('当前操作：补归档合同')).toBeInTheDocument();
    expect(screen.getByText('当前入口来自合同缺失队列，优先上传主合同文件，再继续确认租约状态和履约节点。')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '返回队列' })).toHaveAttribute('href', '/dashboard/property-rental/leases?house_id=99&task=contract');
    expect(screen.getByText('编辑租约')).toBeInTheDocument();
  });

  it('opens lease edit drawer from edit query param even when the filtered list does not include the lease', async () => {
    window.history.pushState({}, '', '/property-rental/leases?house_id=99&edit=5');
    mockListLeases.mockImplementation((params?: Record<string, unknown>) => {
      if (params?.house_id === 99 && !params?.status && !params?.contract_missing) {
        return Promise.resolve({ items: [], total: 0, page: 1, page_size: 100 });
      }
      return Promise.resolve({ items: [], total: 0, page: 1, page_size: 1 });
    });

    renderPage(<LeasesPage />);

    expect(await screen.findByText('编辑租约')).toBeInTheDocument();
    expect(screen.getByDisplayValue('2026-07-01')).toBeInTheDocument();
    await waitFor(() => expect(mockGetLease).toHaveBeenCalledWith(5));
  });

  it('clears source viewing query params when closing the lease creation drawer', async () => {
    window.history.pushState({}, '', '/property-rental/leases?source_viewing_record_id=4');
    mockListViewings.mockImplementation((params?: Record<string, unknown>) => {
      if (params?.contact_missing === false) {
        return Promise.resolve({
          items: [{ id: 4, house_id: 99, house_label: 'A-101', contact_id: 6, contact_name: '王租客', customer_name: '李客户', customer_phone: '13900000000', scheduled_at: '2026-07-01T10:00:00+08:00', status: 'converted', signed_lease_id: null }],
          total: 1,
          page: 1,
          page_size: 100,
        });
      }
      return Promise.resolve({
        items: [{ id: 4, house_id: 99, house_label: 'A-101', contact_id: 6, contact_name: '王租客', customer_name: '李客户', customer_phone: '13900000000', scheduled_at: '2026-07-01T10:00:00+08:00', status: 'converted', signed_lease_id: null }],
        total: 1,
        page: 1,
        page_size: 100,
      });
    });

    renderPage(<LeasesPage />);

    expect(await screen.findByText('已带入成交带看，补齐租期和金额后保存。')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));

    await waitFor(() => expect(window.location.search).toBe(''));
  });

  it('warns when the source viewing has already been signed', async () => {
    window.history.pushState({}, '', '/property-rental/leases?source_viewing_record_id=4');
    mockListViewings.mockResolvedValue({ items: [], total: 0, page: 1, page_size: 100 });

    renderPage(<LeasesPage />);

    expect(await screen.findByText('该成交带看已生成租约，不能重复签约。')).toBeInTheDocument();
    expect(screen.queryByText('已带入成交带看，补齐租期和金额后保存。')).not.toBeInTheDocument();
  });

  it('routes incomplete source viewings back to the viewing workflow before signing', async () => {
    window.history.pushState({}, '', '/property-rental/leases?source_viewing_record_id=4');
    mockListViewings.mockImplementation((params?: Record<string, unknown>) => {
      if (params?.contact_missing === false) {
        return Promise.resolve({ items: [], total: 0, page: 1, page_size: 100 });
      }
      return Promise.resolve({
        items: [{ id: 4, house_id: 99, house_label: 'A-101', customer_name: '李客户', customer_phone: '13900000000', scheduled_at: '2026-07-01T10:00:00+08:00', status: 'converted', signed_lease_id: null }],
        total: 1,
        page: 1,
        page_size: 100,
      });
    });

    renderPage(<LeasesPage />);

    expect(await screen.findByText('该成交带看未绑定租客联系人，请先回带看页补齐业务主体后再签约。')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '去补租客' })).toHaveAttribute('href', '/dashboard/property-rental/viewings?pending_lease=true&contact_missing=true&edit=4');
    expect(screen.queryByText('已带入成交带看，补齐租期和金额后保存。')).not.toBeInTheDocument();
    expect(screen.queryByText('编辑租约')).not.toBeInTheDocument();
  });

  it('fills lease house and tenant from the selected converted viewing', async () => {
    mockListContacts.mockResolvedValue({ items: [{ id: 6, name: '王租客', phone: '13700000000', roles: ['tenant'] }], total: 1, page: 1, page_size: 100 });
    mockListViewings.mockResolvedValue({
      items: [{ id: 4, house_id: 99, house_label: 'A-101', contact_id: 6, contact_name: '王租客', customer_name: '李客户', customer_phone: '13900000000', scheduled_at: '2026-07-01T10:00:00+08:00', status: 'converted', signed_lease_id: null }],
      total: 1,
      page: 1,
      page_size: 100,
    });

    renderPage(<LeasesPage />);

    fireEvent.click(await screen.findByRole('button', { name: 'plus 新建租约' }));
    fireEvent.mouseDown(screen.getByLabelText('成交带看'));
    const viewingOption = (await screen.findAllByText('李客户 / A-101')).at(-1);
    expect(viewingOption).toBeDefined();
    fireEvent.click(viewingOption as HTMLElement);
    fireEvent.change(screen.getByLabelText('起租日期'), { target: { value: '2026-07-01' } });
    fireEvent.change(screen.getByLabelText('到期日期'), { target: { value: '2027-06-30' } });
    fireEvent.change(screen.getByLabelText('月租'), { target: { value: '4200' } });
    fireEvent.click(screen.getByRole('button', { name: /保\s*存/ }));

    await waitFor(() => expect(mockCreateLease).toHaveBeenCalledWith(expect.objectContaining({
      source_viewing_record_id: 4,
      house_id: 99,
      tenant_id: 6,
    })));
  });

  it('does not expose source viewings without contacts in the lease source selector', async () => {
    mockListViewings.mockImplementation((params?: Record<string, unknown>) => {
      if (params?.contact_missing === false) {
        return Promise.resolve({ items: [], total: 0, page: 1, page_size: 100 });
      }
      return Promise.resolve({
        items: [{ id: 4, house_id: 99, house_label: 'A-101', customer_name: '李客户', customer_phone: '13900000000', scheduled_at: '2026-07-01T10:00:00+08:00', status: 'converted', signed_lease_id: null }],
        total: 1,
        page: 1,
        page_size: 100,
      });
    });

    renderPage(<LeasesPage />);

    fireEvent.click(await screen.findByRole('button', { name: 'plus 新建租约' }));
    fireEvent.mouseDown(screen.getByLabelText('成交带看'));

    expect(screen.queryByText('李客户 / A-101')).not.toBeInTheDocument();
  });

  it('prefills tenant creation from a source viewing customer', async () => {
    window.history.pushState({}, '', '/property-rental/leases?source_viewing_record_id=4');
    mockListContacts.mockResolvedValue({ items: [], total: 0, page: 1, page_size: 100 });
    mockListViewings.mockImplementation((params?: Record<string, unknown>) => {
      if (params?.contact_missing === false) {
        return Promise.resolve({
          items: [{ id: 4, house_id: 99, house_label: 'A-101', contact_id: 6, contact_name: '王租客', customer_name: '李客户', customer_phone: '13900000000', scheduled_at: '2026-07-01T10:00:00+08:00', status: 'converted', signed_lease_id: null }],
          total: 1,
          page: 1,
          page_size: 100,
        });
      }
      return Promise.resolve({
        items: [{ id: 4, house_id: 99, house_label: 'A-101', contact_id: 6, contact_name: '王租客', customer_name: '李客户', customer_phone: '13900000000', scheduled_at: '2026-07-01T10:00:00+08:00', status: 'converted', signed_lease_id: null }],
        total: 1,
        page: 1,
        page_size: 100,
      });
    });

    renderPage(<LeasesPage />);

    expect(await screen.findByText('已带入成交带看，补齐租期和金额后保存。')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '新建租客' }));

    expect(screen.getByLabelText('姓名')).toHaveValue('李客户');
    expect(screen.getByLabelText('手机')).toHaveValue('13900000000');
  });

  it('creates a tenant from the lease drawer and selects it', async () => {
    mockListContacts.mockResolvedValue({ items: [], total: 0, page: 1, page_size: 100 });
    mockCreateContact.mockResolvedValue({ id: 8, name: '王租客', phone: '13700000000', roles: ['tenant'], is_active: true });

    renderPage(<LeasesPage />);

    fireEvent.click(await screen.findByRole('button', { name: 'plus 新建租约' }));
    fireEvent.click(screen.getByRole('button', { name: '新建租客' }));
    fireEvent.change(screen.getByLabelText('姓名'), { target: { value: '王租客' } });
    fireEvent.change(screen.getByLabelText('手机'), { target: { value: '13700000000' } });
    fireEvent.click(screen.getByRole('button', { name: '保存租客' }));

    await waitFor(() => expect(mockCreateContact).toHaveBeenCalledWith(expect.objectContaining({
      name: '王租客',
      phone: '13700000000',
      roles: ['tenant'],
      is_active: true,
    })));
    expect((await screen.findAllByText('王租客 / 13700000000')).at(-1)).toBeDefined();

    fireEvent.mouseDown(screen.getByLabelText('房源'));
    const houseOption = (await screen.findAllByText('A-101')).at(-1);
    expect(houseOption).toBeDefined();
    fireEvent.click(houseOption as HTMLElement);
    fireEvent.change(screen.getByLabelText('起租日期'), { target: { value: '2026-07-01' } });
    fireEvent.change(screen.getByLabelText('到期日期'), { target: { value: '2027-06-30' } });
    fireEvent.change(screen.getByLabelText('月租'), { target: { value: '4200' } });
    fireEvent.click(screen.getByRole('button', { name: '保 存' }));

    await waitFor(() => expect(mockCreateLease).toHaveBeenCalledWith(expect.objectContaining({
      house_id: 99,
      tenant_id: 8,
      start_date: '2026-07-01',
    })));
  });

  it('clears lease draft values when reopening the create drawer', async () => {
    renderPage(<LeasesPage />);

    fireEvent.click(await screen.findByRole('button', { name: 'plus 新建租约' }));
    fireEvent.change(screen.getByLabelText('月租'), { target: { value: '4200' } });
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    fireEvent.click(await screen.findByRole('button', { name: 'plus 新建租约' }));

    expect(screen.getByLabelText('月租')).toHaveValue('');
  });

  it('opens lease creation drawer from house source', async () => {
    window.history.pushState({}, '', '/property-rental/leases?house_id=99');

    renderPage(<LeasesPage />);

    expect(await screen.findByText(/已带入房源/)).toBeInTheDocument();
    fireEvent.mouseDown(screen.getByLabelText('租客'));
    const tenantOption = (await screen.findAllByText('张房东 / 13800000000')).at(-1);
    expect(tenantOption).toBeDefined();
    fireEvent.click(tenantOption as HTMLElement);
    fireEvent.change(screen.getByLabelText('起租日期'), { target: { value: '2026-07-01' } });
    fireEvent.change(screen.getByLabelText('到期日期'), { target: { value: '2027-06-30' } });
    fireEvent.change(screen.getByLabelText('月租'), { target: { value: '4200' } });
    fireEvent.click(screen.getByRole('button', { name: /保\s*存/ }));

    await waitFor(() => expect(mockCreateLease).toHaveBeenCalledWith(expect.objectContaining({
      house_id: 99,
      start_date: '2026-07-01',
    })));
    await waitFor(() => expect(mockListLeases).toHaveBeenCalledWith(expect.objectContaining({ house_id: 99 })));
  });
});
