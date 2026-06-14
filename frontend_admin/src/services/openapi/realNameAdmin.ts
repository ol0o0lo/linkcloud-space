// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** 获取实名认证记录列表 GET /api/admin/real-name-verifications/ */
export async function appsAccountsApiListAdminRealNameVerifications(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsAccountsApiListAdminRealNameVerificationsParams,
  options?: { [key: string]: any }
) {
  return request<API.PagedAdminRealNameVerificationRowOut>(
    "/api/admin/real-name-verifications/",
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

/** 获取实名认证详情 GET /api/admin/real-name-verifications/${param0}/ */
export async function appsAccountsApiGetAdminRealNameVerification(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsAccountsApiGetAdminRealNameVerificationParams,
  options?: { [key: string]: any }
) {
  const { verification_id: param0, ...queryParams } = params;
  return request<API.RealNameVerificationDetailOut>(
    `/api/admin/real-name-verifications/${param0}/`,
    {
      method: "GET",
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}

/** 人工通过实名认证 POST /api/admin/real-name-verifications/${param0}/approve/ */
export async function appsAccountsApiApproveAdminRealName(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsAccountsApiApproveAdminRealNameParams,
  body: API.AdminRealNameDecisionIn,
  options?: { [key: string]: any }
) {
  const { verification_id: param0, ...queryParams } = params;
  return request<API.RealNameVerificationDetailOut>(
    `/api/admin/real-name-verifications/${param0}/approve/`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      params: { ...queryParams },
      data: body,
      ...(options || {}),
    }
  );
}

/** 转人工复核 POST /api/admin/real-name-verifications/${param0}/manual-review/ */
export async function appsAccountsApiMoveAdminRealNameToManualReview(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsAccountsApiMoveAdminRealNameToManualReviewParams,
  body: API.AdminRealNameDecisionIn,
  options?: { [key: string]: any }
) {
  const { verification_id: param0, ...queryParams } = params;
  return request<API.RealNameVerificationDetailOut>(
    `/api/admin/real-name-verifications/${param0}/manual-review/`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      params: { ...queryParams },
      data: body,
      ...(options || {}),
    }
  );
}

/** 人工驳回实名认证 POST /api/admin/real-name-verifications/${param0}/reject/ */
export async function appsAccountsApiRejectAdminRealName(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsAccountsApiRejectAdminRealNameParams,
  body: API.AdminRealNameDecisionIn,
  options?: { [key: string]: any }
) {
  const { verification_id: param0, ...queryParams } = params;
  return request<API.RealNameVerificationDetailOut>(
    `/api/admin/real-name-verifications/${param0}/reject/`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      params: { ...queryParams },
      data: body,
      ...(options || {}),
    }
  );
}

/** 撤销实名认证 POST /api/admin/real-name-verifications/${param0}/revoke/ */
export async function appsAccountsApiRevokeAdminRealName(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsAccountsApiRevokeAdminRealNameParams,
  body: API.AdminRealNameDecisionIn,
  options?: { [key: string]: any }
) {
  const { verification_id: param0, ...queryParams } = params;
  return request<API.RealNameVerificationDetailOut>(
    `/api/admin/real-name-verifications/${param0}/revoke/`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      params: { ...queryParams },
      data: body,
      ...(options || {}),
    }
  );
}
