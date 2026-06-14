// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** Get WebAuthn credential creation options
 Returns the WebAuthn credential creation options, that can be
processed using `parseCreationOptionsFromJSON()` on the frontend.
 GET /api/allauth/browser/v1/account/authenticators/webauthn */
export async function getBrowserV1AccountAuthenticatorsWebauthn(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: AllauthAPI.getBrowserV1AccountAuthenticatorsWebauthnParams,
  options?: { [key: string]: any }
) {
  const { client: param0, ...queryParams } = params;
  return request<{
    status: Record<string, any>;
    data: AllauthAPI.WebAuthnCredentialCreationOptions;
  }>("/api/allauth/browser/v1/account/authenticators/webauthn", {
    method: "GET",
    params: {
      ...queryParams,
    },
    ...(options || {}),
  });
}

/** Rename a WebAuthn credential
 You can alter the name of a WebAuthn credential by PUT'ting the ID and
name of the authenticator representing that credential. You can obtain
the credentials via the "List authenticators" endpoint.
 PUT /api/allauth/browser/v1/account/authenticators/webauthn */
export async function putBrowserV1AccountAuthenticatorsWebauthn(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: AllauthAPI.putBrowserV1AccountAuthenticatorsWebauthnParams,
  body: AllauthAPI.UpdateWebAuthn,
  options?: { [key: string]: any }
) {
  const { client: param0, ...queryParams } = params;
  return request<{
    status: Record<string, any>;
    data: AllauthAPI.WebAuthnAuthenticator;
  }>("/api/allauth/browser/v1/account/authenticators/webauthn", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** Add a WebAuthn credential
 POST /api/allauth/browser/v1/account/authenticators/webauthn */
export async function postBrowserV1AccountAuthenticatorsWebauthn(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: AllauthAPI.postBrowserV1AccountAuthenticatorsWebauthnParams,
  body: AllauthAPI.AddWebAuthnAuthenticator,
  options?: { [key: string]: any }
) {
  const { client: param0, ...queryParams } = params;
  return request<{
    status: Record<string, any>;
    data: AllauthAPI.WebAuthnAuthenticator;
    meta: { recovery_codes_generated: boolean };
  }>("/api/allauth/browser/v1/account/authenticators/webauthn", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** Delete a WebAuthn credential
 DELETE /api/allauth/browser/v1/account/authenticators/webauthn */
export async function deleteBrowserV1AccountAuthenticatorsWebauthn(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: AllauthAPI.deleteBrowserV1AccountAuthenticatorsWebauthnParams,
  body: AllauthAPI.DeleteWebAuthn,
  options?: { [key: string]: any }
) {
  const { client: param0, ...queryParams } = params;
  return request<{ status: Record<string, any> }>(
    "/api/allauth/browser/v1/account/authenticators/webauthn",
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
