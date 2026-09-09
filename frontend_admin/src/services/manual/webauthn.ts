import {
  getBrowserV1AuthWebauthnAuthenticate,
  getBrowserV1AuthWebauthnLogin,
  getBrowserV1AuthWebauthnReauthenticate,
  postBrowserV1AuthWebauthnAuthenticate,
  postBrowserV1AuthWebauthnLogin,
  postBrowserV1AuthWebauthnReauthenticate,
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

  const response = credential.response;
  const basePayload = {
    id: credential.id,
    rawId: arrayBufferToBase64Url(credential.rawId),
    type: credential.type,
    clientExtensionResults: credential.getClientExtensionResults(),
  };

  if ('signature' in response) {
    const assertion = response as AuthenticatorAssertionResponse;
    return {
      ...basePayload,
      response: {
        authenticatorData: arrayBufferToBase64Url(assertion.authenticatorData),
        clientDataJSON: arrayBufferToBase64Url(assertion.clientDataJSON),
        signature: arrayBufferToBase64Url(assertion.signature),
        userHandle: assertion.userHandle
          ? arrayBufferToBase64Url(assertion.userHandle)
          : null,
      },
    };
  }

  const attestation = response as AuthenticatorAttestationResponse;
  return {
    ...basePayload,
    response: {
      attestationObject: arrayBufferToBase64Url(attestation.attestationObject),
      clientDataJSON: arrayBufferToBase64Url(attestation.clientDataJSON),
      transports: attestation.getTransports?.() || [],
      publicKeyAlgorithm: attestation.getPublicKeyAlgorithm?.(),
      publicKey: attestation.getPublicKey?.()
        ? arrayBufferToBase64Url(attestation.getPublicKey() as ArrayBuffer)
        : null,
      authenticatorData: attestation.getAuthenticatorData?.()
        ? arrayBufferToBase64Url(attestation.getAuthenticatorData())
        : undefined,
    },
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

function parseCreationOptions(response: unknown) {
  const creationOptions =
    (response as any)?.data?.creation_options ||
    (response as any)?.creation_options;
  const parse = (globalThis.PublicKeyCredential as any)
    ?.parseCreationOptionsFromJSON;
  if (!creationOptions || typeof parse !== 'function') {
    throw new Error('当前浏览器不支持创建通行密钥');
  }
  return parse(creationOptions);
}

export async function createWebauthnCredential(response: unknown) {
  if (!navigator.credentials?.create) {
    throw new Error('当前浏览器不支持创建通行密钥');
  }
  const credential = await navigator.credentials.create({
    publicKey: parseCreationOptions(response),
  });
  if (!credential) {
    throw new Error('未创建通行密钥凭据');
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

export async function reauthenticateWithWebauthn() {
  const options = await getBrowserV1AuthWebauthnReauthenticate(
    { client: 'browser' },
    WEBAUTHN_REQUEST_OPTIONS as any,
  );
  const credential = await requestCredential(options);
  return postBrowserV1AuthWebauthnReauthenticate(
    { client: 'browser' },
    { credential },
    WEBAUTHN_REQUEST_OPTIONS as any,
  );
}
