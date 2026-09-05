import { describe, expect, it } from 'vitest';
import {
  buildOrganizationLocation,
  DEFAULT_ORGANIZATION_ROUTE,
  memberIdFromNode,
  parseOrganizationRoute,
  teamIdFromNode,
} from './model';

describe('组织架构 URL 状态', () => {
  it('默认进入独立的所有成员节点', () => {
    expect(parseOrganizationRoute('')).toEqual(DEFAULT_ORGANIZATION_ROUTE);
  });

  it('解析所有成员节点且不兼容旧邀请节点', () => {
    expect(
      parseOrganizationRoute('?section=members&node=all&tab=directory'),
    ).toMatchObject({ node: 'all', tab: 'members' });
    expect(
      parseOrganizationRoute('?section=members&node=invites&tab=list'),
    ).toEqual(DEFAULT_ORGANIZATION_ROUTE);
  });

  it('解析成员和团队深链接', () => {
    expect(
      parseOrganizationRoute(
        '?section=members&node=member:42&tab=responsibilities',
      ),
    ).toMatchObject({
      section: 'members',
      node: 'member:42',
      tab: 'responsibilities',
    });
    expect(
      parseOrganizationRoute('?section=members&node=team:7&tab=members'),
    ).toMatchObject({
      node: 'team:7',
      tab: 'members',
    });
    expect(
      parseOrganizationRoute('?section=members&node=team:7'),
    ).toMatchObject({
      node: 'team:7',
      tab: 'members',
    });
    expect(
      parseOrganizationRoute('?section=members&node=member:42&tab=teams'),
    ).toMatchObject({
      node: 'member:42',
      tab: 'profile',
    });
  });

  it('组织节点承载资料、角色和邀请上下文', () => {
    expect(
      parseOrganizationRoute('?section=members&node=organization&tab=overview'),
    ).toMatchObject({ node: 'organization', tab: 'overview' });
    expect(
      parseOrganizationRoute('?section=members&node=organization&tab=members'),
    ).toMatchObject({ node: 'organization', tab: 'overview' });
    expect(
      parseOrganizationRoute('?section=members&node=organization&tab=roles'),
    ).toMatchObject({ node: 'organization', tab: 'roles' });
  });

  it('角色管理参数不再由组织架构页面承载', () => {
    expect(
      parseOrganizationRoute(
        '?section=roles&scope=team&team=7&action=new-role',
      ),
    ).toEqual(DEFAULT_ORGANIZATION_ROUTE);
  });

  it('非法参数回退到安全默认值', () => {
    expect(
      parseOrganizationRoute('?section=broken&node=member:nope&tab=broken'),
    ).toEqual(DEFAULT_ORGANIZATION_ROUTE);
  });

  it('构建位置并提取节点 ID', () => {
    const location = buildOrganizationLocation(DEFAULT_ORGANIZATION_ROUTE, {
      node: 'member:12',
      tab: 'access',
    });
    expect(location).toBe(
      '/space/organization?section=members&node=member%3A12&tab=access',
    );
    expect(memberIdFromNode('member:12')).toBe(12);
    expect(teamIdFromNode('team:9')).toBe(9);
  });
});
