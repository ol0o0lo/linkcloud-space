export interface AllauthError {
  message?: string
  code?: string
  param?: string
}

export interface AllauthFlow {
  id: string
  is_pending?: true
  types?: string[]
}

export interface AllauthResponse<TUser = unknown> {
  data?: {
    user?: TUser | null
    flows?: AllauthFlow[]
    [key: string]: unknown
  }
  meta?: {
    session_token?: string
    [key: string]: unknown
  }
  errors?: AllauthError[]
  detail?: string
  [key: string]: unknown
}

export function getAllauthSessionToken(response: AllauthResponse<unknown>): string {
  return response.meta?.session_token || ''
}

export function getAllauthUser<TUser>(response: AllauthResponse<TUser>): TUser | null {
  return response.data?.user || null
}

export function getAllauthErrorMessage(response: AllauthResponse<unknown>): string {
  return response.errors?.find(error => error.message)?.message
    || response.detail
    || '请求失败，请稍后重试'
}

export function isInvalidAllauthSessionStatus(statusCode: number): boolean {
  // allauth app 端对缺失会话返回 401，对已失效/未知 session token 返回 410。
  return statusCode === 401 || statusCode === 410
}

export function getPendingMfaFlow(response: AllauthResponse<unknown>): AllauthFlow | null {
  const flows = response.data?.flows
  if (!Array.isArray(flows))
    return null
  return flows.find(flow => flow.id === 'mfa_authenticate' && flow.is_pending === true) || null
}

export function getPendingMfaTypes(response: AllauthResponse<unknown>): string[] {
  const types = getPendingMfaFlow(response)?.types
  return Array.isArray(types) ? types.filter(type => typeof type === 'string') : []
}
