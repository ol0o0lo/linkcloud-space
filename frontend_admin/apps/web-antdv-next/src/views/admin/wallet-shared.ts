import type { WalletAccountRow, WithdrawalRow } from '#/api/django/wallet';

export function buildWalletAccountStats(rows: WalletAccountRow[]) {
  return [
    { key: 'accounts', label: '钱包账户数', value: rows.length },
    { key: 'available', label: '可用余额', value: rows.reduce((sum, item) => sum + item.available_balance, 0) },
    { key: 'frozen', label: '冻结余额', value: rows.reduce((sum, item) => sum + item.frozen_balance, 0) },
    { key: 'withdrawn', label: '累计提现', value: rows.reduce((sum, item) => sum + item.total_withdrawn, 0) },
  ];
}

export function buildWalletWithdrawalStats(rows: WithdrawalRow[]) {
  return [
    { key: 'total', label: '全部提现', value: rows.length },
    { key: 'pending', label: '待审核', value: rows.filter((item) => item.status === 'pending_review').length },
    { key: 'paying', label: '打款中', value: rows.filter((item) => item.status === 'paying').length },
    { key: 'failed', label: '失败', value: rows.filter((item) => item.status === 'failed').length },
  ];
}

export function getWalletWithdrawalStatusMeta(status: string) {
  switch (status) {
    case 'pending_review':
      return { color: 'gold', text: '待审核' };
    case 'approved':
      return { color: 'blue', text: '待打款' };
    case 'paying':
      return { color: 'processing', text: '打款中' };
    case 'paid':
      return { color: 'green', text: '已打款' };
    case 'failed':
      return { color: 'red', text: '打款失败' };
    case 'rejected':
      return { color: 'default', text: '已驳回' };
    case 'cancelled':
      return { color: 'default', text: '已撤销' };
    default:
      return { color: 'default', text: status };
  }
}

export function getWalletWithdrawalActions(status: string) {
  if (status === 'pending_review') return ['approve', 'reject'];
  if (status === 'approved') return ['payout'];
  if (status === 'failed') return ['retry'];
  return [];
}
