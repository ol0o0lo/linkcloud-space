import { describe, expect, it } from 'vitest';
import access from './access';

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
});
