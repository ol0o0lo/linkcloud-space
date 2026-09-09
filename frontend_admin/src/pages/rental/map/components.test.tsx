import { fireEvent, render, screen } from '@testing-library/react';
import type { AnchorHTMLAttributes, ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type {
  BuildingMapMarkerOut,
  BuildingMapUnlocatedOut,
  HouseOut,
} from '@/services/manual/house';
import {
  BuildingResultPanel,
  EstateResultPanel,
  MapToolbar,
} from './components';
import type { EstateMapDisplayPoint } from './map-display';

vi.mock('@umijs/max', () => ({
  Link: ({
    children,
    to,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & {
    children: ReactNode;
    to: string;
  }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

const counts = {
  total: 18,
  vacant: 13,
  listed: 4,
  rented: 1,
  renovating: 0,
};

const estatePoint: EstateMapDisplayPoint = {
  key: 'estate:2',
  kind: 'estate',
  resourceId: 2,
  estateId: 2,
  name: '云栖花园',
  address: '云栖路 88 号',
  lat: 23.13,
  lng: 113.36,
  locationSource: 'estate',
  buildingCount: 6,
  locatedBuildingCount: 6,
  unlocatedBuildingCount: 0,
  counts,
};

const building: BuildingMapMarkerOut = {
  id: 9,
  estate: { id: 2, name: '云栖花园', display_name: '云栖花园' },
  name: '1栋',
  address: '云栖路 88 号',
  lat: '23.13',
  lng: '113.36',
  counts: { total: 3, vacant: 1, listed: 2, rented: 0, renovating: 0 },
};

const house = {
  id: 91,
  building_id: building.id,
  room_number: '1001',
  floor: 10,
  area: '32.50',
  asking_rent: '4500.00',
  bedrooms: 1,
  living_rooms: 0,
  status: 'vacant',
  status__mapping: '空置',
} as HouseOut;

const unlocatedBuildings = Array.from({ length: 6 }, (_, index) => ({
  id: 20 + index,
  estate: { id: 2, name: '云栖花园', display_name: '云栖花园' },
  name: `${index + 1}栋`,
  address: `云栖路 ${88 + index} 号`,
  counts,
})) as BuildingMapUnlocatedOut[];

describe('MapToolbar', () => {
  it('只在提交搜索时生效，并提供空置、招租、全部快捷切换', () => {
    const onKeywordChange = vi.fn();
    const onKeywordSearch = vi.fn();
    const onHouseStatusChange = vi.fn();

    const { rerender } = render(
      <MapToolbar
        keyword=""
        houseStatus="vacant"
        counts={{
          levelLabel: '楼栋',
          located: 6,
          buildings: 6,
          unlocated: 1,
          ...counts,
        }}
        updating={false}
        onKeywordChange={onKeywordChange}
        onKeywordSearch={onKeywordSearch}
        onHouseStatusChange={onHouseStatusChange}
      />,
    );

    const input = screen.getByPlaceholderText('搜索小区、楼栋或地址');
    fireEvent.change(input, { target: { value: '云岸' } });
    expect(onKeywordChange).toHaveBeenCalledWith('云岸');
    expect(onKeywordSearch).not.toHaveBeenCalled();

    rerender(
      <MapToolbar
        keyword="云岸"
        houseStatus="vacant"
        counts={{
          levelLabel: '楼栋',
          located: 6,
          buildings: 6,
          unlocated: 1,
          ...counts,
        }}
        updating={false}
        onKeywordChange={onKeywordChange}
        onKeywordSearch={onKeywordSearch}
        onHouseStatusChange={onHouseStatusChange}
      />,
    );

    fireEvent.keyDown(screen.getByPlaceholderText('搜索小区、楼栋或地址'), {
      key: 'Enter',
      code: 'Enter',
    });
    expect(onKeywordSearch.mock.calls[0]?.[0]).toBe('云岸');
    fireEvent.click(screen.getByText('招租'));
    fireEvent.click(screen.getByText('全部'));
    expect(onHouseStatusChange).toHaveBeenNthCalledWith(1, 'listed');
    expect(onHouseStatusChange).toHaveBeenNthCalledWith(2, undefined);
    expect(screen.getByText(/13 套空置 · 6 栋/)).toBeInTheDocument();
  });
});

describe('任务侧栏', () => {
  it('收起后仍展示当前任务摘要', () => {
    render(
      <EstateResultPanel
        points={[estatePoint]}
        houseStatus="vacant"
        collapsed
        loading={false}
        error={false}
        truncated={false}
        onSelect={vi.fn()}
        onToggleCollapsed={vi.fn()}
        onRetry={vi.fn()}
      />,
    );

    expect(
      screen.getByRole('button', { name: '展开空置房源结果' }),
    ).toHaveTextContent('空置 13 套');
  });

  it('选中楼栋后以紧凑楼栋上下文承接房源明细', () => {
    render(
      <BuildingResultPanel
        located={[building]}
        unlocated={[]}
        unlocatedTotal={0}
        collapsed={false}
        selectedId={building.id}
        selectedBuilding={building}
        houseStatus="vacant"
        loading={false}
        truncated={false}
        locatedError={false}
        unlocatedError={false}
        houses={[house]}
        houseTotal={1}
        housesLoading={false}
        housesError={false}
        returnTo="/dashboard/rental/properties/map?house_status=vacant"
        pendingListHref="/rental/properties/list?asset_issue=building_location"
        onSelect={vi.fn()}
        onBack={vi.fn()}
        onToggleCollapsed={vi.fn()}
        onRetryLocated={vi.fn()}
        onRetryUnlocated={vi.fn()}
        onRetryHouses={vi.fn()}
      />,
    );

    expect(screen.getByRole('heading', { name: '1栋' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: '返回楼栋列表' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('楼栋任务详情')).not.toBeInTheDocument();
    expect(screen.getByText('云栖花园 · 共 3 套房源')).toBeInTheDocument();
    expect(screen.queryByText('装修 0')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: '空置 1 套' }),
    ).not.toBeInTheDocument();
    const allHousesLink = screen.getByRole('link', {
      name: '查看 1栋 的空置房源列表',
    });
    expect(allHousesLink).toHaveAttribute(
      'href',
      '/rental/properties/list?building_id=9&status=vacant',
    );
    expect(allHousesLink).toHaveAttribute('target', '_blank');
    expect(allHousesLink).toHaveAttribute('rel', 'noreferrer');
    expect(
      allHousesLink.querySelector('.anticon-unordered-list'),
    ).toBeInTheDocument();
    expect(allHousesLink.querySelector('.anticon-export')).toBeInTheDocument();

    const buildingDetailLink = screen.getByRole('link', {
      name: '楼栋详情',
    });
    expect(buildingDetailLink).toHaveAttribute('target', '_blank');
    expect(buildingDetailLink).toHaveAttribute('rel', 'noreferrer');
    expect(
      buildingDetailLink.querySelector('.anticon-bank'),
    ).toBeInTheDocument();
    expect(
      buildingDetailLink.querySelector('.anticon-export'),
    ).toBeInTheDocument();

    const editLocationLink = screen.getByRole('link', {
      name: '编辑位置',
    });
    expect(editLocationLink).toHaveAttribute('target', '_blank');
    expect(editLocationLink).toHaveAttribute('rel', 'noreferrer');
    expect(
      editLocationLink.querySelector('.anticon-environment'),
    ).toBeInTheDocument();
    expect(
      editLocationLink.querySelector('.anticon-export'),
    ).toBeInTheDocument();
    expect(screen.getByText('房源明细')).toBeInTheDocument();
    const houseDetailLink = screen.getByRole('link', {
      name: '查看房源 1001',
    });
    expect(houseDetailLink).toHaveAttribute('href', '/rental/properties/91');
    expect(houseDetailLink).toHaveAttribute('target', '_blank');
    expect(houseDetailLink).toHaveAttribute('rel', 'noreferrer');
    expect(houseDetailLink.querySelector('.anticon-home')).toBeInTheDocument();
    expect(
      houseDetailLink.querySelector('.anticon-export'),
    ).toBeInTheDocument();
    expect(houseDetailLink).toHaveTextContent('¥4500.00 / 月');
    fireEvent.mouseEnter(houseDetailLink);
    expect(houseDetailLink.style.background).toBe('#e6f4ff');
    expect(screen.getByText('单间')).toBeInTheDocument();
    expect(screen.getByText('32.50㎡')).toBeInTheDocument();
    expect(screen.getByText('¥4500.00 / 月')).toBeInTheDocument();
    expect(screen.getByText('空置')).toBeInTheDocument();
  });

  it('房源预览加载失败时提供局部重试', () => {
    const onRetryHouses = vi.fn();

    render(
      <BuildingResultPanel
        located={[building]}
        unlocated={[]}
        unlocatedTotal={0}
        collapsed={false}
        selectedId={building.id}
        selectedBuilding={building}
        houseStatus="vacant"
        loading={false}
        truncated={false}
        locatedError={false}
        unlocatedError={false}
        houses={[]}
        houseTotal={0}
        housesLoading={false}
        housesError
        returnTo="/dashboard/rental/properties/map?house_status=vacant"
        pendingListHref="/rental/properties/list?asset_issue=building_location"
        onSelect={vi.fn()}
        onBack={vi.fn()}
        onToggleCollapsed={vi.fn()}
        onRetryLocated={vi.fn()}
        onRetryUnlocated={vi.fn()}
        onRetryHouses={onRetryHouses}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '重新加载房源' }));
    expect(onRetryHouses).toHaveBeenCalledTimes(1);
  });

  it('当前房态没有房源时可直接查看全部房态', () => {
    const onShowAllStatuses = vi.fn();

    render(
      <BuildingResultPanel
        located={[building]}
        unlocated={[]}
        unlocatedTotal={0}
        collapsed={false}
        selectedId={building.id}
        selectedBuilding={building}
        houseStatus="vacant"
        loading={false}
        truncated={false}
        locatedError={false}
        unlocatedError={false}
        houses={[]}
        houseTotal={0}
        housesLoading={false}
        housesError={false}
        returnTo="/dashboard/rental/properties/map?house_status=vacant"
        pendingListHref="/rental/properties/list?asset_issue=building_location"
        onSelect={vi.fn()}
        onBack={vi.fn()}
        onToggleCollapsed={vi.fn()}
        onRetryLocated={vi.fn()}
        onRetryUnlocated={vi.fn()}
        onRetryHouses={vi.fn()}
        onShowAllStatuses={onShowAllStatuses}
      />,
    );

    expect(screen.getByText('当前筛选下暂无房源')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '查看全部房态' }));
    expect(onShowAllStatuses).toHaveBeenCalledTimes(1);
  });

  it('房源预览加载中时保留明确的局部状态', () => {
    render(
      <BuildingResultPanel
        located={[building]}
        unlocated={[]}
        unlocatedTotal={0}
        collapsed={false}
        selectedId={building.id}
        selectedBuilding={building}
        houseStatus="vacant"
        loading={false}
        truncated={false}
        locatedError={false}
        unlocatedError={false}
        houses={[]}
        houseTotal={0}
        housesLoading
        housesError={false}
        returnTo="/dashboard/rental/properties/map?house_status=vacant"
        pendingListHref="/rental/properties/list?asset_issue=building_location"
        onSelect={vi.fn()}
        onBack={vi.fn()}
        onToggleCollapsed={vi.fn()}
        onRetryLocated={vi.fn()}
        onRetryUnlocated={vi.fn()}
        onRetryHouses={vi.fn()}
      />,
    );

    expect(screen.getByText('房源加载中')).toBeInTheDocument();
  });

  it('楼栋列表只突出当前任务指标，不平铺全部房态', () => {
    render(
      <BuildingResultPanel
        located={[building]}
        unlocated={[]}
        unlocatedTotal={0}
        collapsed={false}
        houseStatus="vacant"
        loading={false}
        truncated={false}
        locatedError={false}
        unlocatedError={false}
        houses={[]}
        houseTotal={0}
        housesLoading={false}
        housesError={false}
        returnTo="/dashboard/rental/properties/map?house_status=vacant"
        pendingListHref="/rental/properties/list?asset_issue=building_location"
        onSelect={vi.fn()}
        onToggleCollapsed={vi.fn()}
        onRetryLocated={vi.fn()}
        onRetryUnlocated={vi.fn()}
        onRetryHouses={vi.fn()}
      />,
    );

    expect(screen.getByText('空置 1 套')).toBeInTheDocument();
    expect(screen.queryByText('招租 2')).not.toBeInTheDocument();
    expect(screen.queryByText('已租 0')).not.toBeInTheDocument();
  });

  it('待定位入口使用定位和列表图标并在新标签页打开', () => {
    render(
      <BuildingResultPanel
        located={[building]}
        unlocated={unlocatedBuildings}
        unlocatedTotal={unlocatedBuildings.length}
        collapsed={false}
        houseStatus="vacant"
        loading={false}
        truncated={false}
        locatedError={false}
        unlocatedError={false}
        houses={[]}
        houseTotal={0}
        housesLoading={false}
        housesError={false}
        returnTo="/dashboard/rental/properties/map?house_status=vacant"
        pendingListHref="/rental/properties/list?asset_issue=building_location"
        onSelect={vi.fn()}
        onToggleCollapsed={vi.fn()}
        onRetryLocated={vi.fn()}
        onRetryUnlocated={vi.fn()}
        onRetryHouses={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /待定位楼栋 6/ }));

    for (const link of screen.getAllByRole('link', { name: '立即定位' })) {
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noreferrer');
      expect(link.querySelector('.anticon-environment')).toBeInTheDocument();
    }

    const pendingListLink = screen.getByRole('link', {
      name: '查看全部 6 栋待定位楼栋',
    });
    expect(pendingListLink).toHaveAttribute('target', '_blank');
    expect(pendingListLink).toHaveAttribute('rel', 'noreferrer');
    expect(
      pendingListLink.querySelector('.anticon-unordered-list'),
    ).toBeInTheDocument();
  });
});
