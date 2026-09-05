export const ADMIN_BASE_PATH = '/dashboard';
export const LOGIN_PATH = '/user/login';
export const REGISTER_PATH = '/user/register';
export const REGISTER_RESULT_PATH = '/user/register-result';
export const VERIFY_PHONE_PATH = '/user/verify-phone';
export const PASSWORD_RESET_PATH = '/user/password/reset';
export const PASSWORD_RESET_CONFIRM_PATH = '/user/password/reset/key';
export const EMAIL_CONFIRM_PATH = '/user/confirm-email';
export const SOCIAL_LOGIN_ERROR_PATH = '/user/social/error';

export const RENTAL_PATHS = {
  root: '/rental',
  workbench: '/rental/workbench',
  workbenchOverview: '/rental/workbench/overview',
  workbenchSpace: '/rental/workbench/space',
  tasks: '/rental/workbench/tasks',
  announcements: '/rental/workbench/announcements',
  properties: '/rental/properties',
  propertyList: '/rental/properties/list',
  propertyNew: '/rental/properties/new',
  estates: '/rental/properties/estates',
  map: '/rental/properties/map',
  vacancySync: '/rental/properties/vacancy-sync',
  buildings: '/rental/properties/buildings',
  customers: '/rental/customers',
  viewings: '/rental/viewings',
  leases: '/rental/leases',
  earnings: '/rental/earnings',
  analytics: '/rental/analytics',
} as const;

export const SPACE_PATHS = {
  root: '/space',
  organization: '/space/organization',
  members: '/space/members',
  invitations: '/space/invitations',
  teams: '/space/teams',
  responsibilities: '/space/responsibilities',
  access: '/space/access',
  organizationRoles: '/space/access/organization-roles',
  teamRoles: '/space/access/team-roles',
  profile: '/space/profile',
  subscription: '/space/subscription',
  subscriptionOrders: '/space/subscription/orders',
  settings: '/space/settings',
  organizationSettings: '/space/settings/organization',
  teamSettings: '/space/settings/team',
  notificationDispatches: '/space/notification-dispatches',
} as const;

export const DEFAULT_POST_LOGIN_PATH = RENTAL_PATHS.workbenchOverview;
export const DEFAULT_PROPERTY_LIST_PATH = `${RENTAL_PATHS.propertyList}?scope=all&status=listed`;

export type RoleManagementScope = 'space' | 'team';

export function buildRoleManagementPath(
  scope: RoleManagementScope,
  teamId?: number,
) {
  const params = new URLSearchParams();
  params.set('scope', scope);
  if (scope === 'team' && teamId && teamId > 0) {
    params.set('team', String(teamId));
  }
  return `${SPACE_PATHS.access}?${params.toString()}`;
}

const AUTH_PATHS = new Set([
  LOGIN_PATH,
  REGISTER_PATH,
  REGISTER_RESULT_PATH,
  VERIFY_PHONE_PATH,
  PASSWORD_RESET_PATH,
  SOCIAL_LOGIN_ERROR_PATH,
]);

export function normalizeAdminPath(path?: string | null) {
  const value = (path || '').trim();
  if (!value) {
    return '/';
  }
  if (!value.startsWith('/')) {
    return '/';
  }
  if (value === ADMIN_BASE_PATH) {
    return '/';
  }
  if (value.startsWith(`${ADMIN_BASE_PATH}/`)) {
    return value.slice(ADMIN_BASE_PATH.length) || '/';
  }
  return value;
}

export function buildAdminPath(
  pathname?: string | null,
  search = '',
  hash = '',
) {
  return `${normalizeAdminPath(pathname)}${search}${hash}`;
}

function parseSafeAdminRedirect(value?: string | null) {
  const redirect = (value || '').trim();
  if (!redirect.startsWith('/') || redirect.startsWith('//')) {
    return undefined;
  }

  try {
    const baseUrl = new URL('https://admin.local');
    const parsed = new URL(redirect, baseUrl);
    if (parsed.origin !== baseUrl.origin) {
      return undefined;
    }
    const normalized = buildAdminPath(
      parsed.pathname,
      parsed.search,
      parsed.hash,
    );
    return normalized.startsWith('//') ? undefined : normalized;
  } catch (_error) {
    return undefined;
  }
}

export function getSafeAdminRedirect(
  value?: string | null,
  fallback: string = DEFAULT_POST_LOGIN_PATH,
): string {
  return parseSafeAdminRedirect(value) || fallback;
}

export function buildAuthRedirectPath(
  authPath: string,
  redirect?: string | null,
) {
  const safeRedirect = parseSafeAdminRedirect(redirect);
  if (!safeRedirect) {
    return authPath;
  }
  const params = new URLSearchParams({ redirect: safeRedirect });
  return `${authPath}?${params.toString()}`;
}

export function isAuthPagePath(pathname?: string | null) {
  const normalized = normalizeAdminPath(pathname);
  return (
    AUTH_PATHS.has(normalized) ||
    normalized.startsWith(`${PASSWORD_RESET_CONFIRM_PATH}/`) ||
    normalized.startsWith(`${EMAIL_CONFIRM_PATH}/`)
  );
}

export function isPublicPagePath(pathname?: string | null) {
  return normalizeAdminPath(pathname).startsWith('/landlords/');
}

export function isAnonymousPagePath(pathname?: string | null) {
  const normalized = normalizeAdminPath(pathname);
  return (
    isAuthPagePath(normalized) ||
    normalized.startsWith('/landlord-invitations/') ||
    isPublicPagePath(normalized)
  );
}
