// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** 创建租户 创建一个新租户，并将当前用户设置为租户 owner 与 primary 成员。 POST /api/organizations/ */
export async function appsOrganizationsApiCreateOrganization(
  body: API.OrganizationCreateIn,
  options?: { [key: string]: any }
) {
  return request<API.OrganizationCreateOut>("/api/organizations/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** 获取租户详情 返回当前选中租户的完整资料，用于后台资料页初始化。 GET /api/organizations/${param0}/ */
export async function appsOrganizationsApiGetOrganization(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsOrganizationsApiGetOrganizationParams,
  options?: { [key: string]: any }
) {
  const { slug: param0, ...queryParams } = params;
  return request<API.OrganizationOut>(`/api/organizations/${param0}/`, {
    method: "GET",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 更新租户资料和限制 更新当前选中租户的基础资料、账单邮箱和成员/团队上限。 PATCH /api/organizations/${param0}/ */
export async function appsOrganizationsApiPatchOrganization(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsOrganizationsApiPatchOrganizationParams,
  body: API.OrganizationPatchIn,
  options?: { [key: string]: any }
) {
  const { slug: param0, ...queryParams } = params;
  return request<API.OrganizationOut>(`/api/organizations/${param0}/`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** 切换当前租户 将当前会话切换到指定 slug 对应的租户。 POST /api/organizations/${param0}/select/ */
export async function appsOrganizationsApiSelectOrg(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsOrganizationsApiSelectOrgParams,
  options?: { [key: string]: any }
) {
  const { slug: param0, ...queryParams } = params;
  return request<API.OrgSelectOut>(`/api/organizations/${param0}/select/`, {
    method: "POST",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 设置主租户 将指定租户设置为当前用户的主租户。 POST /api/organizations/${param0}/set-primary/ */
export async function appsOrganizationsApiSetPrimary(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsOrganizationsApiSetPrimaryParams,
  options?: { [key: string]: any }
) {
  const { slug: param0, ...queryParams } = params;
  return request<API.SetPrimaryOut>(
    `/api/organizations/${param0}/set-primary/`,
    {
      method: "POST",
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}

/** 归档或恢复租户 通过 is_active 控制租户是否可用；禁用时记录 archived_at，恢复时清空。 PATCH /api/organizations/${param0}/status/ */
export async function appsOrganizationsApiPatchOrganizationStatus(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsOrganizationsApiPatchOrganizationStatusParams,
  body: API.OrganizationStatusPatchIn,
  options?: { [key: string]: any }
) {
  const { slug: param0, ...queryParams } = params;
  return request<API.OrganizationOut>(`/api/organizations/${param0}/status/`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** 转移租户 owner 将当前 owner 身份转移给同租户的另一个成员。 POST /api/organizations/${param0}/transfer-owner/ */
export async function appsOrganizationsApiTransferOwner(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsOrganizationsApiTransferOwnerParams,
  body: API.TransferOwnerIn,
  options?: { [key: string]: any }
) {
  const { slug: param0, ...queryParams } = params;
  return request<API.SuccessOut>(
    `/api/organizations/${param0}/transfer-owner/`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      params: { ...queryParams },
      data: body,
      ...(options || {}),
    }
  );
}

/** 获取租户用量 返回当前租户成员数、团队数及对应上限。 GET /api/organizations/${param0}/usage/ */
export async function appsOrganizationsApiGetOrganizationUsage(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsOrganizationsApiGetOrganizationUsageParams,
  options?: { [key: string]: any }
) {
  const { slug: param0, ...queryParams } = params;
  return request<API.OrganizationUsageOut>(
    `/api/organizations/${param0}/usage/`,
    {
      method: "GET",
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}

/** 退出当前租户 清除当前会话中的租户上下文选择。 POST /api/organizations/signout/ */
export async function appsOrganizationsApiSignout(options?: {
  [key: string]: any;
}) {
  return request<API.SuccessOut>("/api/organizations/signout/", {
    method: "POST",
    ...(options || {}),
  });
}

/** 获取租户切换列表 返回当前用户所属租户列表及当前选中、主租户状态。 GET /api/organizations/switch-list/ */
export async function appsOrganizationsApiSwitchList(options?: {
  [key: string]: any;
}) {
  return request<API.SwitchListItemOut[]>("/api/organizations/switch-list/", {
    method: "GET",
    ...(options || {}),
  });
}
