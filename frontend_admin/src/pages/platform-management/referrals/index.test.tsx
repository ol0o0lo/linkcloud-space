import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ReferralsAdminPage from './index';

const {
  mockGetConfig,
  mockPatchConfig,
  mockRecords,
  mockReview,
} = vi.hoisted(() => ({
  mockGetConfig: vi.fn(),
  mockPatchConfig: vi.fn(),
  mockRecords: vi.fn(),
  mockReview: vi.fn(),
}));

vi.mock('@/services/openapi/adminReferrals', () => ({
  appsReferralsApiGetReferralConfig: mockGetConfig,
  appsReferralsApiPatchReferralConfig: mockPatchConfig,
  appsReferralsApiAdminReferralRecords: mockRecords,
  appsReferralsApiReviewReferralRecord: mockReview,
}));

describe('ReferralsAdminPage', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    mockGetConfig.mockResolvedValue({
      id: 1,
      name: '默认规则',
      trigger_event: 'real_name_verified',
      inviter_reward_amount: 100,
      invitee_reward_amount: 50,
      requires_manual_review: true,
      allow_link: true,
      allow_code: false,
      display_level: 'masked_progress',
    });
    mockRecords.mockResolvedValue({
      items: [{ id: 6, inviter_id: 1, invitee_id: 2, invitee_display: 'bob', status: 'pending_review', created_at: '2026-06-16T10:00:00+08:00', updated_at: '2026-06-16T10:00:00+08:00' }],
      total: 1,
      page: 1,
      page_size: 10,
    });
    mockPatchConfig.mockResolvedValue({});
    mockReview.mockResolvedValue({});
  });

  it('renders governance layout and triggers config save / review', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <ReferralsAdminPage />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(mockGetConfig).toHaveBeenCalled();
      expect(mockRecords).toHaveBeenCalledWith({ page: 1, page_size: 10 });
      expect(screen.queryByText('规则概览')).not.toBeInTheDocument();
      expect(screen.queryByText('当前状态')).not.toBeInTheDocument();
      expect(screen.queryByText('关键提醒')).not.toBeInTheDocument();
      expect(screen.getByText('邀请记录')).toBeInTheDocument();
      expect(screen.queryByText('邀请入口')).not.toBeInTheDocument();
      expect(screen.queryByText('展示口径')).not.toBeInTheDocument();
      expect(screen.queryByText('规则触发条件')).not.toBeInTheDocument();
      expect(screen.queryByText('继续处理审核')).not.toBeInTheDocument();
      expect(screen.queryByText('查看业务概览')).not.toBeInTheDocument();
      expect(screen.queryByText('查看用户列表')).not.toBeInTheDocument();
      expect(screen.queryByText('查看实名认证')).not.toBeInTheDocument();
      expect(screen.queryByText('裂变列表')).not.toBeInTheDocument();
      expect(screen.queryByText('裂变规则')).not.toBeInTheDocument();
      expect(screen.getByText('bob')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText('邀请人奖励（分）'), { target: { value: '200' } });
    fireEvent.click(screen.getByRole('button', { name: '保存规则' }));
    await waitFor(() => expect(mockPatchConfig).toHaveBeenCalledWith(expect.objectContaining({ inviter_reward_amount: 200 })));

    const row = screen.getByText('bob').closest('tr');
    expect(row).not.toBeNull();
    expect(within(row!).getByText('待审核')).toBeInTheDocument();
    fireEvent.click(within(row!).getByText('通过'));
    await waitFor(() => expect(mockReview).toHaveBeenCalledWith({ record_id: 6 }, { approved: true, remark: '' }));
  });
});
