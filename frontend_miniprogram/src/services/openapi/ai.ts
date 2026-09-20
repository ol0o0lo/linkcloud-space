/* eslint-disable */
// @ts-ignore
import request from '@/http/vue-query';
import { CustomRequestOptions_ } from '@/http/types';

import * as API from './types';

/** 查询本人 AI 对话 GET /api/ai/conversations/ */
export function aiConversationsUsingGet({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.AiConversationsUsingGetParams;
  options?: CustomRequestOptions_;
}) {
  return request<API.PagedConversationOut>('/api/ai/conversations/', {
    method: 'GET',
    params: {
      // scope has a default value: organization
      scope: 'organization',
      // page has a default value: 1
      page: '1',
      ...params,
    },
    ...(options || {}),
  });
}

/** 创建 AI 对话 POST /api/ai/conversations/ */
export function aiConversationsUsingPost({
  body,
  options,
}: {
  body: API.ConversationCreateIn;
  options?: CustomRequestOptions_;
}) {
  return request<API.ConversationOut>('/api/ai/conversations/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    data: body,
    ...(options || {}),
  });
}

/** 查询 AI 对话消息 GET /api/ai/conversations/${param0}/messages/ */
export function aiConversationsConversationIdMessagesUsingGet({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.AiConversationsConversationIdMessagesUsingGetParams;
  options?: CustomRequestOptions_;
}) {
  const { conversation_id: param0, ...queryParams } = params;

  return request<API.PagedMessageOut>(
    `/api/ai/conversations/${param0}/messages/`,
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

/** 发送 AI 对话消息 POST /api/ai/conversations/${param0}/messages/ */
export function aiConversationsConversationIdMessagesUsingPost({
  params,
  body,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.AiConversationsConversationIdMessagesUsingPostParams;
  body: API.MessageCreateIn;
  options?: CustomRequestOptions_;
}) {
  const { conversation_id: param0, ...queryParams } = params;

  return request<API.MessageGenerationOut>(
    `/api/ai/conversations/${param0}/messages/`,
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

/** 流式发送 AI 对话消息 POST /api/ai/conversations/${param0}/messages/stream/ */
export function aiConversationsConversationIdMessagesStreamUsingPost({
  params,
  body,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.AiConversationsConversationIdMessagesStreamUsingPostParams;
  body: API.MessageCreateIn;
  options?: CustomRequestOptions_;
}) {
  const { conversation_id: param0, ...queryParams } = params;

  return request<unknown>(`/api/ai/conversations/${param0}/messages/stream/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}
