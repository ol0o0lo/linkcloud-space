// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** 查询本人 AI 对话 GET /api/ai/conversations/ */
export async function appsAiApiListConversations(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsAiApiListConversationsParams,
  options?: { [key: string]: any }
) {
  return request<API.PagedConversationOut>("/api/ai/conversations/", {
    method: "GET",
    params: {
      // scope has a default value: organization
      scope: "organization",
      // page has a default value: 1
      page: "1",
      ...params,
    },
    ...(options || {}),
  });
}

/** 创建 AI 对话 POST /api/ai/conversations/ */
export async function appsAiApiCreateConversation(
  body: API.ConversationCreateIn,
  options?: { [key: string]: any }
) {
  return request<API.ConversationOut>("/api/ai/conversations/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** 查询 AI 对话消息 GET /api/ai/conversations/${param0}/messages/ */
export async function appsAiApiListMessages(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsAiApiListMessagesParams,
  options?: { [key: string]: any }
) {
  const { conversation_id: param0, ...queryParams } = params;
  return request<API.PagedMessageOut>(
    `/api/ai/conversations/${param0}/messages/`,
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

/** 发送 AI 对话消息 POST /api/ai/conversations/${param0}/messages/ */
export async function appsAiApiCreateMessage(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsAiApiCreateMessageParams,
  body: API.MessageCreateIn,
  options?: { [key: string]: any }
) {
  const { conversation_id: param0, ...queryParams } = params;
  return request<API.MessageGenerationOut>(
    `/api/ai/conversations/${param0}/messages/`,
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

/** 流式发送 AI 对话消息 POST /api/ai/conversations/${param0}/messages/stream/ */
export async function appsAiApiStreamMessage(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsAiApiStreamMessageParams,
  body: API.MessageCreateIn,
  options?: { [key: string]: any }
) {
  const { conversation_id: param0, ...queryParams } = params;
  return request<any>(`/api/ai/conversations/${param0}/messages/stream/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}
