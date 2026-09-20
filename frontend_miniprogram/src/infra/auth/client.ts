import type { AllauthResponse } from '@/domain/auth'
import { getAllauthErrorMessage } from '@/domain/auth'
import { runtimeHttpClient } from '@/infra/http/runtime'
import { AppError } from '@/core/errors/app-error'
import { platform } from '@/platform'

export class AuthRequestError extends Error {
  statusCode: number
  response: AllauthResponse<unknown>

  constructor(statusCode: number, response: AllauthResponse<unknown>) {
    super(getAllauthErrorMessage(response))
    this.name = 'AuthRequestError'
    this.statusCode = statusCode
    this.response = response
  }
}

interface AuthRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  data?: Record<string, unknown>
  sessionToken?: string
  acceptedStatusCodes?: number[]
}

async function authRequest<TUser = Record<string, unknown>>(path: string, options: AuthRequestOptions = {}): Promise<AllauthResponse<TUser>> {
  const acceptedStatusCodes = options.acceptedStatusCodes || [200]
  const response = await runtimeHttpClient.requestRaw<AllauthResponse<TUser>, Record<string, unknown>>({
    url: path,
    method: options.method || 'GET',
    body: options.data,
    scope: { kind: 'public' },
    sessionToken: options.sessionToken || '',
    acceptedStatusCodes: [200, 201, 202, 204, 400, 401, 403, 404, 409, 410, 422],
    invalidateSessionOnUnauthorized: false,
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
  })
  if (!acceptedStatusCodes.includes(response.statusCode))
    throw new AuthRequestError(response.statusCode, response.data)
  return response.data
}

export interface AllauthUser {
  id: number
  email?: string
  username?: string
  display?: string
}

export interface WechatMiniprogramConnection {
  connected: boolean
}

export function getAuthSession(sessionToken: string) {
  return authRequest<AllauthUser>('/api/allauth/app/v1/auth/session', { sessionToken })
}

export function logoutAuthSession(sessionToken: string) {
  return authRequest('/api/allauth/app/v1/auth/session', { method: 'DELETE', sessionToken })
}

export function loginWithPhonePassword(phoneCountryCode: string, phoneNationalNumber: string, password: string) {
  return authRequest<AllauthUser>('/api/allauth/app/v1/auth/login', {
    method: 'POST',
    data: {
      phone: `${phoneCountryCode.trim()}${phoneNationalNumber.trim()}`,
      password,
    },
    acceptedStatusCodes: [200, 401],
  })
}

export function loginWithWechatCode(code: string) {
  return authRequest<AllauthUser>('/api/allauth/app/v1/auth/provider/token', {
    method: 'POST',
    data: {
      provider: 'wechat_miniprogram',
      process: 'login',
      token: {
        client_id: import.meta.env.VITE_WX_APPID,
        id_token: code,
      },
    },
    acceptedStatusCodes: [200, 401],
  })
}

export function requestPhoneLoginCode(phoneCountryCode: string, phoneNationalNumber: string) {
  return authRequest('/api/users/auth/app/code/request/', {
    method: 'POST',
    data: {
      phone_country_code: phoneCountryCode,
      phone_national_number: phoneNationalNumber,
    },
    acceptedStatusCodes: [200, 401],
  })
}

export function confirmPhoneLoginCode(code: string, sessionToken: string) {
  return authRequest<AllauthUser>('/api/allauth/app/v1/auth/code/confirm', {
    method: 'POST',
    data: { code },
    sessionToken,
    acceptedStatusCodes: [200, 401],
  })
}

export function getWechatLoginCode(): Promise<string> {
  return platform.auth.getLoginCredential().then((result) => {
    if ('reason' in result)
      throw new AppError({ kind: 'business', message: result.reason })
    return result.value
  })
}

export function connectCurrentWechatMiniprogram(code: string) {
  return runtimeHttpClient.request<WechatMiniprogramConnection, { code: string }>({
    url: '/api/users/me/wechat-miniprogram/',
    method: 'POST',
    authRetry: 'never',
    scope: { kind: 'personal' },
    body: { code },
  })
}
