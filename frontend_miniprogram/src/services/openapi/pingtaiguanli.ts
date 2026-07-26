/* eslint-disable */
// @ts-ignore
import request from '@/http/vue-query';
import { CustomRequestOptions_ } from '@/http/types';

import * as API from './types';

/** 平台查看开票申请 GET /api/admin/subscriptions/invoice-requests/ */
export function adminSubscriptionsInvoiceRequestsUsingGet({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.AdminSubscriptionsInvoiceRequestsUsingGetParams;
  options?: CustomRequestOptions_;
}) {
  return request<API.PagedInvoiceRequestOut>(
    '/api/admin/subscriptions/invoice-requests/',
    {
      method: 'GET',
      params: {
        // page has a default value: 1
        page: '1',
        ...params,
      },
      ...(options || {}),
    }
  );
}

/** 处理开票申请 PATCH /api/admin/subscriptions/invoice-requests/${param0}/ */
export function adminSubscriptionsInvoiceRequestsInvoiceRequestIdUsingPatch({
  params,
  body,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.AdminSubscriptionsInvoiceRequestsInvoiceRequestIdUsingPatchParams;
  body: API.InvoiceProcessIn;
  options?: CustomRequestOptions_;
}) {
  const { invoice_request_id: param0, ...queryParams } = params;

  return request<API.InvoiceRequestOut>(
    `/api/admin/subscriptions/invoice-requests/${param0}/`,
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

/** 平台查看订阅订单 GET /api/admin/subscriptions/orders/ */
export function adminSubscriptionsOrdersUsingGet({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.AdminSubscriptionsOrdersUsingGetParams;
  options?: CustomRequestOptions_;
}) {
  return request<API.PagedSaaSOrderOut>('/api/admin/subscriptions/orders/', {
    method: 'GET',
    params: {
      // page has a default value: 1
      page: '1',
      ...params,
    },
    ...(options || {}),
  });
}

/** 线下登记订单退款 POST /api/admin/subscriptions/orders/${param0}/refund/ */
export function adminSubscriptionsOrdersOrderIdRefundUsingPost({
  params,
  body,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.AdminSubscriptionsOrdersOrderIdRefundUsingPostParams;
  body: API.RefundIn;
  options?: CustomRequestOptions_;
}) {
  const { order_id: param0, ...queryParams } = params;

  return request<API.SaaSOrderOut>(
    `/api/admin/subscriptions/orders/${param0}/refund/`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      params: { ...queryParams },
      data: body,
      ...(options || {}),
    }
  );
}
