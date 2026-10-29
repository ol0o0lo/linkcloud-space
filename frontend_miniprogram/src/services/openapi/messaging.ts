/* eslint-disable */
// @ts-ignore
import request from '@/http/vue-query';
import { CustomRequestOptions_ } from '@/http/types';

import * as API from './types';

/** 查询本人会话 GET /api/messaging/organizations/${param0}/conversations/ */
export function messagingOrganizationsOrganizationSlugConversationsUsingGet({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.MessagingOrganizationsOrganizationSlugConversationsUsingGetParams;
  options?: CustomRequestOptions_;
}) {
  const { organization_slug: param0, ...queryParams } = params;

  return request<API.PagedMessagingConversationOut>(
    `/api/messaging/organizations/${param0}/conversations/`,
    {
      method: 'GET',
      params: {
        // page has a default value: 1
        page: '1',
        ...queryParams,
      },
      ...(options || {}),
    }
  );
}

/** 查询本人会话详情 GET /api/messaging/organizations/${param0}/conversations/${param1}/ */
export function messagingOrganizationsOrganizationSlugConversationsConversationIdUsingGet({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.MessagingOrganizationsOrganizationSlugConversationsConversationIdUsingGetParams;
  options?: CustomRequestOptions_;
}) {
  const {
    organization_slug: param0,
    conversation_id: param1,
    ...queryParams
  } = params;

  return request<API.MessagingConversationOut>(
    `/api/messaging/organizations/${param0}/conversations/${param1}/`,
    {
      method: 'GET',
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}

/** 查询聊天历史或增量消息 GET /api/messaging/organizations/${param0}/conversations/${param1}/messages/ */
export function messagingOrganizationsOrganizationSlugConversationsConversationIdMessagesUsingGet({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.MessagingOrganizationsOrganizationSlugConversationsConversationIdMessagesUsingGetParams;
  options?: CustomRequestOptions_;
}) {
  const {
    organization_slug: param0,
    conversation_id: param1,
    ...queryParams
  } = params;

  return request<API.PagedMessagingMessageOut>(
    `/api/messaging/organizations/${param0}/conversations/${param1}/messages/`,
    {
      method: 'GET',
      params: {
        // page has a default value: 1
        page: '1',
        ...queryParams,
      },
      ...(options || {}),
    }
  );
}

/** 发送文字消息 POST /api/messaging/organizations/${param0}/conversations/${param1}/messages/ */
export function messagingOrganizationsOrganizationSlugConversationsConversationIdMessagesUsingPost({
  params,
  body,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.MessagingOrganizationsOrganizationSlugConversationsConversationIdMessagesUsingPostParams;
  body: API.MessagingMessageIn;
  options?: CustomRequestOptions_;
}) {
  const {
    organization_slug: param0,
    conversation_id: param1,
    ...queryParams
  } = params;

  return request<API.MessagingMessageOut>(
    `/api/messaging/organizations/${param0}/conversations/${param1}/messages/`,
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

/** 推进本人会话阅读位置 PATCH /api/messaging/organizations/${param0}/conversations/${param1}/read/ */
export function messagingOrganizationsOrganizationSlugConversationsConversationIdReadUsingPatch({
  params,
  body,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.MessagingOrganizationsOrganizationSlugConversationsConversationIdReadUsingPatchParams;
  body: API.MessagingReadIn;
  options?: CustomRequestOptions_;
}) {
  const {
    organization_slug: param0,
    conversation_id: param1,
    ...queryParams
  } = params;

  return request<API.MessagingReadOut>(
    `/api/messaging/organizations/${param0}/conversations/${param1}/read/`,
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

/** 创建或复用组织成员单聊 POST /api/messaging/organizations/${param0}/conversations/direct/ */
export function messagingOrganizationsOrganizationSlugConversationsDirectUsingPost({
  params,
  body,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.MessagingOrganizationsOrganizationSlugConversationsDirectUsingPostParams;
  body: API.MessagingDirectIn;
  options?: CustomRequestOptions_;
}) {
  const { organization_slug: param0, ...queryParams } = params;

  return request<API.MessagingConversationOut>(
    `/api/messaging/organizations/${param0}/conversations/direct/`,
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

/** 查询组织单聊候选成员 GET /api/messaging/organizations/${param0}/peers/ */
export function messagingOrganizationsOrganizationSlugPeersUsingGet({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.MessagingOrganizationsOrganizationSlugPeersUsingGetParams;
  options?: CustomRequestOptions_;
}) {
  const { organization_slug: param0, ...queryParams } = params;

  return request<API.PagedMessagingPeerOut>(
    `/api/messaging/organizations/${param0}/peers/`,
    {
      method: 'GET',
      params: {
        // page has a default value: 1
        page: '1',
        ...queryParams,
      },
      ...(options || {}),
    }
  );
}

/** 查询当前组织聊天未读 GET /api/messaging/organizations/${param0}/unread-count/ */
export function messagingOrganizationsOrganizationSlugUnreadCountUsingGet({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.MessagingOrganizationsOrganizationSlugUnreadCountUsingGetParams;
  options?: CustomRequestOptions_;
}) {
  const { organization_slug: param0, ...queryParams } = params;

  return request<API.MessagingUnreadCountOut>(
    `/api/messaging/organizations/${param0}/unread-count/`,
    {
      method: 'GET',
      params: {
        ...queryParams,
      },
      ...(options || {}),
    }
  );
}

/** 查询本人业务会话的组织 GET /api/messaging/personal/organizations/ */
export function messagingPersonalOrganizationsUsingGet({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.MessagingPersonalOrganizationsUsingGetParams;
  options?: CustomRequestOptions_;
}) {
  return request<API.PagedMessagingPersonalOrganizationOut>(
    '/api/messaging/personal/organizations/',
    {
      method: 'GET',
      params: {
        // page has a default value: 1
        page: '1',
        ...params,
      },
      ...(options || {}),
    }
  );
}
