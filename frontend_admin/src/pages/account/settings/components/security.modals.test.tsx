import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SecurityModals } from './security.modals';

const serviceMocks = vi.hoisted(() => ({
  activateTotp: vi.fn(),
  addAccountEmail: vi.fn(),
  confirmPhoneChange: vi.fn(),
  deleteAuthenticator: vi.fn(),
  getTotpSetup: vi.fn(),
  getRecoveryCodes: vi.fn(),
  listAccountEmails: vi.fn(),
  listAuthenticators: vi.fn(),
  reauthenticate: vi.fn(),
  removeAccountEmail: vi.fn(),
  requestPhoneChangeCode: vi.fn(),
  setPrimaryAccountEmail: vi.fn(),
  updatePassword: vi.fn(),
}));

vi.mock('../service', () => serviceMocks);

describe('SecurityModals MFA flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    serviceMocks.listAuthenticators.mockResolvedValue([]);
    serviceMocks.getTotpSetup.mockResolvedValue({
      secret: 'ABCDEF123456',
      totpUrl: 'otpauth://totp/demo',
    });
    serviceMocks.getRecoveryCodes.mockResolvedValue(['rc-001', 'rc-002']);
  });

  function renderModal() {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    return render(
      <QueryClientProvider client={queryClient}>
        <SecurityModals activeModal="mfa" onClose={() => {}} />
      </QueryClientProvider>,
    );
  }

  it('uses a real two-step flow for totp binding', async () => {
    renderModal();

    await waitFor(() => {
      expect(serviceMocks.listAuthenticators).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByRole('button', { name: '开始绑定 TOTP' }));

    expect(
      await screen.findByText('第 1 步：扫码或录入密钥'),
    ).toBeInTheDocument();
    expect(screen.queryByText('第 2 步：输入验证码')).not.toBeInTheDocument();
    expect(
      screen.queryByPlaceholderText('请输入验证器当前显示的 6 位数字'),
    ).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: '我已完成添加，下一步' }),
    );

    expect(await screen.findByText('第 2 步：输入验证码')).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText('请输入验证器当前显示的 6 位数字'),
    ).toBeInTheDocument();
    expect(
      screen.queryByText('第 1 步：扫码或录入密钥'),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('手动录入密钥')).not.toBeInTheDocument();
    expect(
      screen.queryByText('打开验证器应用，扫描二维码完成添加'),
    ).not.toBeInTheDocument();
  });

  it('opens reauthenticate modal when backend returns nested reauthenticate flow', async () => {
    serviceMocks.activateTotp.mockRejectedValueOnce({
      response: {
        status: 401,
        data: {
          data: {
            flows: [{ id: 'reauthenticate' }],
          },
        },
      },
    });

    renderModal();

    await waitFor(() => {
      expect(serviceMocks.listAuthenticators).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByRole('button', { name: '开始绑定 TOTP' }));
    fireEvent.click(
      await screen.findByRole('button', { name: '我已完成添加，下一步' }),
    );

    fireEvent.change(
      await screen.findByPlaceholderText('请输入验证器当前显示的 6 位数字'),
      {
        target: { value: '123456' },
      },
    );
    fireEvent.click(screen.getByRole('button', { name: '确认绑定 TOTP' }));

    expect(await screen.findByText('身份验证')).toBeInTheDocument();
    expect(
      screen.getByText('绑定 TOTP 需要重新验证身份，请输入密码后继续'),
    ).toBeInTheDocument();
  });

  it('shows recovery codes after totp activation succeeds', async () => {
    serviceMocks.activateTotp.mockResolvedValueOnce({});

    renderModal();

    await waitFor(() => {
      expect(serviceMocks.listAuthenticators).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByRole('button', { name: '开始绑定 TOTP' }));
    fireEvent.click(
      await screen.findByRole('button', { name: '我已完成添加，下一步' }),
    );
    fireEvent.change(
      await screen.findByPlaceholderText('请输入验证器当前显示的 6 位数字'),
      {
        target: { value: '123456' },
      },
    );
    fireEvent.click(screen.getByRole('button', { name: '确认绑定 TOTP' }));

    expect(await screen.findByText('请保存恢复码')).toBeInTheDocument();
    expect(screen.getByText('已生成 2 条恢复码，请立即复制或下载保存。')).toBeInTheDocument();
    expect(screen.getByText('rc-001')).toBeInTheDocument();
    expect(screen.getByText('rc-002')).toBeInTheDocument();
    expect(screen.queryByText('恢复码列表')).not.toBeInTheDocument();
    expect(screen.queryByText('恢复码 1')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '复制恢复码' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '下载文本' })).toBeInTheDocument();
  });
});
