import {
  getMfaWebauthnRequestOptions,
  getReauthWebauthnRequestOptions,
  submitMfaWebauthnCredential,
  submitReauthWebauthnCredential,
} from './client'

export interface WebAuthnSupport {
  supported: boolean
  reason: string
}

export function getWebAuthnSupport(): WebAuthnSupport {
  // #ifdef H5
  if (typeof window === 'undefined' || !window.isSecureContext)
    return { supported: false, reason: '通行密钥需要在安全网页（HTTPS）中使用' }
  const credentialApi = globalThis.PublicKeyCredential as typeof PublicKeyCredential & {
    parseCreationOptionsFromJSON?: (value: unknown) => PublicKeyCredentialCreationOptions
    parseRequestOptionsFromJSON?: (value: unknown) => PublicKeyCredentialRequestOptions
  }
  if (!credentialApi || !navigator.credentials?.get || !navigator.credentials?.create)
    return { supported: false, reason: '当前浏览器不支持通行密钥' }
  if (typeof credentialApi.parseCreationOptionsFromJSON !== 'function' || typeof credentialApi.parseRequestOptionsFromJSON !== 'function')
    return { supported: false, reason: '当前浏览器版本过低，暂不支持通行密钥' }
  return { supported: true, reason: '' }
  // #endif
  return { supported: false, reason: '当前平台不支持通行密钥' }
}

function arrayBufferToBase64Url(value: ArrayBuffer): string {
  const bytes = new Uint8Array(value)
  let binary = ''
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte)
  })
  return globalThis.btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
}

export function serializePublicKeyCredential(credential: PublicKeyCredential): Record<string, unknown> {
  if (typeof credential.toJSON === 'function')
    return credential.toJSON() as Record<string, unknown>

  const response = credential.response
  const basePayload = {
    id: credential.id,
    rawId: arrayBufferToBase64Url(credential.rawId),
    type: credential.type,
    clientExtensionResults: credential.getClientExtensionResults(),
  }
  if ('signature' in response) {
    const assertion = response as AuthenticatorAssertionResponse
    return {
      ...basePayload,
      response: {
        authenticatorData: arrayBufferToBase64Url(assertion.authenticatorData),
        clientDataJSON: arrayBufferToBase64Url(assertion.clientDataJSON),
        signature: arrayBufferToBase64Url(assertion.signature),
        userHandle: assertion.userHandle ? arrayBufferToBase64Url(assertion.userHandle) : null,
      },
    }
  }

  const attestation = response as AuthenticatorAttestationResponse
  const publicKey = attestation.getPublicKey?.()
  const authenticatorData = attestation.getAuthenticatorData?.()
  return {
    ...basePayload,
    response: {
      attestationObject: arrayBufferToBase64Url(attestation.attestationObject),
      clientDataJSON: arrayBufferToBase64Url(attestation.clientDataJSON),
      transports: attestation.getTransports?.() || [],
      publicKeyAlgorithm: attestation.getPublicKeyAlgorithm?.(),
      publicKey: publicKey ? arrayBufferToBase64Url(publicKey) : null,
      authenticatorData: authenticatorData ? arrayBufferToBase64Url(authenticatorData) : undefined,
    },
  }
}

function responseData(response: unknown, key: 'creation_options' | 'request_options'): unknown {
  const root = response && typeof response === 'object' ? response as Record<string, any> : {}
  return root.data?.[key] || root[key]
}

function ensureSupport(): void {
  const support = getWebAuthnSupport()
  if (!support.supported)
    throw new Error(support.reason)
}

export async function createWebauthnCredential(response: unknown): Promise<Record<string, unknown>> {
  ensureSupport()
  const parse = (globalThis.PublicKeyCredential as any).parseCreationOptionsFromJSON
  const creationOptions = responseData(response, 'creation_options')
  if (!creationOptions)
    throw new Error('未获取到通行密钥创建信息')
  const credential = await navigator.credentials.create({ publicKey: parse(creationOptions) })
  if (!credential)
    throw new Error('未能创建通行密钥')
  return serializePublicKeyCredential(credential as PublicKeyCredential)
}

async function requestWebauthnCredential(response: unknown): Promise<Record<string, unknown>> {
  ensureSupport()
  const parse = (globalThis.PublicKeyCredential as any).parseRequestOptionsFromJSON
  const requestOptions = responseData(response, 'request_options')
  if (!requestOptions)
    throw new Error('未获取到通行密钥验证信息')
  const credential = await navigator.credentials.get({ publicKey: parse(requestOptions) })
  if (!credential)
    throw new Error('未能完成通行密钥验证')
  return serializePublicKeyCredential(credential as PublicKeyCredential)
}

export async function authenticateMfaWithPasskey(sessionToken: string) {
  const options = await getMfaWebauthnRequestOptions(sessionToken)
  return submitMfaWebauthnCredential(await requestWebauthnCredential(options), sessionToken)
}

export async function reauthenticateWithPasskey() {
  const options = await getReauthWebauthnRequestOptions()
  return submitReauthWebauthnCredential(await requestWebauthnCredential(options))
}
