import { describe, expect, it } from 'vitest';
import { readMapSearchState } from './map-state';

describe('readMapSearchState', () => {
  it('仅接受有效的地图筛选与资源 ID', () => {
    expect(readMapSearchState('?keyword=云岸&estate_id=12&house_status=vacant&include_inactive=true&selected_building_id=8')).toEqual({
      keyword: '云岸', estateId: 12, houseStatus: 'vacant', includeInactive: true, selectedBuildingId: 8,
    });
    expect(readMapSearchState('?estate_id=-1&selected_building_id=x')).toMatchObject({ estateId: undefined, selectedBuildingId: undefined });
  });
});
