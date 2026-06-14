// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** List the connected third-party provider accounts GET /api/allauth/browser/v1/account/providers */
export async function getBrowserV1AccountProviders(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: AllauthAPI.getBrowserV1AccountProvidersParams,
  options?: { [key: string]: any }
) {
  const { client: param0, ...queryParams } = params;
  return request<{
    status: Record<string, any>;
    data: AllauthAPI.ProviderAccount2[];
  }>("/api/allauth/browser/v1/account/providers", {
    method: "GET",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** Disconnect a third-party provider account
 Disconnect a third-party provider account, returning the remaining
accounts that are still connected. The disconnect is not allowed if it
would leave the account unusable. For example, if no password was
set up yet.
 DELETE /api/allauth/browser/v1/account/providers */
export async function deleteBrowserV1AccountProviders(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: AllauthAPI.deleteBrowserV1AccountProvidersParams,
  body: AllauthAPI.ProviderAccount,
  options?: { [key: string]: any }
) {
  const { client: param0, ...queryParams } = params;
  return request<{
    status: Record<string, any>;
    data: AllauthAPI.ProviderAccount2[];
  }>("/api/allauth/browser/v1/account/providers", {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}
