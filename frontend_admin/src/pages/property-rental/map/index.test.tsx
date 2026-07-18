import { describe, expect, it } from 'vitest';
import { readMapSearchState, sameBounds } from './map-state';

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
