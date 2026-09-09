import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PropertyRentalMapPage from './index';

const { mockUseAmap, listBuildingMap, listEstateMap, listHouses } = vi.hoisted(
  () => ({
    mockUseAmap: vi.fn(),
    listBuildingMap: vi.fn(),
    listEstateMap: vi.fn(),
    listHouses: vi.fn(),
  }),
);

vi.mock('@/services/manual/amap', () => ({ useAmap: mockUseAmap }));
vi.mock('@/pages/space/shared', () => ({
  TenantSelectionGuard: ({ children }: { children: ReactNode }) => (
    <>{children}</>
  ),
  useTenantWorkspace: () => ({ selectedOrgSlug: 'demo' }),
}));
vi.mock('./components', () => ({
  BuildingResultPanel: () => null,
  EstateResultPanel: () => null,
  MapToolbar: () => null,
}));
vi.mock('@/services/manual/house', () => ({
  houseApi: {
    listBuildingMap,
    listEstateMap,
    listHouses,
    listBuildingMapUnlocated: vi
      .fn()
      .mockResolvedValue({ items: [], total: 0 }),
  },
}));
vi.mock('@/services/openapi/organizationSettings', () => ({
  appsSettingsApiListOrgSettings: vi.fn().mockResolvedValue([]),
}));

const counts = { total: 1, vacant: 1, listed: 0, rented: 0, renovating: 0 };
const buildings = [
  { id: 1, name: 'A座', lat: '23.13', lng: '113.36', address: '', counts },
  { id: 2, name: 'B座', lat: '23.13', lng: '113.3605', address: '', counts },
  { id: 3, name: 'C座', lat: '23.13', lng: '113.38', address: '', counts },
];
const page = (items: typeof buildings) => ({
  items,
  total: items.length,
  page: 1,
  page_size: 500,
});

class Marker {
  static instances: Marker[] = [];
  content: HTMLDivElement;
  title: string;
  click?: () => void;
  setContent = vi.fn((content: HTMLDivElement) => {
    this.content = content;
  });
  setTitle = vi.fn((title: string) => {
    this.title = title;
  });
  setPosition = vi.fn();
  setAnchor = vi.fn();
  setzIndex = vi.fn();
  constructor(options: { content: HTMLDivElement; title: string }) {
    this.content = options.content;
    this.title = options.title;
    Marker.instances.push(this);
  }
  on(event: string, callback: () => void) {
    if (event === 'click') this.click = callback;
  }
}

function createMap(zoom = 16, sdkCluster = false) {
  const listeners = new Map<string, () => void>();
  const overlays = new Set<Marker>();
  const map = {
    zoom,
    on: vi.fn((event: string, callback: () => void) =>
      listeners.set(event, callback),
    ),
    addControl: vi.fn(),
    add: vi.fn((markers: Marker[]) => {
      for (const marker of markers) overlays.add(marker);
    }),
    remove: vi.fn((marker: Marker) => {
      overlays.delete(marker);
    }),
    clearMap: vi.fn(),
    destroy: vi.fn(),
    getZoom: () => map.zoom,
    getCenter: () => ({ lng: 113.36, lat: 23.13 }),
    getBounds: () => ({
      getSouthWest: () => ({ lng: 113.3, lat: 23.1 }),
      getNorthEast: () => ({ lng: 113.4, lat: 23.2 }),
    }),
    lngLatToContainer: ({ lng, lat }: { lng: number; lat: number }) => ({
      x: (lng - 113.36) * 100000 * 2 ** (map.zoom - 16),
      y: (lat - 23.13) * 100000 * 2 ** (map.zoom - 16),
    }),
    getFitZoomAndCenterByBounds: vi
      .fn()
      .mockReturnValue([20, { lng: 113.36025, lat: 23.13 }]),
    setZoomAndCenter: vi.fn(),
  };
  const cluster = { on: vi.fn(), setMap: vi.fn() };
  const MarkerCluster = vi.fn(function MockMarkerCluster() {
    return cluster;
  });
  mockUseAmap.mockReturnValue({
    AMap: {
      Map: vi.fn(function MockMap() {
        return map;
      }),
      Marker,
      Scale: class {},
      ToolBar: class {},
      Bounds: class {
        constructor(
          public southWest: number[],
          public northEast: number[],
        ) {}
      },
      LngLat: class {
        constructor(
          public lng: number,
          public lat: number,
        ) {}
      },
      ...(sdkCluster ? { MarkerCluster } : {}),
    },
    loading: false,
  });
  window.history.replaceState(
    {},
    '',
    `/dashboard/rental/properties/map?center_lat=23.13&center_lng=113.36&zoom=${zoom}`,
  );
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const view = render(
    <QueryClientProvider client={client}>
      <PropertyRentalMapPage />
    </QueryClientProvider>,
  );
  return { map, overlays, listeners, client, cluster, MarkerCluster, ...view };
}

beforeEach(() => {
  Marker.instances = [];
  window.localStorage.clear();
  listBuildingMap.mockResolvedValue(page(buildings));
  listEstateMap.mockResolvedValue({ items: [], total: 0 });
  listHouses.mockResolvedValue({ items: [], total: 0 });
});

afterEach(() => vi.useRealTimers());

describe('地图聚合交互', () => {
  it.each([
    [16, 17.4, 17.4],
    [16, 20, 18],
    [15, 16.2, 16.2],
    [19.5, 20, 20],
  ])('从 %s 级展开时参考范围适配值 %s，平滑推进到 %s', async (zoom, fitZoom, expectedZoom) => {
    // Keep two markers grouped even at the highest tested zoom.
    listBuildingMap.mockResolvedValue(
      page([buildings[0], { ...buildings[1], lng: '113.36001' }]),
    );
    const { map, overlays } = createMap(zoom);
    await waitFor(() => expect(overlays.size).toBe(1));
    map.getFitZoomAndCenterByBounds.mockReturnValue([
      fitZoom,
      { lng: 113.360005, lat: 23.13 },
    ]);
    act(() => [...overlays][0].click?.());
    expect(map.setZoomAndCenter).toHaveBeenCalledExactlyOnceWith(
      expectedZoom,
      [113.360005, 23.13],
    );
    expect(map.getFitZoomAndCenterByBounds.mock.calls[0][0]).toMatchObject({
      southWest: [113.36, 23.13],
      northEast: [113.36001, 23.13],
    });
  });

  it('坐标重合时只前进一级，不会跳到最大缩放', async () => {
    listBuildingMap.mockResolvedValue(
      page([buildings[0], { ...buildings[1], lng: buildings[0].lng }]),
    );
    const { map, overlays } = createMap();
    await waitFor(() => expect(overlays.size).toBe(1));
    act(() => [...overlays][0].click?.());
    expect(map.setZoomAndCenter).toHaveBeenCalledExactlyOnceWith(
      17,
      [113.36, 23.13],
    );
    expect(map.getFitZoomAndCenterByBounds).not.toHaveBeenCalled();
  });

  it('同一展示层级内缩放立即拆分聚合，不等待范围请求，并复用未变化的楼栋', async () => {
    const { map, overlays, listeners } = createMap();
    await waitFor(() => expect(overlays.size).toBe(2));
    const unchanged = [...overlays].find((marker) =>
      marker.title.startsWith('C座'),
    );
    const originalQueryCount = listBuildingMap.mock.calls.length;
    vi.useFakeTimers();
    act(() => {
      map.zoom = 17;
      listeners.get('zoomend')?.();
    });
    expect(overlays.size).toBe(3);
    expect(listBuildingMap).toHaveBeenCalledTimes(originalQueryCount);
    expect(overlays.has(unchanged as Marker)).toBe(true);
    expect(unchanged?.setContent).not.toHaveBeenCalled();
    expect(map.clearMap).not.toHaveBeenCalled();
  });

  it('后台请求开始及相同数据返回时，不重新创建或移除标记', async () => {
    const { map, overlays, client } = createMap();
    await waitFor(() => expect(overlays.size).toBe(2));
    const instances = [...Marker.instances];
    let resolve: (value: ReturnType<typeof page>) => void = () => {};
    listBuildingMap.mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      }),
    );
    let refreshing: Promise<void>;
    act(() => {
      refreshing = client.refetchQueries({ queryKey: ['building-map'] });
    });
    await waitFor(() =>
      expect(client.isFetching({ queryKey: ['building-map'] })).toBe(1),
    );
    expect(Marker.instances).toEqual(instances);
    expect(map.remove).not.toHaveBeenCalled();
    await act(async () => {
      resolve(page(buildings));
      await refreshing;
    });
    expect(Marker.instances).toEqual(instances);
    expect(map.remove).not.toHaveBeenCalled();
    expect(
      instances.every((marker) => marker.setContent.mock.calls.length === 0),
    ).toBe(true);
  });

  it('数据局部变化只更新对应卡片，退出结果的标记才会移除', async () => {
    const { map, overlays, client } = createMap();
    await waitFor(() => expect(overlays.size).toBe(2));
    const unchangedGroup = [...overlays].find((marker) =>
      marker.title.includes('2 栋'),
    );
    const updated = [...overlays].find((marker) =>
      marker.title.startsWith('C座'),
    );
    listBuildingMap.mockResolvedValue(
      page([...buildings.slice(0, 2), { ...buildings[2], name: 'C座新名称' }]),
    );
    await act(async () => {
      await client.refetchQueries({ queryKey: ['building-map'] });
    });
    await waitFor(() => expect(updated?.title).toContain('新名称'));
    expect(unchangedGroup?.setContent).not.toHaveBeenCalled();
    expect(updated?.setContent).toHaveBeenCalledOnce();
    expect(Marker.instances).toHaveLength(2);
    listBuildingMap.mockResolvedValue(page(buildings.slice(0, 2)));
    await act(async () => {
      await client.refetchQueries({ queryKey: ['building-map'] });
    });
    await waitFor(() => expect(overlays.size).toBe(1));
    expect(map.remove).toHaveBeenCalledExactlyOnceWith(updated);
    expect(overlays.has(unchangedGroup as Marker)).toBe(true);
  });

  it('SDK 聚合也按成员范围渐进展开，且同层级缩放不重建聚合器', async () => {
    listBuildingMap.mockResolvedValue(
      page(
        Array.from({ length: 81 }, (_, i) => ({ ...buildings[0], id: i + 1 })),
      ),
    );
    const { map, MarkerCluster, cluster, listeners } = createMap(16, true);
    await waitFor(() => expect(MarkerCluster).toHaveBeenCalled());
    const count = MarkerCluster.mock.calls.length;
    vi.useFakeTimers();
    act(() => {
      map.zoom = 17;
      listeners.get('zoomend')?.();
    });
    expect(MarkerCluster).toHaveBeenCalledTimes(count);
    const click = cluster.on.mock.calls.find(
      ([event]) => event === 'click',
    )?.[1];
    act(() =>
      click({
        clusterData: buildings.slice(0, 2).map((building) => ({ building })),
      }),
    );
    expect(map.setZoomAndCenter).toHaveBeenCalledExactlyOnceWith(
      19,
      [113.36025, 23.13],
    );
  });
});
