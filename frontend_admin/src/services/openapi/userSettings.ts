// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** 获取个人设置列表 返回当前用户的个人偏好设置列表。 GET /api/settings/user/ */
export async function appsSettingsApiListUserSettings(options?: {
  [key: string]: any;
}) {
  return request<API.UserSettingOut[]>("/api/settings/user/", {
    method: "GET",
    ...(options || {}),
  });
}

/** 获取单个个人设置 返回当前用户指定偏好设置的值。 GET /api/settings/user/${param0}/ */
export async function appsSettingsApiGetUserSettingView(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsSettingsApiGetUserSettingViewParams,
  options?: { [key: string]: any }
) {
  const { key: param0, ...queryParams } = params;
  return request<API.UserSettingOut>(`/api/settings/user/${param0}/`, {
    method: "GET",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 更新个人设置 更新当前用户某个偏好设置的值。 PUT /api/settings/user/${param0}/ */
export async function appsSettingsApiPutUserSetting(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsSettingsApiPutUserSettingParams,
  body: API.SetSettingIn,
  options?: { [key: string]: any }
) {
  const { key: param0, ...queryParams } = params;
  return request<API.UserSettingOut>(`/api/settings/user/${param0}/`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** 删除个人设置 删除当前用户某个偏好设置。 DELETE /api/settings/user/${param0}/ */
export async function appsSettingsApiDeleteUserSettingView(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsSettingsApiDeleteUserSettingViewParams,
  options?: { [key: string]: any }
) {
  const { key: param0, ...queryParams } = params;
  return request<any>(`/api/settings/user/${param0}/`, {
    method: "DELETE",
    params: { ...queryParams },
    ...(options || {}),
  });
}
