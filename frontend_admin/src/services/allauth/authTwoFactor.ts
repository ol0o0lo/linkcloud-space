// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** Two-factor authentication If, during authentication,  a response with status 401 is encountered where one of the pending
flows has ID `mfa_authenticate`, that indicates that the Two-Factor Authentication stage needs to
be completed.
 POST /api/allauth/browser/v1/auth/2fa/authenticate */
export async function postBrowserV1AuthTwofaAuthenticate(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: AllauthAPI.postBrowserV1AuthTwofaAuthenticateParams,
  body: AllauthAPI.MFAAuthenticate,
  options?: { [key: string]: any }
) {
  const { client: param0, ...queryParams } = params;
  return request<Record<string, any>>(
    "/api/allauth/browser/v1/auth/2fa/authenticate",
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

/** Reauthenticate using 2FA In order to safeguard the account, some actions require the user to be
recently authenticated.  If you try to perform such an action without
having been recently authenticated, a `401` status is returned, listing
flows that can be performed to reauthenticate. One such flow is the flow
with ID `mfa_reauthenticate`, which allows for the user to input an
authenticator code (e.g. TOTP or recovery code). This is the endpoint
related towards that flow.
 POST /api/allauth/browser/v1/auth/2fa/reauthenticate */
export async function postBrowserV1AuthTwofaReauthenticate(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: AllauthAPI.postBrowserV1AuthTwofaReauthenticateParams,
  body: AllauthAPI.MFAAuthenticate,
  options?: { [key: string]: any }
) {
  const { client: param0, ...queryParams } = params;
  return request<Record<string, any>>(
    "/api/allauth/browser/v1/auth/2fa/reauthenticate",
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

/** Trust this browser If "Trust this browser?" is enabled (`MFA_TRUST_ENABLED`), the
`mfa_trust` flow activates after the user completes the MFA
authentication flow, offering to skip MFA for this particular
browser. This endpoint is used to complete the `mfa_trust` flow.
 POST /api/allauth/browser/v1/auth/2fa/trust */
export async function postBrowserV1AuthTwofaTrust(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: AllauthAPI.postBrowserV1AuthTwofaTrustParams,
  body: AllauthAPI.MFATrust,
  options?: { [key: string]: any }
) {
  return request<Record<string, any>>(
    "/api/allauth/browser/v1/auth/2fa/trust",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      params: { ...params },
      data: body,
      ...(options || {}),
    }
  );
}
