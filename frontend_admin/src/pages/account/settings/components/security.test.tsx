import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SecurityView from './security';

const serviceMocks = vi.hoisted(() => ({
  mockQueryCurrent: vi.fn(),
  mockListAuthenticators: vi.fn(),
  mockGetMyRealName: vi.fn(),
  mockSubmitMyRealName: vi.fn(),
  mockRetryMyRealName: vi.fn(),
  mockUploadFiles: vi.fn(),
}));

vi.mock('../service', () => ({
  queryCurrent: serviceMocks.mockQueryCurrent,
  listAuthenticators: serviceMocks.mockListAuthenticators,
}));

vi.mock('@/services/openapi/realName', () => ({
  appsAccountsApiGetMyRealName: serviceMocks.mockGetMyRealName,
  appsAccountsApiSubmitMyRealName: serviceMocks.mockSubmitMyRealName,
  appsAccountsApiRetryMyRealName: serviceMocks.mockRetryMyRealName,
}));

vi.mock('@/services/openapi/mediaFiles', () => ({
  appsMediaApiUploadFiles: serviceMocks.mockUploadFiles,
}));

vi.mock('./security.modals', () => ({
  SecurityModals: ({ activeModal }: { activeModal: string | null }) => (
    <div data-testid="security-modal-state">{activeModal || 'closed'}</div>
  ),
}));

describe('SecurityView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    serviceMocks.mockQueryCurrent.mockResolvedValue({
      data: {
        id: 7,
        email: 'member@example.com',
        username: 'member',
        first_name: 'Member',
        last_name: 'User',
        timezone: 'Asia/Shanghai',
        avatar_url: null,
        phone_verified: true,
        real_name_status: 'verified',
        phone_country_code: '+86',
        phone_national_number: '13800138001',
        is_staff: false,
        is_superuser: false,
      },
    });
    serviceMocks.mockListAuthenticators.mockResolvedValue([
      { type: 'totp' },
      { type: 'recovery_codes' },
    ]);
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
     .mockResolvedValueOnce([{ id: 101, resource_type: 'real_name_id_card', original_filename: 'front.png', url: '/front.png', file_size: 123, created_at: '2026-06-20T10:00:00+08:00' }])
     .mockResolvedValueOnce([{ id: 102, resource_type: 'real_name_id_card', original_filename: 'back.png', url: '/back.png', file_size: 124, created_at: '2026-06-20T10:00:00+08:00' }]);
  });

  function renderView() {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    return render(
      <QueryClientProvider client={queryClient}>
        <SecurityView />
      </QueryClientProvider>,
    );
  }

  it('renders real-name as part of security settings', async () => {
    renderView();

    await waitFor(() => {
      expect(screen.getByText('账户密码')).toBeInTheDocument();
    });

    expect(screen.getByText('密保手机')).toBeInTheDocument();
    expect(screen.getByText('邮箱地址')).toBeInTheDocument();
    expect(screen.getByText('MFA 设备')).toBeInTheDocument();
    expect(screen.getByText('实名认证')).toBeInTheDocument();
    expect(screen.getByText('未认证')).toBeInTheDocument();
    expect(screen.getByText('去认证')).toBeInTheDocument();
    expect(screen.queryByText('密保问题')).not.toBeInTheDocument();
    expect(screen.getByText('已启用 TOTP 和恢复码')).toBeInTheDocument();
  });

  it('shows unbound copy for empty phone and email', async () => {
    serviceMocks.mockQueryCurrent.mockResolvedValue({
      data: {
        id: 7,
        email: '',
        username: 'member',
        first_name: '',
        last_name: '',
        timezone: 'Asia/Shanghai',
        avatar_url: null,
        phone_verified: false,
        real_name_status: 'unverified',
        phone_country_code: '',
        phone_national_number: '',
        is_staff: false,
        is_superuser: false,
      },
    });
    serviceMocks.mockListAuthenticators.mockResolvedValue([]);

    renderView();

    expect(await screen.findByText('未绑定手机号')).toBeInTheDocument();
    expect(screen.getByText('未绑定邮箱')).toBeInTheDocument();
    expect(screen.getByText('未启用')).toBeInTheDocument();
  });

  it('opens matching modal state when action is clicked', async () => {
    renderView();

    await screen.findByText('账户密码');
    fireEvent.click(screen.getAllByText('修改')[0]);

    expect(screen.getByTestId('security-modal-state')).toHaveTextContent(
      'password',
    );
  });

  it('submits real-name application from a modal with id-card media', async () => {
    renderView();

    await screen.findByText('实名认证');
    fireEvent.click(screen.getByText('去认证'));

    expect(screen.getByText('请完成实名认证')).toBeInTheDocument();
    expect(screen.getByLabelText('真实姓名')).toBeInTheDocument();
    expect(screen.getByLabelText('身份证号')).toBeInTheDocument();
    expect(screen.getByText('身份证人像面')).toBeInTheDocument();
    expect(screen.getByText('身份证国徽面')).toBeInTheDocument();

    // Simulate uploads: the Upload component fires customRequest when a file is selected.
    // We need to trigger file inputs for each upload slot.
    const frontInput = document.querySelectorAll('input[type="file"]')[0] as HTMLInputElement;
    const backInput = document.querySelectorAll('input[type="file"]')[1] as HTMLInputElement;
    fireEvent.change(frontInput, { target: { files: [new File(['front'], 'front.png', { type: 'image/png' })] } });
    fireEvent.change(backInput, { target: { files: [new File(['back'], 'back.png', { type: 'image/png' })] } });
    await waitFor(() => expect(serviceMocks.mockUploadFiles).toHaveBeenCalledTimes(2));

    fireEvent.change(screen.getByLabelText('真实姓名'), { target: { value: '张三' } });
    fireEvent.change(screen.getByLabelText('身份证号'), { target: { value: '110105199001010010' } });
    expect(screen.getByRole('button', { name: '提交实名' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '提交实名' }));

    await waitFor(() => {
      expect(serviceMocks.mockSubmitMyRealName).toHaveBeenCalledWith({
        real_name: '张三',
        id_number: '110105199001010010',
        source: 'user_submit',
       id_card_media: [
          { media_id: 101, media_type: 'image', label: '身份证人像面', side: 'front', url: '/front.png' },
          { media_id: 102, media_type: 'image', label: '身份证国徽面', side: 'back', url: '/back.png' },
        ],
      });
    });
  });
});
