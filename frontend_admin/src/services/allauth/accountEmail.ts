// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** List email addresses Retrieves the list of email addresses of the account.
 GET /api/allauth/browser/v1/account/email */
export async function getBrowserV1AccountEmail(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: AllauthAPI.getBrowserV1AccountEmailParams,
  options?: { [key: string]: any }
) {
  const { client: param0, ...queryParams } = params;
  return request<{
    status: Record<string, any>;
    data: AllauthAPI.EmailAddress[];
  }>("/api/allauth/browser/v1/account/email", {
    method: "GET",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** Request email verification Requests for (another) email verification email to be sent. Note that
sending emails is rate limited, so when you send too many requests the
email will not be sent.
 PUT /api/allauth/browser/v1/account/email */
export async function putBrowserV1AccountEmail(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: AllauthAPI.putBrowserV1AccountEmailParams,
  body: AllauthAPI.Email,
  options?: { [key: string]: any }
) {
  const { client: param0, ...queryParams } = params;
  return request<{ status: Record<string, any> }>(
    "/api/allauth/browser/v1/account/email",
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

/** Add/Change email address
 The following functionality is available:

  - Adding a new email address for an already signed in user (`ACCOUNT_CHANGE_EMAIL = False`).
  - Change to a new email address for an already signed in user   (`ACCOUNT_CHANGE_EMAIL = True`).
  - Change to a new email address during the email verification process at signup (`ACCOUNT_EMAIL_VERIFICATION_SUPPORTS_CHANGE = True`).

In all cases, an email verification mail will be sent containing a link or code that needs to be verified.
 POST /api/allauth/browser/v1/account/email */
export async function postBrowserV1AccountEmail(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: AllauthAPI.postBrowserV1AccountEmailParams,
  body: AllauthAPI.Email,
  options?: { [key: string]: any }
) {
  const { client: param0, ...queryParams } = params;
  return request<{
    status: Record<string, any>;
    data: AllauthAPI.EmailAddress[];
  }>("/api/allauth/browser/v1/account/email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** Remove an email address Used to remove an email address.
 DELETE /api/allauth/browser/v1/account/email */
export async function deleteBrowserV1AccountEmail(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: AllauthAPI.deleteBrowserV1AccountEmailParams,
  body: AllauthAPI.Email,
  options?: { [key: string]: any }
) {
  const { client: param0, ...queryParams } = params;
  return request<{
    status: Record<string, any>;
    data: AllauthAPI.EmailAddress[];
  }>("/api/allauth/browser/v1/account/email", {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** Change primary email address Used to change primary email address to a different one. Note that only verified email addresses
can be marked as primary.
 PATCH /api/allauth/browser/v1/account/email */
export async function patchBrowserV1AccountEmail(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: AllauthAPI.patchBrowserV1AccountEmailParams,
  body: AllauthAPI.MarkPrimaryEmail,
  options?: { [key: string]: any }
) {
  const { client: param0, ...queryParams } = params;
  return request<{
    status: Record<string, any>;
    data: AllauthAPI.EmailAddress[];
  }>("/api/allauth/browser/v1/account/email", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}
