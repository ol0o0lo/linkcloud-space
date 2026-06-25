/* eslint-disable */
// @ts-ignore
import request from '@/http/vue-query';
import { CustomRequestOptions_ } from '@/http/types';

import * as API from './types';

/** 获取我的邀请记录 GET /api/referrals/me/records/ */
export function referralsMeRecordsUsingGet({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.ReferralsMeRecordsUsingGetParams;
  options?: CustomRequestOptions_;
}) {
  return request<API.PagedReferralRecordOut>('/api/referrals/me/records/', {
    method: 'GET',
    params: {
      // page has a default value: 1
      page: '1',
      ...params,
    },
    ...(options || {}),
  });
}

/** 获取我的裂变推广总览 GET /api/referrals/me/summary/ */
export function referralsMeSummaryUsingGet({
  options,
}: {
  options?: CustomRequestOptions_;
}) {
  return request<API.ReferralSummaryOut>('/api/referrals/me/summary/', {
    method: 'GET',
    ...(options || {}),
  });
}

/** 获取我的钱包流水 GET /api/wallet/me/ledger/ */
export function walletMeLedgerUsingGet({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.WalletMeLedgerUsingGetParams;
  options?: CustomRequestOptions_;
}) {
  return request<API.PagedWalletLedgerOut>('/api/wallet/me/ledger/', {
    method: 'GET',
    params: {
      // page has a default value: 1
      page: '1',
      ...params,
    },
    ...(options || {}),
  });
}

/** 获取我的钱包总览 GET /api/wallet/me/summary/ */
export function walletMeSummaryUsingGet({
  options,
}: {
  options?: CustomRequestOptions_;
}) {
  return request<API.WalletSummaryOut>('/api/wallet/me/summary/', {
    method: 'GET',
    ...(options || {}),
  });
}

/** 获取我的提现申请 GET /api/wallet/me/withdrawals/ */
export function walletMeWithdrawalsUsingGet({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.WalletMeWithdrawalsUsingGetParams;
  options?: CustomRequestOptions_;
}) {
  return request<API.PagedWithdrawalOut>('/api/wallet/me/withdrawals/', {
    method: 'GET',
    params: {
      // page has a default value: 1
      page: '1',
      ...params,
    },
    ...(options || {}),
  });
}

/** 提交提现申请 POST /api/wallet/me/withdrawals/ */
export function walletMeWithdrawalsUsingPost({
  body,
  options,
}: {
  body: API.WithdrawalIn;
  options?: CustomRequestOptions_;
}) {
  return request<API.WithdrawalOut>('/api/wallet/me/withdrawals/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    data: body,
    ...(options || {}),
  });
}

/** 获取提现申请详情 GET /api/wallet/me/withdrawals/${param0}/ */
export function walletMeWithdrawalsWithdrawalIdUsingGet({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.WalletMeWithdrawalsWithdrawalIdUsingGetParams;
  options?: CustomRequestOptions_;
}) {
  const { withdrawal_id: param0, ...queryParams } = params;

  return request<API.WithdrawalOut>(`/api/wallet/me/withdrawals/${param0}/`, {
    method: 'GET',
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 撤销提现申请 POST /api/wallet/me/withdrawals/${param0}/cancel/ */
export function walletMeWithdrawalsWithdrawalIdCancelUsingPost({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.WalletMeWithdrawalsWithdrawalIdCancelUsingPostParams;
  options?: CustomRequestOptions_;
}) {
  const { withdrawal_id: param0, ...queryParams } = params;

  return request<API.WithdrawalOut>(
    `/api/wallet/me/withdrawals/${param0}/cancel/`,
    {
      method: 'POST',
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}

/** 处理代付回调 POST /api/wallet/payout/callback/${param0}/ */
export function walletPayoutCallbackProviderUsingPost({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.WalletPayoutCallbackProviderUsingPostParams;
  options?: CustomRequestOptions_;
}) {
  const { provider: param0, ...queryParams } = params;

  return request<API.WithdrawalPayoutOut>(
    `/api/wallet/payout/callback/${param0}/`,
    {
      method: 'POST',
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}
