/* eslint-disable */
// @ts-ignore
import request from '@/http/vue-query';
import { CustomRequestOptions_ } from '@/http/types';

import * as API from './types';

/** 执行钱包对账 POST /api/internal/wallet/reconcile/ */
export function internalWalletReconcileUsingPost({
  options,
}: {
  options?: CustomRequestOptions_;
}) {
  return request<API.ReconcileOut>('/api/internal/wallet/reconcile/', {
    method: 'POST',
    ...(options || {}),
  });
}

/** 重试失败提现代付 POST /api/internal/wallet/withdrawals/${param0}/retry/ */
export function internalWalletWithdrawalsWithdrawalIdRetryUsingPost({
  params,
  body,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.InternalWalletWithdrawalsWithdrawalIdRetryUsingPostParams;
  body: API.WithdrawalRetryIn;
  options?: CustomRequestOptions_;
}) {
  const { withdrawal_id: param0, ...queryParams } = params;

  return request<API.WithdrawalPayoutOut>(
    `/api/internal/wallet/withdrawals/${param0}/retry/`,
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
