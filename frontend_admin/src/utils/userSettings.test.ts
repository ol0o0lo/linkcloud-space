import { describe, expect, it } from 'vitest';
import {
  isEditableUserSettingKey,
  visibleUserSettings,
} from './userSettings';

describe('internal user settings', () => {
  it('hides internal settings from generic maintenance', () => {
    expect(
      visibleUserSettings([
        { key: 'theme', value: 'dark' },
        { key: 'internal.workbench.mine.layout.v1', value: [] },
      ]),
    ).toEqual([{ key: 'theme', value: 'dark' }]);
  });

  it('prevents generic forms from editing internal keys', () => {
    expect(isEditableUserSettingKey('theme')).toBe(true);
    expect(
      isEditableUserSettingKey('internal.workbench.space.layout.v1'),
    ).toBe(false);
  });
});
