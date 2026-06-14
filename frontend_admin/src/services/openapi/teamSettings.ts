// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** 获取团队设置列表 返回指定团队全部可见设置项及其当前值。 GET /api/settings/teams/${param0}/ */
export async function appsSettingsApiListTeamSettings(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsSettingsApiListTeamSettingsParams,
  options?: { [key: string]: any }
) {
  const { team_id: param0, ...queryParams } = params;
  return request<API.SettingOut[]>(`/api/settings/teams/${param0}/`, {
    method: "GET",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 获取单个团队设置 返回指定团队某个设置项的当前值和元数据。 GET /api/settings/teams/${param0}/${param1}/ */
export async function appsSettingsApiGetTeamSettingView(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsSettingsApiGetTeamSettingViewParams,
  options?: { [key: string]: any }
) {
  const { team_id: param0, key: param1, ...queryParams } = params;
  return request<API.SettingOut>(`/api/settings/teams/${param0}/${param1}/`, {
    method: "GET",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 更新团队设置 更新指定团队某个设置项的值。 PUT /api/settings/teams/${param0}/${param1}/ */
export async function appsSettingsApiPutTeamSetting(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsSettingsApiPutTeamSettingParams,
  body: API.SetSettingIn,
  options?: { [key: string]: any }
) {
  const { team_id: param0, key: param1, ...queryParams } = params;
  return request<API.SettingOut>(`/api/settings/teams/${param0}/${param1}/`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** 删除团队设置覆盖 删除指定团队某个设置项的覆盖值，恢复默认设置。 DELETE /api/settings/teams/${param0}/${param1}/ */
export async function appsSettingsApiDeleteTeamSettingView(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsSettingsApiDeleteTeamSettingViewParams,
  options?: { [key: string]: any }
) {
  const { team_id: param0, key: param1, ...queryParams } = params;
  return request<any>(`/api/settings/teams/${param0}/${param1}/`, {
    method: "DELETE",
    params: { ...queryParams },
    ...(options || {}),
  });
}
