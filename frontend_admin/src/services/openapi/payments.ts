// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** 微信收款回调 POST /api/payments/wechat/notify/ */
export async function appsPaymentsApiWechatPaymentNotify(options?: {
  [key: string]: any;
}) {
  return request<Record<string, any>>("/api/payments/wechat/notify/", {
    method: "POST",
    ...(options || {}),
  });
}

/** 微信出款回调 POST /api/payments/wechat/payout/notify/ */
export async function appsPaymentsApiWechatPayoutNotify(options?: {
  [key: string]: any;
}) {
  return request<Record<string, any>>("/api/payments/wechat/payout/notify/", {
    method: "POST",
    ...(options || {}),
  });
}
