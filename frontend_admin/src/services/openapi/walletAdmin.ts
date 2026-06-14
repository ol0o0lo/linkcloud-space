// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** 获取钱包账户列表 GET /api/admin/wallet/accounts/ */
export async function appsWalletApiListWalletAccounts(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsWalletApiListWalletAccountsParams,
  options?: { [key: string]: any }
) {
  return request<API.PagedWalletAccountAdminOut>(
    "/api/admin/wallet/accounts/",
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

/** 获取指定用户钱包流水 GET /api/admin/wallet/accounts/${param0}/ledger/ */
export async function appsWalletApiAdminWalletLedger(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsWalletApiAdminWalletLedgerParams,
  options?: { [key: string]: any }
) {
  const { user_id: param0, ...queryParams } = params;
  return request<API.PagedWalletLedgerOut>(
    `/api/admin/wallet/accounts/${param0}/ledger/`,
    {
      method: "GET",
      params: {
        // page has a default value: 1
        page: "1",
        ...queryParams,
      },
      ...(options || {}),
    }
  );
}

/** 创建钱包调账 POST /api/admin/wallet/adjustments/ */
export async function appsWalletApiCreateAdjustment(
  body: API.WalletAdjustmentIn,
  options?: { [key: string]: any }
) {
  return request<API.WalletLedgerOut>("/api/admin/wallet/adjustments/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** 获取提现申请列表 GET /api/admin/wallet/withdrawals/ */
export async function appsWalletApiAdminWithdrawals(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsWalletApiAdminWithdrawalsParams,
  options?: { [key: string]: any }
) {
  return request<API.PagedWithdrawalOut>("/api/admin/wallet/withdrawals/", {
    method: "GET",
    params: {
      // page has a default value: 1
      page: "1",
      ...params,
    },
    ...(options || {}),
  });
}

/** 发起提现代付 POST /api/admin/wallet/withdrawals/${param0}/payout/ */
export async function appsWalletApiPayoutWithdrawal(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsWalletApiPayoutWithdrawalParams,
  body: API.PayoutCreateIn,
  options?: { [key: string]: any }
) {
  const { withdrawal_id: param0, ...queryParams } = params;
  return request<API.WithdrawalPayoutOut>(
    `/api/admin/wallet/withdrawals/${param0}/payout/`,
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

/** 审核提现申请 POST /api/admin/wallet/withdrawals/${param0}/review/ */
export async function appsWalletApiReviewWithdrawal(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsWalletApiReviewWithdrawalParams,
  body: API.WithdrawalReviewIn,
  options?: { [key: string]: any }
) {
  const { withdrawal_id: param0, ...queryParams } = params;
  return request<API.WithdrawalOut>(
    `/api/admin/wallet/withdrawals/${param0}/review/`,
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
