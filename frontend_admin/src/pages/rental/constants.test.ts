import { describe, expect, it } from 'vitest';
import type { MigrationMediaSource } from '@/services/manual/house';
import {
  buildingLabel,
  displayMedia,
  houseBalconyText,
  houseDisplayTags,
  houseKitchenText,
  houseLabel,
  houseLayoutText,
  housePrimaryLayoutText,
  mediaChangePatch,
  mediaCoverUrl,
  stripDerivedMediaFields,
} from './constants';

describe('迁移媒体只读展示', () => {
  it('普通资料编辑不回传未改变的媒体，避免旧快照覆盖后台新回填', () => {
    const images = [
      { media_id: 11, media_type: 'image', url: '/old-signed.jpg' },
    ];
    expect(
      mediaChangePatch(
        'images',
        [{ ...images[0], url: '/refreshed-signed.jpg' }],
        images,
      ),
    ).toEqual({});
    expect(mediaChangePatch('images', [], images)).toEqual({ images: [] });
  });
  it('按原顺序合并旧图、迁移中占位和正式媒体，不修改编辑源数据', () => {
    const images = [{ media_id: 11, media_type: 'image', url: '/new.jpg' }];
    const source: MigrationMediaSource = {
      migration_media: [
        {
          id: 'old-cover',
          field: 'images',
          position: 0,
          url: 'https://old.example/cover.jpg',
          media_type: 'image',
          status: 'pending',
        },
        {
          id: 'missing',
          field: 'images',
          position: 1,
          url: null,
          media_type: 'image',
          status: 'missing',
        },
      ],
    };
    const result = displayMedia(images, source);
    expect(result.map((item) => item.url)).toEqual([
      'https://old.example/cover.jpg',
      undefined,
      '/new.jpg',
    ]);
    expect(mediaCoverUrl(images, source)).toBe('https://old.example/cover.jpg');
    expect(result[0].media_id).toBeUndefined();
    expect(images).toEqual([
      { media_id: 11, media_type: 'image', url: '/new.jpg' },
    ]);
    expect(stripDerivedMediaFields(images)).toEqual([
      { media_id: 11, media_type: 'image' },
    ]);
  });

  it('新媒体回填后复用正式引用，避免图片重复', () => {
    const source: MigrationMediaSource = {
      migration_media: [
        {
          id: 'copied',
          field: 'images',
          position: 0,
          url: '/new.jpg',
          media_type: 'image',
          status: 'succeeded',
          media_file_id: 11,
        },
      ],
    };
    expect(
      displayMedia([{ media_id: 11, url: '/new.jpg' }], source),
    ).toHaveLength(1);
    expect(displayMedia([], source, 'videos')).toEqual([]);
  });
});

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
