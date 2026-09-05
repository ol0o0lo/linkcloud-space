import { describe, expect, it } from 'vitest';
import routes from '../config/routes';
import access from './access';
import { RENTAL_PATHS, SPACE_PATHS } from './utils/adminRouting';

type AppRoute = {
  access?: string;
  path?: string;
  routes?: AppRoute[];
};

function findRoute(routeList: AppRoute[], path: string): AppRoute | undefined {
  for (const route of routeList) {
    if (route.path === path) return route;
    const nested = route.routes ? findRoute(route.routes, path) : undefined;
    if (nested) return nested;
  }
  return undefined;
}

describe('access', () => {
  it('should return canAdmin true when user has admin access', () => {
    const initialState = {
      currentUser: {
        id: 1,
        email: 'admin@example.com',
        username: 'admin',
        first_name: 'Admin',
        last_name: 'User',
        timezone: 'Asia/Shanghai',
        avatar_url: 'https://example.com/avatar.png',
        phone_verified: true,
        real_name_status: 'verified',
        real_name_status__mapping: '已认证',
        is_staff: true,
        is_superuser: false,
      },
    };

    const result = access(initialState);

    expect(result.canAdmin).toBe(true);
    expect(result.canSuperAdmin).toBe(false);
    expect(result.canViewSpaceWorkbench).toBe(false);
  });

  it('should return canAdmin false when user has non-admin access', () => {
    const initialState = {
      currentUser: {
        id: 2,
        email: 'user@example.com',
        username: 'user',
        first_name: 'Regular',
        last_name: 'User',
        timezone: 'Asia/Shanghai',
        avatar_url: 'https://example.com/avatar.png',
        phone_verified: true,
        real_name_status: 'verified',
        real_name_status__mapping: '已认证',
        is_staff: false,
        is_superuser: false,
      },
    };

    const result = access(initialState);

    expect(result.canAdmin).toBe(false);
    expect(result.canSuperAdmin).toBe(false);
  });

  it('should return canAdmin false when user is not admin', () => {
    const initialState = {
      currentUser: {
        id: 3,
        email: 'guest@example.com',
        username: 'guest',
        first_name: 'Guest',
        last_name: 'User',
        timezone: 'Asia/Shanghai',
        avatar_url: 'https://example.com/avatar.png',
        phone_verified: false,
        real_name_status: 'unverified',
        real_name_status__mapping: '未认证',
        is_staff: false,
        is_superuser: false,
      },
    };

    const result = access(initialState);

    expect(result.canAdmin).toBe(false);
    expect(result.canSuperAdmin).toBe(false);
  });

  it('should return canSuperAdmin true only for superusers', () => {
    const result = access({
      currentUser: {
        id: 4,
        email: 'root@example.com',
        username: 'root',
        first_name: 'Root',
        last_name: 'User',
        timezone: 'Asia/Shanghai',
        phone_verified: true,
        real_name_status: 'verified',
        real_name_status__mapping: '已认证',
        is_staff: false,
        is_superuser: true,
      },
    });

    expect(result.canAdmin).toBe(true);
    expect(result.canSuperAdmin).toBe(true);
  });

  it('should return canAdmin false when currentUser is undefined', () => {
    const initialState = {
      currentUser: undefined,
    };

    const result = access(initialState);

    expect(result.canAdmin).toBeFalsy();
    expect(result.canSuperAdmin).toBeFalsy();
  });

  it('should return canAdmin false when initialState is undefined', () => {
    const result = access(undefined);

    expect(result.canAdmin).toBeFalsy();
    expect(result.canSuperAdmin).toBeFalsy();
  });

  it('only exposes the space workbench for organization-level managers', () => {
    expect(
      access({
        teamOperationsCapabilities: {
          announcement_organization_manage: false,
          announcement_team_ids: [],
          task_organization_manage: true,
          task_team_ids: [],
        },
      }).canViewSpaceWorkbench,
    ).toBe(true);
    expect(
      access({
        teamOperationsCapabilities: {
          announcement_organization_manage: false,
          announcement_team_ids: [],
          task_organization_manage: false,
          task_team_ids: [],
        },
      }).canViewSpaceWorkbench,
    ).toBe(false);
  });

  it('maps backend navigation capabilities to Umi access keys', () => {
    const result = access({
      navigationCapabilities: {
        role_management: true,
        organization_settings: false,
        team_settings: true,
        subscriptions: true,
        analytics: false,
        allocation: true,
        notification_dispatches: false,
      },
    });

    expect(result).toMatchObject({
      canViewRoleManagement: true,
      canViewOrganizationSettings: false,
      canViewTeamSettings: true,
      canViewBusinessSettings: true,
      canViewSubscriptions: true,
      canViewAnalytics: false,
      canViewAllocation: true,
      canManageNotificationDispatches: false,
    });
  });

  it('declares access keys on restricted tenant routes', () => {
    const appRoutes = routes as AppRoute[];

    expect(findRoute(appRoutes, RENTAL_PATHS.earnings)?.access).toBe(
      'canViewAllocation',
    );
    expect(findRoute(appRoutes, RENTAL_PATHS.analytics)?.access).toBe(
      'canViewAnalytics',
    );
    expect(findRoute(appRoutes, SPACE_PATHS.access)?.access).toBe(
      'canViewRoleManagement',
    );
    expect(findRoute(appRoutes, SPACE_PATHS.subscription)?.access).toBe(
      'canViewSubscriptions',
    );
    expect(findRoute(appRoutes, SPACE_PATHS.organizationSettings)?.access).toBe(
      'canViewOrganizationSettings',
    );
    expect(findRoute(appRoutes, SPACE_PATHS.teamSettings)?.access).toBe(
      'canViewTeamSettings',
    );
    expect(
      findRoute(appRoutes, SPACE_PATHS.notificationDispatches)?.access,
    ).toBe('canManageNotificationDispatches');
  });
});
