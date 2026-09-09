/* eslint-disable */
// @ts-ignore
import request from '@/http/vue-query';
import { CustomRequestOptions_ } from '@/http/types';

import * as API from './types';

/** 获取组织架构成员目录 GET /api/organization-workspace/members/ */
export function organizationWorkspaceMembersUsingGet({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.OrganizationWorkspaceMembersUsingGetParams;
  options?: CustomRequestOptions_;
}) {
  return request<API.PagedWorkspaceMemberOut>(
    '/api/organization-workspace/members/',
    {
      method: 'GET',
      params: {
        // page has a default value: 1
        page: '1',
        ...params,
      },
      ...(options || {}),
    }
  );
}

/** 获取组织架构成员详情 GET /api/organization-workspace/members/${param0}/ */
export function organizationWorkspaceMembersMemberIdUsingGet({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.OrganizationWorkspaceMembersMemberIdUsingGetParams;
  options?: CustomRequestOptions_;
}) {
  const { member_id: param0, ...queryParams } = params;

  return request<API.WorkspaceMemberOut>(
    `/api/organization-workspace/members/${param0}/`,
    {
      method: 'GET',
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}

/** 获取组织架构导航摘要 GET /api/organization-workspace/navigation/ */
export function organizationWorkspaceNavigationUsingGet({
  options,
}: {
  options?: CustomRequestOptions_;
}) {
  return request<API.OrganizationNavigationOut>(
    '/api/organization-workspace/navigation/',
    {
      method: 'GET',
      ...(options || {}),
    }
  );
}

/** 搜索组织架构 GET /api/organization-workspace/search/ */
export function organizationWorkspaceSearchUsingGet({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.OrganizationWorkspaceSearchUsingGetParams;
  options?: CustomRequestOptions_;
}) {
  return request<API.OrganizationSearchOut>(
    '/api/organization-workspace/search/',
    {
      method: 'GET',
      params: {
        ...params,
      },
      ...(options || {}),
    }
  );
}
