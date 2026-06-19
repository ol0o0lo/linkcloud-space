import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
      items: [{ id: 3, status: 'manual_review', status_label: '人工审核', source: 'user_submit', source_label: '用户提交', provider: 'manual', provider_label: '人工', real_name_masked: '张*', id_number_masked: '110***********1234', id_number_last4: '1234', is_current: true, created_at: '2026-06-16T10:00:00+08:00', updated_at: '2026-06-16T10:00:00+08:00', user: { username: 'alice' } }],
      total: 1,
      page: 1,
      page_size: 10,
    });
    mockGet.mockResolvedValue({ id: 3, status: 'manual_review', status_label: '人工审核', source: 'user_submit', source_label: '用户提交', provider: 'manual', provider_label: '人工', real_name_masked: '张*', id_number_masked: '110***********1234', id_number_last4: '1234', is_current: true, created_at: '2026-06-16T10:00:00+08:00', updated_at: '2026-06-16T10:00:00+08:00', real_name: '张三', id_number: '110101199001011234', user: { username: 'alice' }, id_card_media: [{ media_id: 101, media_type: 'image', label: '身份证人像面', side: 'front', url: '/front.png' }, { media_id: 102, media_type: 'image', label: '身份证国徽面', side: 'back', url: '/back.png' }], logs: [] });
    mockApprove.mockResolvedValue({});
    mockReject.mockResolvedValue({});
    mockManual.mockResolvedValue({});
    mockRevoke.mockResolvedValue({});
  });

  it('loads real-name rows and triggers review actions', async () => {
    render(<QueryClientProvider client={queryClient}><RealNameAdminPage /></QueryClientProvider>);

    await waitFor(() => {
      expect(mockList).toHaveBeenCalledWith({ page: 1, page_size: 10 });
      expect(screen.getByText('张*')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('通过'));
    fireEvent.change(screen.getByLabelText('备注'), { target: { value: 'ok' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'OK' }).at(-1)!);
    await waitFor(() => expect(mockApprove).toHaveBeenCalledWith({ verification_id: 3 }, { note: 'ok' }));

    fireEvent.click(screen.getByText('驳回'));
    fireEvent.change(screen.getByLabelText('备注'), { target: { value: 'bad' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'OK' }).at(-1)!);
    await waitFor(() => expect(mockReject).toHaveBeenCalledWith({ verification_id: 3 }, { note: 'bad' }));

    fireEvent.click(screen.getByText('详情'));
    expect(await screen.findByAltText('身份证人像面')).toHaveAttribute('src', '/front.png');
    expect(screen.getByAltText('身份证国徽面')).toHaveAttribute('src', '/back.png');
  });
});
