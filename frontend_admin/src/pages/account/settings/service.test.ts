import { request } from '@umijs/max';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildMfaDescription,
  maskEmail,
  maskPhone,
} from './components/security.utils';
import {
  addAccountEmail,
  confirmPhoneChange,
  deleteAuthenticator,
  getTotpSetup,
  listAuthenticators,
  requestPhoneChangeCode,
  setPrimaryAccountEmail,
  updatePassword,
} from './service';

vi.mock('@umijs/max', () => ({
  request: vi.fn(),
}));

vi.mock('@/services/ant-design-pro/api', () => ({
  currentUser: vi.fn(),
}));

const mockRequest = vi.mocked(request);

describe('account settings service', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    Object.defineProperty(document, 'cookie', {
      configurable: true,
      writable: true,
      value: 'csrftoken=test-token',
    });
  });

  it('posts password change to allauth browser endpoint', async () => {
    mockRequest.mockResolvedValueOnce({ meta: { is_authenticated: true } });

    await updatePassword('oldpw123!', 'newpw123!');

    expect(mockRequest).toHaveBeenCalledWith(
      '/api/allauth/browser/v1/account/password/change',
      expect.objectContaining({
        method: 'POST',
        data: { current_password: 'oldpw123!', new_password: 'newpw123!' },
        headers: expect.objectContaining({ 'X-CSRFToken': 'test-token' }),
      }),
    );
  });

  it('uses allauth phone change endpoints', async () => {
    mockRequest
      .mockResolvedValueOnce({
        data: [{ phone: '+8613800138001', verified: false }],
      })
      .mockResolvedValueOnce({ meta: { is_authenticated: true } });

    await requestPhoneChangeCode('+8613800138001');
    await confirmPhoneChange('123456');

    expect(mockRequest).toHaveBeenNthCalledWith(
      1,
      '/api/allauth/browser/v1/account/phone',
      expect.objectContaining({
        method: 'POST',
        data: { phone: '+8613800138001' },
      }),
    );
    expect(mockRequest).toHaveBeenNthCalledWith(
      2,
      '/api/allauth/browser/v1/auth/phone/verify',
      expect.objectContaining({
        method: 'POST',
        data: { code: '123456' },
      }),
    );
  });

  it('uses post and patch to manage account email', async () => {
    mockRequest.mockResolvedValue({ data: [] });

    await addAccountEmail('next@example.com');
    await setPrimaryAccountEmail('next@example.com');

    expect(mockRequest).toHaveBeenNthCalledWith(
      1,
      '/api/allauth/browser/v1/account/email',
      expect.objectContaining({
        method: 'POST',
        data: { email: 'next@example.com' },
      }),
    );
    expect(mockRequest).toHaveBeenNthCalledWith(
      2,
      '/api/allauth/browser/v1/account/email',
      expect.objectContaining({
        method: 'PATCH',
        data: { email: 'next@example.com', primary: true },
      }),
    );
  });

  it('reads totp setup and authenticator list', async () => {
    mockRequest
      .mockResolvedValueOnce({
        data: [{ type: 'totp' }, { type: 'recovery_codes' }],
      })
      .mockRejectedValueOnce({
        response: {
          data: { meta: { secret: 'secret', totp_url: 'otpauth://totp/demo' } },
        },
      });

    const authenticators = await listAuthenticators();
    const totpSetup = await getTotpSetup();

    expect(authenticators.data).toEqual([
      { type: 'totp' },
      { type: 'recovery_codes' },
    ]);
    expect(totpSetup).toEqual({
      secret: 'secret',
      totpUrl: 'otpauth://totp/demo',
    });
  });

  it('deletes authenticator through current-user endpoint', async () => {
    mockRequest.mockResolvedValueOnce({});

    await deleteAuthenticator('totp');

    expect(mockRequest).toHaveBeenCalledWith(
      '/api/users/me/mfa/authenticators/totp/',
      expect.objectContaining({
        method: 'DELETE',
        headers: expect.objectContaining({ 'X-CSRFToken': 'test-token' }),
      }),
    );
  });

  it('masks phone and email for display', () => {
    expect(maskPhone('+86', '13800138001')).toBe('+86138****8001');
    expect(maskEmail('next@example.com')).toBe('nex***@example.com');
    expect(
      buildMfaDescription([{ type: 'totp' }, { type: 'recovery_codes' }]),
    ).toBe('已启用 TOTP 和恢复码');
    expect(
      buildMfaDescription([{ type: 'webauthn' }, { type: 'webauthn' }]),
    ).toBe('已启用 2 个 Passkey');
  });

  it('throws when totp setup payload is missing', async () => {
    mockRequest.mockRejectedValueOnce({
      response: { status: 500, data: { message: 'server error' } },
    });

    await expect(getTotpSetup()).rejects.toMatchObject({
      response: { status: 500 },
    });
  });
});
