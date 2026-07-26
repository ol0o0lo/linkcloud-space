/* eslint-disable */
// @ts-ignore
import request from '@/http/vue-query';
import { CustomRequestOptions_ } from '@/http/types';

import * as API from './types';

/** 获取当前订阅、权益和用量 GET /api/subscriptions/current/ */
export function subscriptionsCurrentUsingGet({
  options,
}: {
  options?: CustomRequestOptions_;
}) {
  return request<API.CurrentSubscriptionOut>('/api/subscriptions/current/', {
    method: 'GET',
    ...(options || {}),
  });
}

/** 获取开票资料 GET /api/subscriptions/invoice-profile/ */
export function subscriptionsInvoiceProfileUsingGet({
  options,
}: {
  options?: CustomRequestOptions_;
}) {
  return request<API.InvoiceProfileOut | null>(
    '/api/subscriptions/invoice-profile/',
    {
      method: 'GET',
      ...(options || {}),
    }
  );
}

/** 维护开票资料 PUT /api/subscriptions/invoice-profile/ */
export function subscriptionsInvoiceProfileUsingPut({
  body,
  options,
}: {
  body: API.InvoiceProfileIn;
  options?: CustomRequestOptions_;
}) {
  return request<API.InvoiceProfileOut>('/api/subscriptions/invoice-profile/', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    data: body,
    ...(options || {}),
  });
}

/** 获取本组织开票申请 GET /api/subscriptions/invoice-requests/ */
export function subscriptionsInvoiceRequestsUsingGet({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.SubscriptionsInvoiceRequestsUsingGetParams;
  options?: CustomRequestOptions_;
}) {
  return request<API.PagedInvoiceRequestOut>(
    '/api/subscriptions/invoice-requests/',
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

/** 申请开票 POST /api/subscriptions/invoice-requests/ */
export function subscriptionsInvoiceRequestsUsingPost({
  body,
  options,
}: {
  body: API.InvoiceRequestIn;
  options?: CustomRequestOptions_;
}) {
  return request<API.InvoiceRequestOut>(
    '/api/subscriptions/invoice-requests/',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      data: body,
      ...(options || {}),
    }
  );
}

/** 获取本组织支付记录 GET /api/subscriptions/orders/ */
export function subscriptionsOrdersUsingGet({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.SubscriptionsOrdersUsingGetParams;
  options?: CustomRequestOptions_;
}) {
  return request<API.PagedSaaSOrderOut>('/api/subscriptions/orders/', {
    method: 'GET',
    params: {
      // page has a default value: 1
      page: '1',
      ...params,
    },
    ...(options || {}),
  });
}

/** 创建套餐支付订单 POST /api/subscriptions/orders/ */
export function subscriptionsOrdersUsingPost({
  body,
  options,
}: {
  body: API.PurchaseOrderIn;
  options?: CustomRequestOptions_;
}) {
  return request<API.SaaSOrderOut>('/api/subscriptions/orders/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    data: body,
    ...(options || {}),
  });
}

/** 轮询支付订单状态 GET /api/subscriptions/orders/${param0}/ */
export function subscriptionsOrdersOrderNoUsingGet({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.SubscriptionsOrdersOrderNoUsingGetParams;
  options?: CustomRequestOptions_;
}) {
  const { order_no: param0, ...queryParams } = params;

  return request<API.SaaSOrderOut>(`/api/subscriptions/orders/${param0}/`, {
    method: 'GET',
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 微信支付回调 POST /api/subscriptions/payments/wechat/notify/ */
export function subscriptionsPaymentsWechatNotifyUsingPost({
  options,
}: {
  options?: CustomRequestOptions_;
}) {
  return request<Record<string, unknown>>(
    '/api/subscriptions/payments/wechat/notify/',
    {
      method: 'POST',
      ...(options || {}),
    }
  );
}

/** 获取可展示的套餐目录 GET /api/subscriptions/plans/ */
export function subscriptionsPlansUsingGet({
  options,
}: {
  options?: CustomRequestOptions_;
}) {
  return request<API.PlanOut[]>('/api/subscriptions/plans/', {
    method: 'GET',
    ...(options || {}),
  });
}
