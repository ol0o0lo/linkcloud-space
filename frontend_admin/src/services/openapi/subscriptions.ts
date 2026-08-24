// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** 获取当前订阅、权益和用量 GET /api/subscriptions/current/ */
export async function appsSubscriptionsApiCurrentSubscription(options?: {
  [key: string]: any;
}) {
  return request<API.CurrentSubscriptionOut>("/api/subscriptions/current/", {
    method: "GET",
    ...(options || {}),
  });
}

/** 获取开票资料 GET /api/subscriptions/invoice-profile/ */
export async function appsSubscriptionsApiGetInvoiceProfile(options?: {
  [key: string]: any;
}) {
  return request<API.InvoiceProfileOut | null>(
    "/api/subscriptions/invoice-profile/",
    {
      method: "GET",
      ...(options || {}),
    }
  );
}

/** 维护开票资料 PUT /api/subscriptions/invoice-profile/ */
export async function appsSubscriptionsApiPutInvoiceProfile(
  body: API.InvoiceProfileIn,
  options?: { [key: string]: any }
) {
  return request<API.InvoiceProfileOut>("/api/subscriptions/invoice-profile/", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** 获取本组织开票申请 GET /api/subscriptions/invoice-requests/ */
export async function appsSubscriptionsApiListInvoiceRequests(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsSubscriptionsApiListInvoiceRequestsParams,
  options?: { [key: string]: any }
) {
  return request<API.PagedInvoiceRequestOut>(
    "/api/subscriptions/invoice-requests/",
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

/** 申请开票 POST /api/subscriptions/invoice-requests/ */
export async function appsSubscriptionsApiCreateInvoiceRequest(
  body: API.InvoiceRequestIn,
  options?: { [key: string]: any }
) {
  return request<API.InvoiceRequestOut>(
    "/api/subscriptions/invoice-requests/",
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

/** 获取本组织支付记录 GET /api/subscriptions/orders/ */
export async function appsSubscriptionsApiListOrders(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsSubscriptionsApiListOrdersParams,
  options?: { [key: string]: any }
) {
  return request<API.PagedSaaSOrderOut>("/api/subscriptions/orders/", {
    method: "GET",
    params: {
      // page has a default value: 1
      page: "1",
      ...params,
    },
    ...(options || {}),
  });
}

/** 创建套餐支付订单 POST /api/subscriptions/orders/ */
export async function appsSubscriptionsApiCreateOrder(
  body: API.PurchaseOrderIn,
  options?: { [key: string]: any }
) {
  return request<API.SaaSOrderOut>("/api/subscriptions/orders/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** 轮询支付订单状态 GET /api/subscriptions/orders/${param0}/ */
export async function appsSubscriptionsApiGetOrder(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsSubscriptionsApiGetOrderParams,
  options?: { [key: string]: any }
) {
  const { order_no: param0, ...queryParams } = params;
  return request<API.SaaSOrderOut>(`/api/subscriptions/orders/${param0}/`, {
    method: "GET",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 获取可展示的套餐目录 GET /api/subscriptions/plans/ */
export async function appsSubscriptionsApiListPlans(options?: {
  [key: string]: any;
}) {
  return request<API.PlanOut[]>("/api/subscriptions/plans/", {
    method: "GET",
    ...(options || {}),
  });
}
