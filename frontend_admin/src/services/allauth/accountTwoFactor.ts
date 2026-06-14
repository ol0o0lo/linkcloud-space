// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** List authenticators GET /api/allauth/browser/v1/account/authenticators */
export async function getBrowserV1AccountAuthenticators(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: AllauthAPI.getBrowserV1AccountAuthenticatorsParams,
  options?: { [key: string]: any }
) {
  const { client: param0, ...queryParams } = params;
  return request<{
    status: Record<string, any>;
    data: AllauthAPI.AuthenticatorList;
  }>("/api/allauth/browser/v1/account/authenticators", {
    method: "GET",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** List recovery codes List recovery codes.
 GET /api/allauth/browser/v1/account/authenticators/recovery-codes */
export async function getBrowserV1AccountAuthenticatorsRecoveryCodes(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: AllauthAPI.getBrowserV1AccountAuthenticatorsRecoveryCodesParams,
  options?: { [key: string]: any }
) {
  const { client: param0, ...queryParams } = params;
  return request<{
    status: Record<string, any>;
    data: AllauthAPI.SensitiveRecoveryCodesAuthenticator;
  }>("/api/allauth/browser/v1/account/authenticators/recovery-codes", {
    method: "GET",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** Regenerate recovery codes POST /api/allauth/browser/v1/account/authenticators/recovery-codes */
export async function postBrowserV1AccountAuthenticatorsRecoveryCodes(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: AllauthAPI.postBrowserV1AccountAuthenticatorsRecoveryCodesParams,
  options?: { [key: string]: any }
) {
  const { client: param0, ...queryParams } = params;
  return request<any>(
    "/api/allauth/browser/v1/account/authenticators/recovery-codes",
    {
      method: "POST",
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}

/** TOTP authenticator status Retrieve the information about the current TOTP authenticator, if any.
 GET /api/allauth/browser/v1/account/authenticators/totp */
export async function getBrowserV1AccountAuthenticatorsTotp(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: AllauthAPI.getBrowserV1AccountAuthenticatorsTotpParams,
  options?: { [key: string]: any }
) {
  const { client: param0, ...queryParams } = params;
  return request<{
    status: Record<string, any>;
    meta?: { recovery_codes_generated?: boolean };
    data: AllauthAPI.TOTPAuthenticator;
  }>("/api/allauth/browser/v1/account/authenticators/totp", {
    method: "GET",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** Activate TOTP The code should be provided from the consuming TOTP authenticator
application which was generated using the TOTP authenticator secret
retrieved from the TOTP authenticator status endpoint.
 POST /api/allauth/browser/v1/account/authenticators/totp */
export async function postBrowserV1AccountAuthenticatorsTotp(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: AllauthAPI.postBrowserV1AccountAuthenticatorsTotpParams,
  body: AllauthAPI.SetupTOTP,
  options?: { [key: string]: any }
) {
  const { client: param0, ...queryParams } = params;
  return request<{
    status: Record<string, any>;
    meta?: { recovery_codes_generated?: boolean };
    data: AllauthAPI.TOTPAuthenticator;
  }>("/api/allauth/browser/v1/account/authenticators/totp", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** Deactivate TOTP Deactivates TOTP authentication. If the user authentication is not
sufficiently recent, a reauthentication flow (`401`) will is presented.
 DELETE /api/allauth/browser/v1/account/authenticators/totp */
export async function deleteBrowserV1AccountAuthenticatorsTotp(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: AllauthAPI.deleteBrowserV1AccountAuthenticatorsTotpParams,
  options?: { [key: string]: any }
) {
  const { client: param0, ...queryParams } = params;
  return request<{ status: Record<string, any> }>(
    "/api/allauth/browser/v1/account/authenticators/totp",
    {
      method: "DELETE",
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}
