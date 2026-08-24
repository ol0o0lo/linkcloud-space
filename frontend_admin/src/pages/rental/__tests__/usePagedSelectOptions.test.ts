import { describe, expect, it } from 'vitest';
import { buildSelectedFirstOptions } from '../usePagedSelectOptions';

describe('buildSelectedFirstOptions', () => {
  it('places selected values first and falls back when details are missing', () => {
    expect(
      buildSelectedFirstOptions({
        items: [
          { id: 2, name: '远程选项' },
          { id: 42, name: '当前选项' },
        ],
        selectedIds: [42, 77],
        getOptionLabel: (item) => item.name,
        getSelectedFallbackLabel: (id) => `当前值 #${id}`,
      }),
    ).toEqual([
      { value: 42, label: '当前选项' },
      { value: 77, label: '当前值 #77' },
      { value: 2, label: '远程选项' },
    ]);
  });
});
