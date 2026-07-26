// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** 平台查看开票申请 GET /api/admin/subscriptions/invoice-requests/ */
export async function appsSubscriptionsApiAdminListInvoiceRequests(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsSubscriptionsApiAdminListInvoiceRequestsParams,
  options?: { [key: string]: any }
) {
  return request<API.PagedInvoiceRequestOut>(
    "/api/admin/subscriptions/invoice-requests/",
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

/** 处理开票申请 PATCH /api/admin/subscriptions/invoice-requests/${param0}/ */
export async function appsSubscriptionsApiAdminProcessInvoiceRequest(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsSubscriptionsApiAdminProcessInvoiceRequestParams,
  body: API.InvoiceProcessIn,
  options?: { [key: string]: any }
) {
  const { invoice_request_id: param0, ...queryParams } = params;
  return request<API.InvoiceRequestOut>(
    `/api/admin/subscriptions/invoice-requests/${param0}/`,
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

/** 平台查看订阅订单 GET /api/admin/subscriptions/orders/ */
export async function appsSubscriptionsApiAdminListOrders(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsSubscriptionsApiAdminListOrdersParams,
  options?: { [key: string]: any }
) {
  return request<API.PagedSaaSOrderOut>("/api/admin/subscriptions/orders/", {
    method: "GET",
    params: {
      // page has a default value: 1
      page: "1",
      ...params,
    },
    ...(options || {}),
  });
}

/** 线下登记订单退款 POST /api/admin/subscriptions/orders/${param0}/refund/ */
export async function appsSubscriptionsApiAdminRefundOrder(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsSubscriptionsApiAdminRefundOrderParams,
  body: API.RefundIn,
  options?: { [key: string]: any }
) {
  const { order_id: param0, ...queryParams } = params;
  return request<API.SaaSOrderOut>(
    `/api/admin/subscriptions/orders/${param0}/refund/`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      params: { ...queryParams },
      data: body,
      ...(options || {}),
    }
  );
}
