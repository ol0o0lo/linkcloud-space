import { describe, expect, it } from 'vitest';
import {
  createBuildingClusterMarkerContent,
  createBuildingCompactMarkerContent,
  createBuildingInfoWindowContent,
  createBuildingLocationMarkerContent,
  createEstateClusterMarkerContent,
  createEstateMapMarkerContent,
} from './marker-content';

describe('createBuildingInfoWindowContent', () => {
  it('安全生成楼栋地图信息卡和操作入口', () => {
    const content = createBuildingInfoWindowContent(
      {
        id: 3,
        name: '</div><img src=x onerror=alert(1)>',
        address: '科技路 1 号',
        estate: { name: '科技园' },
        counts: { total: 8, vacant: 3, rented: 5 },
      },
      {
        adminBasePath: '/dashboard',
        returnTo: '/dashboard/rental/properties/map',
      },
    );

    expect(content.querySelector('img')).toBeNull();
    expect(content.textContent).toContain('</div><img src=x onerror=alert(1)>');
    expect(content.textContent).toContain('房源 8');
    expect(content.querySelector('a')?.getAttribute('href')).toBe(
      '/dashboard/rental/properties/list?building_id=3',
    );
    expect(
      Array.from(content.querySelectorAll('a'))
        .find((link) => link.textContent === '编辑位置')
        ?.getAttribute('href'),
    ).toBe(
      '/dashboard/rental/properties/list?building_id=3&asset_tab=profile&asset_action=edit-building&return_to=%2Fdashboard%2Frental%2Fproperties%2Fmap',
    );
  });

  it('生成带房源数的楼栋定位点与聚合点', () => {
    const marker = createBuildingLocationMarkerContent(8);
    const cluster = createBuildingClusterMarkerContent(12);

    expect(marker.textContent).toContain('8 套');
    expect(marker.getAttribute('aria-label')).toBe('8 套房源');
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
    expect(building.getAttribute('aria-label')).toBe('1栋，房源8套');
  });
});
