// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** Confirm login code Use this endpoint to pass along the received "special" login code.
 POST /api/allauth/browser/v1/auth/code/confirm */
export async function postBrowserV1AuthCodeConfirm(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: AllauthAPI.postBrowserV1AuthCodeConfirmParams,
  body: AllauthAPI.ConfirmLoginCode,
  options?: { [key: string]: any }
) {
  const { client: param0, ...queryParams } = params;
  return request<Record<string, any>>(
    "/api/allauth/browser/v1/auth/code/confirm",
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

/** Request login code Request a "special" login code that is sent to the user by email.
 POST /api/allauth/browser/v1/auth/code/request */
export async function postBrowserV1AuthCodeRequest(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: AllauthAPI.postBrowserV1AuthCodeRequestParams,
  body: AllauthAPI.RequestLoginCode,
  options?: { [key: string]: any }
) {
  const { client: param0, ...queryParams } = params;
  return request<any>("/api/allauth/browser/v1/auth/code/request", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** Resend login code Requests a new login code.
Requires `ACCOUNT_LOGIN_BY_CODE_SUPPORTS_RESEND = True`.
 POST /api/allauth/browser/v1/auth/code/resend */
export async function postBrowserV1AuthCodeResend(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: AllauthAPI.postBrowserV1AuthCodeResendParams,
  options?: { [key: string]: any }
) {
  const { client: param0, ...queryParams } = params;
  return request<{ status: Record<string, any> }>(
    "/api/allauth/browser/v1/auth/code/resend",
    {
      method: "POST",
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}
