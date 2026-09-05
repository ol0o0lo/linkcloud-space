import { request } from '@umijs/max';

export function cancelSubscriptionOrder(orderNo: string) {
  return request<API.SaaSOrderOut>(
    `/api/subscriptions/orders/${encodeURIComponent(orderNo)}/cancel/`,
    { method: 'POST' },
  );
}
