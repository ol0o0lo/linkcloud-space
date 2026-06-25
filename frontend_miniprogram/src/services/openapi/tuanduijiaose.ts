/* eslint-disable */
// @ts-ignore
import request from '@/http/vue-query';
import { CustomRequestOptions_ } from '@/http/types';

import * as API from './types';

/** 获取团队级角色列表 返回当前组织可用的 team 级角色，供指定 team 的授权配置使用。 GET /api/access/teams/${param0}/roles/ */
export function accessTeamsTeamIdRolesUsingGet({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.AccessTeamsTeamIdRolesUsingGetParams;
  options?: CustomRequestOptions_;
}) {
  const { team_id: param0, ...queryParams } = params;

  return request<API.AccessRoleOut[]>(`/api/access/teams/${param0}/roles/`, {
    method: 'GET',
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 创建团队级自定义角色 在当前组织下创建 team 级自定义角色，用于后续绑定到具体 team 成员。 POST /api/access/teams/${param0}/roles/ */
export function accessTeamsTeamIdRolesUsingPost({
  params,
  body,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.AccessTeamsTeamIdRolesUsingPostParams;
  body: API.CustomRoleCreateIn;
  options?: CustomRequestOptions_;
}) {
  const { team_id: param0, ...queryParams } = params;

  return request<API.AccessRoleOut>(`/api/access/teams/${param0}/roles/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** 删除团队级自定义角色 删除当前组织下未被授权绑定引用的 team 级自定义角色。 DELETE /api/access/teams/${param0}/roles/${param1}/ */
export function accessTeamsTeamIdRolesRoleIdUsingDelete({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.AccessTeamsTeamIdRolesRoleIdUsingDeleteParams;
  options?: CustomRequestOptions_;
}) {
  const { team_id: param0, role_id: param1, ...queryParams } = params;

  return request<Record<string, unknown>>(
    `/api/access/teams/${param0}/roles/${param1}/`,
    {
      method: 'DELETE',
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}

/** 更新团队级自定义角色 修改当前组织下的 team 级自定义角色名称或权限列表；系统预置角色不能通过该接口修改。 PATCH /api/access/teams/${param0}/roles/${param1}/ */
export function accessTeamsTeamIdRolesRoleIdUsingPatch({
  params,
  body,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.AccessTeamsTeamIdRolesRoleIdUsingPatchParams;
  body: API.CustomRolePatchIn;
  options?: CustomRequestOptions_;
}) {
  const { team_id: param0, role_id: param1, ...queryParams } = params;

  return request<API.AccessRoleOut>(
    `/api/access/teams/${param0}/roles/${param1}/`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      params: { ...queryParams },
      data: body,
      ...(options || {}),
    }
  );
}
