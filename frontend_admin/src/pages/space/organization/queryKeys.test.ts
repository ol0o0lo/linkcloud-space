import { describe, expect, it } from 'vitest';
import { organizationQueryKeys } from './queryKeys';

describe('organizationQueryKeys', () => {
  it('邀请列表根键可以匹配所有分页查询', () => {
    expect(organizationQueryKeys.invites('lan')).toEqual([
      'organization-workspace',
      'lan',
      'invites',
    ]);
    expect(organizationQueryKeys.invites('lan', 2)).toEqual([
      'organization-workspace',
      'lan',
      'invites',
      2,
    ]);
  });
});
