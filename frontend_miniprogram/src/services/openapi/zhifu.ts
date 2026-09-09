/* eslint-disable */
// @ts-ignore
import request from '@/http/vue-query';
import { CustomRequestOptions_ } from '@/http/types';

import * as API from './types';

/** 微信收款回调 POST /api/payments/wechat/notify/ */
export function paymentsWechatNotifyUsingPost({
  options,
}: {
  options?: CustomRequestOptions_;
}) {
  return request<Record<string, unknown>>('/api/payments/wechat/notify/', {
    method: 'POST',
    ...(options || {}),
  });
}

/** 微信出款回调 POST /api/payments/wechat/payout/notify/ */
export function paymentsWechatPayoutNotifyUsingPost({
  options,
}: {
  options?: CustomRequestOptions_;
}) {
  return request<Record<string, unknown>>(
    '/api/payments/wechat/payout/notify/',
    {
      method: 'POST',
      ...(options || {}),
    }
  );
}
