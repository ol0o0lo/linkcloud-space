import { describe, expect, it } from 'vitest';
import { enumMapping, enumSelectOptions } from './enums';

describe('enum label overrides', () => {
  it('uses frontend-friendly labels for backend enum options and mappings', () => {
    expect(
      enumSelectOptions(
        {
          'notifications.channel': [
            { label: 'In-app', value: 'in_app' },
            { label: 'Email', value: 'email' },
          ],
          'accounts.real_name_status': [
            { label: '待校验', value: 'pending' },
          ],
        },
        'notifications.channel',
      ),
    ).toEqual([
      { label: '站内信', value: 'in_app' },
      { label: '邮件', value: 'email' },
    ]);
    expect(
      enumSelectOptions(
        {
          'accounts.real_name_status': [
            { label: '待校验', value: 'pending' },
          ],
        },
        'accounts.real_name_status',
      ),
    ).toEqual([{ label: '审核中', value: 'pending' }]);
    expect(
      enumMapping('manual_review', '人工复核', 'accounts.real_name_status'),
    ).toBe('人工复核中');
  });
});
