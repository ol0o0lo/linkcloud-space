// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** Get passkey credential request options Returns the WebAuthn credential request options, that can be
processed using `parseRequestOptionsFromJSON()` on the frontend.
 GET /api/allauth/browser/v1/auth/webauthn/signup */
export async function getBrowserV1AuthWebauthnSignup(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: AllauthAPI.getBrowserV1AuthWebauthnSignupParams,
  options?: { [key: string]: any }
) {
  const { client: param0, ...queryParams } = params;
  return request<{
    status: Record<string, any>;
    data: AllauthAPI.WebAuthnCredentialRequestOptions;
  }>("/api/allauth/browser/v1/auth/webauthn/signup", {
    method: "GET",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** Complete the passkey signup flow Complete the passkey signup flow by handing over the WebAuthn credential.
 PUT /api/allauth/browser/v1/auth/webauthn/signup */
export async function putBrowserV1AuthWebauthnSignup(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: AllauthAPI.putBrowserV1AuthWebauthnSignupParams,
  body: AllauthAPI.AddWebAuthnAuthenticator,
  options?: { [key: string]: any }
) {
  const { client: param0, ...queryParams } = params;
  return request<Record<string, any>>(
    "/api/allauth/browser/v1/auth/webauthn/signup",
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      params: { ...queryParams },
      data: body,
      ...(options || {}),
    }
  );
}

/** Initiate the passkey signup flow You initiate the passkey signup flow by inputting (`POST`) the required properties (e.g. email)
similar to the regular account signup, except that the `password` is to be left out.
The user will then be required to verify the email address, after which WebAuthn credential
creation options can be retrieved (`GET`) and used to actually complete (`PUT`) the flow.
 POST /api/allauth/browser/v1/auth/webauthn/signup */
export async function postBrowserV1AuthWebauthnSignup(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: AllauthAPI.postBrowserV1AuthWebauthnSignupParams,
  body: AllauthAPI.PasskeySignup,
  options?: { [key: string]: any }
) {
  const { client: param0, ...queryParams } = params;
  return request<any>("/api/allauth/browser/v1/auth/webauthn/signup", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}
