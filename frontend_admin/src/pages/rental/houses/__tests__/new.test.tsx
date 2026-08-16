import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import HouseNewPage from '../new';

const { mockPush, mockListEstates, mockListBuildings, mockGetDefaultBuilding, mockSetDefaultBuilding, mockListContacts, mockCreateContact, mockCreateBuilding, mockCreateHouse, mockGetTagSuggestions, mockListOrgSettings } = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockListEstates: vi.fn(),
  mockListBuildings: vi.fn(),
  mockGetDefaultBuilding: vi.fn(),
  mockSetDefaultBuilding: vi.fn(),
  mockListContacts: vi.fn(),
  mockCreateContact: vi.fn(),
  mockCreateBuilding: vi.fn(),
  mockCreateHouse: vi.fn(),
  mockGetTagSuggestions: vi.fn(),
  mockListOrgSettings: vi.fn(),
}));

vi.mock('@umijs/max', () => ({
  history: { push: mockPush },
}));

vi.mock('@/pages/space/shared', () => ({
  TenantSelectionGuard: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useTenantWorkspace: () => ({ selectedOrgSlug: 'org', queryClient: new QueryClient() }),
}));

vi.mock('@/services/manual/house', () => ({
  houseApi: {
    listEstates: mockListEstates,
    listBuildings: mockListBuildings,
    getDefaultBuilding: mockGetDefaultBuilding,
    setDefaultBuilding: mockSetDefaultBuilding,
    listContacts: mockListContacts,
    createContact: mockCreateContact,
    createBuilding: mockCreateBuilding,
    createHouse: mockCreateHouse,
    getTagSuggestions: mockGetTagSuggestions,
  },
}));

vi.mock('@/services/openapi/organizationSettings', () => ({
  appsSettingsApiListOrgSettings: mockListOrgSettings,
}));

async function clickNextWhenEnabled() {
  const nextButton = screen.getByRole('button', { name: '下一步' });
  await waitFor(() => expect(nextButton).toBeEnabled());
  fireEvent.click(nextButton);
}

const estateSummary = { id: 1, name: 'xinghewan', display_name: '星河湾' };
const building1 = { id: 10, name: '1 栋', estate_id: 1, estate: estateSummary, floors: 20, address: '', tags: ['近地铁', '有电梯'] };
const building2 = { id: 11, name: '2 栋', estate_id: 1, estate: estateSummary, floors: 28, address: '', tags: ['近公园'] };

describe('House new page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPush.mockReset();
    window.history.pushState({}, '', '/');
    mockListEstates.mockResolvedValue({ items: [{ id: 1, name: 'xinghewan', display_name: '星河湾花园' }], total: 1, page: 1, page_size: 100 });
    mockListBuildings.mockResolvedValue({ items: [building1], total: 1, page: 1, page_size: 100 });
    mockGetDefaultBuilding.mockResolvedValue(building1);
    mockSetDefaultBuilding.mockResolvedValue(building2);
    mockListContacts.mockResolvedValue({ items: [{ id: 20, name: '张房东', phone: '13800000000', roles: ['landlord'] }], total: 1, page: 1, page_size: 100 });
    mockCreateContact.mockResolvedValue({ id: 21, name: '李房东', phone: '13900000000', roles: ['landlord'], is_active: true });
    mockCreateBuilding.mockResolvedValue(building2);
    mockCreateHouse.mockResolvedValue({ id: 99 });
    mockGetTagSuggestions.mockResolvedValue({ tags: ['采光好', '近地铁'] });
    mockListOrgSettings.mockResolvedValue([
      {
        key: 'property_rental.publish_rules',
        value: {
          landlord: { mode: 'required' },
          rent: { mode: 'required' },
          cover: { mode: 'warn' },
          images: { mode: 'warn', min_count: 3 },
          floor_plan: { mode: 'warn' },
          video: { mode: 'off', min_count: 1 },
        },
      },
    ]);
  });

  it('walks through a four-step wizard and creates a house draft without forcing a landlord', async () => {
    render(<QueryClientProvider client={new QueryClient()}><HouseNewPage /></QueryClientProvider>);

    await waitFor(() => expect(mockListBuildings).toHaveBeenCalledTimes(1));
    expect((await screen.findAllByText('星河湾 / 1 栋')).length).toBeGreaterThan(0);
    expect(screen.queryByText('关键提醒')).not.toBeInTheDocument();
    expect(screen.queryByText('详情承接')).not.toBeInTheDocument();
    expect(screen.queryByText('带看基础')).not.toBeInTheDocument();
    expect(screen.queryByText('发布准备')).not.toBeInTheDocument();
    expect(screen.queryByText('当前缺口清单')).not.toBeInTheDocument();
    expect(screen.getAllByText('建档').length).toBeGreaterThan(0);
    expect(screen.getAllByText('补充资料').length).toBeGreaterThan(0);
    expect(screen.getAllByText('媒体资料').length).toBeGreaterThan(0);
    expect(screen.getAllByText('确认保存').length).toBeGreaterThan(0);
    fireEvent.change(screen.getByLabelText('房号'), { target: { value: '1801' } });
    await clickNextWhenEnabled();
    await screen.findByText('补充挂牌与户型');
    expect(screen.getByText('挂牌信息')).toBeInTheDocument();
    expect(screen.getByText('户型与面积')).toBeInTheDocument();
    expect(screen.getByText('房源卖点')).toBeInTheDocument();
    expect(screen.queryByText('带看资料仍待补齐')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('挂牌租金'), { target: { value: '4200' } });
    await clickNextWhenEnabled();
    await screen.findByText('上传图片与视频');
    expect(screen.getByText('图片资料')).toBeInTheDocument();
    expect(screen.getByText('视频资料')).toBeInTheDocument();
    expect(screen.queryByText('发布检查仍有缺口')).not.toBeInTheDocument();
    await clickNextWhenEnabled();
    await screen.findByText('确认房源资料');
    expect(screen.queryByText('保存后建议动作')).not.toBeInTheDocument();
    expect(screen.getAllByText('待补房东').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: '保存并进入详情' }));

    await waitFor(() => expect(mockCreateHouse).toHaveBeenCalledWith(expect.objectContaining({
      building_id: 10,
      room_number: '1801',
      asking_rent: '4200',
    })));
    expect(mockCreateHouse.mock.calls.at(-1)?.[0]).not.toHaveProperty('landlord_id');
    expect(mockPush).toHaveBeenCalledWith('/rental/properties/99');
  });

  it('previews inherited building tags but submits only house-owned tags', async () => {
    render(<QueryClientProvider client={new QueryClient()}><HouseNewPage /></QueryClientProvider>);

    await screen.findAllByText('星河湾 / 1 栋');
    fireEvent.change(screen.getByLabelText('房号'), { target: { value: '1808' } });
    await clickNextWhenEnabled();

    const inherited = await screen.findByLabelText('继承标签');
    expect(within(inherited).getByText('近地铁')).toBeInTheDocument();
    expect(within(inherited).getByText('有电梯')).toBeInTheDocument();

    fireEvent.click(within(screen.getByLabelText('常用标签')).getByText('采光好'));
    await clickNextWhenEnabled();
    await screen.findByText('上传图片与视频');
    await clickNextWhenEnabled();
    await screen.findByText('确认房源资料');
    fireEvent.click(screen.getByRole('button', { name: '保存并进入详情' }));

    await waitFor(() => expect(mockCreateHouse).toHaveBeenCalledWith(expect.objectContaining({
      building_id: 10,
      room_number: '1808',
      tags: ['采光好'],
    })));
  });

  it('shows carried-in source context when entering from building and landlord flows', async () => {
    window.history.pushState({}, '', '/rental/properties/new?building_id=10&landlord_id=20');

    render(<QueryClientProvider client={new QueryClient()}><HouseNewPage /></QueryClientProvider>);

    expect((await screen.findAllByText('星河湾 / 1 栋')).length).toBeGreaterThan(0);
    expect(screen.getByText('已带入楼栋，当前建档会直接挂到这栋楼下。')).toBeInTheDocument();
    expect(screen.getByText('已带入房东，当前录入会沿用该出租方主体。')).toBeInTheDocument();
  });

  it('restores wizard step from URL search params', async () => {
    window.history.pushState({}, '', '/rental/properties/new?step=2');

    render(<QueryClientProvider client={new QueryClient()}><HouseNewPage /></QueryClientProvider>);

    expect(await screen.findByText('上传图片与视频')).toBeInTheDocument();
    expect(screen.getByText('图片资料')).toBeInTheDocument();
    expect(screen.queryByText('发布规则摘要')).not.toBeInTheDocument();
    expect(screen.queryByText('当前缺口清单')).not.toBeInTheDocument();
    expect(screen.queryByText('媒体状态')).not.toBeInTheDocument();
  });

  it('does not render the old sidebar helper copy', async () => {
    window.history.pushState({}, '', '/rental/properties/new?step=1');

    render(<QueryClientProvider client={new QueryClient()}><HouseNewPage /></QueryClientProvider>);

    expect(await screen.findByText('补充挂牌与户型')).toBeInTheDocument();
    expect(screen.queryByText('当前步骤重点')).not.toBeInTheDocument();
    expect(screen.queryByText('发布规则摘要')).not.toBeInTheDocument();
    expect(screen.queryByText('当前缺口清单')).not.toBeInTheDocument();
  });

  it('syncs wizard step back to URL', async () => {
    render(<QueryClientProvider client={new QueryClient()}><HouseNewPage /></QueryClientProvider>);

    expect((await screen.findAllByText('星河湾 / 1 栋')).length).toBeGreaterThan(0);
    fireEvent.change(screen.getByLabelText('房号'), { target: { value: '1801' } });
    await clickNextWhenEnabled();

    await screen.findByText('补充挂牌与户型');
    expect(window.location.search).toBe('?step=1');
  });

  it('keeps the user on step one when draft essentials are missing', async () => {
    render(<QueryClientProvider client={new QueryClient()}><HouseNewPage /></QueryClientProvider>);

    expect((await screen.findAllByText('星河湾 / 1 栋')).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: '下一步' })).toBeDisabled();
    expect(screen.getByText('选择楼栋与房东')).toBeInTheDocument();
    expect(screen.queryByText('先完成最小建档')).not.toBeInTheDocument();
  });

  it('uses the selected building when setting the default building', async () => {
    render(<QueryClientProvider client={new QueryClient()}><HouseNewPage /></QueryClientProvider>);

    expect((await screen.findAllByText('星河湾 / 1 栋')).length).toBeGreaterThan(0);

    const button = screen.getByRole('button', { name: '设为默认' });
    expect(button).toBeEnabled();

    fireEvent.click(button);

    await waitFor(() => expect(mockSetDefaultBuilding).toHaveBeenCalledWith(10));
  });

  it('shows landlord phone in the landlord selector', async () => {
    render(<QueryClientProvider client={new QueryClient()}><HouseNewPage /></QueryClientProvider>);

    expect((await screen.findAllByText('星河湾 / 1 栋')).length).toBeGreaterThan(0);
    fireEvent.mouseDown(screen.getByLabelText('房东'));

    expect((await screen.findAllByText('张房东 / 13800000000')).at(-1)).toBeDefined();
  });

  it('prefills landlord from query param', async () => {
    window.history.pushState({}, '', '/rental/properties/new?landlord_id=20');

    render(<QueryClientProvider client={new QueryClient()}><HouseNewPage /></QueryClientProvider>);

    expect((await screen.findAllByText('星河湾 / 1 栋')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('张房东 / 13800000000').length).toBeGreaterThan(0);
  });

  it('prefills building from query param', async () => {
    window.history.pushState({}, '', '/rental/properties/new?building_id=11');
    mockListBuildings.mockResolvedValue({
      items: [building1, building2],
      total: 2,
      page: 1,
      page_size: 100,
    });

    render(<QueryClientProvider client={new QueryClient()}><HouseNewPage /></QueryClientProvider>);

    expect((await screen.findAllByText('星河湾 / 2 栋')).length).toBeGreaterThan(0);
    fireEvent.change(screen.getByLabelText('房号'), { target: { value: '2801' } });
    await clickNextWhenEnabled();
    await screen.findByText('补充挂牌与户型');
    await clickNextWhenEnabled();
    await screen.findByText('上传图片与视频');
    await clickNextWhenEnabled();
    await screen.findByText('确认房源资料');
    fireEvent.click(screen.getByRole('button', { name: '保存并进入详情' }));

    await waitFor(() => expect(mockCreateHouse).toHaveBeenCalledWith(expect.objectContaining({
      building_id: 11,
      room_number: '2801',
    })));
  });

  it('does not auto-bind the first landlord when the user has not selected one', async () => {
    render(<QueryClientProvider client={new QueryClient()}><HouseNewPage /></QueryClientProvider>);

    expect((await screen.findAllByText('星河湾 / 1 栋')).length).toBeGreaterThan(0);
    fireEvent.change(screen.getByLabelText('房号'), { target: { value: '1901' } });
    await clickNextWhenEnabled();
    await screen.findByText('补充挂牌与户型');
    await clickNextWhenEnabled();
    await screen.findByText('上传图片与视频');
    await clickNextWhenEnabled();
    await screen.findByText('确认房源资料');
    expect(screen.getAllByText('待补房东').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: '保存并进入详情' }));

    await waitFor(() => expect(mockCreateHouse).toHaveBeenCalledWith(expect.not.objectContaining({
      landlord_id: 20,
    })));
  });

  it('treats warning-only media gaps as publishable under organization publish rules', async () => {
    window.history.pushState({}, '', '/rental/properties/new?landlord_id=20');

    render(<QueryClientProvider client={new QueryClient()}><HouseNewPage /></QueryClientProvider>);

    expect((await screen.findAllByText('星河湾 / 1 栋')).length).toBeGreaterThan(0);
    fireEvent.change(screen.getByLabelText('房号'), { target: { value: '1902' } });
    await clickNextWhenEnabled();
    await screen.findByText('补充挂牌与户型');
    fireEvent.change(screen.getByLabelText('挂牌租金'), { target: { value: '5200' } });
    await clickNextWhenEnabled();
    await screen.findByText('上传图片与视频');
    await clickNextWhenEnabled();

    expect(await screen.findByText('确认房源资料')).toBeInTheDocument();
    expect(screen.queryByText('保存后可直接进入发布流程')).not.toBeInTheDocument();
    expect(screen.queryByText('提醒项：缺封面、图片不足、缺户型图')).not.toBeInTheDocument();
    expect(screen.queryByText('阻断项：')).not.toBeInTheDocument();
  });

  it('keeps final step focused on the form summary', async () => {
    window.history.pushState({}, '', '/rental/properties/new?step=3');

    render(<QueryClientProvider client={new QueryClient()}><HouseNewPage /></QueryClientProvider>);

    expect(await screen.findByText('确认房源资料')).toBeInTheDocument();
    expect(screen.queryByText('发布规则摘要')).not.toBeInTheDocument();
    expect(screen.queryByText('当前缺口清单')).not.toBeInTheDocument();
    expect(screen.queryByText('媒体状态')).not.toBeInTheDocument();
    expect(screen.queryByText('基础必补：楼栋')).not.toBeInTheDocument();
    expect(screen.queryByText('当前摘要')).not.toBeInTheDocument();
  });

  it('allows saving a house as soon as the minimum fields are complete', async () => {
    render(<QueryClientProvider client={new QueryClient()}><HouseNewPage /></QueryClientProvider>);

    expect((await screen.findAllByText('星河湾 / 1 栋')).length).toBeGreaterThan(0);
    expect(screen.queryByText('当前步骤重点')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '保存房源' })).toBeDisabled();

    fireEvent.change(screen.getByLabelText('房号'), { target: { value: '1701' } });

    await waitFor(() => expect(screen.getByRole('button', { name: '保存房源' })).toBeEnabled());
    expect(screen.queryByText('当前已满足保存门槛')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '保存房源' }));

    await waitFor(() => expect(mockCreateHouse).toHaveBeenCalledWith(expect.objectContaining({
      building_id: 10,
      room_number: '1701',
    })));
    expect(mockPush).toHaveBeenCalledWith('/rental/properties/99');
  });

  it('creates a landlord from the house form and selects it', async () => {
    mockListContacts.mockResolvedValue({ items: [], total: 0, page: 1, page_size: 100 });
    render(<QueryClientProvider client={new QueryClient()}><HouseNewPage /></QueryClientProvider>);

    expect((await screen.findAllByText('星河湾 / 1 栋')).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: '新建房东' }));
    fireEvent.change(screen.getByLabelText('姓名'), { target: { value: '李房东' } });
    fireEvent.change(screen.getByLabelText('手机'), { target: { value: '13900000000' } });
    fireEvent.click(screen.getByRole('button', { name: '保存房东' }));

    await waitFor(() => expect(mockCreateContact).toHaveBeenCalledWith(expect.objectContaining({
      name: '李房东',
      phone: '13900000000',
      roles: ['landlord'],
      is_active: true,
    })));
    expect((await screen.findAllByText('李房东 / 13900000000')).length).toBeGreaterThan(0);

    fireEvent.change(screen.getByLabelText('房号'), { target: { value: '1802' } });
    await clickNextWhenEnabled();
    await screen.findByText('补充挂牌与户型');
    await clickNextWhenEnabled();
    await screen.findByText('上传图片与视频');
    await clickNextWhenEnabled();
    await screen.findByText('确认房源资料');
    fireEvent.click(screen.getByRole('button', { name: '保存并进入详情' }));

    await waitFor(() => expect(mockCreateHouse).toHaveBeenCalledWith(expect.objectContaining({
      building_id: 10,
      landlord_id: 21,
      room_number: '1802',
    })));
  });

  it('creates a building in a dialog from the first step of the wizard', async () => {
    render(<QueryClientProvider client={new QueryClient()}><HouseNewPage /></QueryClientProvider>);

    expect(screen.getByText('选择楼栋与房东')).toBeInTheDocument();
    expect((await screen.findAllByText('星河湾 / 1 栋')).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: '新建楼栋' }));
    fireEvent.mouseDown(screen.getByLabelText('项目小区'));
    expect((await screen.findAllByText('星河湾花园')).at(-1)).toBeDefined();
    expect(screen.queryByText('xinghewan')).not.toBeInTheDocument();
    fireEvent.click((await screen.findAllByText('星河湾花园')).at(-1) as HTMLElement);
    fireEvent.change(screen.getByLabelText('楼栋名'), { target: { value: '2 栋' } });
    fireEvent.change(screen.getByLabelText('楼层'), { target: { value: '28' } });
    fireEvent.click(screen.getByRole('button', { name: '保存楼栋' }));

    await waitFor(() => expect(mockCreateBuilding).toHaveBeenCalledWith(expect.objectContaining({
      estate_id: 1,
      name: '2 栋',
      floors: 28,
    })));
    expect(mockSetDefaultBuilding).toHaveBeenCalledWith(11);
    expect((await screen.findAllByText('星河湾 / 2 栋')).length).toBeGreaterThan(0);
  });

  it('creates a standalone building with its address', async () => {
    render(<QueryClientProvider client={new QueryClient()}><HouseNewPage /></QueryClientProvider>);

    await screen.findAllByText('星河湾 / 1 栋');
    fireEvent.click(screen.getByRole('button', { name: '新建楼栋' }));
    fireEvent.change(screen.getByLabelText('楼栋名'), { target: { value: '独栋' } });
    fireEvent.change(screen.getByLabelText('楼层'), { target: { value: '3' } });
    fireEvent.change(screen.getByLabelText('地址'), { target: { value: '科技路 88 号' } });
    fireEvent.click(screen.getByRole('button', { name: '保存楼栋' }));

    await waitFor(() => expect(mockCreateBuilding).toHaveBeenCalledWith(expect.objectContaining({
      estate_id: null,
      name: '独栋',
      floors: 3,
      address: '科技路 88 号',
    })));
  });

  it('requires an address when creating a standalone building', async () => {
    render(<QueryClientProvider client={new QueryClient()}><HouseNewPage /></QueryClientProvider>);

    await screen.findAllByText('星河湾 / 1 栋');
    fireEvent.click(screen.getByRole('button', { name: '新建楼栋' }));
    fireEvent.change(screen.getByLabelText('楼栋名'), { target: { value: '独栋' } });
    fireEvent.change(screen.getByLabelText('楼层'), { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: '保存楼栋' }));

    expect(await screen.findByText('非小区楼栋必须填写楼栋地址')).toBeInTheDocument();
    expect(mockCreateBuilding).not.toHaveBeenCalled();
  });
});
