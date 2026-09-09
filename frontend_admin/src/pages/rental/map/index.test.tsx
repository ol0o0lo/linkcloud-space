import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PropertyRentalMapPage from './index';
import { readMapSearchState, sameBounds } from './map-state';

const {
  mockGetBuildingMapDetail,
  mockListBuildingMap,
  mockListBuildingMapUnlocated,
  mockListEstateMap,
  mockListHouses,
} = vi.hoisted(() => ({
  mockGetBuildingMapDetail: vi.fn(),
  mockListBuildingMap: vi.fn(),
  mockListBuildingMapUnlocated: vi.fn(),
  mockListEstateMap: vi.fn(),
  mockListHouses: vi.fn(),
}));

vi.mock('@umijs/max', () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));

vi.mock('@/pages/space/shared', () => ({
  TenantSelectionGuard: ({ children }: { children: ReactNode }) => (
    <>{children}</>
  ),
  useTenantWorkspace: () => ({ selectedOrgSlug: 'demo' }),
}));

vi.mock('@/services/manual/amap', () => ({
  useAmap: () => ({
    AMap: undefined,
    loading: false,
    error: undefined,
    reload: vi.fn(),
  }),
}));

vi.mock('@/services/manual/house', () => ({
  houseApi: {
    getBuildingMapDetail: mockGetBuildingMapDetail,
    listBuildingMap: mockListBuildingMap,
    listBuildingMapUnlocated: mockListBuildingMapUnlocated,
    listEstateMap: mockListEstateMap,
    listHouses: mockListHouses,
  },
}));

vi.mock('@/services/openapi/organizationSettings', () => ({
  appsSettingsApiListOrgSettings: vi.fn().mockResolvedValue([]),
}));

beforeEach(() => {
  window.history.replaceState(
    {},
    '',
    '/dashboard/rental/properties/map?selected_building_id=9&house_status=vacant',
  );
  window.localStorage.clear();
  mockGetBuildingMapDetail.mockResolvedValue({
    id: 9,
    name: '1栋',
    address: '云栖路 88 号',
    lat: '23.13',
    lng: '113.36',
    counts: { total: 1, vacant: 1, listed: 0, rented: 0, renovating: 0 },
  });
  mockListBuildingMap.mockResolvedValue({
    items: [],
    total: 0,
    page: 1,
    page_size: 500,
  });
  mockListBuildingMapUnlocated.mockResolvedValue({
    items: [],
    total: 0,
    page: 1,
    page_size: 5,
  });
  mockListEstateMap.mockResolvedValue({
    items: [],
    total: 0,
    page: 1,
    page_size: 500,
  });
  mockListHouses.mockResolvedValue({
    items: [],
    total: 0,
    page: 1,
    page_size: 8,
  });
});

describe('PropertyRentalMapPage', () => {
  it('辅助侧栏默认收起并保留用户主动展开的偏好', async () => {
    const renderPage = () =>
      render(
        <QueryClientProvider
          client={
            new QueryClient({
              defaultOptions: { queries: { retry: false } },
            })
          }
        >
          <PropertyRentalMapPage />
        </QueryClientProvider>,
      );

    const firstRender = renderPage();
    expect(
      await screen.findByRole('button', { name: '展开空置房源结果' }),
    ).toBeInTheDocument();
    firstRender.unmount();

    window.localStorage.setItem(
      'property-rental-map:result-panel-collapsed',
      'false',
    );
    renderPage();
    expect(
      await screen.findByRole('button', { name: '收起房源结果' }),
    ).toBeInTheDocument();
  });

  it('选中楼栋后按楼栋和当前房态加载房源预览', async () => {
    render(
      <QueryClientProvider
        client={
          new QueryClient({
            defaultOptions: { queries: { retry: false } },
          })
        }
      >
        <PropertyRentalMapPage />
      </QueryClientProvider>,
    );

    await waitFor(() =>
      expect(mockListHouses).toHaveBeenCalledWith({
        building_id: 9,
        status: 'vacant',
        page: 1,
        page_size: 8,
      }),
    );
  });
});

describe('readMapSearchState', () => {
  it('仅接受有效的地图筛选与资源 ID', () => {
    expect(
      readMapSearchState(
        '?keyword=云岸&estate_id=12&house_status=vacant&selected_building_id=8',
      ),
    ).toEqual({
      keyword: '云岸',
      estateId: 12,
      houseStatus: 'vacant',
      selectedBuildingId: 8,
    });
    expect(
      readMapSearchState('?estate_id=-1&selected_building_id=x'),
    ).toMatchObject({ estateId: undefined, selectedBuildingId: undefined });
  });

  it('读取有效地图视口并拒绝非法缩放', () => {
    expect(
      readMapSearchState('?center_lat=22.54&center_lng=113.93&zoom=15')
        .viewport,
    ).toEqual({ lat: 22.54, lng: 113.93, zoom: 15 });
    expect(
      readMapSearchState('?center_lat=22.54&center_lng=113.93&zoom=99')
        .viewport,
    ).toBeUndefined();
  });

  it('相同地图边界不触发重复刷新', () => {
    const bounds = { west: 113.9, south: 22.5, east: 114, north: 22.6 };

    expect(sameBounds(bounds, { ...bounds, east: 114.000001 })).toBe(true);
    expect(sameBounds(bounds, { ...bounds, east: 114.01 })).toBe(false);
  });
});
