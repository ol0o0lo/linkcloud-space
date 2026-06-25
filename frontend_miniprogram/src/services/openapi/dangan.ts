/* eslint-disable */
// @ts-ignore
import request from '@/http/vue-query';
import { CustomRequestOptions_ } from '@/http/types';

import * as API from './types';

/** 获取租户资料 返回当前租户资料页所需的基础信息。 GET /api/organization-settings/ */
export function organizationSettingsUsingGet({
  options,
}: {
  options?: CustomRequestOptions_;
}) {
  return request<API.SettingsOut>('/api/organization-settings/', {
    method: 'GET',
    ...(options || {}),
  });
}

/** 更新租户资料 更新当前租户的基础资料字段。 PATCH /api/organization-settings/update_settings/ */
export function organizationSettingsUpdateSettingsUsingPatch({
  body,
  options,
}: {
  body: API.SettingsPatchIn;
  options?: CustomRequestOptions_;
}) {
  return request<API.SettingsOut>(
    '/api/organization-settings/update_settings/',
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      data: body,
      ...(options || {}),
    }
  );
}
