import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getCredential: vi.fn(),
  getLoginOptions: vi.fn(),
  getMfaOptions: vi.fn(),
  parseOptions: vi.fn(),
  postLogin: vi.fn(),
  postMfa: vi.fn(),
}));

vi.mock('@/services/allauth/authWebauthnLogin', () => ({
  getBrowserV1AuthWebauthnAuthenticate: mocks.getMfaOptions,
  getBrowserV1AuthWebauthnLogin: mocks.getLoginOptions,
  postBrowserV1AuthWebauthnAuthenticate: mocks.postMfa,
  postBrowserV1AuthWebauthnLogin: mocks.postLogin,
}));

import {
  authenticateMfaWithWebauthn,
  loginWithPasskey,
  serializePublicKeyCredential,
} from './webauthn';

describe('webauthn', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(globalThis, 'PublicKeyCredential', {
      configurable: true,
      value: {
        parseRequestOptionsFromJSON: mocks.parseOptions,
      },
    });
    Object.defineProperty(navigator, 'credentials', {
      configurable: true,
      value: { get: mocks.getCredential },
    });
  });

  it('请求通行密钥参数、调用浏览器凭据并提交序列化结果', async () => {
    const parsedOptions = { challenge: new ArrayBuffer(1) };
    const credentialPayload = {
      id: 'credential-id',
      rawId: 'credential-id',
      response: { clientDataJSON: 'client-data' },
      type: 'public-key',
    };
    const credential = {
      toJSON: vi.fn(() => credentialPayload),
    };
    mocks.getLoginOptions.mockResolvedValueOnce({
      data: { request_options: { challenge: 'challenge-value' } },
    });
    mocks.parseOptions.mockReturnValueOnce(parsedOptions);
    mocks.getCredential.mockResolvedValueOnce(credential);
    mocks.postLogin.mockResolvedValueOnce({});

    await loginWithPasskey();

    expect(mocks.getLoginOptions).toHaveBeenCalledWith(
      { client: 'browser' },
      expect.objectContaining({ skipErrorHandler: true }),
    );
    expect(mocks.parseOptions).toHaveBeenCalledWith({
      challenge: 'challenge-value',
    });
    expect(mocks.getCredential).toHaveBeenCalledWith({
      publicKey: parsedOptions,
    });
    expect(mocks.postLogin).toHaveBeenCalledWith(
      { client: 'browser' },
      { credential: credentialPayload },
      expect.objectContaining({ skipErrorHandler: true }),
    );
  });

  it('使用 WebAuthn 完成 MFA', async () => {
    const credentialPayload = {
      id: 'mfa-credential-id',
      rawId: 'mfa-credential-id',
      response: { clientDataJSON: 'client-data' },
      type: 'public-key',
    };
    mocks.getMfaOptions.mockResolvedValueOnce({
      data: { request_options: { challenge: 'mfa-challenge' } },
    });
    mocks.parseOptions.mockReturnValueOnce({ challenge: new ArrayBuffer(1) });
    mocks.getCredential.mockResolvedValueOnce({
      toJSON: () => credentialPayload,
    });
    mocks.postMfa.mockResolvedValueOnce({});

    await authenticateMfaWithWebauthn();

    expect(mocks.getMfaOptions).toHaveBeenCalledWith(
      { client: 'browser' },
      expect.objectContaining({ skipErrorHandler: true }),
    );
    expect(mocks.postMfa).toHaveBeenCalledWith(
      { client: 'browser' },
      { credential: credentialPayload },
      expect.objectContaining({ skipErrorHandler: true }),
    );
  });

  it('浏览器无 toJSON 时手动序列化断言凭据', () => {
    const bytes = new Uint8Array([1, 2, 3]).buffer;
    const payload = serializePublicKeyCredential({
      id: 'credential-id',
      rawId: bytes,
      response: {
        authenticatorData: bytes,
        clientDataJSON: bytes,
        signature: bytes,
        userHandle: null,
      },
      type: 'public-key',
      getClientExtensionResults: () => ({ credProps: { rk: true } }),
    } as unknown as PublicKeyCredential);

    expect(payload).toEqual({
      id: 'credential-id',
      rawId: 'AQID',
      response: {
        authenticatorData: 'AQID',
        clientDataJSON: 'AQID',
        signature: 'AQID',
        userHandle: null,
      },
      type: 'public-key',
      clientExtensionResults: { credProps: { rk: true } },
    });
  });
});
