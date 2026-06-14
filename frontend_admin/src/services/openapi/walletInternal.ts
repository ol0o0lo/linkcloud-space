// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** 执行钱包对账 POST /api/internal/wallet/reconcile/ */
export async function appsWalletApiReconcile(options?: { [key: string]: any }) {
  return request<API.ReconcileOut>("/api/internal/wallet/reconcile/", {
    method: "POST",
    ...(options || {}),
  });
}

/** 重试失败提现代付 POST /api/internal/wallet/withdrawals/${param0}/retry/ */
export async function appsWalletApiRetryWithdrawal(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsWalletApiRetryWithdrawalParams,
  body: API.WithdrawalRetryIn,
  options?: { [key: string]: any }
) {
  const { withdrawal_id: param0, ...queryParams } = params;
  return request<API.WithdrawalPayoutOut>(
    `/api/internal/wallet/withdrawals/${param0}/retry/`,
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
