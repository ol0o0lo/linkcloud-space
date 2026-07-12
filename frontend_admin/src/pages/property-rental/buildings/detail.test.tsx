import { describe, expect, it } from 'vitest';
import { safeMapReturnTo } from './detail-utils';

describe('safeMapReturnTo', () => {
  it('仅允许返回房源地图', () => {
    expect(safeMapReturnTo('/dashboard/property-rental/map?keyword=云岸')).toBe('/dashboard/property-rental/map?keyword=云岸');
    expect(safeMapReturnTo('/dashboard/account/settings')).toBe('/dashboard/property-rental/map');
  });
});
