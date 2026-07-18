import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import HouseLocationPoiCard, {
  distanceText,
  toCoordinates,
} from '../HouseLocationPoiCard';

const { mockUseAmap } = vi.hoisted(() => ({ mockUseAmap: vi.fn() }));

vi.mock('@/services/manual/amap', () => ({
  useAmap: mockUseAmap,
}));

describe('HouseLocationPoiCard', () => {
  beforeEach(() => {
    mockUseAmap.mockReset();
  });

  it('shows a maintenance action when the building has no coordinates', () => {
    render(
      <HouseLocationPoiCard
        buildingId={2}
        buildingName="1栋"
        lat={null}
        lng={null}
        returnTo="/dashboard/property-rental/houses/10"
      />,
    );

    expect(screen.getByText('楼栋尚未维护地图定位')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '去维护定位' })).toHaveAttribute(
      'href',
      '/dashboard/property-rental/estates?view=buildings&task=building_location&building_edit=2&return_to=%2Fdashboard%2Fproperty-rental%2Fhouses%2F10',
    );
    expect(mockUseAmap).not.toHaveBeenCalled();
  });

  it('renders the location map and nearby POIs by category', async () => {
    const map = {
      add: vi.fn(),
      addControl: vi.fn(),
      remove: vi.fn(),
      resize: vi.fn(),
      destroy: vi.fn(),
    };
    const searchNearBy = vi.fn(
      (
        _keyword: string,
        _center: [number, number],
        _radius: number,
        callback: (status: string, result: unknown) => void,
      ) =>
        callback('complete', {
          poiList: {
            pois: [
              {
                id: 'poi-1',
                name: '云栖路公交站',
                pname: '广东省',
                cityname: '广州市',
                adname: '天河区',
                address: '云栖路口',
                distance: '320',
                location: { lat: 23.138, lng: 113.344 },
              },
            ],
          },
        }),
    );
    const AMap = {
      Map: vi.fn(function MapMock() {
        return map;
      }),
      Marker: vi.fn(function MarkerMock() {
        return {};
      }),
      Scale: vi.fn(function ScaleMock() {
        return {};
      }),
      PlaceSearch: vi.fn(function PlaceSearchMock() {
        return { searchNearBy };
      }),
    };
    mockUseAmap.mockReturnValue({
      AMap,
      loading: false,
      error: null,
      reload: vi.fn(),
    });

    render(
      <HouseLocationPoiCard
        buildingId={2}
        buildingName="1栋"
        lat="23.137313"
        lng="113.343920"
        returnTo="/dashboard/property-rental/houses/10"
      />,
    );

    expect(screen.queryByText('1栋')).not.toBeInTheDocument();
    expect(screen.queryByText('23.137313, 113.343920')).not.toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: '1栋 当前定位只读地图' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: '在房源地图查看' }),
    ).toHaveAttribute(
      'href',
      '/dashboard/property-rental/map?selected_building_id=2&center_lat=23.137313&center_lng=113.343920&zoom=16',
    );
    expect(await screen.findByText('云栖路公交站')).toBeInTheDocument();
    expect(screen.getByText('320 m')).toBeInTheDocument();
    expect(searchNearBy).toHaveBeenCalledWith(
      '',
      [113.34392, 23.137313],
      2000,
      expect.any(Function),
    );
    expect(AMap.PlaceSearch).toHaveBeenCalledWith(
      expect.objectContaining({ pageSize: 4, type: '150700' }),
    );
    expect(AMap.Map).toHaveBeenCalledWith(
      expect.any(HTMLElement),
      expect.objectContaining({
        dragEnable: false,
        doubleClickZoom: false,
        keyboardEnable: false,
        scrollWheel: false,
        touchZoom: false,
        zoomEnable: false,
      }),
    );
    expect(screen.queryByText('餐饮')).not.toBeInTheDocument();
    expect(screen.queryByText('购物')).not.toBeInTheDocument();
    expect(AMap.Marker).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText('地铁站'));
    await waitFor(() =>
      expect(AMap.PlaceSearch).toHaveBeenCalledWith(
        expect.objectContaining({ type: '150500' }),
      ),
    );
  });

  it('shows a retryable map error without hiding the location details', () => {
    const reload = vi.fn();
    mockUseAmap.mockReturnValue({
      AMap: null,
      loading: false,
      error: new Error('地图配置不可用'),
      reload,
    });

    render(
      <HouseLocationPoiCard
        buildingId={2}
        buildingName="1栋"
        lat={23.137313}
        lng={113.34392}
        returnTo="/dashboard/property-rental/houses/10"
      />,
    );

    expect(screen.queryByText('1栋')).not.toBeInTheDocument();
    expect(screen.getByText('地图与周边设施加载失败')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'reload 重试' }));
    expect(reload).toHaveBeenCalledOnce();
  });
});

describe('house location POI helpers', () => {
  it('validates coordinates and formats POI distance', () => {
    expect(toCoordinates('23.1', '113.3')).toEqual({ lat: 23.1, lng: 113.3 });
    expect(toCoordinates(95, 113.3)).toBeNull();
    expect(distanceText(320)).toBe('320 m');
    expect(distanceText(1280)).toBe('1.3 km');
  });
});
