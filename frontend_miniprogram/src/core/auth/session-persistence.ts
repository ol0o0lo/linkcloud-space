import type { PendingAction } from '../../domain/pending-action'

export interface PersistedSessionState {
  sessionToken: string
  pendingAction: PendingAction | null
  wechatAutoLoginDisabled: boolean
}

function isPendingAction(value: unknown): value is PendingAction {
  if (!value || typeof value !== 'object')
    return false
  const action = value as Record<string, unknown>
  return typeof action.type === 'string'
    && Boolean(action.payload && typeof action.payload === 'object')
    && typeof action.redirect === 'string'
    && typeof action.createdAt === 'number'
}

export function isPersistedSessionState(value: unknown): value is PersistedSessionState {
  if (!value || typeof value !== 'object')
    return false
  const state = value as Record<string, unknown>
  return typeof state.sessionToken === 'string'
    && (state.pendingAction === null || isPendingAction(state.pendingAction))
    && typeof state.wechatAutoLoginDisabled === 'boolean'
}

export function migratePersistedSessionV1(value: unknown): PersistedSessionState {
  const legacy = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  return {
    sessionToken: typeof legacy.sessionToken === 'string' ? legacy.sessionToken : '',
    pendingAction: isPendingAction(legacy.pendingAction) ? legacy.pendingAction : null,
    wechatAutoLoginDisabled: false,
  }
}

export function migratePersistedSessionV0(value: unknown): PersistedSessionState {
  return migratePersistedSessionV1(value)
}
