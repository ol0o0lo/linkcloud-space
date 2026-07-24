import { describe, expect, it } from 'vitest';
import {
  getRecipientSummary,
  getScopeOptions,
  resolveEditorInitialValues,
} from './policy';

describe('notification dispatch editor policy', () => {
  it('exposes only tenant-safe scopes to tenant administrators', () => {
    expect(getScopeOptions(true).map((option) => option.value)).toEqual([
      'organization',
      'teams',
      'users',
    ]);
    expect(getScopeOptions(true).map((option) => option.label)).toEqual([
      '空间全员',
      '指定团队',
      '指定成员',
    ]);
  });

  it('falls back to the role default when reusing an inaccessible scope', () => {
    expect(
      resolveEditorInitialValues({
        isTenantMode: true,
        source: { scope: 'platform', scope_ids: [1], title: '平台公告' },
      }),
    ).toMatchObject({
      scope: 'organization',
      targets: [],
      title: '平台公告',
    });

    expect(
      resolveEditorInitialValues({
        isTenantMode: false,
        source: { scope: 'teams', scope_ids: [12] },
      }),
    ).toMatchObject({
      scope: 'platform',
      targets: [],
    });
  });

  it('describes the current-space broadcast without exposing a target picker', () => {
    expect(
      getRecipientSummary({
        scope: 'organization',
        isTenantMode: true,
        organizationName: 'LAN 空间',
      }),
    ).toEqual({
      hint: '将发送给「LAN 空间」的全部成员',
      status: '准备发送给当前空间全部成员',
      needsTargetSelection: false,
    });
  });
});
