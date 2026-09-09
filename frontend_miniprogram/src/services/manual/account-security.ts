import type { AccountAuthenticator } from '@/domain/account-security'
import {
  hasPendingReauthentication,
  normalizeAuthenticatorList,
  getRecoveryCodes as parseRecoveryCodes,
  getTotpSetup as parseTotpSetup,
} from '@/domain/account-security'
import {
  activateAccountTotp,
  addAccountWebauthn,
  AuthRequestError,
  getAccountRecoveryCodes,
  getAccountTotpStatus,
  getAccountWebauthnCreationOptions,
  listAccountAuthenticators,
  reauthenticateAccount,
  removeAccountWebauthn,
  updateAccountWebauthn,
} from '@/infra/auth/client'
import { createWebauthnCredential, getWebAuthnSupport, reauthenticateWithPasskey } from '@/infra/auth/webauthn'
import { usersMeMfaAuthenticatorsAuthenticatorTypeUsingDelete } from '@/services/openapi/zhanghu'

function personalWriteOptions() {
  return { requestScope: { kind: 'personal' as const }, authRetry: 'never' as const }
}

export async function listAuthenticators(): Promise<AccountAuthenticator[]> {
  return normalizeAuthenticatorList(await listAccountAuthenticators())
}

export async function startTotpSetup() {
  const setup = parseTotpSetup(await getAccountTotpStatus())
  if (!setup)
    throw new Error('动态验证码已启用，或未获取到初始化信息')
  return setup
}

export async function activateTotp(code: string) {
  const response = await activateAccountTotp(code)
  return { recoveryCodesGenerated: Boolean(response.meta?.recovery_codes_generated) }
}

export async function viewRecoveryCodes(): Promise<string[]> {
  return parseRecoveryCodes(await getAccountRecoveryCodes())
}

export function reauthenticate(password: string) {
  return reauthenticateAccount(password)
}

export function isReauthenticationRequired(error: unknown): boolean {
  return error instanceof AuthRequestError && hasPendingReauthentication(error.response)
}

export function deleteAuthenticator(type: string) {
  return usersMeMfaAuthenticatorsAuthenticatorTypeUsingDelete({ params: { authenticator_type: type }, options: personalWriteOptions() })
}

export async function createPasskey(name: string) {
  const options = await getAccountWebauthnCreationOptions()
  const response = await addAccountWebauthn(name.trim(), await createWebauthnCredential(options))
  return { recoveryCodesGenerated: Boolean(response.meta?.recovery_codes_generated) }
}

export function renamePasskey(id: number, name: string) {
  return updateAccountWebauthn(id, name.trim())
}

export function deletePasskey(id: number) {
  return removeAccountWebauthn([id])
}

export { getWebAuthnSupport, reauthenticateWithPasskey }
