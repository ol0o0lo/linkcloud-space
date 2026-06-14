// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** 获取我的钱包流水 GET /api/wallet/me/ledger/ */
export async function appsWalletApiWalletLedger(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsWalletApiWalletLedgerParams,
  options?: { [key: string]: any }
) {
  return request<API.PagedWalletLedgerOut>("/api/wallet/me/ledger/", {
    method: "GET",
    params: {
      // page has a default value: 1
      page: "1",
      ...params,
    },
    ...(options || {}),
  });
}

/** 获取我的钱包总览 GET /api/wallet/me/summary/ */
export async function appsWalletApiWalletSummary(options?: {
  [key: string]: any;
}) {
  return request<API.WalletSummaryOut>("/api/wallet/me/summary/", {
    method: "GET",
    ...(options || {}),
  });
}

/** 获取我的提现申请 GET /api/wallet/me/withdrawals/ */
export async function appsWalletApiListWithdrawals(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsWalletApiListWithdrawalsParams,
  options?: { [key: string]: any }
) {
  return request<API.PagedWithdrawalOut>("/api/wallet/me/withdrawals/", {
    method: "GET",
    params: {
      // page has a default value: 1
      page: "1",
      ...params,
    },
    ...(options || {}),
  });
}

/** 提交提现申请 POST /api/wallet/me/withdrawals/ */
export async function appsWalletApiCreateWithdrawal(
  body: API.WithdrawalIn,
  options?: { [key: string]: any }
) {
  return request<API.WithdrawalOut>("/api/wallet/me/withdrawals/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** 获取提现申请详情 GET /api/wallet/me/withdrawals/${param0}/ */
export async function appsWalletApiGetWithdrawal(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsWalletApiGetWithdrawalParams,
  options?: { [key: string]: any }
) {
  const { withdrawal_id: param0, ...queryParams } = params;
  return request<API.WithdrawalOut>(`/api/wallet/me/withdrawals/${param0}/`, {
    method: "GET",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 撤销提现申请 POST /api/wallet/me/withdrawals/${param0}/cancel/ */
export async function appsWalletApiCancelUserWithdrawal(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsWalletApiCancelUserWithdrawalParams,
  options?: { [key: string]: any }
) {
  const { withdrawal_id: param0, ...queryParams } = params;
  return request<API.WithdrawalOut>(
    `/api/wallet/me/withdrawals/${param0}/cancel/`,
    {
      method: "POST",
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}

/** 处理代付回调 POST /api/wallet/payout/callback/${param0}/ */
export async function appsWalletApiPayoutCallback(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsWalletApiPayoutCallbackParams,
  options?: { [key: string]: any }
) {
  const { provider: param0, ...queryParams } = params;
  return request<API.WithdrawalPayoutOut>(
    `/api/wallet/payout/callback/${param0}/`,
    {
      method: "POST",
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}
