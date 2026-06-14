// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** 获取当前用户实名认证状态 GET /api/users/me/real-name/ */
export async function appsAccountsApiGetMyRealName(options?: {
  [key: string]: any;
}) {
  return request<API.RealNameVerificationOut>("/api/users/me/real-name/", {
    method: "GET",
    ...(options || {}),
  });
}

/** 获取当前用户实名认证时间线 GET /api/users/me/real-name/logs/ */
export async function appsAccountsApiListMyRealNameLogs(options?: {
  [key: string]: any;
}) {
  return request<API.RealNameLogOut[]>("/api/users/me/real-name/logs/", {
    method: "GET",
    ...(options || {}),
  });
}

/** 重新提交实名认证申请 POST /api/users/me/real-name/retry/ */
export async function appsAccountsApiRetryMyRealName(
  body: API.RealNameRetryIn,
  options?: { [key: string]: any }
) {
  return request<API.RealNameVerificationOut>(
    "/api/users/me/real-name/retry/",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      data: body,
      ...(options || {}),
    }
  );
}

/** 提交实名认证申请 POST /api/users/me/real-name/submit/ */
export async function appsAccountsApiSubmitMyRealName(
  body: API.RealNameSubmitIn,
  options?: { [key: string]: any }
) {
  return request<API.RealNameVerificationOut>(
    "/api/users/me/real-name/submit/",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      data: body,
      ...(options || {}),
    }
  );
}
