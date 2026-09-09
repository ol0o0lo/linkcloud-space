import { resolveApiUrl } from '@/core/config/runtime'
import { createHttpClient } from './client'
import { uniHttpTransport } from './uni-transport'

export interface HttpRuntimeHooks {
  getSessionToken: () => string
  onSessionInvalidated: () => void
  recoverSession: () => Promise<boolean>
}

let hooks: HttpRuntimeHooks = {
  getSessionToken: () => '',
  onSessionInvalidated: () => undefined,
  recoverSession: async () => false,
}

export function configureHttpRuntime(nextHooks: HttpRuntimeHooks) {
  hooks = nextHooks
}

export function getHttpSessionToken(): string {
  return hooks.getSessionToken()
}

export const runtimeHttpClient = createHttpClient({
  transport: uniHttpTransport,
  getSessionToken: () => hooks.getSessionToken(),
  resolveUrl: resolveApiUrl,
  onSessionInvalidated: () => hooks.onSessionInvalidated(),
  recoverSession: () => hooks.recoverSession(),
})
