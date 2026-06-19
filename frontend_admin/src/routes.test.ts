import { describe, expect, it } from 'vitest';
import routes from '../config/routes';
import zhCN from './locales/zh-CN';

type AppRoute = {
  layout?: boolean;
  name?: string;
  path?: string;
  routes?: AppRoute[];
};

const collectMenuKeys = (routeList: AppRoute[], parents: string[] = []) => {
  const keys: string[] = [];

  for (const route of routeList) {
    if (route.layout === false || route.path?.includes('*')) {
      continue;
    }

    const nextParents = route.name ? [...parents, route.name] : parents;

    if (route.name) {
      keys.push(`menu.${nextParents.join('.')}`);
    }

    if (route.routes) {
      keys.push(...collectMenuKeys(route.routes, nextParents));
    }
  }

  return keys;
};

describe('backend capability routes', () => {
  it('registers the first-stage tenant management pages', () => {
    const tenantGroup = routes.find((route) => route.path === '/tenant');

    expect(tenantGroup).toBeDefined();
    expect(tenantGroup?.routes?.map((route) => route.path)).toEqual([
      '/tenant',
      '/tenant/overview',
      '/tenant/settings',
      '/tenant/members',
      '/tenant/invites',
      '/tenant/teams',
    ]);
  });

  it('registers the second-stage access management pages', () => {
    const accessGroup = routes.find((route) => route.path === '/access');

    expect(accessGroup).toBeDefined();
    expect(accessGroup?.routes?.map((route) => route.path)).toEqual([
      '/access',
      '/access/organization-roles',
      '/access/organization-bindings',
      '/access/team-roles',
      '/access/team-bindings',
    ]);
  });

  it('registers the settings management pages without touching account settings tabs', () => {
    const settingsGroup = routes.find((route) => route.path === '/settings-management');

    expect(settingsGroup).toBeDefined();
    expect(settingsGroup?.routes?.map((route) => route.path)).toEqual([
      '/settings-management',
      '/settings-management/organization',
      '/settings-management/team',
    ]);
  });

  it('registers wallet management pages', () => {
    const walletGroup = routes.find((route) => route.path === '/wallet-management');

    expect(walletGroup).toBeDefined();
    expect(walletGroup?.routes?.map((route) => route.path)).toEqual([
      '/wallet-management',
      '/wallet-management/accounts',
      '/wallet-management/withdrawals',
    ]);
  });

  it('registers platform management pages', () => {
    const platformGroup = routes.find((route) => route.path === '/platform-management');
    const paths = platformGroup?.routes?.map((route) => route.path) ?? [];

    expect(platformGroup).toBeDefined();
    expect(paths).toEqual([
      '/platform-management',
      '/platform-management/users',
      '/platform-management/real-name',
      '/platform-management/notifications',
      '/platform-management/notification-dispatches',
      '/platform-management/referrals',
    ]);
    expect(paths).toContain('/platform-management/notification-dispatches');
  });

  it('registers system tools and personal business pages', () => {
    const systemGroup = routes.find((route) => route.path === '/system-tools');
    const personalGroup = routes.find((route) => route.path === '/personal-business');

    expect(systemGroup?.routes?.map((route) => route.path)).toEqual([
      '/system-tools',
      '/system-tools/operations',
    ]);
    expect(personalGroup?.routes?.map((route) => route.path)).toEqual([
      '/personal-business',
      '/personal-business/overview',
    ]);
  });

  it('provides zh-CN menu translations for every named route', () => {
    const missingKeys = collectMenuKeys(routes as AppRoute[]).filter((key) => !(key in zhCN));

    expect(missingKeys).toEqual([]);
  });
});

describe('个人中心路由', () => {
  it('个人中心是主入口，个人设置不再作为菜单项显示', () => {
    const accountGroup = routes.find((route) => route.path === '/account');
    const namedChildren = accountGroup?.routes?.filter((route) => route.name) ?? [];

    expect(namedChildren.map((route) => route.path)).toEqual([
      '/account/center',
    ]);

    expect(accountGroup?.routes?.some((route) => route.path === '/account/settings')).toBe(true);
    expect(accountGroup?.routes?.find((route) => route.path === '/account/settings')?.name).toBeUndefined();
  });
});
