import { describe, expect, it } from 'vitest';
import type {
  BuildingMapMarkerOut,
  EstateMapMarkerOut,
} from '@/services/manual/house';
import {
  getMapDisplayLevel,
  getMapPrimaryMetric,
  mergeEstateMapDisplayPoints,
  summarizeEstateMapPoints,
} from './map-display';

const counts = {
  total: 8,
  vacant: 1,
  listed: 2,
  rented: 4,
  renovating: 1,
};

const estate: EstateMapMarkerOut = {
  id: 2,
  name: '云栖花园',
  display_name: '云栖花园一期',
  address: '云栖路 88 号',
  lat: '23.13512',
  lng: '113.36121',
  location_source: 'building_centroid',
  building_count: 3,
  located_building_count: 2,
  unlocated_building_count: 1,
  counts,
};

const independentBuilding: BuildingMapMarkerOut = {
  id: 9,
  estate: null,
  name: '独立办公楼',
  address: '科技路 9 号',
  lat: '23.13',
  lng: '113.36',
  counts: {
    total: 2,
    vacant: 1,
    listed: 0,
    rented: 1,
    renovating: 0,
  },
};

describe('getMapDisplayLevel', () => {
  it('按缩放级别切换小区聚合、小区和楼栋展示', () => {
    expect(getMapDisplayLevel(3)).toBe('estate-cluster');
    expect(getMapDisplayLevel(9.9)).toBe('estate-cluster');
    expect(getMapDisplayLevel(10)).toBe('estate');
    expect(getMapDisplayLevel(13.9)).toBe('estate');
    expect(getMapDisplayLevel(14)).toBe('building-compact');
    expect(getMapDisplayLevel(15.9)).toBe('building-compact');
    expect(getMapDisplayLevel(16)).toBe('building-detail');
    expect(getMapDisplayLevel(20)).toBe('building-detail');
  });
});

describe('mergeEstateMapDisplayPoints', () => {
  it('合并小区汇总和独立楼栋，并忽略已归属小区的楼栋', () => {
    const points = mergeEstateMapDisplayPoints(
      [estate],
      [
        independentBuilding,
        {
          ...independentBuilding,
          id: 10,
          estate: { id: 2, name: '云栖花园', display_name: '云栖花园一期' },
        },
      ],
    );

    expect(points).toHaveLength(2);
    expect(points[0]).toMatchObject({
      key: 'estate:2',
      kind: 'estate',
      name: '云栖花园一期',
      lat: 23.13512,
      lng: 113.36121,
      locationSource: 'building-centroid',
      buildingCount: 3,
    });
    expect(points[1]).toMatchObject({
      key: 'building:9',
      kind: 'independent-building',
      buildingId: 9,
      buildingCount: 1,
      locatedBuildingCount: 1,
    });
  });
});

describe('地图计数', () => {
  it('按房态选择气泡主指标，未知房态回退到总房源', () => {
    expect(getMapPrimaryMetric(counts, 'vacant')).toEqual({
      key: 'vacant',
      label: '空置',
      value: 1,
    });
    expect(getMapPrimaryMetric(counts, 'unknown')).toEqual({
      key: 'total',
      label: '房源',
      value: 8,
    });
  });

  it('汇总小区与独立楼栋数量，且不会重复统计小区楼栋', () => {
    const summary = summarizeEstateMapPoints(
      mergeEstateMapDisplayPoints([estate], [independentBuilding]),
    );

    expect(summary).toEqual({
      pointCount: 2,
      estateCount: 1,
      independentBuildingCount: 1,
      buildingCount: 4,
      locatedBuildingCount: 3,
      unlocatedBuildingCount: 1,
      counts: {
        total: 10,
        vacant: 2,
        listed: 2,
        rented: 5,
        renovating: 1,
      },
    });
  });
});
