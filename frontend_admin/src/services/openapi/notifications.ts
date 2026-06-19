// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** 获取通知列表 返回当前用户在当前租户范围内的通知列表，支持按已读状态筛选。 GET /api/notifications/ */
export async function appsNotificationsApiListNotifications(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsNotificationsApiListNotificationsParams,
  options?: { [key: string]: any }
) {
  return request<API.PagedNotificationOut>("/api/notifications/", {
    method: "GET",
    params: {
      // page has a default value: 1
      page: "1",
      ...params,
    },
    ...(options || {}),
  });
}

/** 获取通知详情 返回当前用户可访问的单条通知详情。 GET /api/notifications/${param0}/ */
export async function appsNotificationsApiGetNotification(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsNotificationsApiGetNotificationParams,
  options?: { [key: string]: any }
) {
  const { notification_id: param0, ...queryParams } = params;
  return request<API.NotificationOut>(`/api/notifications/${param0}/`, {
    method: "GET",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 删除通知 删除当前用户可访问的单条通知。 DELETE /api/notifications/${param0}/ */
export async function appsNotificationsApiDeleteNotification(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsNotificationsApiDeleteNotificationParams,
  options?: { [key: string]: any }
) {
  const { notification_id: param0, ...queryParams } = params;
  return request<Record<string, any>>(`/api/notifications/${param0}/`, {
    method: "DELETE",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 更新通知状态 更新单条通知的已读状态。 PATCH /api/notifications/${param0}/ */
export async function appsNotificationsApiPatchNotification(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsNotificationsApiPatchNotificationParams,
  body: API.NotificationPatchIn,
  options?: { [key: string]: any }
) {
  const { notification_id: param0, ...queryParams } = params;
  return request<API.NotificationOut>(`/api/notifications/${param0}/`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** 批量处理通知 批量标记通知已读、未读或删除通知。 POST /api/notifications/bulk/ */
export async function appsNotificationsApiBulkAction(
  body: API.BulkActionIn,
  options?: { [key: string]: any }
) {
  return request<API.BulkResultOut>("/api/notifications/bulk/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** 获取通知偏好设置 返回通知类别与当前用户偏好设置的合并结果。 GET /api/notifications/preferences/ */
export async function appsNotificationsApiListPreferences(options?: {
  [key: string]: any;
}) {
  return request<API.NotificationPreferenceOut[]>(
    "/api/notifications/preferences/",
    {
      method: "GET",
      ...(options || {}),
    }
  );
}

/** 更新通知偏好设置 更新某个通知类别的站内和邮件接收偏好。 PATCH /api/notifications/preferences/${param0}/ */
export async function appsNotificationsApiPatchPreference(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsNotificationsApiPatchPreferenceParams,
  body: API.NotificationPreferencePatchIn,
  options?: { [key: string]: any }
) {
  const { category: param0, ...queryParams } = params;
  return request<API.NotificationPreferenceOut>(
    `/api/notifications/preferences/${param0}/`,
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

/** 获取未读通知数量 返回当前用户在当前租户下的未读通知数量。 GET /api/notifications/unread-count/ */
export async function appsNotificationsApiUnreadCount(options?: {
  [key: string]: any;
}) {
  return request<API.UnreadCountOut>("/api/notifications/unread-count/", {
    method: "GET",
    ...(options || {}),
  });
}
