// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** 获取租户级角色绑定列表 返回当前组织内用户与 org 级角色的绑定关系，用于展示谁拥有哪些租户级权限。 GET /api/access/organization-bindings/ */
export async function appsAccessApiListOrganizationBindings(options?: {
  [key: string]: any;
}) {
  return request<API.OrganizationBindingOut[]>(
    "/api/access/organization-bindings/",
    {
      method: "GET",
      ...(options || {}),
    }
  );
}

/** 分配租户级角色 给当前组织内某个成员绑定一个 org 级角色，角色生效范围覆盖整个组织。 POST /api/access/organization-bindings/ */
export async function appsAccessApiCreateOrganizationBinding(
  body: API.RoleBindingIn,
  options?: { [key: string]: any }
) {
  return request<API.OrganizationBindingOut>(
    "/api/access/organization-bindings/",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      data: body,
      ...(options || {}),
    }
  );
}

/** 移除租户级角色绑定 删除当前组织内某个用户的 org 级角色绑定。 DELETE /api/access/organization-bindings/${param0}/ */
export async function appsAccessApiDeleteOrganizationBinding(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsAccessApiDeleteOrganizationBindingParams,
  options?: { [key: string]: any }
) {
  const { binding_id: param0, ...queryParams } = params;
  return request<Record<string, any>>(
    `/api/access/organization-bindings/${param0}/`,
    {
      method: "DELETE",
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}
