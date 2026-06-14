// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** Get email verification information Obtain email verification information, given the token that was sent to
the user by email.
 GET /api/allauth/browser/v1/auth/email/verify */
export async function getBrowserV1AuthEmailVerify(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: AllauthAPI.getBrowserV1AuthEmailVerifyParams,
  options?: { [key: string]: any }
) {
  const { client: param0, ...queryParams } = params;
  return request<AllauthAPI.EmailVerificationInfo>(
    "/api/allauth/browser/v1/auth/email/verify",
    {
      method: "GET",
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}

/** Verify an email Complete the email verification process. Depending on the configuration,
email addresses are either verified by opening a link that is sent to
their email address, or, by inputting a code that is sent. On the API,
both cases are handled identically. Meaning, the required key is either
the one from the link, or, the code itself.

Note that a status code of 401 does not imply failure. It indicates that
the email verification was successful, yet, the user is still not signed
in. For example, in case `ACCOUNT_LOGIN_ON_EMAIL_CONFIRMATION` is set to
`False`, a 401 is returned when verifying as part of login/signup.
 POST /api/allauth/browser/v1/auth/email/verify */
export async function postBrowserV1AuthEmailVerify(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: AllauthAPI.postBrowserV1AuthEmailVerifyParams,
  body: AllauthAPI.VerifyEmail,
  options?: { [key: string]: any }
) {
  const { client: param0, ...queryParams } = params;
  return request<Record<string, any>>(
    "/api/allauth/browser/v1/auth/email/verify",
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

/** Resend email verification code Requests a new email verification code.
Requires `ACCOUNT_EMAIL_VERIFICATION_SUPPORTS_RESEND = True`.
 POST /api/allauth/browser/v1/auth/email/verify/resend */
export async function postBrowserV1AuthEmailVerifyResend(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: AllauthAPI.postBrowserV1AuthEmailVerifyResendParams,
  options?: { [key: string]: any }
) {
  const { client: param0, ...queryParams } = params;
  return request<{ status: Record<string, any> }>(
    "/api/allauth/browser/v1/auth/email/verify/resend",
    {
      method: "POST",
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}

/** Login Login using a username-password or email-password combination.
 POST /api/allauth/browser/v1/auth/login */
export async function postBrowserV1AuthLogin(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: AllauthAPI.postBrowserV1AuthLoginParams,
  body: AllauthAPI.Login,
  options?: { [key: string]: any }
) {
  const { client: param0, ...queryParams } = params;
  return request<Record<string, any>>("/api/allauth/browser/v1/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** Verify a phone number Complete the phone number verification process. Note that a status code
of 401 does not imply failure. It merely indicates that the phone number
verification was successful, yet, the user is still not signed in.
 POST /api/allauth/browser/v1/auth/phone/verify */
export async function postBrowserV1AuthPhoneVerify(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: AllauthAPI.postBrowserV1AuthPhoneVerifyParams,
  body: AllauthAPI.VerifyPhone,
  options?: { [key: string]: any }
) {
  const { client: param0, ...queryParams } = params;
  return request<Record<string, any>>(
    "/api/allauth/browser/v1/auth/phone/verify",
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

/** Resend phone number verification code Requests a new phone number verification code.
Requires `ACCOUNT_PHONE_VERIFICATION_SUPPORTS_RESEND = True`.
 POST /api/allauth/browser/v1/auth/phone/verify/resend */
export async function postBrowserV1AuthPhoneVerifyResend(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: AllauthAPI.postBrowserV1AuthPhoneVerifyResendParams,
  options?: { [key: string]: any }
) {
  const { client: param0, ...queryParams } = params;
  return request<{ status: Record<string, any> }>(
    "/api/allauth/browser/v1/auth/phone/verify/resend",
    {
      method: "POST",
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}

/** Reauthenticate In order to safeguard the account, some actions require the user to be
recently authenticated.  If you try to perform such an action without
having been recently authenticated, a `401` status is returned, listing
flows that can be performed to reauthenticate. One such flow is the flow
with ID `reauthenticate`, which allows for the user to input the
password. This is the endpoint related towards that flow.
 POST /api/allauth/browser/v1/auth/reauthenticate */
export async function postBrowserV1AuthReauthenticate(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: AllauthAPI.postBrowserV1AuthReauthenticateParams,
  body: AllauthAPI.Reauthenticate,
  options?: { [key: string]: any }
) {
  const { client: param0, ...queryParams } = params;
  return request<Record<string, any>>(
    "/api/allauth/browser/v1/auth/reauthenticate",
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

/** Signup Whether or not `username`, `email`, `phone` or combination of those are
required depends on the configuration of django-allauth. Additionally,
if a custom signup form is used there may be other custom properties
required.
 POST /api/allauth/browser/v1/auth/signup */
export async function postBrowserV1AuthSignup(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: AllauthAPI.postBrowserV1AuthSignupParams,
  body: AllauthAPI.Signup,
  options?: { [key: string]: any }
) {
  const { client: param0, ...queryParams } = params;
  return request<Record<string, any>>("/api/allauth/browser/v1/auth/signup", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}
