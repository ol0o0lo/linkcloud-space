import { describe, expect, it } from 'vitest';
import { readMapSearchState } from './map-state';

describe('readMapSearchState 地图视口', () => {
  it('未指定房态时默认筛选空置房源', () => {
    expect(readMapSearchState('').houseStatus).toBe('vacant');
    expect(readMapSearchState('?house_status=rented').houseStatus).toBe(
      'rented',
    );
  });

  it('缺少或留空任一中心坐标时不生成视口', () => {
    expect(
      readMapSearchState('?center_lng=113.93&zoom=15').viewport,
    ).toBeUndefined();
    expect(
      readMapSearchState('?center_lat=22.54&zoom=15').viewport,
    ).toBeUndefined();
    expect(
      readMapSearchState('?center_lat=&center_lng=113.93&zoom=15').viewport,
    ).toBeUndefined();
    expect(
      readMapSearchState('?center_lat=22.54&center_lng=&zoom=15').viewport,
    ).toBeUndefined();
  });

  it('接受高德地图 2 至 20 级缩放并拒绝范围外的值', () => {
    expect(
      readMapSearchState('?center_lat=22.54&center_lng=113.93&zoom=2').viewport,
    ).toEqual({ lat: 22.54, lng: 113.93, zoom: 2 });
    expect(
      readMapSearchState('?center_lat=22.54&center_lng=113.93&zoom=20')
        .viewport,
    ).toEqual({ lat: 22.54, lng: 113.93, zoom: 20 });
    expect(
      readMapSearchState('?center_lat=22.54&center_lng=113.93&zoom=1').viewport,
    ).toBeUndefined();
    expect(
      readMapSearchState('?center_lat=22.54&center_lng=113.93&zoom=21')
        .viewport,
    ).toBeUndefined();
  });
});
