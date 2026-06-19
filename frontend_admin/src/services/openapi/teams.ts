// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** 获取团队列表 返回当前租户下用户可见的团队列表，支持按名称搜索。 GET /api/teams/ */
export async function appsTeamsApiListTeams(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsTeamsApiListTeamsParams,
  options?: { [key: string]: any }
) {
  return request<API.PagedTeamOut>("/api/teams/", {
    method: "GET",
    params: {
      // page has a default value: 1
      page: "1",
      ...params,
    },
    ...(options || {}),
  });
}

/** 创建团队 在当前租户下创建一个新团队，并可设置初始成员。 POST /api/teams/ */
export async function appsTeamsApiCreateTeam(
  body: API.TeamIn,
  options?: { [key: string]: any }
) {
  return request<API.TeamOut>("/api/teams/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** 获取团队详情 返回当前用户有权限访问的单个团队详情。 GET /api/teams/${param0}/ */
export async function appsTeamsApiGetTeam(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsTeamsApiGetTeamParams,
  options?: { [key: string]: any }
) {
  const { team_id: param0, ...queryParams } = params;
  return request<API.TeamOut>(`/api/teams/${param0}/`, {
    method: "GET",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 删除团队 删除指定团队。 DELETE /api/teams/${param0}/ */
export async function appsTeamsApiDeleteTeam(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsTeamsApiDeleteTeamParams,
  options?: { [key: string]: any }
) {
  const { team_id: param0, ...queryParams } = params;
  return request<Record<string, any>>(`/api/teams/${param0}/`, {
    method: "DELETE",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 更新团队 更新团队名称或成员列表，成员变更需要额外的成员管理权限。 PATCH /api/teams/${param0}/ */
export async function appsTeamsApiPatchTeam(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsTeamsApiPatchTeamParams,
  body: API.TeamPatchIn,
  options?: { [key: string]: any }
) {
  const { team_id: param0, ...queryParams } = params;
  return request<API.TeamOut>(`/api/teams/${param0}/`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}
