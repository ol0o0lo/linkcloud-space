/* eslint-disable */
// @ts-ignore
import request from '@/http/vue-query';
import { CustomRequestOptions_ } from '@/http/types';

import * as API from './types';

/** 获取租户设置列表 返回当前租户全部可见设置项及其当前值。 GET /api/settings/org/ */
export function settingsOrgUsingGet({
  options,
}: {
  options?: CustomRequestOptions_;
}) {
  return request<API.SettingOut[]>('/api/settings/org/', {
    method: 'GET',
    ...(options || {}),
  });
}

/** 获取单个租户设置 返回当前租户指定设置项的当前值和元数据。 GET /api/settings/org/${param0}/ */
export function settingsOrgKeyUsingGet({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.SettingsOrgKeyUsingGetParams;
  options?: CustomRequestOptions_;
}) {
  const { key: param0, ...queryParams } = params;

  return request<API.SettingOut>(`/api/settings/org/${param0}/`, {
    method: 'GET',
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 更新租户设置 更新当前租户某个设置项的值。 PUT /api/settings/org/${param0}/ */
export function settingsOrgKeyUsingPut({
  params,
  body,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.SettingsOrgKeyUsingPutParams;
  body: API.SetSettingIn;
  options?: CustomRequestOptions_;
}) {
  const { key: param0, ...queryParams } = params;

  return request<API.SettingOut>(`/api/settings/org/${param0}/`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** 删除租户设置覆盖 删除当前租户某个设置项的覆盖值，恢复默认设置。 DELETE /api/settings/org/${param0}/ */
export function settingsOrgKeyUsingDelete({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.SettingsOrgKeyUsingDeleteParams;
  options?: CustomRequestOptions_;
}) {
  const { key: param0, ...queryParams } = params;

  return request<Record<string, unknown>>(`/api/settings/org/${param0}/`, {
    method: 'DELETE',
    params: { ...queryParams },
    ...(options || {}),
  });
}
