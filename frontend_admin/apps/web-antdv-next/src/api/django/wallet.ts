import { djangoGet, djangoPost } from './client';
import { unwrapWalletResponse } from './wallet-response';

interface PaginatedResponse<T> {
  items: T[];
  page: number;
  page_size: number;
  total: number;
}

export interface WalletAccountRow {
  available_balance: number;
  frozen_balance: number;
  id: number;
  total_income: number;
  total_withdrawn: number;
  user_id: number;
  user_label?: string;
}

export interface WalletLedgerRow {
  amount_delta: number;
  available_balance_after: number;
  biz_id: string;
  biz_type: string;
  created_at: string;
  entry_type: string;
  frozen_balance_after: number;
  id: number;
  remark: string;
}

export interface WithdrawalRow {
  amount: number;
  created_at: string;
  fee_amount: number;
  id: number;
  net_amount: number;
  pay_channel: string;
  payee_account_snapshot: Record<string, unknown>;
  reject_reason: string;
  reviewed_at: null | string;
  status: string;
  user_id?: number;
  user_label?: string;
}

export interface WithdrawalPayoutRow {
  error_code: string;
  error_message: string;
  executed_at: null | string;
  id: number;
  out_trade_no: string;
  provider: string;
  provider_trade_no: string;
  status: string;
  withdrawal_request_id: number;
}

export interface WalletAdjustmentPayload {
  amount: number;
  idempotency_key: string;
  remark: string;
  user_id: number;
}

export interface WalletReviewPayload {
  approved: boolean;
  idempotency_key: string;
  reason: string;
}

export interface WalletPayoutPayload {
  idempotency_key: string;
  out_trade_no: string;
  provider: 'wechat';
  request_payload: Record<string, unknown>;
}

export async function listWalletAccountsApi(params: Record<string, number | string> = {}) {
  return unwrapWalletResponse(await djangoGet<PaginatedResponse<WalletAccountRow>>('/admin/wallet/accounts/', params));
}

export async function getWalletLedgerApi(userId: number, params: Record<string, number | string> = {}) {
  return unwrapWalletResponse(await djangoGet<PaginatedResponse<WalletLedgerRow>>(`/admin/wallet/accounts/${userId}/ledger/`, params));
}

export async function createWalletAdjustmentApi(payload: WalletAdjustmentPayload) {
  return unwrapWalletResponse(await djangoPost<WalletLedgerRow>('/admin/wallet/adjustments/', payload));
}

export async function listWalletWithdrawalsApi(params: Record<string, number | string> = {}) {
  return unwrapWalletResponse(await djangoGet<PaginatedResponse<WithdrawalRow>>('/admin/wallet/withdrawals/', params));
}

export async function reviewWalletWithdrawalApi(withdrawalId: number, payload: WalletReviewPayload) {
  return unwrapWalletResponse(await djangoPost<WithdrawalRow>(`/admin/wallet/withdrawals/${withdrawalId}/review/`, payload));
}

export async function payoutWalletWithdrawalApi(withdrawalId: number, payload: WalletPayoutPayload) {
  return unwrapWalletResponse(await djangoPost<WithdrawalPayoutRow>(`/admin/wallet/withdrawals/${withdrawalId}/payout/`, payload));
}

export async function retryWalletWithdrawalApi(withdrawalId: number, payload: WalletPayoutPayload) {
  return unwrapWalletResponse(await djangoPost<WithdrawalPayoutRow>(`/internal/wallet/withdrawals/${withdrawalId}/retry/`, payload));
}

export { unwrapWalletResponse } from './wallet-response';
