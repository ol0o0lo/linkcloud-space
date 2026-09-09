export type PendingActionType = string

export interface PendingAction<TPayload = unknown> {
  type: PendingActionType
  payload: TPayload
  redirect: string
  createdAt: number
  version: number
}

export interface PendingActionHandler<TPayload> {
  version: number
  validate: (payload: unknown) => payload is TPayload
  execute: (payload: TPayload, action: PendingAction<TPayload>) => Promise<unknown> | unknown
}

export type PendingActionHandlers = Record<string, PendingActionHandler<never>>

const PENDING_ACTION_TTL = 15 * 60 * 1000

export function createPendingAction<TPayload>(type: PendingActionType, payload: TPayload, redirect: string, createdAt = Date.now(), version = 1): PendingAction<TPayload> {
  return { type, payload, redirect, createdAt, version }
}

export function takePendingAction(pending: PendingAction | null, now = Date.now()): { action: PendingAction | null, next: null } {
  if (!pending || now - pending.createdAt > PENDING_ACTION_TTL)
    return { action: null, next: null }
  return { action: pending, next: null }
}

export function createPendingActionRegistry(handlers: Record<string, PendingActionHandler<any>>) {
  return {
    async consume(pending: PendingAction | null, now = Date.now()): Promise<{ executed: boolean, next: null }> {
      const { action } = takePendingAction(pending, now)
      if (!action)
        return { executed: false, next: null }
      const handler = handlers[action.type]
      if (!handler || action.version !== handler.version || !handler.validate(action.payload))
        return { executed: false, next: null }
      await handler.execute(action.payload, action)
      return { executed: true, next: null }
    },
  }
}
