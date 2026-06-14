// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** 获取租户邀请列表 返回当前租户的邀请记录列表。 GET /api/organization-invites/ */
export async function appsOrganizationsApiListInvites(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsOrganizationsApiListInvitesParams,
  options?: { [key: string]: any }
) {
  return request<API.PagedInviteOut>("/api/organization-invites/", {
    method: "GET",
    params: {
      // page has a default value: 1
      page: "1",
      ...params,
    },
    ...(options || {}),
  });
}

/** 创建租户邀请 向指定邮箱或用户发送加入当前租户的邀请。 POST /api/organization-invites/ */
export async function appsOrganizationsApiCreateInvite(
  body: API.InviteIn,
  options?: { [key: string]: any }
) {
  return request<API.InviteOut>("/api/organization-invites/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** 获取租户邀请详情 返回当前租户某条邀请记录的详情。 GET /api/organization-invites/${param0}/ */
export async function appsOrganizationsApiGetInvite(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsOrganizationsApiGetInviteParams,
  options?: { [key: string]: any }
) {
  const { invite_id: param0, ...queryParams } = params;
  return request<API.InviteOut>(`/api/organization-invites/${param0}/`, {
    method: "GET",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 取消租户邀请 取消一条未处理的租户邀请。 DELETE /api/organization-invites/${param0}/ */
export async function appsOrganizationsApiDeleteInvite(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsOrganizationsApiDeleteInviteParams,
  options?: { [key: string]: any }
) {
  const { invite_id: param0, ...queryParams } = params;
  return request<any>(`/api/organization-invites/${param0}/`, {
    method: "DELETE",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 重发租户邀请 重新发送当前租户内某条待处理邀请。 POST /api/organization-invites/${param0}/resend/ */
export async function appsOrganizationsApiResendInvite(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsOrganizationsApiResendInviteParams,
  options?: { [key: string]: any }
) {
  const { invite_id: param0, ...queryParams } = params;
  return request<API.SuccessOut>(
    `/api/organization-invites/${param0}/resend/`,
    {
      method: "POST",
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}
