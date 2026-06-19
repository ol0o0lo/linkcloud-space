// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** 获取租户级角色列表 返回当前组织下可用的 org 级角色，包含系统预置角色和当前组织自定义角色。 GET /api/access/organization-roles/ */
export async function appsAccessApiListOrgRoles(options?: {
  [key: string]: any;
}) {
  return request<API.AccessRoleOut[]>("/api/access/organization-roles/", {
    method: "GET",
    ...(options || {}),
  });
}

/** 创建租户级自定义角色 在当前组织下创建 org 级自定义角色，可直接传入权限列表，或基于现有角色复制权限配置。 POST /api/access/organization-roles/ */
export async function appsAccessApiCreateOrgRole(
  body: API.CustomRoleCreateIn,
  options?: { [key: string]: any }
) {
  return request<API.AccessRoleOut>("/api/access/organization-roles/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** 删除租户级自定义角色 删除当前组织下未被授权绑定引用的 org 级自定义角色。 DELETE /api/access/organization-roles/${param0}/ */
export async function appsAccessApiDeleteOrgRole(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsAccessApiDeleteOrgRoleParams,
  options?: { [key: string]: any }
) {
  const { role_id: param0, ...queryParams } = params;
  return request<any>(`/api/access/organization-roles/${param0}/`, {
    method: "DELETE",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 更新租户级自定义角色 修改当前组织下的 org 级自定义角色名称或权限列表；系统预置角色不能通过该接口修改。 PATCH /api/access/organization-roles/${param0}/ */
export async function appsAccessApiPatchOrgRole(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsAccessApiPatchOrgRoleParams,
  body: API.CustomRolePatchIn,
  options?: { [key: string]: any }
) {
  const { role_id: param0, ...queryParams } = params;
  return request<API.AccessRoleOut>(
    `/api/access/organization-roles/${param0}/`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      params: { ...queryParams },
      data: body,
      ...(options || {}),
    }
  );
}
