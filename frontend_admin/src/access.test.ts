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
        is_staff: true,
        is_superuser: false,
      },
    };

    const result = access(initialState);

    expect(result.canAdmin).toBe(true);
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
        is_staff: false,
        is_superuser: false,
      },
    };

    const result = access(initialState);

    expect(result.canAdmin).toBe(false);
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
        is_staff: false,
        is_superuser: false,
      },
    };

    const result = access(initialState);

    expect(result.canAdmin).toBe(false);
  });

  it('should return canAdmin false when currentUser is undefined', () => {
    const initialState = {
      currentUser: undefined,
    };

    const result = access(initialState);

    expect(result.canAdmin).toBeFalsy();
  });

  it('should return canAdmin false when initialState is undefined', () => {
    const result = access(undefined);

    expect(result.canAdmin).toBeFalsy();
  });
});
