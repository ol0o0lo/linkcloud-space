import {
  getBrowserV1AuthWebauthnAuthenticate,
  getBrowserV1AuthWebauthnLogin,
  postBrowserV1AuthWebauthnAuthenticate,
  postBrowserV1AuthWebauthnLogin,
} from '@/services/allauth/authWebauthnLogin';

const WEBAUTHN_REQUEST_OPTIONS = {
  credentials: 'include',
  skipErrorHandler: true,
} as const;

type WebAuthnCredentialPayload = Record<string, unknown>;

function arrayBufferToBase64Url(value: ArrayBuffer) {
  const bytes = new Uint8Array(value);
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary)
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/u, '');
}

export function serializePublicKeyCredential(
  credential: PublicKeyCredential,
): WebAuthnCredentialPayload {
  if (typeof credential.toJSON === 'function') {
    return credential.toJSON() as unknown as WebAuthnCredentialPayload;
  }

  const response = credential.response as AuthenticatorAssertionResponse;
  return {
    id: credential.id,
    rawId: arrayBufferToBase64Url(credential.rawId),
    response: {
      authenticatorData: arrayBufferToBase64Url(response.authenticatorData),
      clientDataJSON: arrayBufferToBase64Url(response.clientDataJSON),
      signature: arrayBufferToBase64Url(response.signature),
      userHandle: response.userHandle
        ? arrayBufferToBase64Url(response.userHandle)
        : null,
    },
    type: credential.type,
    clientExtensionResults: credential.getClientExtensionResults(),
  };
}

function parseRequestOptions(response: unknown) {
  const requestOptions =
    (response as any)?.data?.request_options ||
    (response as any)?.request_options;
  const parse = globalThis.PublicKeyCredential?.parseRequestOptionsFromJSON;
  if (!requestOptions || typeof parse !== 'function') {
    throw new Error('当前浏览器不支持通行密钥登录');
  }
  return parse(requestOptions as PublicKeyCredentialRequestOptionsJSON);
}

async function requestCredential(response: unknown) {
  if (!navigator.credentials?.get) {
    throw new Error('当前浏览器不支持通行密钥登录');
  }
  const credential = await navigator.credentials.get({
    publicKey: parseRequestOptions(response),
  });
  if (!credential) {
    throw new Error('未获取到通行密钥凭据');
  }
  return serializePublicKeyCredential(credential as PublicKeyCredential);
}

export async function loginWithPasskey() {
  const options = await getBrowserV1AuthWebauthnLogin(
    { client: 'browser' },
    WEBAUTHN_REQUEST_OPTIONS as any,
  );
  const credential = await requestCredential(options);
  return postBrowserV1AuthWebauthnLogin(
    { client: 'browser' },
    { credential },
    WEBAUTHN_REQUEST_OPTIONS as any,
  );
}

export async function authenticateMfaWithWebauthn() {
  const options = await getBrowserV1AuthWebauthnAuthenticate(
    { client: 'browser' },
    WEBAUTHN_REQUEST_OPTIONS as any,
  );
  const credential = await requestCredential(options);
  return postBrowserV1AuthWebauthnAuthenticate(
    { client: 'browser' },
    { credential },
    WEBAUTHN_REQUEST_OPTIONS as any,
  );
}
