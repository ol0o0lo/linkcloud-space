// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** 公开获取 SaaS 套餐目录 GET /api/public/saas/plans/ */
export async function appsSubscriptionsApiPublicListPlans(options?: {
  [key: string]: any;
}) {
  return request<API.PlanOut[]>("/api/public/saas/plans/", {
    method: "GET",
    ...(options || {}),
  });
}

/** 公开提交企业版需求 POST /api/public/saas/sales-leads/ */
export async function appsSubscriptionsApiPublicCreateSalesLead(
  body: API.SalesLeadCreateIn,
  options?: { [key: string]: any }
) {
  return request<API.SalesLeadOut>("/api/public/saas/sales-leads/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}
