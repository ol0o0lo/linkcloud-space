function base64UrlToBuffer(value: string) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/');
  const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4));
  const binary = window.atob(padded + pad);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

function bufferToBase64Url(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';

  for (let i = 0; i < bytes.byteLength; i += 1) {
    binary += String.fromCharCode(bytes[i]!);
  }

  return window.btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function unwrap<T>(options: { publicKey?: T } | T) {
  if (
    options &&
    typeof options === 'object' &&
    'publicKey' in options &&
    options.publicKey
  ) {
    return options.publicKey;
  }
  return options as T;
}

function decodeRequestOptions(options: any) {
  const inner = unwrap(options);
  const decoded = {
    ...inner,
    challenge: base64UrlToBuffer(inner.challenge),
  };

  if (inner.allowCredentials) {
    decoded.allowCredentials = inner.allowCredentials.map((item: any) => ({
      ...item,
      id: base64UrlToBuffer(item.id),
    }));
  }

  return decoded;
}

function encodeCredential(credential: PublicKeyCredential) {
  const response = credential.response as AuthenticatorAssertionResponse;

  return {
    authenticatorAttachment: credential.authenticatorAttachment ?? null,
    clientExtensionResults: credential.getClientExtensionResults?.() ?? {},
    id: credential.id,
    rawId: bufferToBase64Url(credential.rawId),
    response: {
      authenticatorData: bufferToBase64Url(response.authenticatorData),
      clientDataJSON: bufferToBase64Url(response.clientDataJSON),
      signature: bufferToBase64Url(response.signature),
      userHandle: response.userHandle ? bufferToBase64Url(response.userHandle) : null,
    },
    type: credential.type,
  };
}

export async function getPasskeyAssertion(requestOptionsJson: any) {
  const publicKey = decodeRequestOptions(requestOptionsJson);
  const credential = (await navigator.credentials.get({
    publicKey,
  })) as PublicKeyCredential | null;

  if (!credential) {
    throw new Error('未获取到 Passkey 凭据。');
  }

  return encodeCredential(credential);
}

export function isWebAuthnSupported() {
  return (
    typeof window !== 'undefined' &&
    typeof window.PublicKeyCredential !== 'undefined' &&
    typeof navigator.credentials?.get === 'function'
  );
}
