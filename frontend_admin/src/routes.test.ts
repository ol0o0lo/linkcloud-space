import { describe, expect, it } from 'vitest';
import routes from '../config/routes';
import zhCN from './locales/zh-CN';

type AppRoute = {
  access?: string;
  hideInMenu?: boolean;
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
    const superAdminGroup = routes.find((route) => route.path === '/super-admin');

    expect(superAdminGroup?.routes?.map((route) => route.path)).toContain('/super-admin/wallet/accounts');
    expect(superAdminGroup?.routes?.map((route) => route.path)).toContain('/super-admin/wallet/withdrawals');
  });

  it('registers super admin pages behind the superuser access gate', () => {
    const superAdminGroup = routes.find((route) => route.path === '/super-admin');
    const paths = superAdminGroup?.routes?.map((route) => route.path) ?? [];

    expect(superAdminGroup).toBeDefined();
    expect(superAdminGroup?.access).toBe('canSuperAdmin');
    expect(paths).toEqual([
      '/super-admin',
      '/super-admin/users',
      '/super-admin/real-name',
      '/super-admin/wallet/accounts',
      '/super-admin/wallet/withdrawals',
      '/super-admin/referrals',
      '/super-admin/notification-dispatches',
      '/super-admin/operations',
    ]);
  });

  it('registers system tools and personal business pages', () => {
    const tenantOperationsGroup = routes.find((route) => route.path === '/tenant-operations');
    const personalGroup = routes.find((route) => route.path === '/personal-business');

    expect(tenantOperationsGroup?.routes?.map((route) => route.path)).toEqual([
      '/tenant-operations',
      '/tenant-operations/notification-dispatches',
    ]);
    expect(personalGroup?.routes?.map((route) => route.path)).toEqual([
      '/personal-business',
      '/personal-business/overview',
      '/personal-business/notifications',
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
