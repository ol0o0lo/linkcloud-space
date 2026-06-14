// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** Change password In order to change the password of an account, the current and new
password must be provider.  However, accounts that were created by
signing up using a third-party provider do not have a password set. In
that case, the current password is not required.
 POST /api/allauth/browser/v1/account/password/change */
export async function postBrowserV1AccountPasswordChange(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: AllauthAPI.postBrowserV1AccountPasswordChangeParams,
  body: AllauthAPI.ChangePassword,
  options?: { [key: string]: any }
) {
  const { client: param0, ...queryParams } = params;
  return request<any>("/api/allauth/browser/v1/account/password/change", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}
