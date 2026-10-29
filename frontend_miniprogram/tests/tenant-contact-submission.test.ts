import assert from 'node:assert/strict'
import test from 'node:test'
import type { TenantContactRequestIn, TenantContactRequestOut } from '../src/services/manual/tenant-rental.ts'
import type { TenantContactDraft, TenantContactSubmissionState } from '../src/features/tenant-rental/contact-submission.ts'
import type { HttpTransportResponse } from '../src/infra/http/client.ts'
import { recoverAuthenticatedSession } from '../src/core/auth/session-recovery.ts'
import { createTenantContactSubmissionController, tenantContactSendOptions } from '../src/features/tenant-rental/contact-submission.ts'
import { createHttpClient } from '../src/infra/http/client.ts'
import { getConversationRoute } from '../src/modules/routes.ts'

const draft: TenantContactDraft = { house_id: 42, channels: ['phone', 'wechat'], phone: '13800138000', wechat: 'tenant-wechat' }
const tick = () => new Promise<void>(resolve => setImmediate(resolve))

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (cause: unknown) => void
  const promise = new Promise<T>((accept, fail) => {
    resolve = accept
    reject = fail
  })
  return { promise, resolve, reject }
}

function receipt(payload: TenantContactRequestIn): TenantContactRequestOut {
  return {
    notification_id: null,
    inquiry_id: 10,
    conversation: {
      id: 8,
      organization: { id: 6, slug: 'house-organization', name: '房源组织' },
      namespace: 'house.contact',
      context_key: '42',
      status: 'active',
      status__mapping: '进行中',
      members: [{ id: 1, user_id: 1, display_name: '租客', access_kind: 'business_party' }, { id: 2, user_id: 2, display_name: '接待', access_kind: 'organization_member' }],
      last_message: null,
      my_member_id: 1,
      my_last_read_seq: 0,
      unread_count: 0,
      can_send: true,
      send_block_reason: '',
      send_block_reason__mapping: '',
    },
    message: { id: 9, conversation_id: 8, seq: 1, sender_member_id: 1, client_message_id: payload.client_message_id, content: `房源 42\n手机号：${payload.phone}\n微信号：${payload.wechat}`, created_at: '2026-10-24T08:30:00Z' },
  }
}

test('发送完成收到真实消息后进入房源组织个人聊天，重复打开不再发消息', async () => {
  const requests: TenantContactRequestIn[] = []
  const routes: string[] = []
  let contactVisible = true
  let state!: TenantContactSubmissionState
  const controller = createTenantContactSubmissionController(async (payload, userId) => {
    assert.equal(userId, 1)
    requests.push(payload)
    return receipt(payload)
  }, async (url) => {
    assert.equal(contactVisible, false)
    routes.push(url)
  }, value => state = value, visible => contactVisible = visible)
  controller.setContext(1, draft)
  await controller.submit()
  assert.equal(requests.length, 1)
  assert.match(requests[0].client_message_id, /^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i)
  assert.match(state.result?.message?.content || '', /房源 42\n手机号：13800138000\n微信号：tenant-wechat/)
  assert.equal(state.notice, '联系方式已发送')
  assert.deepEqual(routes, [getConversationRoute(8, 'house-organization', 'business_party')])
  assert.equal(contactVisible, false)
  await controller.submit()
  assert.equal(requests.length, 1)
  assert.equal(routes.length, 2)
})

test('连击只发送一次，超时后同正文重试复用 UUID', async () => {
  const sending = deferred<TenantContactRequestOut>()
  const requests: TenantContactRequestIn[] = []
  let state!: TenantContactSubmissionState
  const controller = createTenantContactSubmissionController((payload) => {
    requests.push(payload)
    return requests.length === 1 ? sending.promise : Promise.resolve(receipt(payload))
  }, async () => {}, value => state = value)
  controller.setContext(1, draft)
  const first = controller.submit()
  await controller.submit()
  assert.equal(state.sending, true)
  assert.equal(requests.length, 1)
  sending.reject(new Error('请求超时'))
  await first
  assert.equal(state.sending, false)
  assert.equal(state.error, '请求超时')
  controller.setContext(1, { ...draft })
  await controller.submit()
  assert.deepEqual(requests[1], requests[0])
  assert.equal(state.error, '')
})

test('输入修改后改回、换房源后换回、换账号后换回都生成新 UUID', async () => {
  const requests: TenantContactRequestIn[] = []
  const controller = createTenantContactSubmissionController(async (payload) => {
    requests.push(payload)
    throw new Error('请求超时')
  }, async () => {}, () => {})
  controller.setContext(1, draft)
  await controller.submit()
  for (const [userId, changed] of [[1, { ...draft, phone: '13900139000' }], [1, { ...draft, house_id: 43 }], [2, draft]] as const) {
    controller.setContext(userId, changed)
    controller.setContext(1, draft)
    await controller.submit()
  }
  assert.equal(new Set(requests.map(item => item.client_message_id)).size, 4)
})

test('旧输入、旧房源和旧账号的发送回执不导航，也不覆盖当前结果', async () => {
  for (const [userId, changed] of [[1, { ...draft, wechat: 'new-wechat' }], [1, { ...draft, house_id: 43 }], [2, draft]] as const) {
    const sending = deferred<TenantContactRequestOut>()
    const routes: string[] = []
    let state!: TenantContactSubmissionState
    let payload!: TenantContactRequestIn
    const controller = createTenantContactSubmissionController((value) => {
      payload = value
      return sending.promise
    }, async url => routes.push(url), value => state = value)
    controller.setContext(1, draft)
    const task = controller.submit()
    controller.setContext(userId, changed)
    sending.resolve(receipt(payload))
    await task
    assert.equal(routes.length, 0)
    assert.equal(state.result, null)
    assert.equal(state.sending, false)
  }
})

test('导航失败保留已发送回执，重试只打开聊天', async () => {
  let sent = 0
  let opened = 0
  const visibility: boolean[] = []
  let state!: TenantContactSubmissionState
  const controller = createTenantContactSubmissionController(async (payload) => {
    sent += 1
    return receipt(payload)
  }, async () => {
    if (++opened === 1)
      throw new Error('页面栈已满')
  }, value => state = value, visible => visibility.push(visible))
  controller.setContext(1, draft)
  await controller.submit()
  assert.equal(state.notice, '联系方式已发送')
  assert.ok(state.result?.message)
  assert.match(state.error, /已发送.*打开聊天/)
  assert.deepEqual(visibility, [false, true])
  controller.setContext(1, draft)
  await controller.submit()
  assert.equal(sent, 1)
  assert.equal(opened, 2)
  assert.equal(state.error, '')
  assert.deepEqual(visibility, [false, true, false])
})

test('导航失败时账号、房源已变化或详情页已隐藏，均不恢复旧弹层', async () => {
  for (const change of ['account', 'house', 'hidden'] as const) {
    const navigation = deferred<void>()
    const visibility: boolean[] = []
    const controller = createTenantContactSubmissionController(async payload => receipt(payload), () => navigation.promise, () => {}, visible => visibility.push(visible))
    controller.setContext(1, draft)
    const task = controller.submit()
    await tick()
    assert.deepEqual(visibility, [false])
    if (change === 'account')
      controller.setContext(2, draft)
    else if (change === 'house')
      controller.setContext(1, { ...draft, house_id: 43 })
    else
      controller.setActive(false)
    navigation.reject(new Error('导航失败'))
    await task
    assert.deepEqual(visibility, [false])
  }
})

test('无接待只显示咨询已记录，缺少消息或会话时均不跳转', async () => {
  for (const missing of ['both', 'message', 'conversation'] as const) {
    let sent = 0
    let state!: TenantContactSubmissionState
    const routes: string[] = []
    const controller = createTenantContactSubmissionController(async (payload) => {
      sent += 1
      const result = receipt(payload)
      if (missing !== 'message')
        result.conversation = null
      if (missing !== 'conversation')
        result.message = null
      return result
    }, async url => routes.push(url), value => state = value)
    controller.setContext(1, draft)
    await controller.submit()
    assert.equal(routes.length, 0)
    assert.doesNotMatch(state.notice, /已发送/)
    assert.equal(state.notice, missing === 'both' ? '咨询已记录，暂无接待人员，暂时无法开始聊天' : '咨询已记录，聊天暂时无法打开')
    await controller.submit()
    assert.equal(sent, 1)
  }
})

test('离开页面后收到回执不自动导航，回来可打开已发送聊天', async () => {
  const sending = deferred<TenantContactRequestOut>()
  const requests: TenantContactRequestIn[] = []
  const routes: string[] = []
  const controller = createTenantContactSubmissionController((payload) => {
    requests.push(payload)
    return sending.promise
  }, async url => routes.push(url), () => {})
  controller.setContext(1, draft)
  const task = controller.submit()
  controller.setActive(false)
  sending.resolve(receipt(requests[0]))
  await task
  assert.equal(routes.length, 0)
  controller.setActive(true)
  await controller.submit()
  assert.equal(routes.length, 1)
  assert.equal(requests.length, 1)
})

async function recoveryHarness(restoredUserId: number, replayStatus = 201) {
  const login = deferred<boolean>()
  let identity: number | null = 1
  let token = 'expired'
  const requests: { body: TenantContactRequestIn, headers: Record<string, string> }[] = []
  const routes: string[] = []
  let state!: TenantContactSubmissionState
  let controller!: ReturnType<typeof createTenantContactSubmissionController>
  const client = createHttpClient({
    getSessionToken: () => token,
    resolveUrl: value => value,
    recoverSession: () => recoverAuthenticatedSession({
      clearSession: () => token = '',
      resetToVisitor: () => {
        identity = null
        controller.setContext(identity, draft)
      },
      tryAutomaticLogin: () => login.promise,
      refreshAuthenticatedContext: async () => {
        token = 'renewed'
        identity = restoredUserId
        controller.setContext(identity, draft)
      },
    }),
    transport: async (request): Promise<HttpTransportResponse> => {
      const body = request.body as TenantContactRequestIn
      requests.push({ body, headers: request.headers })
      if (request.headers['X-Session-Token'] === 'expired')
        return { statusCode: 401, data: { detail: '会话过期' } }
      if (requests.length === 2 && replayStatus >= 400)
        return { statusCode: replayStatus, data: { detail: '保存失败' } }
      return { statusCode: 201, data: receipt(body) }
    },
  })
  controller = createTenantContactSubmissionController((body, userId) => {
    const options = tenantContactSendOptions(userId, () => identity)
    return client.request<TenantContactRequestOut>({
      url: '/api/house/tenant/contact/',
      method: 'POST',
      scope: options.requestScope,
      authRetry: options.authRetry,
      authReplayGuard: options.authReplayGuard,
      body,
    })
  }, async url => routes.push(url), value => state = value)
  controller.setContext(1, draft)
  const task = controller.submit()
  await tick()
  assert.equal(identity, null)
  assert.equal(state.result, null)
  login.resolve(true)
  await task
  if (restoredUserId === 1) {
    assert.equal(requests.length, 2)
    assert.deepEqual(requests[0].body, requests[1].body)
    assert.deepEqual(requests.map(item => item.headers), [{ 'X-Session-Token': 'expired' }, { 'X-Session-Token': 'renewed' }])
    if (replayStatus >= 400) {
      assert.equal(state.result, null)
      assert.ok(state.error)
      await controller.submit()
      assert.deepEqual(requests[2].body, requests[0].body)
    }
    assert.equal(routes.length, 1)
    assert.equal(state.result?.message?.client_message_id, requests[0].body.client_message_id)
  }
  else {
    assert.equal(requests.length, 1)
    assert.equal(routes.length, 0)
    assert.equal(state.result, null)
    identity = 1
    controller.setContext(identity, draft)
    await controller.submit()
    assert.notEqual(requests[1].body.client_message_id, requests[0].body.client_message_id)
  }
}

test('真实 401 恢复为同账号后安全重放同 UUID，个人请求始终不带组织头', () => recoveryHarness(1))
test('同账号恢复后的重放失败仍保留原 UUID 供再次发送', () => recoveryHarness(1, 503))
test('真实 401 恢复为其他账号不重放，切回旧账号也不沿用旧 UUID', () => recoveryHarness(2))
