import { getMenuData } from '@ant-design/pro-layout/es/utils/getMenuData.js';
import { getMatchMenu } from '@umijs/route-utils';
import { describe, expect, it } from 'vitest';
import routes from '../config/routes';
import zhCN from './locales/zh-CN';
import {
  DEFAULT_PROPERTY_LIST_PATH,
  RENTAL_PATHS,
  SPACE_PATHS,
} from './utils/adminRouting';

type AppRoute = {
  access?: string;
  component?: string;
  hideInMenu?: boolean;
  icon?: string;
  layout?: boolean;
  locale?: boolean;
  name?: string;
  path?: string;
  redirect?: string;
  routes?: AppRoute[];
};

const collectMenuKeys = (routeList: AppRoute[], parents: string[] = []) => {
  const keys: string[] = [];

  for (const route of routeList) {
    if (route.layout === false || route.path?.includes('*')) {
      continue;
    }

    const nextParents = route.name ? [...parents, route.name] : parents;

    if (route.name && route.locale !== false) {
      keys.push(`menu.${nextParents.join('.')}`);
    }

    if (route.routes) {
      keys.push(...collectMenuKeys(route.routes, nextParents));
    }
  }

  return keys;
};

const appRoutes = routes as AppRoute[];

describe('backend capability routes', () => {
  it('承接 allauth 的公开认证回调页面', () => {
    const authGroup = appRoutes.find((route) => route.path === '/user');
    const authPaths = authGroup?.routes?.map((route) => route.path) ?? [];

    expect(authPaths).toEqual(
      expect.arrayContaining([
        '/user/login',
        '/user/register',
        '/user/verify-phone',
        '/user/password/reset',
        '/user/password/reset/key/:key',
        '/user/confirm-email/:key',
        '/user/social/error',
      ]),
    );
  });

  it('按用户租赁流程组织一级导航', () => {
    const visibleTopLevelNames = appRoutes
      .filter(
        (route) =>
          route.name && route.layout !== false && route.hideInMenu !== true,
      )
      .map((route) => route.name);

    expect(visibleTopLevelNames).toEqual([
      'workbench',
      'property-assets',
      'customers',
      'viewings',
      'leases',
      'earnings',
      'data-insights',
      'space-management',
      'super-admin',
    ]);
  });

  it.each([
    ['客户', RENTAL_PATHS.customers, 'customers'],
    ['带看', RENTAL_PATHS.viewings, 'viewings'],
    ['租约', RENTAL_PATHS.leases, 'leases'],
    ['数据', RENTAL_PATHS.analytics, 'data-insights'],
  ])('访问%s页面时不会匹配并展开房源菜单', (_, pathname, menuName) => {
    const { menuData } = getMenuData(
      appRoutes as unknown as Parameters<typeof getMenuData>[0],
      { locale: false },
      undefined,
    );
    const matchedMenuNames = getMatchMenu(pathname, menuData, true).map(
      (item) => item.name,
    );

    expect(menuData.find((item) => item.name === 'property-assets')?.path).toBe(
      RENTAL_PATHS.properties,
    );
    expect(matchedMenuNames).toContain(menuName);
    expect(matchedMenuNames).not.toContain('property-assets');
  });

  it('租赁命名空间根地址进入工作台', () => {
    const rentalRoot = appRoutes.find(
      (route) => route.path === RENTAL_PATHS.root,
    );

    expect(rentalRoot?.hideInMenu).toBe(true);
    expect(rentalRoot?.redirect).toBe(RENTAL_PATHS.workbenchOverview);
  });

  it('把房源资产相关页面收敛到房源导航', () => {
    const propertyGroup = appRoutes.find(
      (route) => route.path === RENTAL_PATHS.properties,
    );

    expect(propertyGroup?.name).toBe('property-assets');
    expect(propertyGroup?.path).toBe(RENTAL_PATHS.properties);
    expect(propertyGroup?.routes?.[0]?.redirect).toBe(
      DEFAULT_PROPERTY_LIST_PATH,
    );
    expect(propertyGroup?.routes?.map((route) => route.path)).toEqual([
      RENTAL_PATHS.properties,
      RENTAL_PATHS.propertyList,
      RENTAL_PATHS.map,
      RENTAL_PATHS.vacancySync,
      `${RENTAL_PATHS.buildings}/:id`,
      `${RENTAL_PATHS.estates}/:id`,
      RENTAL_PATHS.propertyNew,
      `${RENTAL_PATHS.properties}/:id`,
    ]);
  });

  it('把成员、权限和设置收敛到空间管理', () => {
    const tenantGroup = appRoutes.find(
      (route) => route.path === SPACE_PATHS.root,
    );
    const accessGroup = tenantGroup?.routes?.find(
      (route) => route.path === SPACE_PATHS.access,
    );
    const businessSettingsGroup = tenantGroup?.routes?.find(
      (route) => route.path === SPACE_PATHS.settings,
    );

    expect(tenantGroup?.name).toBe('space-management');
    expect(tenantGroup?.routes?.map((route) => route.path)).toEqual([
      SPACE_PATHS.root,
      SPACE_PATHS.organization,
      SPACE_PATHS.members,
      SPACE_PATHS.invitations,
      SPACE_PATHS.teams,
      SPACE_PATHS.responsibilities,
      SPACE_PATHS.access,
      SPACE_PATHS.profile,
      SPACE_PATHS.subscriptionOrders,
      SPACE_PATHS.subscription,
      SPACE_PATHS.settings,
      SPACE_PATHS.notificationDispatches,
    ]);
    expect(
      tenantGroup?.routes?.find(
        (route) => route.path === SPACE_PATHS.subscriptionOrders,
      )?.hideInMenu,
    ).toBe(true);
    expect(
      tenantGroup?.routes?.find(
        (route) => route.path === SPACE_PATHS.organization,
      ),
    ).toMatchObject({
      name: '组织架构',
      locale: false,
      component: './space/organization',
    });
    expect(
      tenantGroup?.routes?.find((route) => route.path === SPACE_PATHS.members),
    ).toMatchObject({
      hideInMenu: true,
      redirect: `${SPACE_PATHS.organization}?section=members&node=organization&tab=members`,
    });
    expect(
      tenantGroup?.routes?.find(
        (route) => route.path === SPACE_PATHS.invitations,
      ),
    ).toMatchObject({
      hideInMenu: true,
      redirect: `${SPACE_PATHS.organization}?section=members&node=organization&tab=invites`,
    });
    expect(
      tenantGroup?.routes?.find((route) => route.path === SPACE_PATHS.teams),
    ).toMatchObject({
      hideInMenu: true,
      redirect: `${SPACE_PATHS.organization}?section=members&node=organization&tab=overview`,
    });
    expect(
      tenantGroup?.routes?.find(
        (route) => route.path === SPACE_PATHS.responsibilities,
      ),
    ).toMatchObject({
      hideInMenu: true,
      redirect: `${SPACE_PATHS.organization}?section=members&node=organization&tab=members`,
    });
    expect(accessGroup).toMatchObject({
      name: '角色管理',
      locale: false,
      icon: 'key',
      component: './access',
      hideInMenu: true,
    });
    expect(accessGroup?.routes).toBeUndefined();
    expect(
      tenantGroup?.routes?.some((route) =>
        new Set<string>([
          SPACE_PATHS.organizationRoles,
          `${SPACE_PATHS.access}/organization-bindings`,
          SPACE_PATHS.teamRoles,
          `${SPACE_PATHS.access}/team-bindings`,
        ]).has(route.path || ''),
      ),
    ).toBe(false);
    expect(
      tenantGroup?.routes?.find((route) => route.path === SPACE_PATHS.profile),
    ).toMatchObject({
      hideInMenu: true,
      redirect: `${SPACE_PATHS.organization}?section=members&node=organization&tab=overview`,
    });
    expect(businessSettingsGroup?.routes?.map((route) => route.path)).toEqual([
      SPACE_PATHS.settings,
      SPACE_PATHS.organizationSettings,
      SPACE_PATHS.teamSettings,
    ]);
  });

  it('registers wallet management pages', () => {
    const superAdminGroup = appRoutes.find(
      (route) => route.path === '/super-admin',
    );

    expect(superAdminGroup?.routes?.map((route) => route.path)).toContain(
      '/super-admin/wallet/accounts',
    );
    expect(superAdminGroup?.routes?.map((route) => route.path)).toContain(
      '/super-admin/wallet/withdrawals',
    );
  });

  it('registers super admin pages behind the superuser access gate', () => {
    const superAdminGroup = appRoutes.find(
      (route) => route.path === '/super-admin',
    );
    const paths = superAdminGroup?.routes?.map((route) => route.path) ?? [];

    expect(superAdminGroup).toBeDefined();
    expect(superAdminGroup?.access).toBe('canSuperAdmin');
    expect(paths).toEqual([
      '/super-admin',
      '/super-admin/users',
      '/super-admin/real-name',
      '/super-admin/wallet/accounts',
      '/super-admin/wallet/withdrawals',
      '/super-admin/subscriptions',
      '/super-admin/referrals',
      '/super-admin/notification-dispatches',
      '/super-admin/operations',
    ]);
  });

  it('registers system tools and personal pages', () => {
    const rentalWorkbenchGroup = appRoutes.find(
      (route) => route.path === RENTAL_PATHS.workbench,
    );
    const personalGroup = appRoutes.find(
      (route) => route.path === '/personal-business',
    );

    expect(rentalWorkbenchGroup?.routes?.map((route) => route.path)).toEqual([
      RENTAL_PATHS.workbench,
      RENTAL_PATHS.workbenchOverview,
      RENTAL_PATHS.workbenchSpace,
      RENTAL_PATHS.tasks,
      RENTAL_PATHS.announcements,
    ]);
    expect(
      rentalWorkbenchGroup?.routes?.find(
        (route) => route.path === RENTAL_PATHS.workbenchSpace,
      )?.hideInMenu,
    ).toBe(true);
    expect(personalGroup?.routes?.map((route) => route.path)).toEqual([
      '/personal-business',
      '/personal-business/overview',
      '/personal-business/favorites',
      '/personal-business/notifications',
      '/personal-business/landlord',
    ]);
    expect(zhCN['menu.personal-business']).toBe('个人');
    expect(zhCN['menu.personal-business.overview']).toBe('个人概览');
    expect(zhCN['menu.personal-business.favorites']).toBe('我的收藏');
    expect(personalGroup?.hideInMenu).toBe(true);
  });

  it('provides zh-CN menu translations for every named route', () => {
    const missingKeys = collectMenuKeys(appRoutes).filter(
      (key) => !(key in zhCN),
    );

    expect(missingKeys).toEqual([]);
  });
});

describe('个人中心路由', () => {
  it('个人中心是主入口，个人设置不再作为菜单项显示', () => {
    const accountGroup = appRoutes.find((route) => route.path === '/account');
    const namedChildren =
      accountGroup?.routes?.filter((route) => route.name) ?? [];

    expect(namedChildren.map((route) => route.path)).toEqual([
      '/account/center',
    ]);

    expect(
      accountGroup?.routes?.some((route) => route.path === '/account/settings'),
    ).toBe(true);
    expect(
      accountGroup?.routes?.find((route) => route.path === '/account/settings')
        ?.name,
    ).toBeUndefined();
  });
});
