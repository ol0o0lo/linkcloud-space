import assert from 'node:assert/strict'
import test from 'node:test'

import { createAutomaticLoginAttempt } from '../src/core/auth/automatic-login.ts'
import { isPersistedSessionState, migratePersistedSessionV1 } from '../src/core/auth/session-persistence.ts'

test('自动登录失败后同一运行周期不再重试', async () => {
  let loginCount = 0
  const automaticLogin = createAutomaticLoginAttempt({
    isDisabled: () => false,
    login: async () => {
      loginCount += 1
      throw new Error('微信登录失败')
    },
  })

  assert.equal(await automaticLogin(), false)
  assert.equal(await automaticLogin(), false)
  assert.equal(loginCount, 1)
})

test('用户主动退出后不执行自动登录', async () => {
  let loginCount = 0
  const automaticLogin = createAutomaticLoginAttempt({
    isDisabled: () => true,
    login: async () => {
      loginCount += 1
    },
  })

  assert.equal(await automaticLogin(), false)
  assert.equal(loginCount, 0)
})

test('旧会话缓存迁移后默认保持微信自动登录', () => {
  const migrated = migratePersistedSessionV1({ sessionToken: 'session-1', pendingAction: null })

  assert.deepEqual(migrated, {
    sessionToken: 'session-1',
    pendingAction: null,
    wechatAutoLoginDisabled: false,
  })
  assert.equal(isPersistedSessionState(migrated), true)
})
