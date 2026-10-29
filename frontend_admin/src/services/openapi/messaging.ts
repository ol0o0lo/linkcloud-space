// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** 查询本人会话 GET /api/messaging/organizations/${param0}/conversations/ */
export async function messagingListConversations(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.messagingListConversationsParams,
  options?: { [key: string]: any }
) {
  const { organization_slug: param0, ...queryParams } = params;
  return request<API.PagedMessagingConversationOut>(
    `/api/messaging/organizations/${param0}/conversations/`,
    {
      method: "GET",
      params: {
        // page has a default value: 1
        page: "1",
        ...queryParams,
      },
      ...(options || {}),
    }
  );
}

/** 查询本人会话详情 GET /api/messaging/organizations/${param0}/conversations/${param1}/ */
export async function messagingGetConversation(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.messagingGetConversationParams,
  options?: { [key: string]: any }
) {
  const {
    organization_slug: param0,
    conversation_id: param1,
    ...queryParams
  } = params;
  return request<API.MessagingConversationOut>(
    `/api/messaging/organizations/${param0}/conversations/${param1}/`,
    {
      method: "GET",
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}

/** 查询聊天历史或增量消息 GET /api/messaging/organizations/${param0}/conversations/${param1}/messages/ */
export async function messagingListMessages(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.messagingListMessagesParams,
  options?: { [key: string]: any }
) {
  const {
    organization_slug: param0,
    conversation_id: param1,
    ...queryParams
  } = params;
  return request<API.PagedMessagingMessageOut>(
    `/api/messaging/organizations/${param0}/conversations/${param1}/messages/`,
    {
      method: "GET",
      params: {
        // page has a default value: 1
        page: "1",
        ...queryParams,
      },
      ...(options || {}),
    }
  );
}

/** 发送文字消息 POST /api/messaging/organizations/${param0}/conversations/${param1}/messages/ */
export async function messagingSendMessage(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.messagingSendMessageParams,
  body: API.MessagingMessageIn,
  options?: { [key: string]: any }
) {
  const {
    organization_slug: param0,
    conversation_id: param1,
    ...queryParams
  } = params;
  return request<API.MessagingMessageOut>(
    `/api/messaging/organizations/${param0}/conversations/${param1}/messages/`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      params: { ...queryParams },
      data: body,
      ...(options || {}),
    }
  );
}

/** 推进本人会话阅读位置 PATCH /api/messaging/organizations/${param0}/conversations/${param1}/read/ */
export async function messagingMarkRead(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.messagingMarkReadParams,
  body: API.MessagingReadIn,
  options?: { [key: string]: any }
) {
  const {
    organization_slug: param0,
    conversation_id: param1,
    ...queryParams
  } = params;
  return request<API.MessagingReadOut>(
    `/api/messaging/organizations/${param0}/conversations/${param1}/read/`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      params: { ...queryParams },
      data: body,
      ...(options || {}),
    }
  );
}

/** 创建或复用组织成员单聊 POST /api/messaging/organizations/${param0}/conversations/direct/ */
export async function messagingCreateDirectConversation(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.messagingCreateDirectConversationParams,
  body: API.MessagingDirectIn,
  options?: { [key: string]: any }
) {
  const { organization_slug: param0, ...queryParams } = params;
  return request<API.MessagingConversationOut>(
    `/api/messaging/organizations/${param0}/conversations/direct/`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      params: { ...queryParams },
      data: body,
      ...(options || {}),
    }
  );
}

/** 查询组织单聊候选成员 GET /api/messaging/organizations/${param0}/peers/ */
export async function messagingListPeers(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.messagingListPeersParams,
  options?: { [key: string]: any }
) {
  const { organization_slug: param0, ...queryParams } = params;
  return request<API.PagedMessagingPeerOut>(
    `/api/messaging/organizations/${param0}/peers/`,
    {
      method: "GET",
      params: {
        // page has a default value: 1
        page: "1",
        ...queryParams,
      },
      ...(options || {}),
    }
  );
}

/** 查询当前组织聊天未读 GET /api/messaging/organizations/${param0}/unread-count/ */
export async function messagingGetUnreadCount(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.messagingGetUnreadCountParams,
  options?: { [key: string]: any }
) {
  const { organization_slug: param0, ...queryParams } = params;
  return request<API.MessagingUnreadCountOut>(
    `/api/messaging/organizations/${param0}/unread-count/`,
    {
      method: "GET",
      params: {
        ...queryParams,
      },
      ...(options || {}),
    }
  );
}

/** 查询本人业务会话的组织 GET /api/messaging/personal/organizations/ */
export async function messagingListPersonalOrganizations(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.messagingListPersonalOrganizationsParams,
  options?: { [key: string]: any }
) {
  return request<API.PagedMessagingPersonalOrganizationOut>(
    "/api/messaging/personal/organizations/",
    {
      method: "GET",
      params: {
        // page has a default value: 1
        page: "1",
        ...params,
      },
      ...(options || {}),
    }
  );
}
