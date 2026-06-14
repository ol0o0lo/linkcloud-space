// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** 获取公开邀请信息 根据邀请 key 查询公开邀请详情，供登录前后的接受页展示。 GET /api/invite-by-key/${param0}/ */
export async function appsOrganizationsApiGetInviteByKey(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsOrganizationsApiGetInviteByKeyParams,
  options?: { [key: string]: any }
) {
  const { key: param0, ...queryParams } = params;
  return request<API.PublicInviteOut>(`/api/invite-by-key/${param0}/`, {
    method: "GET",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 接受公开邀请 接受租户邀请并将当前用户加入对应租户。 POST /api/invite-by-key/${param0}/accept/ */
export async function appsOrganizationsApiAcceptInviteByKey(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsOrganizationsApiAcceptInviteByKeyParams,
  options?: { [key: string]: any }
) {
  const { key: param0, ...queryParams } = params;
  return request<API.SuccessOut>(`/api/invite-by-key/${param0}/accept/`, {
    method: "POST",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 拒绝公开邀请 拒绝并删除当前用户对应的租户邀请。 POST /api/invite-by-key/${param0}/decline/ */
export async function appsOrganizationsApiDeclineInviteByKey(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsOrganizationsApiDeclineInviteByKeyParams,
  options?: { [key: string]: any }
) {
  const { key: param0, ...queryParams } = params;
  return request<API.SuccessOut>(`/api/invite-by-key/${param0}/decline/`, {
    method: "POST",
    params: { ...queryParams },
    ...(options || {}),
  });
}
