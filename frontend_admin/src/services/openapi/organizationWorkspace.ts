// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** 获取组织架构成员目录 GET /api/organization-workspace/members/ */
export async function appsOrganizationsWorkspaceApiListWorkspaceMembers(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsOrganizationsWorkspaceApiListWorkspaceMembersParams,
  options?: { [key: string]: any }
) {
  return request<API.PagedWorkspaceMemberOut>(
    "/api/organization-workspace/members/",
    {
      method: "GET",
      params: {
        // page has a default value: 1
        page: "1",
        ...params,
      },
      ...(options || {}),
    }
  );
}

/** 获取组织架构成员详情 GET /api/organization-workspace/members/${param0}/ */
export async function appsOrganizationsWorkspaceApiGetWorkspaceMember(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsOrganizationsWorkspaceApiGetWorkspaceMemberParams,
  options?: { [key: string]: any }
) {
  const { member_id: param0, ...queryParams } = params;
  return request<API.WorkspaceMemberOut>(
    `/api/organization-workspace/members/${param0}/`,
    {
      method: "GET",
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}

/** 获取组织架构导航摘要 GET /api/organization-workspace/navigation/ */
export async function appsOrganizationsWorkspaceApiGetNavigation(options?: {
  [key: string]: any;
}) {
  return request<API.OrganizationNavigationOut>(
    "/api/organization-workspace/navigation/",
    {
      method: "GET",
      ...(options || {}),
    }
  );
}

/** 搜索组织架构 GET /api/organization-workspace/search/ */
export async function appsOrganizationsWorkspaceApiSearchWorkspace(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsOrganizationsWorkspaceApiSearchWorkspaceParams,
  options?: { [key: string]: any }
) {
  return request<API.OrganizationSearchOut>(
    "/api/organization-workspace/search/",
    {
      method: "GET",
      params: {
        ...params,
      },
      ...(options || {}),
    }
  );
}
