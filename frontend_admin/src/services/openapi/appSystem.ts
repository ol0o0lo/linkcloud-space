// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** 获取应用上下文 返回当前用户、当前租户和前端初始化所需的全局上下文信息。 GET /api/app-context/ */
export async function appsBaseApiAppContext(options?: { [key: string]: any }) {
  return request<API.AppContextOut>("/api/app-context/", {
    method: "GET",
    ...(options || {}),
  });
}

/** 发送测试通知 向指定 staff 用户发送测试邮件或站内通知，仅超级管理员可用。 POST /api/test-notifications/ */
export async function appsBaseApiSendTestNotification(
  body: API.TestNotificationIn,
  options?: { [key: string]: any }
) {
  return request<any>("/api/test-notifications/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** 获取测试通知收件人列表 返回可用于发送测试通知的 staff 用户列表，仅超级管理员可用。 GET /api/test-notifications/staff-users/ */
export async function appsBaseApiTestNotificationsStaffUsers(options?: {
  [key: string]: any;
}) {
  return request<any>("/api/test-notifications/staff-users/", {
    method: "GET",
    ...(options || {}),
  });
}

/** 获取应用版本 返回当前前端构建版本标识，用于客户端版本展示与调试。 GET /api/version/ */
export async function appsBaseApiGetVersion(options?: { [key: string]: any }) {
  return request<any>("/api/version/", {
    method: "GET",
    ...(options || {}),
  });
}
