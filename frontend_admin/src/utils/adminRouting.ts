export const ADMIN_BASE_PATH = '/dashboard';
export const LOGIN_PATH = '/user/login';
export const REGISTER_PATH = '/user/register';
export const REGISTER_RESULT_PATH = '/user/register-result';
export const DEFAULT_POST_LOGIN_PATH = '/property-rental/houses';

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

export function buildAdminPath(pathname?: string | null, search = '', hash = '') {
  return `${normalizeAdminPath(pathname)}${search}${hash}`;
}

export function isAuthPagePath(pathname?: string | null) {
  return AUTH_PATHS.has(normalizeAdminPath(pathname));
}
