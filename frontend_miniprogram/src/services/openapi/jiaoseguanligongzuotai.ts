/* eslint-disable */
// @ts-ignore
import request from '@/http/vue-query';
import { CustomRequestOptions_ } from '@/http/types';

import * as API from './types';

/** 获取角色管理作用范围导航 GET /api/access/role-management/navigation/ */
export function accessRoleManagementNavigationUsingGet({
  options,
}: {
  options?: CustomRequestOptions_;
}) {
  return request<API.RoleManagementNavigationOut>(
    '/api/access/role-management/navigation/',
    {
      method: 'GET',
      ...(options || {}),
    }
  );
}

/** 分页获取角色候选及授权成员 GET /api/access/role-management/roles/${param0}/members/ */
export function accessRoleManagementRolesRoleIdMembersUsingGet({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.AccessRoleManagementRolesRoleIdMembersUsingGetParams;
  options?: CustomRequestOptions_;
}) {
  const { role_id: param0, ...queryParams } = params;

  return request<API.PagedRoleMemberOptionOut>(
    `/api/access/role-management/roles/${param0}/members/`,
    {
      method: 'GET',
      params: {
        // assignment has a default value: all
        assignment: 'all',
        // page has a default value: 1
        page: '1',
        ...queryParams,
      },
      ...(options || {}),
    }
  );
}

/** 批量调整角色成员授权 PATCH /api/access/role-management/roles/${param0}/members/ */
export function accessRoleManagementRolesRoleIdMembersUsingPatch({
  params,
  body,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.AccessRoleManagementRolesRoleIdMembersUsingPatchParams;
  body: API.RoleMemberAssignmentIn;
  options?: CustomRequestOptions_;
}) {
  const { role_id: param0, ...queryParams } = params;

  return request<API.RoleMemberAssignmentOut>(
    `/api/access/role-management/roles/${param0}/members/`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      params: {
        ...queryParams,
      },
      data: body,
      ...(options || {}),
    }
  );
}
