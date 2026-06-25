/* eslint-disable */
// @ts-ignore
import request from '@/http/vue-query';
import { CustomRequestOptions_ } from '@/http/types';

import * as API from './types';

/** 获取团队设置列表 返回指定团队全部可见设置项及其当前值。 GET /api/settings/teams/${param0}/ */
export function settingsTeamsTeamIdUsingGet({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.SettingsTeamsTeamIdUsingGetParams;
  options?: CustomRequestOptions_;
}) {
  const { team_id: param0, ...queryParams } = params;

  return request<API.SettingOut[]>(`/api/settings/teams/${param0}/`, {
    method: 'GET',
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 获取单个团队设置 返回指定团队某个设置项的当前值和元数据。 GET /api/settings/teams/${param0}/${param1}/ */
export function settingsTeamsTeamIdKeyUsingGet({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.SettingsTeamsTeamIdKeyUsingGetParams;
  options?: CustomRequestOptions_;
}) {
  const { team_id: param0, key: param1, ...queryParams } = params;

  return request<API.SettingOut>(`/api/settings/teams/${param0}/${param1}/`, {
    method: 'GET',
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 更新团队设置 更新指定团队某个设置项的值。 PUT /api/settings/teams/${param0}/${param1}/ */
export function settingsTeamsTeamIdKeyUsingPut({
  params,
  body,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.SettingsTeamsTeamIdKeyUsingPutParams;
  body: API.SetSettingIn;
  options?: CustomRequestOptions_;
}) {
  const { team_id: param0, key: param1, ...queryParams } = params;

  return request<API.SettingOut>(`/api/settings/teams/${param0}/${param1}/`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** 删除团队设置覆盖 删除指定团队某个设置项的覆盖值，恢复默认设置。 DELETE /api/settings/teams/${param0}/${param1}/ */
export function settingsTeamsTeamIdKeyUsingDelete({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.SettingsTeamsTeamIdKeyUsingDeleteParams;
  options?: CustomRequestOptions_;
}) {
  const { team_id: param0, key: param1, ...queryParams } = params;

  return request<Record<string, unknown>>(
    `/api/settings/teams/${param0}/${param1}/`,
    {
      method: 'DELETE',
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}
