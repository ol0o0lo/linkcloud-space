import { describe, expect, it } from 'vitest';
import {
  buildingLabel,
  houseBalconyText,
  houseDisplayTags,
  houseKitchenText,
  houseLabel,
  houseLayoutText,
  housePrimaryLayoutText,
} from './constants';

describe('楼栋与房源标签', () => {
  it('绑定小区时以小区和楼栋显示', () => {
    expect(
      buildingLabel({ name: '1 栋', estate: { display_name: '星河湾' } }),
    ).toBe('星河湾 / 1 栋');
    expect(
      houseLabel({
        room_number: '1801',
        building: { name: '1 栋', estate: { display_name: '星河湾' } },
      }),
    ).toBe('星河湾 / 1 栋 / 1801');
  });

  it('未绑定小区时以楼栋和地址显示', () => {
    expect(buildingLabel({ name: '独栋', address: '科技路 88 号' })).toBe(
      '独栋 · 科技路 88 号',
    );
    expect(
      houseLabel({
        room_number: '201',
        building: { name: '独栋', address: '科技路 88 号', estate: null },
      }),
    ).toBe('独栋 · 科技路 88 号 / 201');
  });

  it('优先使用后端计算的房源有效标签', () => {
    expect(
      houseDisplayTags({
        tags: ['房源标签'],
        effective_tags: ['房源标签', '楼栋标签'],
      }),
    ).toEqual(['房源标签', '楼栋标签']);
    expect(houseDisplayTags({ tags: ['房源标签'] })).toEqual(['房源标签']);
  });
});

describe('房源户型展示', () => {
  it('将一室零厅统一显示为单间', () => {
    expect(housePrimaryLayoutText({ bedrooms: 1, living_rooms: 0 })).toBe(
      '单间',
    );
  });

  it('保留其他户型的原有格式', () => {
    expect(housePrimaryLayoutText({ bedrooms: 1, living_rooms: 1 })).toBe(
      '1室1厅',
    );
    expect(housePrimaryLayoutText({ bedrooms: 2, living_rooms: 1 })).toBe(
      '2室1厅',
    );
    expect(
      housePrimaryLayoutText(
        { bedrooms: 2, living_rooms: 1 },
        { bedroomLabel: ' 房', livingRoomLabel: ' 厅', separator: ' ' },
      ),
    ).toBe('2 房 1 厅');
  });

  it('客厅数未填写时不误判为单间', () => {
    expect(housePrimaryLayoutText({ bedrooms: 1 })).toBe('1室');
  });

  it('主户型只组合房厅卫', () => {
    expect(
      houseLayoutText({
        bedrooms: 2,
        living_rooms: 1,
        bathrooms: 1,
        kitchens: 1,
        balconies: 2,
      }),
    ).toBe('2房1厅1卫');
    expect(
      houseLayoutText({ bedrooms: 1, living_rooms: 0, bathrooms: 1 }),
    ).toBe('单间');
  });

  it('厨房和阳台作为两个独立次要字段', () => {
    expect(houseKitchenText({ kitchens: 1 })).toBe('1厨');
    expect(houseBalconyText({ balconies: 2 })).toBe('2阳台');
  });
});
