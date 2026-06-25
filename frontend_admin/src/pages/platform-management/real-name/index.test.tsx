import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import RealNameAdminPage from './index';

const {
  mockList,
  mockApprove,
  mockReject,
  mockManual,
  mockRevoke,
  mockGet,
} = vi.hoisted(() => ({
  mockList: vi.fn(),
  mockApprove: vi.fn(),
  mockReject: vi.fn(),
  mockManual: vi.fn(),
  mockRevoke: vi.fn(),
  mockGet: vi.fn(),
}));

vi.mock('@/services/openapi/realNameAdmin', () => ({
  appsAccountsApiListAdminRealNameVerifications: mockList,
  appsAccountsApiGetAdminRealNameVerification: mockGet,
  appsAccountsApiApproveAdminRealName: mockApprove,
  appsAccountsApiRejectAdminRealName: mockReject,
  appsAccountsApiMoveAdminRealNameToManualReview: mockManual,
  appsAccountsApiRevokeAdminRealName: mockRevoke,
}));

describe('RealNameAdminPage', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    mockList.mockResolvedValue({
      items: [
        {
          id: 3,
          status: 'manual_review',
          status_label: '人工审核',
          source: 'user_submit',
          source_label: '用户提交',
          provider: 'manual',
          provider_label: '人工',
          real_name_masked: '张*',
          id_number_masked: '110***********1234',
          is_current: true,
          created_at: '2026-06-16T10:00:00+08:00',
          updated_at: '2026-06-16T10:00:00+08:00',
          user: { username: 'alice', email: 'alice@example.com' },
        },
      ],
      total: 1,
      page: 1,
      page_size: 10,
    });
    mockGet.mockResolvedValue({
      id: 3,
      status: 'manual_review',
      status_label: '人工审核',
      source: 'user_submit',
      source_label: '用户提交',
      provider: 'manual',
      provider_label: '人工',
      real_name_masked: '张*',
      id_number_masked: '110***********1234',
      is_current: true,
      created_at: '2026-06-16T10:00:00+08:00',
      updated_at: '2026-06-16T10:00:00+08:00',
      real_name: '张三',
      id_number: '110101199001011234',
      user: { username: 'alice' },
      id_card_media: [
        { media_id: 101, media_type: 'image', side: 'front', url: '/front.png' },
        { media_id: 102, media_type: 'image', side: 'back', url: '/back.png' },
      ],
      logs: [],
    });
    mockApprove.mockResolvedValue({});
    mockReject.mockResolvedValue({});
    mockManual.mockResolvedValue({});
    mockRevoke.mockResolvedValue({});
  });

  it('renders governance layout and handles review actions', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <RealNameAdminPage />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(mockList).toHaveBeenCalledWith({ page: 1, page_size: 10, q: undefined, status: undefined });
      expect(screen.getByText('实名治理概览')).toBeInTheDocument();
      expect(screen.getByText('当前审核执行面')).toBeInTheDocument();
      expect(screen.getByText('闭环信号')).toBeInTheDocument();
      expect(screen.getByText('实名治理台账')).toBeInTheDocument();
      expect(screen.getByText('张*')).toBeInTheDocument();
      expect(screen.getByText('alice')).toBeInTheDocument();
    });

    const row = screen.getByText('alice').closest('tr');
    expect(row).not.toBeNull();
    expect(within(row!).getByText('人工审核')).toBeInTheDocument();
    expect(within(row!).getByText('通过实名')).toBeInTheDocument();
    expect(within(row!).getByText('驳回实名')).toBeInTheDocument();
    expect(screen.queryByText('撤销实名')).not.toBeInTheDocument();

    fireEvent.click(within(row!).getByText('通过实名'));
    const approveDialog = screen.getAllByRole('dialog').at(-1)!;
    fireEvent.change(within(approveDialog).getByLabelText('备注'), { target: { value: 'ok' } });
    fireEvent.click(within(approveDialog).getByRole('button', { name: 'OK' }));
    await waitFor(() => expect(mockApprove).toHaveBeenCalledWith({ verification_id: 3 }, { note: 'ok' }));

    fireEvent.click(within(row!).getByText('详情'));
    expect(await screen.findByAltText('身份证人像面')).toHaveAttribute('src', '/front.png');
    expect(screen.getByAltText('身份证国徽面')).toHaveAttribute('src', '/back.png');

    const searchBox = screen.getByPlaceholderText('按用户名、邮箱、手机号、实名或证件搜索');
    fireEvent.change(searchBox, { target: { value: 'alice' } });
    fireEvent.keyDown(searchBox, { key: 'Enter', code: 'Enter' });
    await waitFor(() => expect(mockList).toHaveBeenLastCalledWith({ page: 1, page_size: 10, q: 'alice', status: undefined }));
  });
});
