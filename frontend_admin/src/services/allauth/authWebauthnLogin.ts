// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** Get WebAuthn credential request options for 2FA Returns the WebAuthn credential request options, that can be
processed using `parseRequestOptionsFromJSON()` on the frontend.
 GET /api/allauth/browser/v1/auth/webauthn/authenticate */
export async function getBrowserV1AuthWebauthnAuthenticate(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: AllauthAPI.getBrowserV1AuthWebauthnAuthenticateParams,
  options?: { [key: string]: any }
) {
  const { client: param0, ...queryParams } = params;
  return request<{
    status: Record<string, any>;
    data: AllauthAPI.WebAuthnCredentialRequestOptions;
  }>("/api/allauth/browser/v1/auth/webauthn/authenticate", {
    method: "GET",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** Perform 2FA using WebAuthn Perform Two-Factor Authentication using a WebAuthn credential.
 POST /api/allauth/browser/v1/auth/webauthn/authenticate */
export async function postBrowserV1AuthWebauthnAuthenticate(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: AllauthAPI.postBrowserV1AuthWebauthnAuthenticateParams,
  body: AllauthAPI.AuthenticateWebAuthn,
  options?: { [key: string]: any }
) {
  const { client: param0, ...queryParams } = params;
  return request<Record<string, any>>(
    "/api/allauth/browser/v1/auth/webauthn/authenticate",
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

/** Get WebAuthn credential request options for login Returns the WebAuthn credential request options, that can be
processed using `parseRequestOptionsFromJSON()` on the frontend.
 GET /api/allauth/browser/v1/auth/webauthn/login */
export async function getBrowserV1AuthWebauthnLogin(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: AllauthAPI.getBrowserV1AuthWebauthnLoginParams,
  options?: { [key: string]: any }
) {
  const { client: param0, ...queryParams } = params;
  return request<{
    status: Record<string, any>;
    data: AllauthAPI.WebAuthnCredentialRequestOptions;
  }>("/api/allauth/browser/v1/auth/webauthn/login", {
    method: "GET",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** Login using WebAuthn Login using a WebAuthn credential (Passkey). Both 200 and 401 can be
expected after a successful request.  The 401 can, for example, occur
when the credential passed was valid, but the email attached to the
account still requires verification.
 POST /api/allauth/browser/v1/auth/webauthn/login */
export async function postBrowserV1AuthWebauthnLogin(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: AllauthAPI.postBrowserV1AuthWebauthnLoginParams,
  body: AllauthAPI.LoginWebAuthn,
  options?: { [key: string]: any }
) {
  const { client: param0, ...queryParams } = params;
  return request<Record<string, any>>(
    "/api/allauth/browser/v1/auth/webauthn/login",
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

/** Get WebAuthn credential request options for reauthentication Returns the WebAuthn credential request options, that can be
processed using `parseRequestOptionsFromJSON()` on the frontend.
 GET /api/allauth/browser/v1/auth/webauthn/reauthenticate */
export async function getBrowserV1AuthWebauthnReauthenticate(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: AllauthAPI.getBrowserV1AuthWebauthnReauthenticateParams,
  options?: { [key: string]: any }
) {
  const { client: param0, ...queryParams } = params;
  return request<{
    status: Record<string, any>;
    data: AllauthAPI.WebAuthnCredentialRequestOptions;
  }>("/api/allauth/browser/v1/auth/webauthn/reauthenticate", {
    method: "GET",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** Reauthenticate using WebAuthn Reauthenticate the user using a WebAuthn credential.
 POST /api/allauth/browser/v1/auth/webauthn/reauthenticate */
export async function postBrowserV1AuthWebauthnReauthenticate(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: AllauthAPI.postBrowserV1AuthWebauthnReauthenticateParams,
  body: AllauthAPI.ReauthenticateWebAuthn,
  options?: { [key: string]: any }
) {
  const { client: param0, ...queryParams } = params;
  return request<Record<string, any>>(
    "/api/allauth/browser/v1/auth/webauthn/reauthenticate",
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
