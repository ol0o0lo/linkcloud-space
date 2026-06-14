// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** 获取租户成员列表 返回当前租户成员列表，支持按姓名、用户名和邮箱搜索。 GET /api/organization-members/ */
export async function appsOrganizationsApiListMembers(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsOrganizationsApiListMembersParams,
  options?: { [key: string]: any }
) {
  return request<API.PagedMemberOut>("/api/organization-members/", {
    method: "GET",
    params: {
      // page has a default value: 1
      page: "1",
      ...params,
    },
    ...(options || {}),
  });
}

/** 添加租户成员 向当前租户新增一个成员，并可选择是否授予 owner 身份。 POST /api/organization-members/ */
export async function appsOrganizationsApiCreateMember(
  body: API.MemberIn,
  options?: { [key: string]: any }
) {
  return request<API.MemberOut>("/api/organization-members/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** 获取租户成员详情 返回当前租户内单个成员的详细信息。 GET /api/organization-members/${param0}/ */
export async function appsOrganizationsApiGetMember(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsOrganizationsApiGetMemberParams,
  options?: { [key: string]: any }
) {
  const { member_id: param0, ...queryParams } = params;
  return request<API.MemberOut>(`/api/organization-members/${param0}/`, {
    method: "GET",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 移除租户成员 将指定成员从当前租户移除，不允许移除自己。 DELETE /api/organization-members/${param0}/ */
export async function appsOrganizationsApiDeleteMember(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsOrganizationsApiDeleteMemberParams,
  options?: { [key: string]: any }
) {
  const { member_id: param0, ...queryParams } = params;
  return request<any>(`/api/organization-members/${param0}/`, {
    method: "DELETE",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 更新租户成员 更新成员 owner 状态等可编辑信息。 PATCH /api/organization-members/${param0}/ */
export async function appsOrganizationsApiPatchMember(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsOrganizationsApiPatchMemberParams,
  body: API.MemberPatchIn,
  options?: { [key: string]: any }
) {
  const { member_id: param0, ...queryParams } = params;
  return request<API.MemberOut>(`/api/organization-members/${param0}/`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** 搜索可添加成员 搜索尚未加入当前租户且未被邀请的可添加用户。 GET /api/organization-members/search/ */
export async function appsOrganizationsApiSearchMembers(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsOrganizationsApiSearchMembersParams,
  options?: { [key: string]: any }
) {
  return request<API.MemberSearchOut[]>("/api/organization-members/search/", {
    method: "GET",
    params: {
      ...params,
    },
    ...(options || {}),
  });
}
