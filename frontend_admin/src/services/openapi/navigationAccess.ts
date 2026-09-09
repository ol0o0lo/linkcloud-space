// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** 获取当前组织导航能力 GET /api/access/navigation/ */
export async function appsAccessApiGetNavigationAccessCapabilities(options?: {
  [key: string]: any;
}) {
  return request<API.NavigationAccessCapabilitiesOut>(
    "/api/access/navigation/",
    {
      method: "GET",
      ...(options || {}),
    }
  );
}
