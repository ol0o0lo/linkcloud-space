/* eslint-disable */
// @ts-ignore
import request from '@/http/vue-query';
import { CustomRequestOptions_ } from '@/http/types';

import * as API from './types';

/** 获取租户邀请列表 返回当前租户的邀请记录列表。 GET /api/organization-invites/ */
export function organizationInvitesUsingGet({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.OrganizationInvitesUsingGetParams;
  options?: CustomRequestOptions_;
}) {
  return request<API.PagedInviteOut>('/api/organization-invites/', {
    method: 'GET',
    params: {
      // page has a default value: 1
      page: '1',
      ...params,
    },
    ...(options || {}),
  });
}

/** 创建租户邀请 向指定邮箱或用户发送加入当前租户的邀请。 POST /api/organization-invites/ */
export function organizationInvitesUsingPost({
  body,
  options,
}: {
  body: API.InviteIn;
  options?: CustomRequestOptions_;
}) {
  return request<API.InviteOut>('/api/organization-invites/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    data: body,
    ...(options || {}),
  });
}

/** 获取租户邀请详情 返回当前租户某条邀请记录的详情。 GET /api/organization-invites/${param0}/ */
export function organizationInvitesInviteIdUsingGet({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.OrganizationInvitesInviteIdUsingGetParams;
  options?: CustomRequestOptions_;
}) {
  const { invite_id: param0, ...queryParams } = params;

  return request<API.InviteOut>(`/api/organization-invites/${param0}/`, {
    method: 'GET',
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 取消租户邀请 取消一条未处理的租户邀请。 DELETE /api/organization-invites/${param0}/ */
export function organizationInvitesInviteIdUsingDelete({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.OrganizationInvitesInviteIdUsingDeleteParams;
  options?: CustomRequestOptions_;
}) {
  const { invite_id: param0, ...queryParams } = params;

  return request<Record<string, unknown>>(
    `/api/organization-invites/${param0}/`,
    {
      method: 'DELETE',
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}

/** 重发租户邀请 重新发送当前租户内某条待处理邀请。 POST /api/organization-invites/${param0}/resend/ */
export function organizationInvitesInviteIdResendUsingPost({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.OrganizationInvitesInviteIdResendUsingPostParams;
  options?: CustomRequestOptions_;
}) {
  const { invite_id: param0, ...queryParams } = params;

  return request<API.SuccessOut>(
    `/api/organization-invites/${param0}/resend/`,
    {
      method: 'POST',
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}
