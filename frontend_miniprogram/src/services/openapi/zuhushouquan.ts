/* eslint-disable */
// @ts-ignore
import request from '@/http/vue-query';
import { CustomRequestOptions_ } from '@/http/types';

import * as API from './types';

/** 获取租户级角色绑定列表 返回当前组织内用户与 org 级角色的绑定关系，用于展示谁拥有哪些租户级权限。 GET /api/access/organization-bindings/ */
export function accessOrganizationBindingsUsingGet({
  options,
}: {
  options?: CustomRequestOptions_;
}) {
  return request<API.OrganizationBindingOut[]>(
    '/api/access/organization-bindings/',
    {
      method: 'GET',
      ...(options || {}),
    }
  );
}

/** 分配租户级角色 给当前组织内某个成员绑定一个 org 级角色，角色生效范围覆盖整个组织。 POST /api/access/organization-bindings/ */
export function accessOrganizationBindingsUsingPost({
  body,
  options,
}: {
  body: API.RoleBindingIn;
  options?: CustomRequestOptions_;
}) {
  return request<API.OrganizationBindingOut>(
    '/api/access/organization-bindings/',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      data: body,
      ...(options || {}),
    }
  );
}

/** 移除租户级角色绑定 删除当前组织内某个用户的 org 级角色绑定。 DELETE /api/access/organization-bindings/${param0}/ */
export function accessOrganizationBindingsBindingIdUsingDelete({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.AccessOrganizationBindingsBindingIdUsingDeleteParams;
  options?: CustomRequestOptions_;
}) {
  const { binding_id: param0, ...queryParams } = params;

  return request<Record<string, unknown>>(
    `/api/access/organization-bindings/${param0}/`,
    {
      method: 'DELETE',
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}
