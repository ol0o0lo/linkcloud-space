import { describe, expect, it } from 'vitest';

import routes from '#/router/routes/modules/vben';

function findRoute(path: string) {
  return routes.find((route) => route.path === path);
}

describe('profile routes', () => {
  it('注册个人中心主页和三个独立二级页', () => {
    expect(findRoute('/profile')?.name).toBe('Profile');
    expect(findRoute('/profile/security')?.name).toBe('ProfileSecurity');
    expect(findRoute('/profile/password')?.name).toBe('ProfilePassword');
    expect(findRoute('/profile/notifications')?.name).toBe('ProfileNotifications');
  });
});
