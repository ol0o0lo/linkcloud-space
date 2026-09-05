import { describe, expect, it } from 'vitest';
import {
  buildAdminPath,
  buildAuthRedirectPath,
  buildRoleManagementPath,
  DEFAULT_POST_LOGIN_PATH,
  DEFAULT_PROPERTY_LIST_PATH,
  EMAIL_CONFIRM_PATH,
  getSafeAdminRedirect,
  isAnonymousPagePath,
  isAuthPagePath,
  isPublicPagePath,
  normalizeAdminPath,
  PASSWORD_RESET_CONFIRM_PATH,
  PASSWORD_RESET_PATH,
  RENTAL_PATHS,
  SOCIAL_LOGIN_ERROR_PATH,
  SPACE_PATHS,
  VERIFY_PHONE_PATH,
} from './adminRouting';

describe('管理端规范路由', () => {
  it('默认进入租赁工作台', () => {
    expect(DEFAULT_POST_LOGIN_PATH).toBe(RENTAL_PATHS.workbenchOverview);
  });

  it('房源菜单默认进入全部范围的招租房源', () => {
    expect(DEFAULT_PROPERTY_LIST_PATH).toBe(
      `${RENTAL_PATHS.propertyList}?scope=all&status=listed`,
    );
  });

  it('租赁和空间路由使用独立命名空间', () => {
    expect(
      Object.values(RENTAL_PATHS).every((path) => path.startsWith('/rental')),
    ).toBe(true);
    expect(
      Object.values(SPACE_PATHS).every((path) => path.startsWith('/space')),
    ).toBe(true);
  });

  it('移除部署前缀并保留规范路径', () => {
    expect(normalizeAdminPath('/dashboard/rental/customers')).toBe(
      RENTAL_PATHS.customers,
    );
    expect(normalizeAdminPath(RENTAL_PATHS.analytics)).toBe(
      RENTAL_PATHS.analytics,
    );
  });

  it('构建管理端内部地址时保留查询参数和锚点', () => {
    expect(
      buildAdminPath(
        `/dashboard${RENTAL_PATHS.customers}`,
        '?preview=7',
        '#detail',
      ),
    ).toBe(`${RENTAL_PATHS.customers}?preview=7#detail`);
  });

  it('安全解析登录后的管理端目标地址', () => {
    expect(
      getSafeAdminRedirect('/dashboard/space/invitations?source=mail#accept'),
    ).toBe('/space/invitations?source=mail#accept');
    expect(getSafeAdminRedirect('//evil.example/path')).toBe(
      DEFAULT_POST_LOGIN_PATH,
    );
    expect(getSafeAdminRedirect('https://evil.example/path')).toBe(
      DEFAULT_POST_LOGIN_PATH,
    );
    expect(getSafeAdminRedirect('/\\evil.example/path')).toBe(
      DEFAULT_POST_LOGIN_PATH,
    );
  });

  it('认证页面之间只透传安全的 redirect', () => {
    expect(
      buildAuthRedirectPath(
        '/user/register',
        '/dashboard/space/invitations?source=mail#accept',
      ),
    ).toBe(
      '/user/register?redirect=%2Fspace%2Finvitations%3Fsource%3Dmail%23accept',
    );
    expect(buildAuthRedirectPath('/user/register', '//evil.example')).toBe(
      '/user/register',
    );
  });

  it('只把认证页面识别为认证路由', () => {
    expect(isAuthPagePath('/dashboard/user/login')).toBe(true);
    expect(isAuthPagePath(`/dashboard${VERIFY_PHONE_PATH}`)).toBe(true);
    expect(isAuthPagePath(`/dashboard${PASSWORD_RESET_PATH}`)).toBe(true);
    expect(
      isAuthPagePath(`/dashboard${PASSWORD_RESET_CONFIRM_PATH}/reset-key`),
    ).toBe(true);
    expect(isAuthPagePath(`/dashboard${EMAIL_CONFIRM_PATH}/email-key`)).toBe(
      true,
    );
    expect(isAuthPagePath(`/dashboard${SOCIAL_LOGIN_ERROR_PATH}`)).toBe(true);
    expect(isAuthPagePath(RENTAL_PATHS.workbenchOverview)).toBe(false);
  });

  it('允许房东邀请和公开店铺匿名打开', () => {
    expect(isAnonymousPagePath('/dashboard/landlord-invitations/token-1')).toBe(
      true,
    );
    expect(isAnonymousPagePath('/dashboard/landlords/public-key')).toBe(true);
    expect(isPublicPagePath('/dashboard/landlords/public-key')).toBe(true);
    expect(isPublicPagePath('/dashboard/landlord-invitations/token-1')).toBe(
      false,
    );
    expect(isAnonymousPagePath(RENTAL_PATHS.workbenchOverview)).toBe(false);
  });

  it('无效输入回退到根地址', () => {
    expect(normalizeAdminPath()).toBe('/');
    expect(normalizeAdminPath('rental/customers')).toBe('/');
  });

  it('房源详情与房源列表拥有稳定且不同的地址', () => {
    expect(`${RENTAL_PATHS.properties}/12`).not.toBe(RENTAL_PATHS.propertyList);
  });

  it('构建统一角色管理的空间和团队上下文地址', () => {
    expect(buildRoleManagementPath('space')).toBe('/space/access?scope=space');
    expect(buildRoleManagementPath('team', 7)).toBe(
      '/space/access?scope=team&team=7',
    );
  });
});
