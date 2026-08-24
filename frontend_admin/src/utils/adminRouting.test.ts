import { describe, expect, it } from 'vitest';
import {
  buildAdminPath,
  buildRoleManagementPath,
  DEFAULT_POST_LOGIN_PATH,
  isAuthPagePath,
  normalizeAdminPath,
  RENTAL_PATHS,
  SPACE_PATHS,
} from './adminRouting';

describe('管理端规范路由', () => {
  it('默认进入租赁工作台', () => {
    expect(DEFAULT_POST_LOGIN_PATH).toBe(RENTAL_PATHS.workbenchOverview);
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

  it('只把认证页面识别为认证路由', () => {
    expect(isAuthPagePath('/dashboard/user/login')).toBe(true);
    expect(isAuthPagePath(RENTAL_PATHS.workbenchOverview)).toBe(false);
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
