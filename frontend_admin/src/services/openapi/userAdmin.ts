// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** 获取后台用户列表 由超级管理员查看全量用户列表，用于后台账号生命周期管理。 GET /api/admin/users/ */
export async function appsAccountsApiListAdminUsers(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsAccountsApiListAdminUsersParams,
  options?: { [key: string]: any }
) {
  return request<API.PagedAdminUserOut>("/api/admin/users/", {
    method: "GET",
    params: {
      // page has a default value: 1
      page: "1",
      ...params,
    },
    ...(options || {}),
  });
}

/** 创建后台用户 由超级管理员创建用户，可同时设置角色、手机号和初始密码。 POST /api/admin/users/ */
export async function appsAccountsApiCreateAdminUser(
  body: API.AdminUserCreateIn,
  options?: { [key: string]: any }
) {
  return request<API.AdminUserOut>("/api/admin/users/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** 更新后台用户 由超级管理员更新用户资料、角色与联系方式。 PATCH /api/admin/users/${param0}/ */
export async function appsAccountsApiPatchAdminUser(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsAccountsApiPatchAdminUserParams,
  body: API.AdminUserPatchIn,
  options?: { [key: string]: any }
) {
  const { user_id: param0, ...queryParams } = params;
  return request<API.AdminUserOut>(`/api/admin/users/${param0}/`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** 强制用户退出登录 删除 allauth 记录的用户会话，使用户需要重新登录。 POST /api/admin/users/${param0}/force-logout/ */
export async function appsAccountsApiForceLogoutUser(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsAccountsApiForceLogoutUserParams,
  options?: { [key: string]: any }
) {
  const { user_id: param0, ...queryParams } = params;
  return request<API.ForceLogoutOut>(
    `/api/admin/users/${param0}/force-logout/`,
    {
      method: "POST",
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}

/** 解绑用户手机号 清空用户手机号及验证状态。 DELETE /api/admin/users/${param0}/phone/ */
export async function appsAccountsApiUnbindUserPhone(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsAccountsApiUnbindUserPhoneParams,
  options?: { [key: string]: any }
) {
  const { user_id: param0, ...queryParams } = params;
  return request<any>(`/api/admin/users/${param0}/phone/`, {
    method: "DELETE",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 重置用户 MFA 删除用户已配置的 allauth MFA authenticators。 POST /api/admin/users/${param0}/reset-mfa/ */
export async function appsAccountsApiResetUserMfa(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsAccountsApiResetUserMfaParams,
  options?: { [key: string]: any }
) {
  const { user_id: param0, ...queryParams } = params;
  return request<API.ResetMfaOut>(`/api/admin/users/${param0}/reset-mfa/`, {
    method: "POST",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 设置用户密码 由超级管理员直接设置用户密码。 POST /api/admin/users/${param0}/set-password/ */
export async function appsAccountsApiSetAdminUserPassword(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsAccountsApiSetAdminUserPasswordParams,
  body: API.AdminUserPasswordIn,
  options?: { [key: string]: any }
) {
  const { user_id: param0, ...queryParams } = params;
  return request<API.AdminUserOut>(`/api/admin/users/${param0}/set-password/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** 启用或禁用用户 由超级管理员启用或禁用用户账号；禁止通过该接口禁用自己。 PATCH /api/admin/users/${param0}/status/ */
export async function appsAccountsApiPatchUserStatus(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsAccountsApiPatchUserStatusParams,
  body: API.UserStatusPatchIn,
  options?: { [key: string]: any }
) {
  const { user_id: param0, ...queryParams } = params;
  return request<API.AdminUserOut>(`/api/admin/users/${param0}/status/`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** 解绑用户微信账号 删除用户微信开放平台和小程序 social account 绑定。 DELETE /api/admin/users/${param0}/wechat/ */
export async function appsAccountsApiUnbindUserWechat(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsAccountsApiUnbindUserWechatParams,
  options?: { [key: string]: any }
) {
  const { user_id: param0, ...queryParams } = params;
  return request<any>(`/api/admin/users/${param0}/wechat/`, {
    method: "DELETE",
    params: { ...queryParams },
    ...(options || {}),
  });
}
