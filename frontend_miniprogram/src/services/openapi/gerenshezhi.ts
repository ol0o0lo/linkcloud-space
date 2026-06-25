/* eslint-disable */
// @ts-ignore
import request from '@/http/vue-query';
import { CustomRequestOptions_ } from '@/http/types';

import * as API from './types';

/** 获取个人设置列表 返回当前用户的个人偏好设置列表。 GET /api/settings/user/ */
export function settingsUserUsingGet({
  options,
}: {
  options?: CustomRequestOptions_;
}) {
  return request<API.UserSettingOut[]>('/api/settings/user/', {
    method: 'GET',
    ...(options || {}),
  });
}

/** 获取单个个人设置 返回当前用户指定偏好设置的值。 GET /api/settings/user/${param0}/ */
export function settingsUserKeyUsingGet({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.SettingsUserKeyUsingGetParams;
  options?: CustomRequestOptions_;
}) {
  const { key: param0, ...queryParams } = params;

  return request<API.UserSettingOut>(`/api/settings/user/${param0}/`, {
    method: 'GET',
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 更新个人设置 更新当前用户某个偏好设置的值。 PUT /api/settings/user/${param0}/ */
export function settingsUserKeyUsingPut({
  params,
  body,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.SettingsUserKeyUsingPutParams;
  body: API.SetSettingIn;
  options?: CustomRequestOptions_;
}) {
  const { key: param0, ...queryParams } = params;

  return request<API.UserSettingOut>(`/api/settings/user/${param0}/`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** 删除个人设置 删除当前用户某个偏好设置。 DELETE /api/settings/user/${param0}/ */
export function settingsUserKeyUsingDelete({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.SettingsUserKeyUsingDeleteParams;
  options?: CustomRequestOptions_;
}) {
  const { key: param0, ...queryParams } = params;

  return request<Record<string, unknown>>(`/api/settings/user/${param0}/`, {
    method: 'DELETE',
    params: { ...queryParams },
    ...(options || {}),
  });
}
