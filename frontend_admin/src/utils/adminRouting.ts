export const ADMIN_BASE_PATH = '/dashboard';
export const LOGIN_PATH = '/user/login';
export const REGISTER_PATH = '/user/register';
export const REGISTER_RESULT_PATH = '/user/register-result';

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

const AUTH_PATHS = new Set([LOGIN_PATH, REGISTER_PATH, REGISTER_RESULT_PATH]);

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

export function isAuthPagePath(pathname?: string | null) {
  return AUTH_PATHS.has(normalizeAdminPath(pathname));
}
