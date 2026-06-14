// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** 获取团队级角色列表 返回当前组织可用的 team 级角色，供指定 team 的授权配置使用。 GET /api/access/teams/${param0}/roles/ */
export async function appsAccessApiListTeamRoles(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsAccessApiListTeamRolesParams,
  options?: { [key: string]: any }
) {
  const { team_id: param0, ...queryParams } = params;
  return request<API.AccessRoleOut[]>(`/api/access/teams/${param0}/roles/`, {
    method: "GET",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 创建团队级自定义角色 在当前组织下创建 team 级自定义角色，用于后续绑定到具体 team 成员。 POST /api/access/teams/${param0}/roles/ */
export async function appsAccessApiCreateTeamRole(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsAccessApiCreateTeamRoleParams,
  body: API.CustomRoleCreateIn,
  options?: { [key: string]: any }
) {
  const { team_id: param0, ...queryParams } = params;
  return request<API.AccessRoleOut>(`/api/access/teams/${param0}/roles/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** 停用团队级自定义角色 将当前组织下的 team 级自定义角色标记为停用，不会物理删除历史绑定记录。 DELETE /api/access/teams/${param0}/roles/${param1}/ */
export async function appsAccessApiDeleteTeamRole(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsAccessApiDeleteTeamRoleParams,
  options?: { [key: string]: any }
) {
  const { team_id: param0, role_id: param1, ...queryParams } = params;
  return request<any>(`/api/access/teams/${param0}/roles/${param1}/`, {
    method: "DELETE",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 更新团队级自定义角色 修改当前组织下的 team 级自定义角色名称、编码、权限列表或启停状态；系统预置角色不能通过该接口修改。 PATCH /api/access/teams/${param0}/roles/${param1}/ */
export async function appsAccessApiPatchTeamRole(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsAccessApiPatchTeamRoleParams,
  body: API.CustomRolePatchIn,
  options?: { [key: string]: any }
) {
  const { team_id: param0, role_id: param1, ...queryParams } = params;
  return request<API.AccessRoleOut>(
    `/api/access/teams/${param0}/roles/${param1}/`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      params: { ...queryParams },
      data: body,
      ...(options || {}),
    }
  );
}
