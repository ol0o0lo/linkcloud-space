/* eslint-disable */
// @ts-ignore
import request from '@/http/vue-query';
import { CustomRequestOptions_ } from '@/http/types';

import * as API from './types';

/** 获取通知列表 返回当前用户在当前租户范围内的通知列表，支持按已读状态筛选。 GET /api/notifications/ */
export function notificationsUsingGet({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.NotificationsUsingGetParams;
  options?: CustomRequestOptions_;
}) {
  return request<API.PagedNotificationOut>('/api/notifications/', {
    method: 'GET',
    params: {
      // page has a default value: 1
      page: '1',
      ...params,
    },
    ...(options || {}),
  });
}

/** 获取通知详情 返回当前用户可访问的单条通知详情。 GET /api/notifications/${param0}/ */
export function notificationsNotificationIdUsingGet({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.NotificationsNotificationIdUsingGetParams;
  options?: CustomRequestOptions_;
}) {
  const { notification_id: param0, ...queryParams } = params;

  return request<API.NotificationOut>(`/api/notifications/${param0}/`, {
    method: 'GET',
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 删除通知 删除当前用户可访问的单条通知。 DELETE /api/notifications/${param0}/ */
export function notificationsNotificationIdUsingDelete({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.NotificationsNotificationIdUsingDeleteParams;
  options?: CustomRequestOptions_;
}) {
  const { notification_id: param0, ...queryParams } = params;

  return request<Record<string, unknown>>(`/api/notifications/${param0}/`, {
    method: 'DELETE',
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 更新通知状态 更新单条通知的已读状态。 PATCH /api/notifications/${param0}/ */
export function notificationsNotificationIdUsingPatch({
  params,
  body,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.NotificationsNotificationIdUsingPatchParams;
  body: API.NotificationPatchIn;
  options?: CustomRequestOptions_;
}) {
  const { notification_id: param0, ...queryParams } = params;

  return request<API.NotificationOut>(`/api/notifications/${param0}/`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** 批量处理通知 批量标记通知已读、未读或删除通知。 POST /api/notifications/bulk/ */
export function notificationsBulkUsingPost({
  body,
  options,
}: {
  body: API.BulkActionIn;
  options?: CustomRequestOptions_;
}) {
  return request<API.BulkResultOut>('/api/notifications/bulk/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    data: body,
    ...(options || {}),
  });
}

/** 获取通知偏好设置 返回通知类别与当前用户偏好设置的合并结果。 GET /api/notifications/preferences/ */
export function notificationsPreferencesUsingGet({
  options,
}: {
  options?: CustomRequestOptions_;
}) {
  return request<API.NotificationPreferenceOut[]>(
    '/api/notifications/preferences/',
    {
      method: 'GET',
      ...(options || {}),
    }
  );
}

/** 更新通知偏好设置 更新某个通知类别的站内和邮件接收偏好。 PATCH /api/notifications/preferences/${param0}/ */
export function notificationsPreferencesCategoryUsingPatch({
  params,
  body,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.NotificationsPreferencesCategoryUsingPatchParams;
  body: API.NotificationPreferencePatchIn;
  options?: CustomRequestOptions_;
}) {
  const { category: param0, ...queryParams } = params;

  return request<API.NotificationPreferenceOut>(
    `/api/notifications/preferences/${param0}/`,
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

/** 获取未读通知数量 返回当前用户在当前租户下的未读通知数量。 GET /api/notifications/unread-count/ */
export function notificationsUnreadCountUsingGet({
  options,
}: {
  options?: CustomRequestOptions_;
}) {
  return request<API.UnreadCountOut>('/api/notifications/unread-count/', {
    method: 'GET',
    ...(options || {}),
  });
}
