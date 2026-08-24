import { describe, expect, it } from 'vitest';
import { buildHouseInlinePatch } from './HouseListInlineEditors';

describe('buildHouseInlinePatch', () => {
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
