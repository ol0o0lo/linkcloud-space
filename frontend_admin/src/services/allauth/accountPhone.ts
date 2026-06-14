// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** Get the phone number Retrieves the phone number of the account, if any. Note that while the
endpoint returns a list of phone numbers, at most one entry is returned.
 GET /api/allauth/browser/v1/account/phone */
export async function getBrowserV1AccountPhone(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: AllauthAPI.getBrowserV1AccountPhoneParams,
  options?: { [key: string]: any }
) {
  const { client: param0, ...queryParams } = params;
  return request<AllauthAPI.PhoneNumbersResponse>(
    "/api/allauth/browser/v1/account/phone",
    {
      method: "GET",
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}

/** Change the phone number
 The following functionality is available:

- Initiate the phone number change process for signed in users.
- Change to a new phone number during the phone number verification
  process at signup for unauthenticated users. Note that this requires:
  `ACCOUNT_PHONE_VERIFICATION_SUPPORTS_CHANGE = True`.

In both cases, after posting a new phone number, proceed with the phone
verification endpoint to confirm the change of the phone number by
posting the verification code.
 POST /api/allauth/browser/v1/account/phone */
export async function postBrowserV1AccountPhone(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: AllauthAPI.postBrowserV1AccountPhoneParams,
  body: AllauthAPI.Phone,
  options?: { [key: string]: any }
) {
  const { client: param0, ...queryParams } = params;
  return request<any>("/api/allauth/browser/v1/account/phone", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}
