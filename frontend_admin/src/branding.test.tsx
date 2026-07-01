import { describe, expect, it } from 'vitest';
import defaultSettings from '../config/defaultSettings';
import enUSPages from './locales/en-US/pages';
import zhCNPages from './locales/zh-CN/pages';

describe('branding copy', () => {
  it('uses the Chinese brand name in zh-CN surfaces while keeping en-US unchanged', () => {
    expect(defaultSettings.title).toBe('链云空间');
    expect(zhCNPages['pages.layouts.userLayout.title']).toBe('链云空间后台管理');
    expect(enUSPages['pages.layouts.userLayout.title']).toBe('LinkCloud Space Admin');
  });
});
