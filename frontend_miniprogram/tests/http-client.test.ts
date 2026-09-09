import assert from 'node:assert/strict'
import test from 'node:test'

import { AppError } from '../src/core/errors/app-error.ts'
import { createHttpClient } from '../src/infra/http/client.ts'

test('HTTP 客户端统一解析地址、作用域请求头和成功信封', async () => {
  const requests: unknown[] = []
  const client = createHttpClient({
    getSessionToken: () => 'session-1',
    resolveUrl: path => `https://api.example.com${path}`,
    transport: async (request) => {
      requests.push(request)
      return { statusCode: 200, data: { code: 0, data: { id: 1 } } }
    },
  })

  assert.deepEqual(await client.request<{ id: number }>({
    url: '/api/users/me/',
    method: 'GET',
    scope: { kind: 'organization', organizationSlug: 'alpha' },
  }), { id: 1 })
  assert.deepEqual(requests, [{
    url: 'https://api.example.com/api/users/me/',
    method: 'GET',
    headers: {
      'X-Org-Slug': 'alpha',
      'X-Session-Token': 'session-1',
    },
    timeoutMs: 60000,
  }])
})

test('HTTP 客户端将业务失败和会话失效统一转换为 AppError', async () => {
  let invalidated = 0
  const client = createHttpClient({
    getSessionToken: () => 'expired-session',
    resolveUrl: path => path,
    onSessionInvalidated: () => invalidated += 1,
    transport: async () => ({ statusCode: 401, data: { code: 401, message: '登录已失效' } }),
  })

  await assert.rejects(
    () => client.request({ url: '/api/users/me/', scope: { kind: 'personal' } }),
    (error: unknown) => error instanceof AppError && error.kind === 'unauthenticated' && error.message === '登录已失效',
  )
  assert.equal(invalidated, 1)
})

test('HTTP 客户端保留传输层失败原因并归一化为可重试网络错误', async () => {
  const cause = new Error('socket closed')
  const client = createHttpClient({
    getSessionToken: () => '',
    resolveUrl: path => path,
    transport: async () => Promise.reject(cause),
  })

  await assert.rejects(
    () => client.request({ url: '/api/public/houses/', scope: { kind: 'public' } }),
    (error: unknown) => error instanceof AppError && error.kind === 'network' && error.retryable && error.cause === cause,
  )
})

test('认证流程可复用同一客户端读取原始响应并显式覆盖流程 token', async () => {
  let invalidated = 0
  const client = createHttpClient({
    getSessionToken: () => 'current-session',
    resolveUrl: path => path,
    onSessionInvalidated: () => invalidated += 1,
    transport: async request => ({ statusCode: 401, data: { meta: { session_token: request.headers['X-Session-Token'] } } }),
  })

  const response = await client.requestRaw<{ meta: { session_token: string } }>({
    url: '/api/allauth/app/v1/auth/code/confirm',
    method: 'POST',
    scope: { kind: 'public' },
    sessionToken: 'login-flow-token',
    acceptedStatusCodes: [200, 401],
    invalidateSessionOnUnauthorized: false,
  })

  assert.equal(response.statusCode, 401)
  assert.equal(response.data.meta.session_token, 'login-flow-token')
  assert.equal(invalidated, 0)
})

test('安全请求会在会话恢复成功后使用新 token 重放一次', async () => {
  let sessionToken = 'expired-session'
  let recoveryCount = 0
  const receivedTokens: string[] = []
  const client = createHttpClient({
    getSessionToken: () => sessionToken,
    resolveUrl: path => path,
    recoverSession: async () => {
      recoveryCount += 1
      sessionToken = 'renewed-session'
      return true
    },
    transport: async (request) => {
      receivedTokens.push(request.headers['X-Session-Token'])
      if (request.headers['X-Session-Token'] === 'expired-session')
        return { statusCode: 401, data: { code: 401, message: '登录已失效' } }
      return { statusCode: 200, data: { code: 0, data: { id: 1 } } }
    },
  })

  assert.deepEqual(await client.request<{ id: number }>({
    url: '/api/users/me/',
    method: 'GET',
    scope: { kind: 'personal' },
  }), { id: 1 })
  assert.equal(recoveryCount, 1)
  assert.deepEqual(receivedTokens, ['expired-session', 'renewed-session'])
})

test('敏感写请求即使恢复会话也不自动重放', async () => {
  let transportCount = 0
  let recoveryCount = 0
  const client = createHttpClient({
    getSessionToken: () => 'expired-session',
    resolveUrl: path => path,
    recoverSession: async () => {
      recoveryCount += 1
      return true
    },
    transport: async () => {
      transportCount += 1
      return { statusCode: 401, data: { code: 401, message: '登录已失效' } }
    },
  })

  await assert.rejects(
    () => client.request({
      url: '/api/payments/confirm/',
      method: 'POST',
      scope: { kind: 'personal' },
      authRetry: 'never',
    }),
    (error: unknown) => error instanceof AppError && error.kind === 'unauthenticated',
  )
  assert.equal(recoveryCount, 1)
  assert.equal(transportCount, 1)
})

test('并发请求只执行一次全局会话恢复', async () => {
  let sessionToken = 'expired-session'
  let recoveryCount = 0
  let releaseRecovery: (() => void) | undefined
  const receivedTokens: string[] = []
  const client = createHttpClient({
    getSessionToken: () => sessionToken,
    resolveUrl: path => path,
    recoverSession: async () => {
      recoveryCount += 1
      await new Promise<void>((resolve) => {
        releaseRecovery = resolve
      })
      sessionToken = 'renewed-session'
      return true
    },
    transport: async (request) => {
      receivedTokens.push(request.headers['X-Session-Token'])
      if (request.headers['X-Session-Token'] === 'expired-session')
        return { statusCode: 401, data: { code: 401, message: '登录已失效' } }
      return { statusCode: 200, data: { code: 0, data: { ok: true } } }
    },
  })

  const first = client.request({ url: '/api/users/me/', scope: { kind: 'personal' } })
  const second = client.request({ url: '/api/notifications/', scope: { kind: 'personal' } })
  await new Promise(resolve => setImmediate(resolve))
  releaseRecovery?.()
  await Promise.all([first, second])

  assert.equal(recoveryCount, 1)
  assert.equal(receivedTokens.filter(token => token === 'expired-session').length, 2)
  assert.equal(receivedTokens.filter(token => token === 'renewed-session').length, 2)
})

test('业务信封中的 410 同样触发会话失效处理', async () => {
  let invalidated = 0
  const client = createHttpClient({
    getSessionToken: () => 'expired-session',
    resolveUrl: path => path,
    onSessionInvalidated: () => invalidated += 1,
    transport: async () => ({ statusCode: 200, data: { code: 410, message: '会话已过期' } }),
  })

  await assert.rejects(
    () => client.request({ url: '/api/users/me/', scope: { kind: 'personal' } }),
    (error: unknown) => error instanceof AppError && error.kind === 'unauthenticated',
  )
  assert.equal(invalidated, 1)
})
