// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** 获取角色管理作用范围导航 GET /api/access/role-management/navigation/ */
export async function appsAccessApiGetRoleManagementNavigation(options?: {
  [key: string]: any;
}) {
  return request<API.RoleManagementNavigationOut>(
    "/api/access/role-management/navigation/",
    {
      method: "GET",
      ...(options || {}),
    }
  );
}

/** 分页获取角色候选及授权成员 GET /api/access/role-management/roles/${param0}/members/ */
export async function appsAccessApiListRoleMembers(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsAccessApiListRoleMembersParams,
  options?: { [key: string]: any }
) {
  const { role_id: param0, ...queryParams } = params;
  return request<API.PagedRoleMemberOptionOut>(
    `/api/access/role-management/roles/${param0}/members/`,
    {
      method: "GET",
      params: {
        // assignment has a default value: all
        assignment: "all",
        // page has a default value: 1
        page: "1",
        ...queryParams,
      },
      ...(options || {}),
    }
  );
}

/** 批量调整角色成员授权 PATCH /api/access/role-management/roles/${param0}/members/ */
export async function appsAccessApiPatchRoleMembers(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsAccessApiPatchRoleMembersParams,
  body: API.RoleMemberAssignmentIn,
  options?: { [key: string]: any }
) {
  const { role_id: param0, ...queryParams } = params;
  return request<API.RoleMemberAssignmentOut>(
    `/api/access/role-management/roles/${param0}/members/`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      params: {
        ...queryParams,
      },
      data: body,
      ...(options || {}),
    }
  );
}
