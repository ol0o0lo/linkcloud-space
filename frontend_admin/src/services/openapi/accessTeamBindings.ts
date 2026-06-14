// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** 获取团队级角色绑定列表 返回指定 team 下用户与 team 级角色的绑定关系，用于展示团队内实际授权结果。 GET /api/access/teams/${param0}/bindings/ */
export async function appsAccessApiListTeamBindingsView(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsAccessApiListTeamBindingsViewParams,
  options?: { [key: string]: any }
) {
  const { team_id: param0, ...queryParams } = params;
  return request<API.TeamBindingOut[]>(
    `/api/access/teams/${param0}/bindings/`,
    {
      method: "GET",
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}

/** 分配团队级角色 给指定 team 的成员绑定一个 team 级角色，角色仅在该 team 范围内生效。 POST /api/access/teams/${param0}/bindings/ */
export async function appsAccessApiCreateTeamBinding(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsAccessApiCreateTeamBindingParams,
  body: API.RoleBindingIn,
  options?: { [key: string]: any }
) {
  const { team_id: param0, ...queryParams } = params;
  return request<API.TeamBindingOut>(`/api/access/teams/${param0}/bindings/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** 移除团队级角色绑定 删除指定 team 下某个用户的 team 级角色绑定。 DELETE /api/access/teams/${param0}/bindings/${param1}/ */
export async function appsAccessApiDeleteTeamBinding(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsAccessApiDeleteTeamBindingParams,
  options?: { [key: string]: any }
) {
  const { team_id: param0, binding_id: param1, ...queryParams } = params;
  return request<any>(`/api/access/teams/${param0}/bindings/${param1}/`, {
    method: "DELETE",
    params: { ...queryParams },
    ...(options || {}),
  });
}
