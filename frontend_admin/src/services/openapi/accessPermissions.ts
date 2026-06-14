// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** 获取可分配权限列表 返回当前系统可用于角色配置的权限点清单，前端可用于角色创建和编辑时展示权限选项。 GET /api/access/permissions/ */
export async function appsAccessApiListPermissions(options?: {
  [key: string]: any;
}) {
  return request<API.PermissionOut[]>("/api/access/permissions/", {
    method: "GET",
    ...(options || {}),
  });
}
