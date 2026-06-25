/* eslint-disable */
// @ts-ignore
import request from '@/http/vue-query';
import { CustomRequestOptions_ } from '@/http/types';

import * as API from './types';

/** 获取可分配权限列表 返回当前系统可用于角色配置的权限点清单，前端可用于角色创建和编辑时展示权限选项。 GET /api/access/permissions/ */
export function accessPermissionsUsingGet({
  options,
}: {
  options?: CustomRequestOptions_;
}) {
  return request<API.PermissionOut[]>('/api/access/permissions/', {
    method: 'GET',
    ...(options || {}),
  });
}
