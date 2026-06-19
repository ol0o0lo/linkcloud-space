// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** 获取通知分发列表 返回当前管理员可访问的通知分发列表。 GET /api/notification-dispatches/ */
export async function appsNotificationsApiListDispatches(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsNotificationsApiListDispatchesParams,
  options?: { [key: string]: any }
) {
  return request<API.PagedNotificationDispatchOut>(
    "/api/notification-dispatches/",
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

/** 创建通知分发 创建通知分发记录，并异步入队执行。 POST /api/notification-dispatches/ */
export async function appsNotificationsApiCreateDispatch(
  body: API.NotificationDispatchIn,
  options?: { [key: string]: any }
) {
  return request<API.NotificationDispatchOut>("/api/notification-dispatches/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** 获取通知分发详情 返回当前管理员可访问的单条通知分发详情。 GET /api/notification-dispatches/${param0}/ */
export async function appsNotificationsApiGetDispatch(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsNotificationsApiGetDispatchParams,
  options?: { [key: string]: any }
) {
  const { dispatch_id: param0, ...queryParams } = params;
  return request<API.NotificationDispatchOut>(
    `/api/notification-dispatches/${param0}/`,
    {
      method: "GET",
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}

/** 获取通知分发投递明细 返回当前管理员可访问的通知分发投递行。 GET /api/notification-dispatches/${param0}/notifications/ */
export async function appsNotificationsApiListDispatchNotifications(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsNotificationsApiListDispatchNotificationsParams,
  options?: { [key: string]: any }
) {
  const { dispatch_id: param0, ...queryParams } = params;
  return request<API.PagedNotificationOut>(
    `/api/notification-dispatches/${param0}/notifications/`,
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
