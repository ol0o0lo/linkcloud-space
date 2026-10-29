import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getSelectedOrgSlug, setSelectedOrgSlug } from '@/utils/orgSelection';

const mocks = vi.hoisted(() => ({
  request: vi.fn(),
  switchList: vi.fn(),
}));

vi.mock('@umijs/max', () => ({ request: mocks.request }));
vi.mock('@/services/openapi/organizations', () => ({
  appsOrganizationsApiSwitchList: mocks.switchList,
}));

import { loadAuthenticatedState } from './authenticatedState';

const user = { id: 1, is_superuser: true } as API.MeOut;
const organizations = ['tenant-a', 'tenant-b'].map((slug, index) => ({
  id: index + 1,
  slug,
  name: slug,
  is_current: index === 0,
  is_primary: index === 0,
}));

describe('显式组织作用域的认证快照', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setSelectedOrgSlug('tenant-a');
    mocks.switchList.mockResolvedValue(organizations);
    mocks.request.mockResolvedValue({});
  });

  it('成员和权限请求使用目标工作空间，全局组织在快照完成前后均不改变', async () => {
    const snapshot = await loadAuthenticatedState(undefined, user, 'tenant-b');
    expect(snapshot?.selectedOrgSlug).toBe('tenant-b');
    expect(snapshot?.organizations.map((item) => item.is_current)).toEqual([
      false,
      true,
    ]);
    expect(mocks.switchList).toHaveBeenCalledWith({
      skipErrorHandler: true,
      headers: { 'X-Org-Slug': 'tenant-b' },
    });
    expect(mocks.request).toHaveBeenCalledWith('/api/access/navigation/', {
      method: 'GET',
      headers: { 'X-Org-Slug': 'tenant-b' },
    });
    expect(mocks.request).toHaveBeenCalledWith(
      '/api/team-operations/capabilities/',
      {
        method: 'GET',
        headers: { 'X-Org-Slug': 'tenant-b' },
      },
    );
    expect(getSelectedOrgSlug()).toBe('tenant-a');
  });

  it.each(['不属于目标工作空间', '成员列表加载失败'])(
    '%s 时不接受目标或修改全局组织',
    async (kind) => {
      if (kind === '不属于目标工作空间')
        mocks.switchList.mockResolvedValueOnce([organizations[0]]);
      else mocks.switchList.mockRejectedValueOnce(new Error('network'));
      const snapshot = await loadAuthenticatedState(undefined, user, 'tenant-b');
      expect(snapshot?.selectedOrgSlug).toBeUndefined();
      expect(mocks.request).not.toHaveBeenCalled();
      expect(getSelectedOrgSlug()).toBe('tenant-a');
    },
  );
});
