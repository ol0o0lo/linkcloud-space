// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** List sessions GET /api/allauth/browser/v1/auth/sessions */
export async function getBrowserV1AuthSessions(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: AllauthAPI.getBrowserV1AuthSessionsParams,
  options?: { [key: string]: any }
) {
  const { client: param0, ...queryParams } = params;
  return request<{ status: Record<string, any>; data: AllauthAPI.Session[] }>(
    "/api/allauth/browser/v1/auth/sessions",
    {
      method: "GET",
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}

/** End one or more sessions DELETE /api/allauth/browser/v1/auth/sessions */
export async function deleteBrowserV1AuthSessions(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: AllauthAPI.deleteBrowserV1AuthSessionsParams,
  body: AllauthAPI.EndSessions,
  options?: { [key: string]: any }
) {
  const { client: param0, ...queryParams } = params;
  return request<{ status: Record<string, any>; data: AllauthAPI.Session[] }>(
    "/api/allauth/browser/v1/auth/sessions",
    {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      params: { ...queryParams },
      data: body,
      ...(options || {}),
    }
  );
}
