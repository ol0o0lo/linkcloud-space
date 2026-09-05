import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  codeConfirm: vi.fn(),
  codeRequest: vi.fn(),
  codeResend: vi.fn(),
  config: vi.fn(),
  confirmEmail: vi.fn(),
  requestPassword: vi.fn(),
  resendPhone: vi.fn(),
  resetPassword: vi.fn(),
  signup: vi.fn(),
  verifyPhone: vi.fn(),
}));

vi.mock('@/services/allauth/authAccount', () => ({
  postBrowserV1AuthEmailVerify: mocks.confirmEmail,
  postBrowserV1AuthPhoneVerify: mocks.verifyPhone,
  postBrowserV1AuthPhoneVerifyResend: mocks.resendPhone,
  postBrowserV1AuthSignup: mocks.signup,
}));

vi.mock('@/services/allauth/authPasswordReset', () => ({
  postBrowserV1AuthPasswordRequest: mocks.requestPassword,
  postBrowserV1AuthPasswordReset: mocks.resetPassword,
}));

vi.mock('@/services/allauth/authLoginByCode', () => ({
  postBrowserV1AuthCodeConfirm: mocks.codeConfirm,
  postBrowserV1AuthCodeRequest: mocks.codeRequest,
  postBrowserV1AuthCodeResend: mocks.codeResend,
}));

vi.mock('@/services/allauth/configuration', () => ({
  getBrowserV1Config: mocks.config,
}));

import {
  confirmPublicEmail,
  confirmPublicLoginCode,
  requestPublicPasswordReset,
  requestPublicLoginCode,
  resendPublicLoginCode,
  resendPublicPhoneCode,
  resetPublicPassword,
  signupPublicAccount,
  startPublicProviderLogin,
  verifyPublicPhone,
} from './publicAuth';

describe('publicAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('注册时提交规范手机号并携带邀请码来源', async () => {
    mocks.signup.mockResolvedValue({});

    await signupPublicAccount({
      email: 'new@example.com',
      phoneCountryCode: '+86',
      phoneNationalNumber: '13800138000',
      password: 'testpw123!',
      inviteCode: 'abc123',
      referralSource: 'link',
    });

    expect(mocks.signup).toHaveBeenCalledWith(
      {
        client: 'browser',
        invite_code: 'ABC123',
        referral_source: 'link',
      },
      {
        email: 'new@example.com',
        password: 'testpw123!',
        phone: '+8613800138000',
      },
      expect.objectContaining({ skipErrorHandler: true }),
    );
  });

  it('完成手机验证并支持重发', async () => {
    await verifyPublicPhone('1234');
    await resendPublicPhoneCode();

    expect(mocks.verifyPhone).toHaveBeenCalledWith(
      { client: 'browser' },
      { code: '1234' },
      expect.objectContaining({ skipErrorHandler: true }),
    );
    expect(mocks.resendPhone).toHaveBeenCalledWith(
      { client: 'browser' },
      expect.objectContaining({ skipErrorHandler: true }),
    );
  });

  it('发起和完成密码重置并确认邮箱', async () => {
    await requestPublicPasswordReset('person@example.com');
    await resetPublicPassword('reset-key', 'next-password');
    await confirmPublicEmail('email-key');

    expect(mocks.requestPassword).toHaveBeenCalledWith(
      { client: 'browser' },
      { email: 'person@example.com' },
      expect.objectContaining({ skipErrorHandler: true }),
    );
    expect(mocks.resetPassword).toHaveBeenCalledWith(
      { client: 'browser' },
      { key: 'reset-key', password: 'next-password' },
      expect.objectContaining({ skipErrorHandler: true }),
    );
    expect(mocks.confirmEmail).toHaveBeenCalledWith(
      { client: 'browser' },
      { key: 'email-key' },
      expect.objectContaining({ skipErrorHandler: true }),
    );
  });

  it('请求并确认邮箱登录验证码', async () => {
    mocks.codeRequest.mockRejectedValueOnce({
      response: {
        status: 401,
        data: { flows: [{ id: 'login_by_code', is_pending: true }] },
      },
    });
    mocks.codeConfirm.mockResolvedValueOnce({});
    mocks.codeResend.mockResolvedValueOnce({});

    await expect(
      requestPublicLoginCode('person@example。com'),
    ).resolves.toBeUndefined();
    await confirmPublicLoginCode(' 123456 ');
    await resendPublicLoginCode();

    expect(mocks.codeRequest).toHaveBeenCalledWith(
      { client: 'browser' },
      { email: 'person@example.com' },
      expect.objectContaining({ skipErrorHandler: true }),
    );
    expect(mocks.codeConfirm).toHaveBeenCalledWith(
      { client: 'browser' },
      { code: '123456' },
      expect.objectContaining({ skipErrorHandler: true }),
    );
    expect(mocks.codeResend).toHaveBeenCalledWith(
      { client: 'browser' },
      expect.objectContaining({ skipErrorHandler: true }),
    );
  });

  it('通过顶层表单发起 GitHub 登录并保留登录后去向', async () => {
    const submit = vi.fn();
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation(((tagName: string) => {
      const element = originalCreateElement(tagName);
      if (tagName === 'form') {
        Object.defineProperty(element, 'submit', { value: submit });
      }
      return element;
    }) as typeof document.createElement);
    Object.defineProperty(document, 'cookie', {
      configurable: true,
      writable: true,
      value: 'csrftoken=test-token',
    });
    window.history.replaceState(
      {},
      '',
      '/dashboard/user/login?redirect=%2Frental%2Fhouses',
    );

    await startPublicProviderLogin('github');

    const form = document.body.querySelector('form');
    expect(form?.getAttribute('action')).toBe(
      '/api/allauth/browser/v1/auth/provider/redirect',
    );
    expect(
      form?.querySelector('input[name="provider"]')?.getAttribute('value'),
    ).toBe('github');
    expect(
      form?.querySelector('input[name="csrfmiddlewaretoken"]')?.getAttribute('value'),
    ).toBe('test-token');
    expect(
      form?.querySelector('input[name="callback_url"]')?.getAttribute('value'),
    ).toBe(
      `${window.location.origin}/dashboard/user/login?redirect=%2Frental%2Fhouses`,
    );
    expect(submit).toHaveBeenCalledTimes(1);
  });
});
