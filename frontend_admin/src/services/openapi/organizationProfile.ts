// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** 获取租户资料 返回当前租户资料页所需的基础信息。 GET /api/organization-settings/ */
export async function appsOrganizationsApiGetSettings(options?: {
  [key: string]: any;
}) {
  return request<API.SettingsOut>("/api/organization-settings/", {
    method: "GET",
    ...(options || {}),
  });
}

/** 更新租户资料 更新当前租户的基础资料字段。 PATCH /api/organization-settings/update_settings/ */
export async function appsOrganizationsApiUpdateSettings(
  body: API.SettingsPatchIn,
  options?: { [key: string]: any }
) {
  return request<API.SettingsOut>(
    "/api/organization-settings/update_settings/",
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      data: body,
      ...(options || {}),
    }
  );
}
