export interface AccountAuthenticator {
  type: string
  id?: number
  name?: string
  is_passwordless?: boolean
  created_at?: number
  last_used_at?: number | null
  total_code_count?: number
  unused_code_count?: number
}

export interface TotpSetup {
  secret: string
  totpUrl: string
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? value as Record<string, unknown> : null
}

export function normalizeAuthenticatorList(response: unknown): AccountAuthenticator[] {
  const data = record(response)?.data
  if (!Array.isArray(data))
    return []
  return data.filter((item): item is AccountAuthenticator => Boolean(record(item)?.type && typeof record(item)?.type === 'string'))
}

export function getTotpSetup(response: unknown): TotpSetup | null {
  const source = record(record(response)?.meta) || record(response)
  if (typeof source?.secret !== 'string' || typeof source.totp_url !== 'string')
    return null
  return { secret: source.secret, totpUrl: source.totp_url }
}

export function getRecoveryCodes(response: unknown): string[] {
  const codes = record(record(response)?.data)?.unused_codes
  return Array.isArray(codes) ? codes.map(code => String(code)) : []
}

function getFlows(response: unknown): Array<Record<string, unknown>> {
  const source = record(response)
  const data = record(source?.data)
  const flows = data?.flows || source?.flows
  return Array.isArray(flows) ? flows.filter((flow): flow is Record<string, unknown> => Boolean(record(flow))) : []
}

export function hasPendingReauthentication(response: unknown): boolean {
  return getFlows(response).some(flow => flow.is_pending === true && (flow.id === 'reauthenticate' || flow.id === 'mfa_reauthenticate'))
}

export function getAuthenticatorLabel(type: string): string {
  if (type === 'totp')
    return '动态验证码（TOTP）'
  if (type === 'recovery_codes')
    return '恢复码'
  if (type === 'webauthn')
    return '通行密钥（Passkey）'
  return '其他验证方式'
}

export function buildMfaDescription(authenticators: AccountAuthenticator[]): string {
  if (!authenticators.length)
    return '未启用'

  const types = new Set(authenticators.map(item => item.type))
  const parts: string[] = []
  if (types.has('totp'))
    parts.push(getAuthenticatorLabel('totp'))
  if (types.has('recovery_codes'))
    parts.push('恢复码')
  const passkeyCount = authenticators.filter(item => item.type === 'webauthn').length
  if (passkeyCount)
    parts.push(passkeyCount > 1 ? `${passkeyCount} 个通行密钥（Passkey）` : getAuthenticatorLabel('webauthn'))
  for (const type of Array.from(types)) {
    if (!['totp', 'recovery_codes', 'webauthn'].includes(type))
      parts.push(getAuthenticatorLabel(type))
  }
  return parts.length ? `已启用 ${parts.join('、')}` : '已启用'
}
