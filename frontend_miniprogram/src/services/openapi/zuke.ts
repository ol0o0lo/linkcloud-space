/* eslint-disable */
// @ts-ignore
import request from '@/http/vue-query';
import { CustomRequestOptions_ } from '@/http/types';

import * as API from './types';

/** 租客直接开始房源聊天 POST /api/house/tenant/chat/ */
export function houseTenantChatUsingPost({
  body,
  options,
}: {
  body: API.TenantChatIn;
  options?: CustomRequestOptions_;
}) {
  return request<API.MessagingConversationOut>('/api/house/tenant/chat/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    data: body,
    ...(options || {}),
  });
}

/** 租客发送预约联系方式 POST /api/house/tenant/contact/ */
export function houseTenantContactUsingPost({
  body,
  options,
}: {
  body: API.TenantContactRequestIn;
  options?: CustomRequestOptions_;
}) {
  return request<API.TenantContactRequestOut>('/api/house/tenant/contact/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    data: body,
    ...(options || {}),
  });
}

/** 租客向当前房源会话分享联系方式 POST /api/house/tenant/conversations/${param0}/contact/ */
export function houseTenantConversationsConversationIdContactUsingPost({
  params,
  body,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.HouseTenantConversationsConversationIdContactUsingPostParams;
  body: API.TenantContactShareIn;
  options?: CustomRequestOptions_;
}) {
  const { conversation_id: param0, ...queryParams } = params;

  return request<API.MessagingMessageOut>(
    `/api/house/tenant/conversations/${param0}/contact/`,
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

/** 获取租客个人租约 GET /api/house/tenant/leases/ */
export function houseTenantLeasesUsingGet({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.HouseTenantLeasesUsingGetParams;
  options?: CustomRequestOptions_;
}) {
  return request<API.PagedTenantLeaseOut>('/api/house/tenant/leases/', {
    method: 'GET',
    params: {
      // page has a default value: 1
      page: '1',
      ...params,
    },
    ...(options || {}),
  });
}

/** 获取租客个人租约详情 GET /api/house/tenant/leases/${param0}/ */
export function houseTenantLeasesLeaseIdUsingGet({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.HouseTenantLeasesLeaseIdUsingGetParams;
  options?: CustomRequestOptions_;
}) {
  const { lease_id: param0, ...queryParams } = params;

  return request<API.TenantLeaseOut>(`/api/house/tenant/leases/${param0}/`, {
    method: 'GET',
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 获取租客个人带看记录 GET /api/house/tenant/viewing-records/ */
export function houseTenantViewingRecordsUsingGet({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.HouseTenantViewingRecordsUsingGetParams;
  options?: CustomRequestOptions_;
}) {
  return request<API.PagedTenantViewingRecordOut>(
    '/api/house/tenant/viewing-records/',
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

/** 租客预约看房 POST /api/house/tenant/viewing-records/ */
export function houseTenantViewingRecordsUsingPost({
  body,
  options,
}: {
  body: API.TenantViewingRecordIn;
  options?: CustomRequestOptions_;
}) {
  return request<API.TenantViewingRecordOut>(
    '/api/house/tenant/viewing-records/',
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

/** 获取租客个人带看详情 GET /api/house/tenant/viewing-records/${param0}/ */
export function houseTenantViewingRecordsViewingRecordIdUsingGet({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.HouseTenantViewingRecordsViewingRecordIdUsingGetParams;
  options?: CustomRequestOptions_;
}) {
  const { viewing_record_id: param0, ...queryParams } = params;

  return request<API.TenantViewingRecordOut>(
    `/api/house/tenant/viewing-records/${param0}/`,
    {
      method: 'GET',
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}

/** 取消租客个人带看预约 POST /api/house/tenant/viewing-records/${param0}/cancel/ */
export function houseTenantViewingRecordsViewingRecordIdCancelUsingPost({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.HouseTenantViewingRecordsViewingRecordIdCancelUsingPostParams;
  options?: CustomRequestOptions_;
}) {
  const { viewing_record_id: param0, ...queryParams } = params;

  return request<API.TenantViewingRecordOut>(
    `/api/house/tenant/viewing-records/${param0}/cancel/`,
    {
      method: 'POST',
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}
