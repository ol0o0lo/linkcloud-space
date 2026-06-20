import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PersonalBusinessPage from './index';

const {
  mockWalletSummary,
  mockWalletLedger,
  mockWithdrawals,
  mockWithdrawalDetail,
  mockCreateWithdrawal,
  mockCancelWithdrawal,
  mockReferralSummary,
  mockReferralRecords,
  mockRealName,
  mockRealNameLogs,
  mockUserSettings,
  mockGetUserSetting,
  mockPutUserSetting,
  mockDeleteUserSetting,
} = vi.hoisted(() => ({
  mockWalletSummary: vi.fn(),
  mockWalletLedger: vi.fn(),
  mockWithdrawals: vi.fn(),
  mockWithdrawalDetail: vi.fn(),
  mockCreateWithdrawal: vi.fn(),
  mockCancelWithdrawal: vi.fn(),
  mockReferralSummary: vi.fn(),
  mockReferralRecords: vi.fn(),
  mockRealName: vi.fn(),
  mockRealNameLogs: vi.fn(),
  mockUserSettings: vi.fn(),
  mockGetUserSetting: vi.fn(),
  mockPutUserSetting: vi.fn(),
  mockDeleteUserSetting: vi.fn(),
}));

vi.mock('@/services/openapi/userWallet', () => ({
  appsWalletApiWalletSummary: mockWalletSummary,
  appsWalletApiWalletLedger: mockWalletLedger,
  appsWalletApiListWithdrawals: mockWithdrawals,
  appsWalletApiGetWithdrawal: mockWithdrawalDetail,
  appsWalletApiCreateWithdrawal: mockCreateWithdrawal,
  appsWalletApiCancelUserWithdrawal: mockCancelWithdrawal,
}));

vi.mock('@/services/openapi/referrals', () => ({
  appsReferralsApiMyReferralSummary: mockReferralSummary,
  appsReferralsApiMyReferralRecords: mockReferralRecords,
}));

vi.mock('@/services/openapi/realName', () => ({
  appsAccountsApiGetMyRealName: mockRealName,
  appsAccountsApiListMyRealNameLogs: mockRealNameLogs,
}));

vi.mock('@/services/openapi/userSettings', () => ({
  appsSettingsApiListUserSettings: mockUserSettings,
  appsSettingsApiGetUserSettingView: mockGetUserSetting,
  appsSettingsApiPutUserSetting: mockPutUserSetting,
  appsSettingsApiDeleteUserSettingView: mockDeleteUserSetting,
}));

describe('PersonalBusinessPage', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    mockWalletSummary.mockResolvedValue({ available_balance: 1000, frozen_balance: 0, total_income: 2000, total_withdrawn: 500 });
    mockWalletLedger.mockResolvedValue({ items: [{ id: 1, entry_type: 'income', amount_delta: 100, available_balance_after: 1000, frozen_balance_after: 0, biz_type: 'referral', biz_id: '1', remark: '奖励', created_at: '2026-06-16T10:00:00+08:00' }], total: 1, page: 1, page_size: 10 });
    mockWithdrawals.mockResolvedValue({ items: [{ id: 2, amount: 500, fee_amount: 0, net_amount: 500, status: 'pending', pay_channel: 'alipay', payee_account_snapshot: {}, reject_reason: '', created_at: '2026-06-16T10:00:00+08:00' }], total: 1, page: 1, page_size: 10 });
    mockWithdrawalDetail.mockResolvedValue({ id: 2, amount: 500, fee_amount: 0, net_amount: 500, status: 'pending', pay_channel: 'alipay', payee_account_snapshot: {}, reject_reason: '', created_at: '2026-06-16T10:00:00+08:00' });
    mockReferralSummary.mockResolvedValue({ invite_code: 'ABC', share_link: 'https://example.com/i/ABC', registered_count: 1, pending_review_count: 1, rewarded_count: 0 });
    mockReferralRecords.mockResolvedValue({ items: [{ id: 3, inviter_id: 1, invitee_id: 2, invitee_display: 'bob', status: 'pending', created_at: '2026-06-16T10:00:00+08:00', updated_at: '2026-06-16T10:00:00+08:00' }], total: 1, page: 1, page_size: 10 });
    mockRealName.mockResolvedValue({ id: 4, status: 'unverified', status_label: '未认证', source: 'user_submit', source_label: '用户提交', provider: 'manual', provider_label: '人工', real_name_masked: '', id_number_masked: '', is_current: true, created_at: '2026-06-16T10:00:00+08:00', updated_at: '2026-06-16T10:00:00+08:00' });
    mockRealNameLogs.mockResolvedValue([]);
    mockUserSettings.mockResolvedValue([{ key: 'theme', value: 'light' }]);
    mockGetUserSetting.mockResolvedValue({ key: 'theme', value: 'light' });
    mockCreateWithdrawal.mockResolvedValue({});
    mockCancelWithdrawal.mockResolvedValue({});
    mockPutUserSetting.mockResolvedValue({});
    mockDeleteUserSetting.mockResolvedValue({});
  });

  it('loads personal business data and triggers primary actions', async () => {
    render(<QueryClientProvider client={queryClient}><PersonalBusinessPage /></QueryClientProvider>);

    await waitFor(() => {
      expect(mockWalletSummary).toHaveBeenCalled();
      expect(mockReferralSummary).toHaveBeenCalled();
      expect(screen.getByText('ABC')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText('提现金额'), { target: { value: '500' } });
    fireEvent.change(screen.getByLabelText('提现渠道'), { target: { value: 'alipay' } });
    fireEvent.change(screen.getByLabelText('收款账号'), { target: { value: 'a@example.com' } });
    fireEvent.change(screen.getByLabelText('提现请求 ID'), { target: { value: 'wd-1' } });
    fireEvent.click(screen.getByRole('button', { name: '提交提现' }));
    await waitFor(() => expect(mockCreateWithdrawal).toHaveBeenCalledWith({ amount: 500, fee_amount: 0, pay_channel: 'alipay', payee_account: { account: 'a@example.com' }, client_request_id: 'wd-1' }));

    fireEvent.click(screen.getByText('撤销提现'));
    await waitFor(() => expect(mockCancelWithdrawal).toHaveBeenCalledWith({ withdrawal_id: 2 }));

    expect(screen.queryByLabelText('真实姓名')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('身份证号')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: '去个人设置实名' })).toHaveAttribute('href', '/account/center?tab=security');

    fireEvent.change(screen.getByLabelText('设置 Key'), { target: { value: 'theme' } });
    fireEvent.change(screen.getByLabelText('设置值'), { target: { value: 'dark' } });
    fireEvent.click(screen.getByRole('button', { name: '保存个人设置' }));
    await waitFor(() => expect(mockPutUserSetting).toHaveBeenCalledWith({ key: 'theme' }, { value: 'dark' }));
  });
});
