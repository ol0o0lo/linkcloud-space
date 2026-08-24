import { describe, expect, it } from 'vitest';
import {
  buildWorkbenchViewLocation,
  canAccessSpaceWorkbench,
  getWorkbenchViewFromSearch,
} from './view';
import { WORKBENCH_LAYOUT_KEYS } from './layout/model';

const teamOnlyCapabilities = {
  announcement_organization_manage: false,
  announcement_team_ids: [2],
  task_organization_manage: false,
  task_team_ids: [2],
};

describe('workbench view access', () => {
  it('reads the requested workbench view from URL search params', () => {
    expect(getWorkbenchViewFromSearch('?view=space')).toBe('space');
    expect(getWorkbenchViewFromSearch('?view=mine')).toBe('mine');
    expect(getWorkbenchViewFromSearch('?view=unknown')).toBe('mine');
  });

  it('preserves filters when switching workbench views', () => {
    expect(
      buildWorkbenchViewLocation(
        '/rental/workbench/overview',
        '?publish=blocked',
        'space',
      ),
    ).toBe('/rental/workbench/overview?publish=blocked&view=space');
  });

  it('limits the space workbench to owners and organization managers', () => {
    expect(
      canAccessSpaceWorkbench({
        ...teamOnlyCapabilities,
        task_organization_manage: true,
      }),
    ).toBe(true);
    expect(
      canAccessSpaceWorkbench({
        ...teamOnlyCapabilities,
        announcement_organization_manage: true,
      }),
    ).toBe(true);
    expect(canAccessSpaceWorkbench(teamOnlyCapabilities)).toBe(false);
  });

  it('uses independent personal setting keys for each workbench view', () => {
    expect(WORKBENCH_LAYOUT_KEYS.mine).toBe(
      'internal.workbench.mine.layout.v1',
    );
    expect(WORKBENCH_LAYOUT_KEYS.space).toBe(
      'internal.workbench.space.layout.v1',
    );
  });
});
