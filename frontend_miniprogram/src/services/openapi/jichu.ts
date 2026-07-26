/* eslint-disable */
// @ts-ignore
import request from '@/http/vue-query';
import { CustomRequestOptions_ } from '@/http/types';

import * as API from './types';

/** 创建租户 创建一个新租户，并将当前用户设置为租户 owner 与 primary 成员。 POST /api/organizations/ */
export function organizationsUsingPost({
  body,
  options,
}: {
  body: API.OrganizationCreateIn;
  options?: CustomRequestOptions_;
}) {
  return request<API.OrganizationCreateOut>('/api/organizations/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    data: body,
    ...(options || {}),
  });
}

/** 获取租户详情 返回当前选中租户的完整资料，用于后台资料页初始化。 GET /api/organizations/${param0}/ */
export function organizationsSlugUsingGet({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.OrganizationsSlugUsingGetParams;
  options?: CustomRequestOptions_;
}) {
  const { slug: param0, ...queryParams } = params;

  return request<API.OrganizationOut>(`/api/organizations/${param0}/`, {
    method: 'GET',
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 更新租户资料 更新当前选中租户的基础资料和账单邮箱。 PATCH /api/organizations/${param0}/ */
export function organizationsSlugUsingPatch({
  params,
  body,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.OrganizationsSlugUsingPatchParams;
  body: API.OrganizationPatchIn;
  options?: CustomRequestOptions_;
}) {
  const { slug: param0, ...queryParams } = params;

  return request<API.OrganizationOut>(`/api/organizations/${param0}/`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** 切换当前租户 将当前会话切换到指定 slug 对应的租户。 POST /api/organizations/${param0}/select/ */
export function organizationsSlugSelectUsingPost({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.OrganizationsSlugSelectUsingPostParams;
  options?: CustomRequestOptions_;
}) {
  const { slug: param0, ...queryParams } = params;

  return request<API.OrgSelectOut>(`/api/organizations/${param0}/select/`, {
    method: 'POST',
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 设置主租户 将指定租户设置为当前用户的主租户。 POST /api/organizations/${param0}/set-primary/ */
export function organizationsSlugSetPrimaryUsingPost({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.OrganizationsSlugSetPrimaryUsingPostParams;
  options?: CustomRequestOptions_;
}) {
  const { slug: param0, ...queryParams } = params;

  return request<API.SetPrimaryOut>(
    `/api/organizations/${param0}/set-primary/`,
    {
      method: 'POST',
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}

/** 归档或恢复租户 通过 is_active 控制租户是否可用；禁用时记录 archived_at，恢复时清空。 PATCH /api/organizations/${param0}/status/ */
export function organizationsSlugStatusUsingPatch({
  params,
  body,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.OrganizationsSlugStatusUsingPatchParams;
  body: API.OrganizationStatusPatchIn;
  options?: CustomRequestOptions_;
}) {
  const { slug: param0, ...queryParams } = params;

  return request<API.OrganizationOut>(`/api/organizations/${param0}/status/`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** 转移租户 owner 将当前 owner 身份转移给同租户的另一个成员。 POST /api/organizations/${param0}/transfer-owner/ */
export function organizationsSlugTransferOwnerUsingPost({
  params,
  body,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.OrganizationsSlugTransferOwnerUsingPostParams;
  body: API.TransferOwnerIn;
  options?: CustomRequestOptions_;
}) {
  const { slug: param0, ...queryParams } = params;

  return request<API.SuccessOut>(
    `/api/organizations/${param0}/transfer-owner/`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      params: { ...queryParams },
      data: body,
      ...(options || {}),
    }
  );
}

/** 获取租户用量 返回当前租户成员数、团队数。配额由订阅权益接口提供。 GET /api/organizations/${param0}/usage/ */
export function organizationsSlugUsageUsingGet({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.OrganizationsSlugUsageUsingGetParams;
  options?: CustomRequestOptions_;
}) {
  const { slug: param0, ...queryParams } = params;

  return request<API.OrganizationUsageOut>(
    `/api/organizations/${param0}/usage/`,
    {
      method: 'GET',
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}

/** 退出当前租户 清除当前会话中的租户上下文选择。 POST /api/organizations/signout/ */
export function organizationsSignoutUsingPost({
  options,
}: {
  options?: CustomRequestOptions_;
}) {
  return request<API.SuccessOut>('/api/organizations/signout/', {
    method: 'POST',
    ...(options || {}),
  });
}

/** 获取租户切换列表 返回当前用户所属租户列表及当前选中、主租户状态。 GET /api/organizations/switch-list/ */
export function organizationsSwitchListUsingGet({
  options,
}: {
  options?: CustomRequestOptions_;
}) {
  return request<API.SwitchListItemOut[]>('/api/organizations/switch-list/', {
    method: 'GET',
    ...(options || {}),
  });
}

/** 获取团队列表 返回当前租户下用户可见的团队列表，支持按名称搜索。 GET /api/teams/ */
export function teamsUsingGet({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.TeamsUsingGetParams;
  options?: CustomRequestOptions_;
}) {
  return request<API.PagedTeamOut>('/api/teams/', {
    method: 'GET',
    params: {
      // page has a default value: 1
      page: '1',
      ...params,
    },
    ...(options || {}),
  });
}

/** 创建团队 在当前租户下创建一个新团队，并可设置初始成员。 POST /api/teams/ */
export function teamsUsingPost({
  body,
  options,
}: {
  body: API.TeamIn;
  options?: CustomRequestOptions_;
}) {
  return request<API.TeamOut>('/api/teams/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    data: body,
    ...(options || {}),
  });
}

/** 获取团队详情 返回当前用户有权限访问的单个团队详情。 GET /api/teams/${param0}/ */
export function teamsTeamIdUsingGet({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.TeamsTeamIdUsingGetParams;
  options?: CustomRequestOptions_;
}) {
  const { team_id: param0, ...queryParams } = params;

  return request<API.TeamOut>(`/api/teams/${param0}/`, {
    method: 'GET',
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 删除团队 删除指定团队。 DELETE /api/teams/${param0}/ */
export function teamsTeamIdUsingDelete({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.TeamsTeamIdUsingDeleteParams;
  options?: CustomRequestOptions_;
}) {
  const { team_id: param0, ...queryParams } = params;

  return request<Record<string, unknown>>(`/api/teams/${param0}/`, {
    method: 'DELETE',
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 更新团队 更新团队资料或成员列表，成员变更需要额外的成员管理权限。 PATCH /api/teams/${param0}/ */
export function teamsTeamIdUsingPatch({
  params,
  body,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.TeamsTeamIdUsingPatchParams;
  body: API.TeamPatchIn;
  options?: CustomRequestOptions_;
}) {
  const { team_id: param0, ...queryParams } = params;

  return request<API.TeamOut>(`/api/teams/${param0}/`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}
