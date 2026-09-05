import { describe, expect, it } from 'vitest';
import { buildHouseInlinePatch } from './HouseListInlineEditors';

describe('buildHouseInlinePatch', () => {
  it('normalizes editable values into the house patch payload', () => {
    const patch = buildHouseInlinePatch({
      area: '38.50',
      balconies: 2,
      bathrooms: 2,
      building_id: 7,
      decoration: 'fine',
      floor: 12,
      internal_notes: '内部备注',
      kitchens: null,
      landlord_id: 8,
      media_edit: {
        images: [
          {
            image_role: 'cover',
            media_id: 8,
            media_type: 'image',
            url: '/derived-house-cover.jpg',
          },
        ],
        videos: [],
      },
      orientation: 'south',
      public_description: '对外描述',
      room_layout_edit: { bedrooms: 2, living_rooms: 1 },
      room_number: 'A-102',
      status: 'vacant',
      tags: ['近地铁', '采光好'],
    });

    expect(patch).toEqual(
      expect.objectContaining({
        area: 38.5,
        balconies: 2,
        bathrooms: 2,
        bedrooms: 2,
        building_id: 7,
        decoration: 'fine',
        floor: 12,
        images: [
          {
            image_role: 'cover',
            media_id: 8,
            media_type: 'image',
          },
        ],
        kitchens: 0,
        landlord_id: 8,
        living_rooms: 1,
        orientation: 'south',
        room_number: 'A-102',
        status: 'vacant',
        tags: ['近地铁', '采光好'],
        videos: [],
      }),
    );
    expect(patch).not.toHaveProperty('has_elevator_access');
  });

  it('keeps public description separate from internal notes', () => {
    const patch = buildHouseInlinePatch({
      building_id: 2,
      room_number: '101',
      public_description: '面向租客展示的描述',
      internal_notes: '仅内部可见的备注',
      media_edit: { images: [], videos: [] },
      tags: [],
    });

    expect(patch).toEqual(
      expect.objectContaining({
        public_description: '面向租客展示的描述',
        internal_notes: '仅内部可见的备注',
      }),
    );
    expect(patch).not.toHaveProperty('has_elevator_access');
  });
});
