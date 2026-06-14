// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** Request password Initiates the password reset procedure. Depending on whether or not
`ACCOUNT_PASSWORD_RESET_BY_CODE_ENABLED` is `True`, the procedure is
either stateless or stateful.

In case codes are used, it is stateful, and a new
`password_reset_by_code` flow is started. In this case, on a successful
password reset request, you will receive a 401 indicating the pending
status of this flow.

In case password reset is configured to use (stateless) links, you will
receive a 200 on a successful password reset request.
 POST /api/allauth/browser/v1/auth/password/request */
export async function postBrowserV1AuthPasswordRequest(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: AllauthAPI.postBrowserV1AuthPasswordRequestParams,
  body: AllauthAPI.RequestPassword,
  options?: { [key: string]: any }
) {
  const { client: param0, ...queryParams } = params;
  return request<{ status: Record<string, any> }>(
    "/api/allauth/browser/v1/auth/password/request",
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

/** Get password reset information Used to obtain information on and validate a password reset key.  The
key passed is either the key encoded in the password reset URL that the
user has received per email, or, the password reset code in case of
`ACCOUNT_PASSWORD_RESET_BY_CODE_ENABLED`. Note that in case of a code,
the number of requests you can make is limited (by
`ACCOUNT_PASSWORD_RESET_BY_CODE_MAX_ATTEMPTS`).
 GET /api/allauth/browser/v1/auth/password/reset */
export async function getBrowserV1AuthPasswordReset(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: AllauthAPI.getBrowserV1AuthPasswordResetParams,
  options?: { [key: string]: any }
) {
  const { client: param0, ...queryParams } = params;
  return request<{
    status: Record<string, any>;
    data: { user: AllauthAPI.User };
  }>("/api/allauth/browser/v1/auth/password/reset", {
    method: "GET",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** Reset password Perform the password reset, by handing over the password reset key and
the new password. After successfully completing the password reset, the
user is either logged in (in case `ACCOUNT_LOGIN_ON_PASSWORD_RESET` is
`True`), or, the user will need to proceed to the login page.  In case
of the former, a `200` status code is returned, in case of the latter a
401.
 POST /api/allauth/browser/v1/auth/password/reset */
export async function postBrowserV1AuthPasswordReset(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: AllauthAPI.postBrowserV1AuthPasswordResetParams,
  body: AllauthAPI.ResetPassword,
  options?: { [key: string]: any }
) {
  const { client: param0, ...queryParams } = params;
  return request<Record<string, any>>(
    "/api/allauth/browser/v1/auth/password/reset",
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
