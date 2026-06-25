/* eslint-disable */
// @ts-ignore
import request from '@/http/vue-query';
import { CustomRequestOptions_ } from '@/http/types';

import * as API from './types';

/** 获取用户列表 返回当前租户下可见的用户列表，支持按姓名关键字筛选。 GET /api/users/ */
export function usersUsingGet({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.UsersUsingGetParams;
  options?: CustomRequestOptions_;
}) {
  return request<API.PagedUserOut>('/api/users/', {
    method: 'GET',
    params: {
      // page has a default value: 1
      page: '1',
      ...params,
    },
    ...(options || {}),
  });
}

/** 获取指定用户信息 返回当前租户范围内指定用户的资料信息。 GET /api/users/${param0}/ */
export function usersUserIdUsingGet({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.UsersUserIdUsingGetParams;
  options?: CustomRequestOptions_;
}) {
  const { user_id: param0, ...queryParams } = params;

  return request<API.UserOut>(`/api/users/${param0}/`, {
    method: 'GET',
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 更新当前用户资料 更新当前登录用户自己的基础资料，不允许修改他人账户。 PATCH /api/users/${param0}/ */
export function usersUserIdUsingPatch({
  params,
  body,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.UsersUserIdUsingPatchParams;
  body: API.UserPatchIn;
  options?: CustomRequestOptions_;
}) {
  const { user_id: param0, ...queryParams } = params;

  return request<API.UserOut>(`/api/users/${param0}/`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** 拆分手机号请求登录验证码 POST /api/users/auth/app/code/request/ */
export function usersAuthAppCodeRequestUsingPost({
  body,
  options,
}: {
  body: API.SplitPhoneIn;
  options?: CustomRequestOptions_;
}) {
  return request<unknown>('/api/users/auth/app/code/request/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    data: body,
    ...(options || {}),
  });
}

/** 拆分手机号发起换绑 POST /api/users/auth/browser/account/phone/ */
export function usersAuthBrowserAccountPhoneUsingPost({
  body,
  options,
}: {
  body: API.SplitPhoneIn;
  options?: CustomRequestOptions_;
}) {
  return request<unknown>('/api/users/auth/browser/account/phone/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    data: body,
    ...(options || {}),
  });
}

/** 确认手机号验证码 POST /api/users/auth/browser/phone/verify/ */
export function usersAuthBrowserPhoneVerifyUsingPost({
  body,
  options,
}: {
  body: API.PhoneCodeVerifyIn;
  options?: CustomRequestOptions_;
}) {
  return request<unknown>('/api/users/auth/browser/phone/verify/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    data: body,
    ...(options || {}),
  });
}

/** 拆分手机号注册 POST /api/users/auth/browser/signup/ */
export function usersAuthBrowserSignupUsingPost({
  body,
  options,
}: {
  body: API.SplitPhoneSignupIn;
  options?: CustomRequestOptions_;
}) {
  return request<unknown>('/api/users/auth/browser/signup/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    data: body,
    ...(options || {}),
  });
}

/** 搜索可代登录用户 供超级管理员搜索可用于 impersonate 的用户候选列表。 GET /api/users/impersonate-search/ */
export function usersImpersonateSearchUsingGet({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.UsersImpersonateSearchUsingGetParams;
  options?: CustomRequestOptions_;
}) {
  return request<API.ImpersonateUserOut[]>('/api/users/impersonate-search/', {
    method: 'GET',
    params: {
      ...params,
    },
    ...(options || {}),
  });
}

/** 获取当前用户信息 返回当前登录用户的资料、权限相关标记和展示信息。 GET /api/users/me/ */
export function usersMeUsingGet({
  options,
}: {
  options?: CustomRequestOptions_;
}) {
  return request<API.MeOut>('/api/users/me/', {
    method: 'GET',
    ...(options || {}),
  });
}

/** 删除当前用户的 MFA 认证器 删除当前登录用户指定类型的 MFA 认证器。 DELETE /api/users/me/mfa/authenticators/${param0}/ */
export function usersMeMfaAuthenticatorsAuthenticatorTypeUsingDelete({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.UsersMeMfaAuthenticatorsAuthenticatorTypeUsingDeleteParams;
  options?: CustomRequestOptions_;
}) {
  const { authenticator_type: param0, ...queryParams } = params;

  return request<Record<string, unknown>>(
    `/api/users/me/mfa/authenticators/${param0}/`,
    {
      method: 'DELETE',
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}

/** 获取 TOTP 初始化信息 返回当前用户可用于初始化 TOTP 的密钥和 otpauth URL。 GET /api/users/me/mfa/totp-setup/ */
export function usersMeMfaTotpSetupUsingGet({
  options,
}: {
  options?: CustomRequestOptions_;
}) {
  return request<API.TotpSetupOut>('/api/users/me/mfa/totp-setup/', {
    method: 'GET',
    ...(options || {}),
  });
}

/** 获取当前用户社交账号绑定状态 返回管理端账号绑定页需要展示的当前用户社交绑定状态。 GET /api/users/me/social-bindings/ */
export function usersMeSocialBindingsUsingGet({
  options,
}: {
  options?: CustomRequestOptions_;
}) {
  return request<API.SocialBindingsOut>('/api/users/me/social-bindings/', {
    method: 'GET',
    ...(options || {}),
  });
}

/** 绑定微信手机号 通过微信小程序手机号凭证为当前用户绑定手机号。 POST /api/users/me/wechat-phone/ */
export function usersMeWechatPhoneUsingPost({
  body,
  options,
}: {
  body: API.WechatPhoneIn;
  options?: CustomRequestOptions_;
}) {
  return request<API.WechatPhoneOut>('/api/users/me/wechat-phone/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    data: body,
    ...(options || {}),
  });
}
