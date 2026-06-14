// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** Get authentication status
 Retrieve information about the authentication status for the current
session.
 GET /api/allauth/browser/v1/auth/session */
export async function getBrowserV1AuthSession(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: AllauthAPI.getBrowserV1AuthSessionParams,
  options?: { [key: string]: any }
) {
  const { client: param0, ...queryParams } = params;
  return request<Record<string, any>>("/api/allauth/browser/v1/auth/session", {
    method: "GET",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** Logout Logs out the user from the current session.
 DELETE /api/allauth/browser/v1/auth/session */
export async function deleteBrowserV1AuthSession(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: AllauthAPI.deleteBrowserV1AuthSessionParams,
  options?: { [key: string]: any }
) {
  const { client: param0, ...queryParams } = params;
  return request<any>("/api/allauth/browser/v1/auth/session", {
    method: "DELETE",
    params: { ...queryParams },
    ...(options || {}),
  });
}
