// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** 获取用户列表 返回当前租户下可见的用户列表，支持按姓名关键字筛选。 GET /api/users/ */
export async function appsAccountsApiListUsers(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsAccountsApiListUsersParams,
  options?: { [key: string]: any }
) {
  return request<API.PagedUserOut>("/api/users/", {
    method: "GET",
    params: {
      // page has a default value: 1
      page: "1",
      ...params,
    },
    ...(options || {}),
  });
}

/** 获取指定用户信息 返回当前租户范围内指定用户的资料信息。 GET /api/users/${param0}/ */
export async function appsAccountsApiGetUser(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsAccountsApiGetUserParams,
  options?: { [key: string]: any }
) {
  const { user_id: param0, ...queryParams } = params;
  return request<API.UserOut>(`/api/users/${param0}/`, {
    method: "GET",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 更新当前用户资料 更新当前登录用户自己的基础资料，不允许修改他人账户。 PATCH /api/users/${param0}/ */
export async function appsAccountsApiPatchUser(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsAccountsApiPatchUserParams,
  body: API.UserPatchIn,
  options?: { [key: string]: any }
) {
  const { user_id: param0, ...queryParams } = params;
  return request<API.UserOut>(`/api/users/${param0}/`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** 拆分手机号请求登录验证码 POST /api/users/auth/app/code/request/ */
export async function appsAccountsApiRequestLoginCodeWithSplitPhone(
  body: API.SplitPhoneIn,
  options?: { [key: string]: any }
) {
  return request<any>("/api/users/auth/app/code/request/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** 拆分手机号发起换绑 POST /api/users/auth/browser/account/phone/ */
export async function appsAccountsApiChangePhoneWithSplitPhone(
  body: API.SplitPhoneIn,
  options?: { [key: string]: any }
) {
  return request<any>("/api/users/auth/browser/account/phone/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** 确认手机号验证码 POST /api/users/auth/browser/phone/verify/ */
export async function appsAccountsApiVerifyPhoneWithCode(
  body: API.PhoneCodeVerifyIn,
  options?: { [key: string]: any }
) {
  return request<any>("/api/users/auth/browser/phone/verify/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** 拆分手机号注册 POST /api/users/auth/browser/signup/ */
export async function appsAccountsApiSignupWithSplitPhone(
  body: API.SplitPhoneSignupIn,
  options?: { [key: string]: any }
) {
  return request<any>("/api/users/auth/browser/signup/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** 搜索可代登录用户 供超级管理员搜索可用于 impersonate 的用户候选列表。 GET /api/users/impersonate-search/ */
export async function appsAccountsApiImpersonateSearch(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsAccountsApiImpersonateSearchParams,
  options?: { [key: string]: any }
) {
  return request<API.ImpersonateUserOut[]>("/api/users/impersonate-search/", {
    method: "GET",
    params: {
      ...params,
    },
    ...(options || {}),
  });
}

/** 获取当前用户信息 返回当前登录用户的资料、权限相关标记和展示信息。 GET /api/users/me/ */
export async function appsAccountsApiGetMe(options?: { [key: string]: any }) {
  return request<API.MeOut>("/api/users/me/", {
    method: "GET",
    ...(options || {}),
  });
}

/** 删除当前用户的 MFA 认证器 删除当前登录用户指定类型的 MFA 认证器。 DELETE /api/users/me/mfa/authenticators/${param0}/ */
export async function appsAccountsApiDeleteMyAuthenticator(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsAccountsApiDeleteMyAuthenticatorParams,
  options?: { [key: string]: any }
) {
  const { authenticator_type: param0, ...queryParams } = params;
  return request<Record<string, any>>(
    `/api/users/me/mfa/authenticators/${param0}/`,
    {
      method: "DELETE",
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}

/** 获取 TOTP 初始化信息 返回当前用户可用于初始化 TOTP 的密钥和 otpauth URL。 GET /api/users/me/mfa/totp-setup/ */
export async function appsAccountsApiGetTotpSetup(options?: {
  [key: string]: any;
}) {
  return request<API.TotpSetupOut>("/api/users/me/mfa/totp-setup/", {
    method: "GET",
    ...(options || {}),
  });
}

/** 获取当前用户社交账号绑定状态 返回管理端账号绑定页需要展示的当前用户社交绑定状态。 GET /api/users/me/social-bindings/ */
export async function appsAccountsApiGetSocialBindings(options?: {
  [key: string]: any;
}) {
  return request<API.SocialBindingsOut>("/api/users/me/social-bindings/", {
    method: "GET",
    ...(options || {}),
  });
}

/** 绑定微信手机号 通过微信小程序手机号凭证为当前用户绑定手机号。 POST /api/users/me/wechat-phone/ */
export async function appsAccountsApiBindWechatPhone(
  body: API.WechatPhoneIn,
  options?: { [key: string]: any }
) {
  return request<API.WechatPhoneOut>("/api/users/me/wechat-phone/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}
