import { describe, expect, it } from 'vitest';

import type { WalletAccountRow, WithdrawalRow } from '#/api/django/wallet';
import adminRoutes from '#/router/routes/modules/admin';

import {
  buildWalletAccountStats,
  buildWalletWithdrawalStats,
  getWalletWithdrawalActions,
  getWalletWithdrawalStatusMeta,
} from '../wallet-shared';

describe('wallet-shared', () => {
  it('汇总钱包账户统计', () => {
    const rows: WalletAccountRow[] = [
      { available_balance: 1000, frozen_balance: 200, id: 1, total_income: 3000, total_withdrawn: 800, user_id: 11, user_label: 'u1' },
      { available_balance: 500, frozen_balance: 100, id: 2, total_income: 1800, total_withdrawn: 200, user_id: 12, user_label: 'u2' },
    ];

    const stats = buildWalletAccountStats(rows);

    expect(stats.map((item) => item.value)).toEqual([2, 1500, 300, 1000]);
  });

  it('汇总提现统计', () => {
    const rows: WithdrawalRow[] = [
      { amount: 1000, created_at: '', fee_amount: 100, id: 1, net_amount: 900, pay_channel: 'wechat', payee_account_snapshot: {}, reject_reason: '', reviewed_at: null, status: 'pending_review', user_id: 11, user_label: 'u1' },
      { amount: 800, created_at: '', fee_amount: 80, id: 2, net_amount: 720, pay_channel: 'wechat', payee_account_snapshot: {}, reject_reason: '', reviewed_at: null, status: 'failed', user_id: 12, user_label: 'u2' },
    ];

    const stats = buildWalletWithdrawalStats(rows);

    expect(stats.map((item) => item.value)).toEqual([2, 1, 0, 1]);
  });

  it('正确映射提现状态标签', () => {
    expect(getWalletWithdrawalStatusMeta('pending_review')).toEqual({ color: 'gold', text: '待审核' });
    expect(getWalletWithdrawalStatusMeta('approved')).toEqual({ color: 'blue', text: '待打款' });
    expect(getWalletWithdrawalStatusMeta('failed')).toEqual({ color: 'red', text: '打款失败' });
  });

  it('只在允许状态返回可操作按钮', () => {
    expect(getWalletWithdrawalActions('pending_review')).toEqual(['approve', 'reject']);
    expect(getWalletWithdrawalActions('approved')).toEqual(['payout']);
    expect(getWalletWithdrawalActions('failed')).toEqual(['retry']);
    expect(getWalletWithdrawalActions('paid')).toEqual([]);
    expect(getWalletWithdrawalActions('cancelled')).toEqual([]);
  });

  it('后台管理菜单包含钱包账户和提现审核入口', () => {
    const admin = adminRoutes[0]!;
    const names = admin.children?.map((item) => item.name);
    expect(names).toContain('AdminWalletAccounts');
    expect(names).toContain('AdminWalletWithdrawals');
  });
});
