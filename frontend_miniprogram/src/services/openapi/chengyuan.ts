/* eslint-disable */
// @ts-ignore
import request from '@/http/vue-query';
import { CustomRequestOptions_ } from '@/http/types';

import * as API from './types';

/** 获取租户成员列表 返回当前租户成员列表，支持按姓名、用户名和邮箱搜索。 GET /api/organization-members/ */
export function organizationMembersUsingGet({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.OrganizationMembersUsingGetParams;
  options?: CustomRequestOptions_;
}) {
  return request<API.PagedMemberOut>('/api/organization-members/', {
    method: 'GET',
    params: {
      // page has a default value: 1
      page: '1',
      ...params,
    },
    ...(options || {}),
  });
}

/** 添加租户成员 向当前租户新增一个成员，并可选择是否授予 owner 身份。 POST /api/organization-members/ */
export function organizationMembersUsingPost({
  body,
  options,
}: {
  body: API.MemberIn;
  options?: CustomRequestOptions_;
}) {
  return request<API.MemberOut>('/api/organization-members/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    data: body,
    ...(options || {}),
  });
}

/** 获取租户成员详情 返回当前租户内单个成员的详细信息。 GET /api/organization-members/${param0}/ */
export function organizationMembersMemberIdUsingGet({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.OrganizationMembersMemberIdUsingGetParams;
  options?: CustomRequestOptions_;
}) {
  const { member_id: param0, ...queryParams } = params;

  return request<API.MemberOut>(`/api/organization-members/${param0}/`, {
    method: 'GET',
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 移除租户成员 将指定成员从当前租户移除，不允许移除自己。 DELETE /api/organization-members/${param0}/ */
export function organizationMembersMemberIdUsingDelete({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.OrganizationMembersMemberIdUsingDeleteParams;
  options?: CustomRequestOptions_;
}) {
  const { member_id: param0, ...queryParams } = params;

  return request<Record<string, unknown>>(
    `/api/organization-members/${param0}/`,
    {
      method: 'DELETE',
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}

/** 更新租户成员 更新成员 owner 状态等可编辑信息。 PATCH /api/organization-members/${param0}/ */
export function organizationMembersMemberIdUsingPatch({
  params,
  body,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.OrganizationMembersMemberIdUsingPatchParams;
  body: API.MemberPatchIn;
  options?: CustomRequestOptions_;
}) {
  const { member_id: param0, ...queryParams } = params;

  return request<API.MemberOut>(`/api/organization-members/${param0}/`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** 搜索可添加成员 搜索尚未加入当前租户且未被邀请的可添加用户。 GET /api/organization-members/search/ */
export function organizationMembersSearchUsingGet({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.OrganizationMembersSearchUsingGetParams;
  options?: CustomRequestOptions_;
}) {
  return request<API.MemberSearchOut[]>('/api/organization-members/search/', {
    method: 'GET',
    params: {
      ...params,
    },
    ...(options || {}),
  });
}
