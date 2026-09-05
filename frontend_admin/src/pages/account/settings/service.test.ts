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
  getRecoveryCodes,
  getTotpSetup,
  listAuthenticators,
  querySocialBindings,
  requestPhoneChangeCode,
  setPrimaryAccountEmail,
  startSocialBinding,
  uploadAvatar,
  updatePassword,
} from './service';

vi.mock('@umijs/max', () => ({
  request: vi.fn(),
}));

const mockRequest = vi.mocked(request);

describe('account settings service', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    document.body.innerHTML = '';
    Object.defineProperty(document, 'cookie', {
      configurable: true,
      writable: true,
      value: 'csrftoken=test-token',
    });
  });

  it('queries current social binding states from the dedicated api', async () => {
    mockRequest.mockResolvedValueOnce({
      items: [
        { provider: 'github', label: 'GitHub', connected: false },
        { provider: 'weixin', label: '微信', connected: true },
      ],
    });

    const result = await querySocialBindings();

    expect(mockRequest).toHaveBeenCalledWith(
      '/api/users/me/social-bindings/',
      expect.objectContaining({
        credentials: 'include',
        method: 'GET',
      }),
    );
    expect(result.items[1]).toEqual({
      provider: 'weixin',
      label: '微信',
      connected: true,
    });
  });

  it('submits a top-level form post to the allauth provider redirect endpoint', async () => {
    const submit = vi.fn();
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation(((
      tagName: string,
    ) => {
      const element = originalCreateElement(tagName);
      if (tagName === 'form') {
        Object.defineProperty(element, 'submit', { value: submit });
      }
      return element;
    }) as typeof document.createElement);

    await startSocialBinding('github');

    const form = document.body.querySelector('form');
    expect(form?.getAttribute('action')).toBe(
      '/api/allauth/browser/v1/auth/provider/redirect',
    );
    expect(form?.getAttribute('method')).toBe('POST');
    expect(
      form?.querySelector('input[name="provider"]')?.getAttribute('value'),
    ).toBe('github');
    expect(
      form?.querySelector('input[name="process"]')?.getAttribute('value'),
    ).toBe('login');
    expect(
      form
        ?.querySelector('input[name="csrfmiddlewaretoken"]')
        ?.getAttribute('value'),
    ).toBe('test-token');
    expect(
      form?.querySelector('input[name="callback_url"]')?.getAttribute('value'),
    ).toBe(`${window.location.origin}/dashboard/account/settings?tab=security`);
    expect(submit).toHaveBeenCalledTimes(1);
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

  it('uploads avatar through media app then patches user avatar ref', async () => {
    mockRequest
      .mockResolvedValueOnce([{ id: 42, url: '/media/avatar.png', resource_type: 'avatar', original_filename: 'avatar.png', file_size: 123, created_at: '2026-01-01T00:00:00Z' }])
      .mockResolvedValueOnce({});
    const file = new File(['avatar'], 'avatar.png', { type: 'image/png' });

    const result = await uploadAvatar(7, file);

    const [, options] = mockRequest.mock.calls[0] as unknown as [string, { data: FormData }];
    const formData = options?.data as FormData;
    expect(mockRequest).toHaveBeenNthCalledWith(
      1,
      '/api/media/upload/',
      expect.objectContaining({
        method: 'POST',
        requestType: 'form',
        headers: expect.objectContaining({ 'X-CSRFToken': 'test-token' }),
      }),
    );
    expect(formData.getAll('files')).toEqual([file]);
    expect(formData.has('crop_data')).toBe(false);
    expect(formData.get('resource_type')).toBe('avatar');
    expect(formData.get('scope')).toBe('user');
    expect(mockRequest).toHaveBeenNthCalledWith(
      2,
      '/api/users/7/',
      expect.objectContaining({
        method: 'PATCH',
        data: { avatar: [{ media_id: 42, media_type: 'image' }] },
      }),
    );
    expect(result).toEqual({
      avatar: [{
        media_id: 42,
        resource_type: 'avatar',
        original_filename: 'avatar.png',
        url: '/media/avatar.png',
        thumbnail: null,
        file_size: 123,
        created_at: '2026-01-01T00:00:00Z',
      }],
    });
  });

  it('uses split-phone wrapper endpoints for phone change', async () => {
    mockRequest
      .mockResolvedValueOnce({
        data: [{ phone: '+8613800138001', verified: false }],
      })
      .mockResolvedValueOnce({ meta: { is_authenticated: true } });

    await requestPhoneChangeCode('+86', '13800138001');
    await confirmPhoneChange('123456');

    expect(mockRequest).toHaveBeenNthCalledWith(
      1,
      '/api/users/auth/browser/account/phone/',
      expect.objectContaining({
        method: 'POST',
        data: { phone_country_code: '+86', phone_national_number: '13800138001' },
      }),
    );
    expect(mockRequest).toHaveBeenNthCalledWith(
      2,
      '/api/users/auth/browser/phone/verify/',
      expect.objectContaining({
        method: 'POST',
        data: { code: '123456' },
      }),
    );
  });

  it('normalizes an international phone before requesting a change code', async () => {
    mockRequest.mockResolvedValueOnce({
      data: [{ phone: '+819012345678', verified: false }],
    });

    await requestPhoneChangeCode('+81', '090-1234-5678');

    expect(mockRequest).toHaveBeenCalledWith(
      '/api/users/auth/browser/account/phone/',
      expect.objectContaining({
        method: 'POST',
        data: {
          phone_country_code: '+81',
          phone_national_number: '9012345678',
        },
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

  it('normalizes full-width punctuation before adding account email', async () => {
    mockRequest.mockResolvedValue({ data: [] });

    await addAccountEmail('next@example。com');

    expect(mockRequest).toHaveBeenCalledWith(
      '/api/allauth/browser/v1/account/email',
      expect.objectContaining({
        method: 'POST',
        data: { email: 'next@example.com' },
      }),
    );
  });

  it('reads totp setup and authenticator list', async () => {
    mockRequest
      .mockResolvedValueOnce({
        data: [{ type: 'totp' }, { type: 'recovery_codes' }],
      })
      .mockResolvedValueOnce({
        meta: {
          secret: 'secret',
          totp_url: 'otpauth://totp/demo',
        },
      });

    const authenticators = await listAuthenticators();
    const totpSetup = await getTotpSetup();

    expect(authenticators).toEqual([
      { type: 'totp' },
      { type: 'recovery_codes' },
    ]);
    expect(totpSetup).toEqual({
      secret: 'secret',
      totpUrl: 'otpauth://totp/demo',
    });
    expect(mockRequest).toHaveBeenNthCalledWith(
      2,
      '/api/allauth/browser/v1/account/authenticators/totp',
      expect.objectContaining({
        credentials: 'include',
        method: 'GET',
        skipErrorHandler: true,
      }),
    );
  });

  it('reads recovery codes from allauth endpoint', async () => {
    mockRequest.mockResolvedValueOnce({
      data: {
        type: 'recovery_codes',
        total_code_count: 10,
        unused_code_count: 10,
        unused_codes: ['code-1', 'code-2'],
      },
    });

    const recoveryCodes = await getRecoveryCodes();

    expect(recoveryCodes).toEqual(['code-1', 'code-2']);
    expect(mockRequest).toHaveBeenCalledWith(
      '/api/allauth/browser/v1/account/authenticators/recovery-codes',
      expect.objectContaining({
        credentials: 'include',
        method: 'GET',
        skipErrorHandler: true,
      }),
    );
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
