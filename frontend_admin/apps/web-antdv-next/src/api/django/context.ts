import type { UserInfo } from '@vben/types';

import { djangoGet } from './client';

export interface DjangoUser {
  id: number;
  id_number_masked: string;
  email: string;
  username: string;
  first_name: string;
  last_name: string;
  real_name_masked: string;
  real_name_status: string;
  timezone: string;
  avatar_url: null | string;
  phone: null | string;
  phone_verified: boolean;
  is_staff: boolean;
  is_superuser: boolean;
  organizations: Array<{ id: number; name: string; slug: string }>;
}

export interface DjangoAppContext {
  user: DjangoUser | null;
  org: null | { id: number; is_owner: boolean; name: string; slug: string };
  organizations: Array<{ id: number; name: string; slug: string }>;
  orgMemberCount: number;
  orgOwnerCount: number;
  siteName: string;
  version: string;
}

export async function getAppContextApi() {
  return djangoGet<DjangoAppContext>('/app-context/');
}

export function getAccessCodesFromContext(context: DjangoAppContext) {
  const codes = ['notification:read', 'profile:update'];
  const user = context.user;
  if (!user) return [];

  if (user.is_staff || user.is_superuser) {
    codes.push('admin', 'admin:user', 'admin:team', 'admin:settings');
  }
  if (user.is_superuser || context.org?.is_owner) {
    codes.push('admin:organization');
  }
  if (user.is_superuser) {
    codes.push('admin:superuser', 'admin:real-name');
  }
  return [...new Set(codes)];
}

export function mapContextToUserInfo(context: DjangoAppContext): UserInfo {
  const user = context.user;
  if (!user) {
    throw new Error('Authentication required.');
  }

  const realName =
    [user.first_name, user.last_name].filter(Boolean).join(' ') ||
    user.email ||
    user.username;
  const roles = user.is_superuser
    ? ['super', 'admin', 'user']
    : user.is_staff
      ? ['admin', 'user']
      : ['user'];

  return {
    avatar: user.avatar_url || '',
    desc: context.org?.name || context.siteName || '',
    email: user.email,
    homePath: user.is_staff || user.is_superuser ? '/dashboard/overview' : '/profile',
    phone: user.phone,
    realName,
    roles,
    token: 'session',
    userId: String(user.id),
    username: user.username || user.email,
  } as UserInfo;
}
