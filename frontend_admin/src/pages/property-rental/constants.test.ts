import { describe, expect, it } from 'vitest';
import { buildingLabel, houseLabel } from './constants';

describe('楼栋与房源标签', () => {
  it('绑定小区时以小区和楼栋显示', () => {
    expect(buildingLabel({ name: '1 栋', estate: { display_name: '星河湾' } })).toBe('星河湾 / 1 栋');
    expect(houseLabel({ room_number: '1801', building: { name: '1 栋', estate: { display_name: '星河湾' } } })).toBe('星河湾 / 1 栋 / 1801');
  });

  it('未绑定小区时以楼栋和地址显示', () => {
    expect(buildingLabel({ name: '独栋', address: '科技路 88 号' })).toBe('独栋 · 科技路 88 号');
    expect(houseLabel({ room_number: '201', building: { name: '独栋', address: '科技路 88 号', estate: null } })).toBe('独栋 · 科技路 88 号 / 201');
  });
});
