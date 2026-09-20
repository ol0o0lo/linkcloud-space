import { runtimeHttpClient } from '@/infra/http/runtime'

interface TotpSetupOut {
  secret: string
  totp_url: string
}

export interface AccountSecurityOverview {
  totpEnabled: boolean
}

export async function getAccountSecurityOverview(): Promise<AccountSecurityOverview> {
  const response = await runtimeHttpClient.requestRaw<TotpSetupOut>({
    url: '/api/users/me/mfa/totp-setup/',
    method: 'GET',
    scope: { kind: 'personal' },
    acceptedStatusCodes: [200, 409],
  })
  return { totpEnabled: response.statusCode === 409 }
}
