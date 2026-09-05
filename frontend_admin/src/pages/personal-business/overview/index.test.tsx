import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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

vi.mock('@/services/manual/enums', () => ({
  enumMapping: (value?: string | null, mapping?: string | null) =>
    mapping || value || '-',
}));

vi.mock('@ant-design/pro-components', () => ({
  PageContainer: ({ children, title, subTitle }: any) => (
    <section>
      <h1>{title}</h1>
      <p>{subTitle}</p>
      {children}
    </section>
  ),
}));

import PersonalBusinessPage from './index';

describe('PersonalBusinessPage', () => {
  let queryClient: QueryClient;
  const writeText = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    mockWalletSummary.mockResolvedValue({
      available_balance: 1000,
      frozen_balance: 300,
      total_income: 2600,
      total_withdrawn: 800,
    });
    mockWalletLedger.mockResolvedValue({
      items: [
        {
          id: 1,
          entry_type: 'income',
          amount_delta: 100,
          available_balance_after: 1000,
          frozen_balance_after: 300,
          biz_type: 'referral',
          biz_id: '1',
          remark: '奖励',
          created_at: '2026-06-16T10:00:00+08:00',
        },
      ],
      total: 1,
      page: 1,
      page_size: 10,
    });
    mockWithdrawals.mockResolvedValue({
      items: [
        {
          id: 2,
          amount: 500,
          fee_amount: 0,
          net_amount: 500,
          status: 'pending_review',
          status__mapping: '待审核',
          pay_channel: 'wechat',
          payee_account_snapshot: {},
          reject_reason: '',
          created_at: '2026-06-16T10:00:00+08:00',
          reviewed_at: null,
        },
        {
          id: 3,
          amount: 300,
          fee_amount: 0,
          net_amount: 300,
          status: 'failed',
          status__mapping: '失败待处理',
          pay_channel: 'wechat',
          payee_account_snapshot: {},
          reject_reason: '渠道失败',
          created_at: '2026-06-16T11:00:00+08:00',
          reviewed_at: '2026-06-16T11:30:00+08:00',
        },
      ],
      total: 2,
      page: 1,
      page_size: 10,
    });
    mockWithdrawalDetail.mockResolvedValue({
      id: 2,
      amount: 500,
      fee_amount: 0,
      net_amount: 500,
      status: 'pending_review',
      status__mapping: '待审核',
      pay_channel: 'wechat',
      payee_account_snapshot: {},
      reject_reason: '',
      created_at: '2026-06-16T10:00:00+08:00',
      reviewed_at: null,
    });
    mockReferralSummary.mockResolvedValue({
      invite_code: 'ABC',
      share_link:
        '/dashboard/user/register?invite_code=ABC&referral_source=link',
      allow_link: true,
      allow_code: true,
      registered_count: 2,
      pending_review_count: 1,
      rewarded_count: 1,
    });
    mockReferralRecords.mockResolvedValue({
      items: [
        {
          id: 3,
          inviter_id: 1,
          invitee_id: 2,
          invitee_display: 'bob',
          status: 'pending',
          created_at: '2026-06-16T10:00:00+08:00',
          updated_at: '2026-06-16T10:00:00+08:00',
        },
      ],
      total: 1,
      page: 1,
      page_size: 10,
    });
    mockRealName.mockResolvedValue({
      id: 4,
      status: 'unverified',
      status_label: '未认证',
      status__mapping: '未实名',
      source: 'user_submit',
      source_label: '用户提交',
      source__mapping: '用户主动提交',
      provider: 'manual',
      provider_label: '人工',
      provider__mapping: '后台人工处理',
      real_name_masked: '',
      id_number_masked: '',
      is_current: true,
      created_at: '2026-06-16T10:00:00+08:00',
      updated_at: '2026-06-16T10:00:00+08:00',
    });
    mockRealNameLogs.mockResolvedValue([]);
    mockUserSettings.mockResolvedValue([
      { key: 'theme', value: 'light' },
      { key: 'internal.workbench.mine.layout.v1', value: [] },
    ]);
    mockGetUserSetting.mockResolvedValue({ key: 'theme', value: 'light' });
    mockCreateWithdrawal.mockResolvedValue({});
    mockCancelWithdrawal.mockResolvedValue({});
    mockPutUserSetting.mockResolvedValue({});
    mockDeleteUserSetting.mockResolvedValue({});
  });

  it('runs personal business actions with validated payloads', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <PersonalBusinessPage />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(mockWalletSummary).toHaveBeenCalled();
      expect(mockReferralSummary).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByRole('button', { name: '复制分享链接' }));
    expect(writeText).toHaveBeenCalledWith(
      `${window.location.origin}/dashboard/user/register?invite_code=ABC&referral_source=link`,
    );

    fireEvent.change(screen.getByLabelText('提现金额'), {
      target: { value: '500' },
    });
    fireEvent.change(screen.getByLabelText('提现渠道'), {
      target: { value: 'wechat' },
    });
    fireEvent.change(screen.getByLabelText('收款账号'), {
      target: { value: 'wx-openid' },
    });
    fireEvent.change(screen.getByLabelText('提现请求 ID'), {
      target: { value: 'wd-1' },
    });
    fireEvent.click(screen.getByRole('button', { name: '提交提现' }));

    await waitFor(() => {
      expect(mockCreateWithdrawal).toHaveBeenCalledWith({
        amount: 500,
        fee_amount: 0,
        pay_channel: 'wechat',
        payee_account: { account: 'wx-openid' },
        client_request_id: 'wd-1',
      });
    });

    const rows = screen.getAllByRole('row');
    const pendingWithdrawalRow = rows.find(
      (row) =>
        within(row).queryByText('待审核') && within(row).queryByText('详情'),
    );
    if (!pendingWithdrawalRow) throw new Error('待审核提现行未渲染');
    fireEvent.click(within(pendingWithdrawalRow).getByText('详情'));

    await waitFor(() => {
      expect(mockWithdrawalDetail).toHaveBeenCalledWith({ withdrawal_id: 2 });
      expect(screen.getByText('提现详情')).toBeInTheDocument();
    });

    const failedWithdrawalRow = rows.find(
      (row) =>
        within(row).queryByText('失败待处理') &&
        within(row).queryByText('撤销提现'),
    );
    if (!failedWithdrawalRow) throw new Error('失败提现行未渲染');
    fireEvent.click(within(failedWithdrawalRow).getByText('撤销提现'));

    await waitFor(() => {
      expect(mockCancelWithdrawal).toHaveBeenCalledWith({ withdrawal_id: 3 });
    });

    fireEvent.change(screen.getByLabelText('设置 Key'), {
      target: { value: 'theme' },
    });
    fireEvent.change(screen.getByLabelText('设置值'), {
      target: { value: 'dark' },
    });
    fireEvent.click(screen.getByRole('button', { name: '保存个人设置' }));

    await waitFor(() => {
      expect(mockPutUserSetting).toHaveBeenCalledWith(
        { key: 'theme' },
        { value: 'dark' },
      );
    });

    mockPutUserSetting.mockClear();
    fireEvent.change(screen.getByLabelText('设置 Key'), {
      target: { value: 'internal.workbench.space.layout.v1' },
    });
    fireEvent.click(screen.getByRole('button', { name: '保存个人设置' }));

    expect(
      await screen.findByText('该设置由对应功能页面内部维护'),
    ).toBeInTheDocument();
    expect(mockPutUserSetting).not.toHaveBeenCalled();
  });

  it('明确展示被规则关闭的邀请渠道', async () => {
    mockReferralSummary.mockResolvedValue({
      invite_code: null,
      share_link: null,
      allow_link: false,
      allow_code: false,
      registered_count: 0,
      pending_review_count: 0,
      rewarded_count: 0,
    });

    render(
      <QueryClientProvider client={queryClient}>
        <PersonalBusinessPage />
      </QueryClientProvider>,
    );

    expect(await screen.findByText('邀请链接已关闭')).toBeInTheDocument();
    expect(screen.getAllByText('手工邀请码已关闭')).toHaveLength(2);
    expect(
      screen.queryByRole('button', { name: '复制分享链接' }),
    ).not.toBeInTheDocument();
  });
});
