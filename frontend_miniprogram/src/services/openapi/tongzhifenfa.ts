/* eslint-disable */
// @ts-ignore
import request from '@/http/vue-query';
import { CustomRequestOptions_ } from '@/http/types';

import * as API from './types';

/** 获取通知分发列表 返回当前管理员可访问的通知分发列表。 GET /api/notification-dispatches/ */
export function notificationDispatchesUsingGet({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.NotificationDispatchesUsingGetParams;
  options?: CustomRequestOptions_;
}) {
  return request<API.PagedNotificationDispatchOut>(
    '/api/notification-dispatches/',
    {
      method: 'GET',
      params: {
        // management_context has a default value: auto
        management_context: 'auto',
        // page has a default value: 1
        page: '1',
        ...params,
      },
      ...(options || {}),
    }
  );
}

/** 创建通知分发 创建通知分发记录，并异步入队执行。 POST /api/notification-dispatches/ */
export function notificationDispatchesUsingPost({
  params,
  body,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.NotificationDispatchesUsingPostParams;
  body: API.NotificationDispatchIn;
  options?: CustomRequestOptions_;
}) {
  return request<API.NotificationDispatchOut>('/api/notification-dispatches/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    params: {
      // management_context has a default value: auto
      management_context: 'auto',
      ...params,
    },
    data: body,
    ...(options || {}),
  });
}

/** 获取通知分发详情 返回当前管理员可访问的单条通知分发详情。 GET /api/notification-dispatches/${param0}/ */
export function notificationDispatchesDispatchIdUsingGet({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.NotificationDispatchesDispatchIdUsingGetParams;
  options?: CustomRequestOptions_;
}) {
  const { dispatch_id: param0, ...queryParams } = params;

  return request<API.NotificationDispatchOut>(
    `/api/notification-dispatches/${param0}/`,
    {
      method: 'GET',
      params: {
        // management_context has a default value: auto
        management_context: 'auto',
        ...queryParams,
      },
      ...(options || {}),
    }
  );
}

/** 获取通知分发投递明细 返回当前管理员可访问的通知分发投递行。 GET /api/notification-dispatches/${param0}/notifications/ */
export function notificationDispatchesDispatchIdNotificationsUsingGet({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.NotificationDispatchesDispatchIdNotificationsUsingGetParams;
  options?: CustomRequestOptions_;
}) {
  const { dispatch_id: param0, ...queryParams } = params;

  return request<API.PagedNotificationOut>(
    `/api/notification-dispatches/${param0}/notifications/`,
    {
      method: 'GET',
      params: {
        // management_context has a default value: auto
        management_context: 'auto',
        // page has a default value: 1
        page: '1',
        ...queryParams,
      },
      ...(options || {}),
    }
  );
}

/** 获取通知分发目标候选 返回当前管理员有权选择的启用组织、当前组织团队或用户候选。 GET /api/notification-dispatches/targets/ */
export function notificationDispatchesTargetsUsingGet({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.NotificationDispatchesTargetsUsingGetParams;
  options?: CustomRequestOptions_;
}) {
  return request<API.PagedNotificationDispatchTargetOut>(
    '/api/notification-dispatches/targets/',
    {
      method: 'GET',
      params: {
        // management_context has a default value: auto
        management_context: 'auto',
        // page has a default value: 1
        page: '1',
        ...params,
      },
      ...(options || {}),
    }
  );
}
