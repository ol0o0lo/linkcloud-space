import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RealNameView } from './real-name';

const serviceMocks = vi.hoisted(() => ({
  mockGetMyRealName: vi.fn(),
  mockSubmitMyRealName: vi.fn(),
  mockRetryMyRealName: vi.fn(),
  mockUploadFiles: vi.fn(),
}));

vi.mock('@/services/openapi/realName', () => ({
  appsAccountsApiGetMyRealName: serviceMocks.mockGetMyRealName,
  appsAccountsApiSubmitMyRealName: serviceMocks.mockSubmitMyRealName,
  appsAccountsApiRetryMyRealName: serviceMocks.mockRetryMyRealName,
}));

vi.mock('@/services/openapi/mediaFiles', () => ({
  appsMediaApiUploadFiles: serviceMocks.mockUploadFiles,
}));

describe('RealNameView', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    vi.clearAllMocks();
    serviceMocks.mockGetMyRealName.mockResolvedValue({
      id: 0,
      status: 'unverified',
      status_label: '未认证',
      source: 'user_submit',
      source_label: '用户提交',
      provider: 'mock_auto',
      provider_label: '模拟校验',
      real_name_masked: '',
      id_number_masked: '',
      id_number_last4: '',
      is_current: false,
      created_at: '',
      updated_at: '',
    });
    serviceMocks.mockSubmitMyRealName.mockResolvedValue({});
    serviceMocks.mockRetryMyRealName.mockResolvedValue({});
    serviceMocks.mockUploadFiles
      .mockResolvedValueOnce([
        {
          id: 101,
          resource_type: 'real_name_id_card',
          original_filename: 'front.png',
          url: '/front.png',
          file_size: 123,
          created_at: '2026-06-20T10:00:00+08:00',
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 102,
          resource_type: 'real_name_id_card',
          original_filename: 'back.png',
          url: '/back.png',
          file_size: 124,
          created_at: '2026-06-20T10:00:00+08:00',
        },
      ]);
  });

  function renderView() {
    return render(
      <QueryClientProvider client={queryClient}>
        <RealNameView />
      </QueryClientProvider>,
    );
  }

  it('submits real-name application from a modal with id-card media', async () => {
    renderView();

    await screen.findByText('实名认证');
    fireEvent.click(screen.getByText('去认证'));

    expect(screen.getByText('请完成实名认证')).toBeInTheDocument();
    expect(screen.getByLabelText('真实姓名')).toBeInTheDocument();
    expect(screen.getByLabelText('身份证号')).toBeInTheDocument();
    expect(screen.getByText('身份证人像面')).toBeInTheDocument();
    expect(screen.getByText('身份证国徽面')).toBeInTheDocument();

    const frontInput = document.querySelectorAll(
      'input[type="file"]',
    )[0] as HTMLInputElement;
    const backInput = document.querySelectorAll(
      'input[type="file"]',
    )[1] as HTMLInputElement;
    fireEvent.change(frontInput, {
      target: {
        files: [new File(['front'], 'front.png', { type: 'image/png' })],
      },
    });
    fireEvent.change(backInput, {
      target: {
        files: [new File(['back'], 'back.png', { type: 'image/png' })],
      },
    });
    await waitFor(() =>
      expect(serviceMocks.mockUploadFiles).toHaveBeenCalledTimes(2),
    );

    fireEvent.change(screen.getByLabelText('真实姓名'), {
      target: { value: '张三' },
    });
    fireEvent.change(screen.getByLabelText('身份证号'), {
      target: { value: '110105199001010010' },
    });
    expect(
      screen.getByRole('button', { name: '提交实名' }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '提交实名' }));

    await waitFor(() => {
      expect(serviceMocks.mockSubmitMyRealName).toHaveBeenCalledWith({
        real_name: '张三',
        id_number: '110105199001010010',
        source: 'user_submit',
        id_card_media: [
          {
            media_id: 101,
            media_type: 'image',
            label: '身份证人像面',
            side: 'front',
            url: '/front.png',
          },
          {
            media_id: 102,
            media_type: 'image',
            label: '身份证国徽面',
            side: 'back',
            url: '/back.png',
          },
        ],
      });
    });
  });
});
