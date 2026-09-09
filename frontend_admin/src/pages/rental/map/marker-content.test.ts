import { fireEvent } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  createBuildingClusterMarkerContent,
  createBuildingCompactMarkerContent,
  createBuildingDetailMarkerContent,
  createBuildingGroupMarkerContent,
  createBuildingLocationMarkerContent,
  createBuildingOverviewMarkerContent,
  createEstateClusterMarkerContent,
  createEstateMapMarkerContent,
  getBuildingGroupAreaName,
} from './marker-content';

describe('地图标点内容', () => {
  it('生成带房源数的楼栋定位点与聚合点', () => {
    const marker = createBuildingLocationMarkerContent({
      name: '1栋',
      primaryLabel: '房源',
      primaryValue: 8,
    });
    const namedMarker = createBuildingLocationMarkerContent({
      name: '南区3栋',
      primaryLabel: '空置',
      primaryValue: 2,
    });
    const cluster = createBuildingClusterMarkerContent(12);

    expect(marker.textContent).toContain('1栋');
    expect(marker.textContent).toContain('房源 8 套');
    expect(marker.getAttribute('aria-label')).toBe('1栋，房源8套');
    expect(marker.childElementCount).toBe(2);
    expect(marker.lastElementChild).toHaveAttribute(
      'data-map-location-pin',
      'true',
    );
    expect(namedMarker.textContent).toContain('南区3栋');
    expect(namedMarker.textContent).toContain('空置 2 套');
    expect(namedMarker.getAttribute('aria-label')).toBe('南区3栋，空置2套');
    expect(cluster.textContent).toBe('12 栋');
    expect(cluster.getAttribute('aria-label')).toBe('12 栋楼栋');
  });

  it('生成按缩放层级使用的小区气泡和紧凑楼栋标点', () => {
    const estate = createEstateMapMarkerContent({
      name: '云栖花园',
      primaryLabel: '空置',
      primaryValue: 6,
      buildingCount: 3,
    });
    const cluster = createEstateClusterMarkerContent({
      estateCount: 4,
      buildingCount: 12,
      primaryLabel: '房源',
      primaryValue: 36,
    });
    const building = createBuildingCompactMarkerContent({
      name: '1栋',
      primaryLabel: '房源',
      primaryValue: 8,
    });

    expect(estate.textContent).toContain('云栖花园');
    expect(estate.textContent).toContain('6 套');
    expect(estate.textContent).not.toContain('空置');
    expect(cluster.textContent).toContain('4 个项目');
    expect(cluster.textContent).toContain('房源 36 套');
    expect(building.textContent).toContain('1栋');
    expect(building.textContent).toContain('房源 8 套');
    expect(building.getAttribute('aria-label')).toBe('1栋，房源8套');
  });

  it('为可点击标点提供按钮语义和键盘焦点', () => {
    const markers = [
      createEstateMapMarkerContent({
        name: '云栖花园',
        primaryLabel: '空置',
        primaryValue: 6,
        buildingCount: 3,
      }),
      createEstateClusterMarkerContent({
        estateCount: 4,
        buildingCount: 12,
        primaryLabel: '空置',
        primaryValue: 9,
      }),
      createBuildingCompactMarkerContent({
        name: '1栋',
        primaryLabel: '空置',
        primaryValue: 2,
      }),
      createBuildingLocationMarkerContent({
        name: '1栋',
        primaryLabel: '空置',
        primaryValue: 2,
      }),
      createBuildingClusterMarkerContent(3),
    ];

    for (const marker of markers) {
      expect(marker).toHaveAttribute('role', 'button');
      expect(marker).toHaveAttribute('tabindex', '0');
    }
  });

  it('选中楼栋后在地图详情卡中展示房源总数、房号和租金', () => {
    const marker = createBuildingDetailMarkerContent({
      name: 'A座',
      estateName: '滨江公馆',
      address: '广州市海珠区阅江中路166号 A座',
      totalValue: 8,
      primaryLabel: '空置',
      primaryValue: 5,
      houseTotal: 5,
      houses: [
        { id: 1, room_number: '1803', asking_rent: '3200.00' },
        { id: 2, room_number: '1802', asking_rent: null },
        { id: 3, room_number: '1701', asking_rent: '2800.00' },
        { id: 4, room_number: '1608', asking_rent: '3000.00' },
        { id: 5, room_number: '1506', asking_rent: '2600.00' },
      ],
      houseDetailHref: (houseId) => `/dashboard/rental/properties/${houseId}`,
      loading: false,
      error: false,
    });

    expect(marker.textContent).toContain('A座');
    expect(marker.textContent).toContain('共 8 套房源');
    expect(marker.textContent).toContain('房号');
    expect(marker.textContent).toContain('房号 · 空置 5 套');
    expect(marker.textContent).toContain('月租');
    expect(marker.textContent).toContain('1803');
    expect(marker.textContent).toContain('¥3200.00 / 月');
    expect(marker.textContent).toContain('租金待定');
    expect(marker.textContent).toContain('另有 1 套');
    expect(marker.textContent).not.toContain('1506');
    expect(marker.getAttribute('aria-label')).toContain(
      'A座，共8套房源，空置5套',
    );
    expect(marker.lastElementChild).toHaveAttribute(
      'data-map-location-pin',
      'true',
    );
    const houseLink = marker.querySelector<HTMLAnchorElement>(
      'a[href="/dashboard/rental/properties/1"]',
    );
    expect(houseLink).toHaveAttribute('target', '_blank');
    expect(houseLink).toHaveAttribute('rel', 'noreferrer');
    expect(houseLink).toHaveAttribute('aria-label', '查看房源 1803');
    expect(houseLink).not.toHaveTextContent('↗');
    expect(
      houseLink?.querySelector('[data-new-tab-indicator="true"]'),
    ).not.toBeNull();
    expect(
      houseLink?.querySelector('[data-new-tab-indicator="true"]'),
    ).toHaveAttribute('aria-hidden', 'true');
    expect(houseLink?.style.transition).toContain('background-color');
    if (!houseLink) throw new Error('未生成房源详情链接');
    fireEvent.mouseEnter(houseLink);
    expect(houseLink.style.backgroundColor).toBe('#e6f4ff');
    fireEvent.mouseLeave(houseLink);
    expect(houseLink.style.backgroundColor).toBe('transparent');
  });

  it('地图楼栋详情卡提供加载、失败和空房源状态', () => {
    const common = {
      name: 'A座',
      totalValue: 3,
      primaryLabel: '空置',
      primaryValue: 1,
      houseTotal: 1,
      houses: [],
    };

    expect(
      createBuildingDetailMarkerContent({
        ...common,
        loading: true,
        error: false,
      }).textContent,
    ).toContain('房源加载中');
    expect(
      createBuildingDetailMarkerContent({
        ...common,
        loading: false,
        error: true,
      }).textContent,
    ).toContain('房源加载失败');
    expect(
      createBuildingDetailMarkerContent({
        ...common,
        loading: false,
        error: false,
      }).textContent,
    ).toContain('当前筛选暂无房源');
  });

  it('放大后生成可同时展示的小型楼栋概览卡', () => {
    const marker = createBuildingOverviewMarkerContent({
      name: 'A座',
      contextName: '滨江公馆',
      primaryLabel: '空置',
      primaryValue: 3,
    });

    expect(marker.textContent).toContain('滨江公馆');
    expect(marker.textContent).toContain('A座');
    expect(marker.textContent).toContain('空置 3 套');
    expect(marker.lastElementChild).toHaveAttribute(
      'data-map-location-pin',
      'true',
    );
  });

  it('密集楼栋合并为小区或地段卡并展示不同楼栋', () => {
    const sameEstateBuildings = [
      {
        estate: { id: 5, name: '滨江公馆', display_name: '滨江公馆' },
        address: '广州市海珠区阅江中路166号 A座',
      },
      {
        estate: { id: 5, name: '滨江公馆', display_name: '滨江公馆' },
        address: '广州市海珠区阅江中路166号 B座',
      },
    ];
    const mixedEstateBuildings = [
      {
        estate: { id: 5, name: '滨江公馆', display_name: '滨江公馆' },
        address: '广州市海珠区阅江中路166号 A座',
      },
      {
        estate: { id: 6, name: '阅江花园', display_name: '阅江花园' },
        address: '广州市海珠区阅江中路166号 2栋',
      },
    ];

    expect(getBuildingGroupAreaName(sameEstateBuildings)).toBe('滨江公馆');
    expect(getBuildingGroupAreaName(mixedEstateBuildings)).toBe(
      '广州市海珠区阅江中路166号',
    );

    const marker = createBuildingGroupMarkerContent({
      areaName: '滨江公馆',
      buildingCount: 3,
      buildings: [
        { name: 'A座', primaryLabel: '空置', primaryValue: 1 },
        { name: 'B座', primaryLabel: '空置', primaryValue: 2 },
        { name: 'C座', primaryLabel: '空置', primaryValue: 4 },
      ],
    });

    expect(marker.textContent).toContain('滨江公馆');
    expect(marker.textContent).toContain('3 栋');
    expect(marker.textContent).toContain('A座');
    expect(marker.textContent).toContain('B座');
    expect(marker.textContent).toContain('C座');
    expect(marker.textContent).toContain('空置 4 套');
  });
});
