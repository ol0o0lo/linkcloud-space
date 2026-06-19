// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** 获取租户设置列表 返回当前租户全部可见设置项及其当前值。 GET /api/settings/org/ */
export async function appsSettingsApiListOrgSettings(options?: {
  [key: string]: any;
}) {
  return request<API.SettingOut[]>("/api/settings/org/", {
    method: "GET",
    ...(options || {}),
  });
}

/** 获取单个租户设置 返回当前租户指定设置项的当前值和元数据。 GET /api/settings/org/${param0}/ */
export async function appsSettingsApiGetOrgSettingView(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsSettingsApiGetOrgSettingViewParams,
  options?: { [key: string]: any }
) {
  const { key: param0, ...queryParams } = params;
  return request<API.SettingOut>(`/api/settings/org/${param0}/`, {
    method: "GET",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 更新租户设置 更新当前租户某个设置项的值。 PUT /api/settings/org/${param0}/ */
export async function appsSettingsApiPutOrgSetting(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsSettingsApiPutOrgSettingParams,
  body: API.SetSettingIn,
  options?: { [key: string]: any }
) {
  const { key: param0, ...queryParams } = params;
  return request<API.SettingOut>(`/api/settings/org/${param0}/`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** 删除租户设置覆盖 删除当前租户某个设置项的覆盖值，恢复默认设置。 DELETE /api/settings/org/${param0}/ */
export async function appsSettingsApiDeleteOrgSettingView(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsSettingsApiDeleteOrgSettingViewParams,
  options?: { [key: string]: any }
) {
  const { key: param0, ...queryParams } = params;
  return request<Record<string, any>>(`/api/settings/org/${param0}/`, {
    method: "DELETE",
    params: { ...queryParams },
    ...(options || {}),
  });
}
