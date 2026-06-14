// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** Provider redirect Initiates the third-party provider authentication redirect flow. As calling
this endpoint results in a user facing redirect (302), this call is only
available in a browser, and must be called in a synchronous (non-XHR)
manner.
 POST /api/allauth/browser/v1/auth/provider/redirect */
export async function postBrowserV1AuthProviderRedirect(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: AllauthAPI.postBrowserV1AuthProviderRedirectParams,
  body: {
    provider: AllauthAPI.ProviderID;
    /** The URL to return to after the redirect flow is complete.

Note that this is not to be mistaken with the callback URL that you
configure over at the OAuth provider during the OAuth app/client
setup. The flow is as follows:

  1. Your frontend redirects to the headless provider redirect
     endpoint in a synchronous (non-XHR) manner, informing allauth
     (by means of `callback_url`) where to redirect to after the
     provider handshake is completed.

  2. Headless will redirect to the (OAuth) identity provider to
     initiate the handshake, passing along a different callback URL
     to the provider: one that points to an allauth backend URL.
     This is the URL that you need to have setup at your OAuth
     app/client configuration. Note that this must be a backend URL
     as providers can use POST requests to perform their callbacks,
     which is something a frontend would not be able to handle.

  3. After the authorization at the provider is completed, the
     provider redirects to the *backend* allauth callback URL, which
     will then redirect back to the *frontend* callback URL.

  4. Your frontend is now expected to fetch the current session to
     determine what the next course of action is. The user could be
     authenticated at this point, or another flow is pending
     (e.g. email verification, or, provider signup). In case of
     errors a `?error=` is passed to the frontend callback URL.
 */
    callback_url: string;
    process: AllauthAPI.Process;
  },
  options?: { [key: string]: any }
) {
  return request<any>("/api/allauth/browser/v1/auth/provider/redirect", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    params: { ...params },
    data: body,
    ...(options || {}),
  });
}

/** Provider signup information If, while signing up using a third-party provider account, there is
insufficient information received from the provider to automatically
complete the signup process, an additional step is needed to complete
the missing data before the user is fully signed up and authenticated.
The information available so far, such as the pending provider account,
can be retrieved via this endpoint.
 GET /api/allauth/browser/v1/auth/provider/signup */
export async function getBrowserV1AuthProviderSignup(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: AllauthAPI.getBrowserV1AuthProviderSignupParams,
  options?: { [key: string]: any }
) {
  const { client: param0, ...queryParams } = params;
  return request<{
    status: Record<string, any>;
    data: {
      email: AllauthAPI.EmailAddress[];
      account: AllauthAPI.ProviderAccount2;
      user: AllauthAPI.User;
    };
  }>("/api/allauth/browser/v1/auth/provider/signup", {
    method: "GET",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** Provider signup If, while signing up using a third-party provider account, there is
insufficient information received from the provider to automatically
complete the signup process, an additional step is needed to complete
the missing data before the user is fully signed up and authenticated.
 POST /api/allauth/browser/v1/auth/provider/signup */
export async function postBrowserV1AuthProviderSignup(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: AllauthAPI.postBrowserV1AuthProviderSignupParams,
  body: AllauthAPI.ProviderSignup,
  options?: { [key: string]: any }
) {
  const { client: param0, ...queryParams } = params;
  return request<Record<string, any>>(
    "/api/allauth/browser/v1/auth/provider/signup",
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

/** Provider token Authenticates with a third-party provider using provider tokens received
by other means. For example, in case of a mobile app, the authentication
flow runs completely on the device itself, without any interaction with
the API. Then, when the (device) authentication completes and the mobile
app receives an access and/or ID token, it can hand over these tokens
via this endpoint to authenticate on the server.
 POST /api/allauth/browser/v1/auth/provider/token */
export async function postBrowserV1AuthProviderToken(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: AllauthAPI.postBrowserV1AuthProviderTokenParams,
  body: AllauthAPI.ProviderToken,
  options?: { [key: string]: any }
) {
  const { client: param0, ...queryParams } = params;
  return request<Record<string, any>>(
    "/api/allauth/browser/v1/auth/provider/token",
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
