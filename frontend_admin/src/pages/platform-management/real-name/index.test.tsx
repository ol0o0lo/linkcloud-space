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
  mockGetEnumRegistry,
} = vi.hoisted(() => ({
  mockList: vi.fn(),
  mockApprove: vi.fn(),
  mockReject: vi.fn(),
  mockManual: vi.fn(),
  mockRevoke: vi.fn(),
  mockGet: vi.fn(),
  mockGetEnumRegistry: vi.fn(),
}));

vi.mock('@/services/openapi/realNameAdmin', () => ({
  appsAccountsApiListAdminRealNameVerifications: mockList,
  appsAccountsApiGetAdminRealNameVerification: mockGet,
  appsAccountsApiApproveAdminRealName: mockApprove,
  appsAccountsApiRejectAdminRealName: mockReject,
  appsAccountsApiMoveAdminRealNameToManualReview: mockManual,
  appsAccountsApiRevokeAdminRealName: mockRevoke,
}));

vi.mock('@/services/manual/enums', () => ({
  getEnumRegistry: mockGetEnumRegistry,
  enumMapping: (value?: string | null, mapping?: string | null) => mapping || value || '-',
  toSelectOptions: (items?: Array<{ value: string; mapping: string }>) => (items || []).map((item) => ({ value: item.value, label: item.mapping })),
}));

describe('RealNameAdminPage', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    mockGetEnumRegistry.mockResolvedValue({
      'accounts.real_name_status': [
        { value: 'pending', mapping: '待校验' },
        { value: 'manual_review', mapping: '人工复核' },
        { value: 'verified', mapping: '已实名' },
        { value: 'rejected', mapping: '已驳回' },
        { value: 'revoked', mapping: '已撤销' },
      ],
    });
    mockList.mockResolvedValue({
      items: [
        {
          id: 3,
          status: 'manual_review',
          status_label: '人工审核',
          status__mapping: '人工复核',
          source: 'user_submit',
          source_label: '用户提交',
          source__mapping: '用户主动提交',
          provider: 'manual',
          provider_label: '人工',
          provider__mapping: '后台人工处理',
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
      status__mapping: '人工复核',
      source: 'user_submit',
      source_label: '用户提交',
      source__mapping: '用户主动提交',
      provider: 'manual',
      provider_label: '人工',
      provider__mapping: '后台人工处理',
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
      expect(mockList).toHaveBeenCalledWith({ page: 1, page_size: 10, keyword: undefined, status: undefined });
      expect(screen.queryByText('实名概览')).not.toBeInTheDocument();
      expect(screen.queryByText('审核详情')).not.toBeInTheDocument();
      expect(screen.queryByText('关键提醒')).not.toBeInTheDocument();
      expect(screen.getByText('实名列表')).toBeInTheDocument();
      expect(screen.queryByText('待校验记录')).not.toBeInTheDocument();
      expect(screen.queryByText('人工复核')).not.toBeInTheDocument();
      expect(screen.queryByText('驳回回流')).not.toBeInTheDocument();
      expect(screen.queryByText('撤销与回收')).not.toBeInTheDocument();
      expect(screen.queryByText('继续审核')).not.toBeInTheDocument();
      expect(screen.queryByText('联动用户治理')).not.toBeInTheDocument();
      expect(screen.queryByText('查看账号承接')).not.toBeInTheDocument();
      expect(screen.queryByText('来源与承接')).not.toBeInTheDocument();
      expect(screen.queryByText('返回用户治理')).not.toBeInTheDocument();
      expect(screen.getByText('张*')).toBeInTheDocument();
      expect(screen.getByText('alice')).toBeInTheDocument();
    });

    const row = screen.getByText('alice').closest('tr');
    expect(row).not.toBeNull();
    expect(within(row!).getByText('人工复核')).toBeInTheDocument();
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
    await waitFor(() => expect(mockList).toHaveBeenLastCalledWith({ page: 1, page_size: 10, keyword: 'alice', status: undefined }));
  });
});
