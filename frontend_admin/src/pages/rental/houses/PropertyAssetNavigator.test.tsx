// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { houseApi } from '@/services/manual/house';
import { PropertyAssetNavigator } from './PropertyAssetNavigator';

const { mockHistoryPush } = vi.hoisted(() => ({
  mockHistoryPush: vi.fn(),
}));

vi.mock('@umijs/max', () => ({
  history: { push: mockHistoryPush },
}));

vi.mock('@/services/manual/house', () => ({
  houseApi: {
    getBuilding: vi.fn(),
    listBuildings: vi.fn(),
    listEstates: vi.fn(),
  },
}));

const mockedHouseApi = vi.mocked(houseApi);

function renderNavigator(
  onScopeChange = vi.fn(),
  onOpenManagement = vi.fn(),
  scope = {},
  collapsed = false,
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <PropertyAssetNavigator
        collapsed={collapsed}
        enabled
        orgSlug="demo"
        scope={scope}
        onOpenManagement={onOpenManagement}
        onScopeChange={onScopeChange}
      />
    </QueryClientProvider>,
  );
}

describe('PropertyAssetNavigator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    mockedHouseApi.listEstates.mockResolvedValue({
      items: [
        {
          id: 1,
          name: '星河湾',
          display_name: '星河湾',
          building_count: 2,
          counts: {
            total: 42,
            vacant: 4,
            listed: 6,
            rented: 30,
            renovating: 2,
          },
        } as never,
      ],
      total: 1,
      page: 1,
      page_size: 30,
    });
    mockedHouseApi.listBuildings.mockResolvedValue({
      items: [
        {
          id: 2,
          estate_id: 1,
          estate: { id: 1, name: '星河湾', display_name: '星河湾' },
          name: '1栋',
          address: '幸福路 18 号',
          elevator: true,
          counts: {
            total: 24,
            vacant: 2,
            listed: 4,
            rented: 18,
            renovating: 0,
          },
        } as never,
      ],
      total: 1,
      page: 1,
      page_size: 500,
    });
    mockedHouseApi.getBuilding.mockResolvedValue({
      id: 2,
      estate_id: 1,
      estate: { id: 1, name: '星河湾', display_name: '星河湾' },
      name: '1栋',
    } as never);
  });

  it('decorates the house scope heading with a hidden house icon', async () => {
    const { container } = renderNavigator();

    expect(await screen.findByText('房源范围')).toBeInTheDocument();
    expect(
      container.querySelector('[data-scope-heading-icon="true"]'),
    ).toHaveAttribute('aria-hidden', 'true');
  });

  it('only loads all buildings after an estate is expanded', async () => {
    renderNavigator();

    expect(await screen.findByText('星河湾')).toBeInTheDocument();
    expect(mockedHouseApi.listBuildings).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: '展开星河湾' }));

    expect(await screen.findByText('1栋')).toBeInTheDocument();
    expect(mockedHouseApi.listBuildings).toHaveBeenCalledWith({
      estate_id: 1,
      page: 1,
      page_size: 500,
    });
  });

  it('selects estate and building scopes independently', async () => {
    const onScopeChange = vi.fn();
    renderNavigator(onScopeChange);

    fireEvent.click(
      await screen.findByRole('button', { name: '选择项目 星河湾' }),
    );
    expect(onScopeChange).toHaveBeenLastCalledWith({ estateId: 1 });

    fireEvent.click(
      await screen.findByRole('button', { name: '选择楼栋 星河湾 / 1栋' }),
    );
    expect(onScopeChange).toHaveBeenLastCalledWith({ buildingId: 2 });
  });

  it('clears the scope and collapses the estate when its selected label is clicked again', async () => {
    const onScopeChange = vi.fn();
    renderNavigator(onScopeChange, vi.fn(), { estateId: 1 });

    const estateButton = await screen.findByRole('button', {
      name: '选择项目 星河湾',
    });
    expect(
      await screen.findByRole('button', { name: '选择楼栋 星河湾 / 1栋' }),
    ).toBeInTheDocument();

    fireEvent.click(estateButton);

    expect(onScopeChange).toHaveBeenLastCalledWith({});
    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: '选择楼栋 星河湾 / 1栋' }),
      ).not.toBeInTheDocument(),
    );
  });

  it('marks the active scope with aria-current', async () => {
    const allHousesView = renderNavigator();

    expect(screen.getByRole('button', { name: '全部房源' })).toHaveAttribute(
      'aria-current',
      'page',
    );

    allHousesView.unmount();
    renderNavigator(vi.fn(), vi.fn(), { estateId: 1 });

    expect(
      await screen.findByRole('button', { name: '选择项目 星河湾' }),
    ).toHaveAttribute('aria-current', 'page');
    expect(
      screen.getByRole('button', { name: '全部房源' }),
    ).not.toHaveAttribute('aria-current');
  });

  it('collapses the previous estate when another estate is selected', async () => {
    mockedHouseApi.listEstates.mockResolvedValue({
      items: [
        {
          id: 1,
          name: '星河湾',
          display_name: '星河湾',
          building_count: 1,
        } as never,
        {
          id: 8,
          name: '云栖花园',
          display_name: '云栖花园',
          building_count: 1,
        } as never,
      ],
      total: 2,
      page: 1,
      page_size: 30,
    });
    mockedHouseApi.listBuildings.mockImplementation((params) => {
      const estateId = params?.estate_id;
      return Promise.resolve({
        items: [
          {
            id: estateId === 1 ? 2 : 9,
            estate_id: estateId,
            name: estateId === 1 ? '1栋' : '3栋',
          } as never,
        ],
        total: 1,
        page: 1,
        page_size: 500,
      });
    });
    renderNavigator();

    fireEvent.click(
      await screen.findByRole('button', { name: '选择项目 星河湾' }),
    );
    expect(
      await screen.findByRole('button', { name: '选择楼栋 星河湾 / 1栋' }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '选择项目 云栖花园' }));

    expect(
      await screen.findByRole('button', { name: '选择楼栋 云栖花园 / 3栋' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: '选择楼栋 星河湾 / 1栋' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: '展开星河湾' }),
    ).toBeInTheDocument();
  });

  it('opens the integrated project and building manager', async () => {
    const onOpenManagement = vi.fn();
    renderNavigator(vi.fn(), onOpenManagement);

    fireEvent.click(
      await screen.findByRole('button', { name: '管理项目与楼栋' }),
    );

    await waitFor(() => expect(onOpenManagement).toHaveBeenCalledTimes(1));
  });

  it('searches estates and buildings on the server', async () => {
    mockedHouseApi.listEstates.mockImplementation((params) =>
      Promise.resolve({
        items: params?.keyword
          ? [
              {
                id: 8,
                name: '云栖花园',
                display_name: '云栖花园',
              } as never,
            ]
          : [],
        total: params?.keyword ? 1 : 0,
        page: 1,
        page_size: Number(params?.page_size || 30),
      }),
    );
    mockedHouseApi.listBuildings.mockResolvedValue({
      items: [
        {
          id: 9,
          estate_id: 8,
          estate: { id: 8, name: '云栖花园', display_name: '云栖花园' },
          name: '3栋',
        } as never,
      ],
      total: 1,
      page: 1,
      page_size: 50,
    });
    renderNavigator();

    fireEvent.change(screen.getByLabelText('搜索项目或楼栋'), {
      target: { value: '云栖' },
    });
    fireEvent.keyDown(
      screen.getByRole('combobox', { name: '搜索项目或楼栋' }),
      {
        key: 'Enter',
        code: 'Enter',
      },
    );

    expect(
      await screen.findByRole('button', { name: '选择项目 云栖花园' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: '选择楼栋 云栖花园 / 3栋' }),
    ).toBeInTheDocument();
    expect(mockedHouseApi.listEstates).toHaveBeenCalledWith({
      keyword: '云栖',
      page: 1,
      page_size: 50,
    });
    expect(mockedHouseApi.listBuildings).toHaveBeenCalledWith({
      keyword: '云栖',
      page: 1,
      page_size: 50,
    });
  });

  it('offers contextual create actions for estates and buildings', async () => {
    const onOpenManagement = vi.fn();
    renderNavigator(vi.fn(), onOpenManagement);

    fireEvent.click(
      await screen.findByRole('button', { name: '新建星河湾楼栋' }),
    );
    expect(onOpenManagement).toHaveBeenCalledWith({
      buildingCreateEstateId: 1,
    });

    fireEvent.click(screen.getByRole('button', { name: '展开星河湾' }));
    fireEvent.click(
      await screen.findByRole('button', { name: '在星河湾 / 1栋下新建房源' }),
    );
    expect(mockHistoryPush).toHaveBeenCalledWith(
      '/rental/properties/new?building_id=2',
    );
  });

  it('shows a compact empty state when an estate has no buildings', async () => {
    mockedHouseApi.listBuildings.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      page_size: 500,
    });
    renderNavigator();

    fireEvent.click(await screen.findByRole('button', { name: '展开星河湾' }));

    expect(await screen.findByText('暂无楼栋')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: '在星河湾下新建楼栋' }),
    ).not.toBeInTheDocument();
  });

  it('offers contextual edit actions for estates and buildings', async () => {
    const onOpenManagement = vi.fn();
    renderNavigator(vi.fn(), onOpenManagement);

    fireEvent.click(
      await screen.findByRole('button', { name: '编辑星河湾项目' }),
    );
    expect(onOpenManagement).toHaveBeenCalledWith({ estateEditId: 1 });

    fireEvent.click(screen.getByRole('button', { name: '展开星河湾' }));
    fireEvent.click(
      await screen.findByRole('button', { name: '编辑星河湾 / 1栋' }),
    );
    expect(onOpenManagement).toHaveBeenCalledWith({ buildingEditId: 2 });
  });

  it('offers top-level project and standalone-building creation', async () => {
    const onOpenManagement = vi.fn();
    renderNavigator(vi.fn(), onOpenManagement);

    fireEvent.click(await screen.findByRole('button', { name: '新建项目' }));
    expect(onOpenManagement).toHaveBeenCalledWith({ estateCreate: true });

    fireEvent.click(screen.getByRole('button', { name: '新建独立楼栋' }));
    expect(onOpenManagement).toHaveBeenCalledWith({
      buildingCreateStandalone: true,
    });
  });

  it('shows recently used scopes only from the search history dropdown', async () => {
    const onScopeChange = vi.fn();
    renderNavigator(onScopeChange);
    const searchInput = screen.getByRole('combobox', {
      name: '搜索项目或楼栋',
    });

    fireEvent.click(
      await screen.findByRole('button', { name: '选择项目 星河湾' }),
    );
    expect(screen.queryByText('最近使用')).not.toBeInTheDocument();

    fireEvent.focus(searchInput);

    expect(await screen.findByText('最近使用')).toBeInTheDocument();
    const historyOption = screen.getByRole('option', { name: /星河湾/ });
    fireEvent.click(historyOption);
    expect(onScopeChange).toHaveBeenLastCalledWith({ estateId: 1 });

    fireEvent.focus(searchInput);
    expect(await screen.findByText('最近使用')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '清除搜索历史' }));

    await waitFor(() => {
      expect(searchInput).toHaveAttribute('aria-expanded', 'false');
      expect(
        window.localStorage.getItem(
          'ui.property-rental.asset-navigator.recent.demo',
        ),
      ).toBeNull();
    });

    fireEvent.blur(searchInput);
    fireEvent.focus(searchInput);
    expect(searchInput).toHaveAttribute('aria-expanded', 'false');
  });

  it('loads standalone buildings only after the standalone section expands', async () => {
    mockedHouseApi.listBuildings.mockResolvedValue({
      items: [
        {
          id: 12,
          estate_id: null,
          estate: null,
          name: '科技路 88 号',
          counts: {
            total: 12,
            vacant: 2,
            listed: 3,
            rented: 7,
            renovating: 0,
          },
        } as never,
      ],
      total: 1,
      page: 1,
      page_size: 500,
    });
    renderNavigator();

    expect(mockedHouseApi.listBuildings).not.toHaveBeenCalled();
    fireEvent.click(
      await screen.findByRole('button', { name: '展开独立楼栋' }),
    );

    expect(await screen.findByText('科技路 88 号')).toBeInTheDocument();
    expect(mockedHouseApi.listBuildings).toHaveBeenCalledWith({
      page: 1,
      page_size: 500,
    });
  });

  it('preserves the current building scope in map and vacancy-sync shortcuts', async () => {
    renderNavigator(vi.fn(), vi.fn(), { buildingId: 2 });

    fireEvent.click(screen.getByRole('button', { name: '地图查看' }));
    expect(mockHistoryPush).toHaveBeenCalledWith(
      '/rental/properties/map?selected_building_id=2',
    );

    fireEvent.click(screen.getByRole('button', { name: '房态同步' }));
    expect(mockHistoryPush).toHaveBeenCalledWith(
      '/rental/properties/vacancy-sync?building_id=2',
    );
  });

  it('can collapse and restore the navigator', async () => {
    const { container } = renderNavigator(vi.fn(), vi.fn(), {}, true);

    expect(
      container.querySelector('[data-asset-navigator-collapsed="true"]'),
    ).toBeInTheDocument();
    expect(container.querySelector('aside')).toHaveAttribute(
      'aria-hidden',
      'true',
    );
  });
});
