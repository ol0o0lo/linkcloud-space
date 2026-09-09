import assert from 'node:assert/strict'
import test from 'node:test'

import { createVersionedStorage } from '../src/infra/storage/versioned-storage.ts'

function createMemoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial))
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
    readRaw: (key: string) => values.get(key) ?? null,
  }
}

interface SessionState {
  sessionToken: string
  pendingAction: null
}

function isSessionState(value: unknown): value is SessionState {
  if (!value || typeof value !== 'object')
    return false
  const state = value as Record<string, unknown>
  return typeof state.sessionToken === 'string' && state.pendingAction === null
}

test('读取旧版本时按顺序迁移并回写当前版本', () => {
  const storage = createMemoryStorage({
    session: JSON.stringify({ version: 1, data: { token: 'legacy-token' } }),
  })
  const sessionStorage = createVersionedStorage<SessionState>({
    key: 'session',
    version: 2,
    storage,
    validate: isSessionState,
    migrations: {
      1: value => ({ sessionToken: (value as { token: string }).token, pendingAction: null }),
    },
  })

  assert.deepEqual(sessionStorage.read(), { sessionToken: 'legacy-token', pendingAction: null })
  assert.equal(storage.readRaw('session'), JSON.stringify({ version: 2, data: { sessionToken: 'legacy-token', pendingAction: null } }))
})

test('损坏、未来版本或迁移后仍无效的数据安全回退并清理', () => {
  for (const raw of ['not-json', JSON.stringify({ version: 99, data: {} }), JSON.stringify({ version: 2, data: { sessionToken: 1 } })]) {
    const storage = createMemoryStorage({ session: raw })
    const sessionStorage = createVersionedStorage<SessionState>({
      key: 'session',
      version: 2,
      storage,
      validate: isSessionState,
      migrations: {},
    })

    assert.equal(sessionStorage.read(), null)
    assert.equal(storage.readRaw('session'), null)
  }
})

test('写入只持久化带当前 schema 版本的有效数据', () => {
  const storage = createMemoryStorage()
  const sessionStorage = createVersionedStorage<SessionState>({
    key: 'session',
    version: 2,
    storage,
    validate: isSessionState,
    migrations: {},
  })

  sessionStorage.write({ sessionToken: 'session-2', pendingAction: null })
  assert.equal(storage.readRaw('session'), JSON.stringify({ version: 2, data: { sessionToken: 'session-2', pendingAction: null } }))
  assert.throws(() => sessionStorage.write({ sessionToken: 1 } as unknown as SessionState), /持久化数据不符合 schema/)
})

test('未带版本号的旧 Pinia 数据可以声明为 v0 后迁移', () => {
  const storage = createMemoryStorage({
    session: JSON.stringify({ token: 'pinia-token' }),
  })
  const sessionStorage = createVersionedStorage<SessionState>({
    key: 'session',
    version: 1,
    legacyVersion: 0,
    storage,
    validate: isSessionState,
    migrations: {
      0: value => ({ sessionToken: (value as { token: string }).token, pendingAction: null }),
    },
  })

  assert.deepEqual(sessionStorage.read(), { sessionToken: 'pinia-token', pendingAction: null })
})
