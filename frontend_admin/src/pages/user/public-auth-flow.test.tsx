import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  confirmEmail: vi.fn(),
  historyPush: vi.fn(),
  historyReplace: vi.fn(),
  requestReset: vi.fn(),
  resendPhone: vi.fn(),
  resetPassword: vi.fn(),
  signup: vi.fn(),
  verifyPhone: vi.fn(),
}));

let routeParams: Record<string, string> = {};

vi.mock('@umijs/max', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@umijs/max')>();
  return {
    ...actual,
    Link: ({ children, to }: any) => <a href={to}>{children}</a>,
    history: {
      push: mocks.historyPush,
      replace: mocks.historyReplace,
    },
    useParams: () => routeParams,
    useSearchParams: () => [new URLSearchParams(window.location.search)],
  };
});

vi.mock('@/services/manual/publicAuth', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/services/manual/publicAuth')>();
  return {
    ...actual,
    confirmPublicEmail: mocks.confirmEmail,
    requestPublicPasswordReset: mocks.requestReset,
    resendPublicPhoneCode: mocks.resendPhone,
    resetPublicPassword: mocks.resetPassword,
    signupPublicAccount: mocks.signup,
    verifyPublicPhone: mocks.verifyPhone,
  };
});

import ConfirmEmailPage from './confirm-email';
import PasswordResetPage from './password-reset';
import PasswordResetConfirmPage from './password-reset/confirm';
import RegisterPage from './register';
import VerifyPhonePage from './verify-phone';

describe('公开认证闭环', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    routeParams = {};
    window.history.replaceState({}, '', '/user/register');
  });

  it('注册真实账号并在待验证手机号时跳转', async () => {
    window.history.replaceState(
      {},
      '',
      '/user/register?invite_code=AQPSQ6OVNA&referral_source=link&redirect=%2Fpromotion',
    );
    mocks.signup.mockRejectedValue({
      response: {
        status: 401,
        data: { flows: [{ id: 'verify_phone', is_pending: true }] },
      },
    });

    render(<RegisterPage />);

    expect(screen.getByDisplayValue('AQPSQ6OVNA')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '返回登录' })).toHaveAttribute(
      'href',
      '/user/login?redirect=%2Fpromotion',
    );
    fireEvent.change(screen.getByPlaceholderText('请输入邮箱'), {
      target: { value: 'frontend-admin-signup@example.com' },
    });
    fireEvent.change(screen.getByPlaceholderText('请输入手机号'), {
      target: { value: '13800138011' },
    });
    const passwordInputs = screen.getAllByPlaceholderText(/密码/);
    fireEvent.change(passwordInputs[0], { target: { value: 'testpw123!' } });
    fireEvent.change(passwordInputs[1], { target: { value: 'testpw123!' } });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: '创建账号' }));

    await waitFor(() =>
      expect(mocks.signup).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'frontend-admin-signup@example.com',
          phoneCountryCode: '+86',
          phoneNationalNumber: '13800138011',
          inviteCode: 'AQPSQ6OVNA',
          referralSource: 'link',
        }),
      ),
    );
    expect(mocks.historyPush).toHaveBeenCalledWith(
      '/user/verify-phone?phone=%2B8613800138011&redirect=%2Fpromotion',
    );
  });

  it('验证手机号成功后返回目标页并可重发', async () => {
    window.history.replaceState(
      {},
      '',
      '/user/verify-phone?phone=%2B8613800138011&redirect=%2Fpromotion',
    );
    mocks.verifyPhone.mockResolvedValue({});
    mocks.resendPhone.mockResolvedValue({});

    render(<VerifyPhonePage />);

    expect(screen.getByText('+8613800138011')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '返回登录' })).toHaveAttribute(
      'href',
      '/user/login?redirect=%2Fpromotion',
    );
    fireEvent.change(screen.getByPlaceholderText('请输入短信验证码'), {
      target: { value: '1234' },
    });
    fireEvent.click(screen.getByRole('button', { name: '确认验证' }));

    await waitFor(() => expect(mocks.verifyPhone).toHaveBeenCalledWith('1234'));
    expect(mocks.historyReplace).toHaveBeenCalledWith('/promotion');

    fireEvent.click(screen.getByRole('button', { name: '重新发送' }));
    await waitFor(() => expect(mocks.resendPhone).toHaveBeenCalled());
  });

  it('发起密码重置请求', async () => {
    window.history.replaceState(
      {},
      '',
      '/user/password/reset?redirect=%2Fpromotion',
    );
    mocks.requestReset.mockResolvedValue({});
    render(<PasswordResetPage />);

    expect(screen.getByRole('link', { name: '返回登录' })).toHaveAttribute(
      'href',
      '/user/login?redirect=%2Fpromotion',
    );

    fireEvent.change(screen.getByPlaceholderText('请输入注册邮箱'), {
      target: { value: 'person@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: '发送重置邮件' }));

    expect(await screen.findByText('重置邮件已发送')).toBeInTheDocument();
    expect(mocks.requestReset).toHaveBeenCalledWith('person@example.com');
  });

  it('使用链接 key 设置新密码', async () => {
    routeParams = { key: 'reset-key' };
    mocks.resetPassword.mockResolvedValue({});
    render(<PasswordResetConfirmPage />);

    const passwordInputs = screen.getAllByPlaceholderText(/新密码/);
    fireEvent.change(passwordInputs[0], { target: { value: 'nextpw123!' } });
    fireEvent.change(passwordInputs[1], { target: { value: 'nextpw123!' } });
    fireEvent.click(screen.getByRole('button', { name: '更新密码' }));

    await waitFor(() =>
      expect(mocks.resetPassword).toHaveBeenCalledWith(
        'reset-key',
        'nextpw123!',
      ),
    );
  });

  it('打开邮件链接即确认邮箱', async () => {
    routeParams = { key: 'email-key' };
    mocks.confirmEmail.mockResolvedValue({});
    render(<ConfirmEmailPage />);

    expect(await screen.findByText('邮箱验证成功')).toBeInTheDocument();
    expect(mocks.confirmEmail).toHaveBeenCalledWith('email-key');
  });
});
