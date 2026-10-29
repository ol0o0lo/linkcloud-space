import assert from 'node:assert/strict'
import test from 'node:test'
import { computed, nextTick, ref, watch } from 'vue'
import type { ConversationState } from '../src/features/messaging/conversation-controller.ts'
import type { Conversation, MessagingApi, MessagingContext, MessagingMessage, MessagingReadResult } from '../src/features/messaging/types.ts'
import type { RouteWorkspace } from '../src/domain/route-access.ts'
import { buildAppModeOptions } from '../src/domain/app-mode.ts'
import { getRouteAccessDecision, withRouteWorkspace } from '../src/domain/route-access.ts'
import { choosePersonalMessagingOrganization, mergeMessages, messagingContextKey, messagingRequestScope, messagingSendOptions } from '../src/features/messaging/context.ts'
import { recoverAuthenticatedSession } from '../src/core/auth/session-recovery.ts'
import type { HttpTransportResponse } from '../src/infra/http/client.ts'
import { createHttpClient } from '../src/infra/http/client.ts'
import { createConversationController } from '../src/features/messaging/conversation-controller.ts'
import { createSerialPoller } from '../src/features/messaging/polling.ts'
import { createUnreadBadgeState } from '../src/features/messaging/unread-badge.ts'
import { getConversationRoute } from '../src/modules/routes.ts'
import { buildScopeHeaders } from '../src/infra/http/request-scope.ts'

const context: MessagingContext = { userId: 1, accessKind: 'organization_member', organizationSlug: 'alpha' }
const tick = () => new Promise<void>(resolve => setImmediate(resolve))

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((accept, fail) => {
    resolve = accept
    reject = fail
  })
  return { promise, resolve, reject }
}

function conversation(slug = 'alpha', id = 1): Conversation {
  return {
    id,
    organization: { id: 1, slug, name: slug },
    namespace: 'demo.alpha',
    context_key: '',
    status: 'active',
    status__mapping: '进行中',
    members: [{ id: 1, user_id: 1, display_name: '本人', access_kind: 'organization_member' }, { id: 2, user_id: 2, display_name: '对方', access_kind: 'organization_member' }],
    last_message: null,
    my_member_id: 1,
    my_last_read_seq: 0,
    unread_count: 1,
    can_send: true,
    send_block_reason: '',
    send_block_reason__mapping: '',
  }
}

function message(seq: number, overrides: Partial<MessagingMessage> = {}): MessagingMessage {
  return { id: seq, conversation_id: 1, seq, sender_member_id: 2, client_message_id: `message-${seq}`, content: `消息 ${seq}`, created_at: '2026-10-24T08:30:00Z', ...overrides }
}

function page(items: MessagingMessage[], total = items.length) {
  return { items, total, page: 1, page_size: 50 }
}

function api(overrides: Partial<MessagingApi> = {}): MessagingApi {
  return {
    getConversation: async (current, id) => {
      const result = conversation(current.organizationSlug, id)
      result.members[0].access_kind = current.accessKind
      return result
    },
    listMessages: async () => page([message(1)]),
    sendMessage: async (_current, _id, body) => message(2, { ...body, sender_member_id: 1 }),
    markRead: async (_current, _id, seq) => ({ last_read_seq: seq, unread_count: 0 }),
    ...overrides,
  }
}

test('房源卡片进入同一发件队列，失败重试保持 UUID 和卡片数据', async () => {
  let state!: ConversationState
  const attempts: Parameters<MessagingApi['sendMessage']>[2][] = []
  const controller = createConversationController(api({ sendMessage: async (_context, _id, body) => {
    attempts.push({ ...body })
    if (attempts.length === 1)
      throw new Error('暂时不可用')
    return message(2, { client_message_id: body.client_message_id, message_type: 'house.listing', payload: { house_id: 9, title: '云舍 501' } })
  } }), next => state = next)
  controller.setAccount(1)
  controller.setContext(context, 1)
  controller.activate()
  try {
    await tick()
    const payload = { house_id: 9, title: '云舍 501', bedrooms: 1, living_rooms: 0, area: '21.41', asking_rent: '2800', address: '' }
    assert.equal(controller.sendHouse(payload, [{ url: 'https://example.invalid/cover.jpg' }]), true)
    await tick()
    assert.equal(state.pending[0].state, 'failed')
    assert.deepEqual(state.pending[0].payload, payload)
    const requestId = state.pending[0].client_message_id
    controller.retry(requestId)
    await tick()
    assert.equal(attempts.length, 2)
    assert.equal(attempts[0].client_message_id, attempts[1].client_message_id)
    assert.equal(attempts[1].house_id, 9)
    assert.equal(attempts[1].message_type, 'house.listing')
    assert.equal(state.pending.length, 0)
    assert.equal(state.messages.filter(item => item.client_message_id === requestId).length, 1)
  }
  finally { controller.deactivate() }
})

test('上下文键同时隔离账号、参与方式、组织、namespace 和会话', () => {
  const base = messagingContextKey(context, 1)
  for (const next of [{ ...context, userId: 2 }, { ...context, accessKind: 'business_party' as const }, { ...context, organizationSlug: 'beta' }, { ...context, namespace: 'demo.beta' }])
    assert.notEqual(messagingContextKey(next, 1), base)
  assert.notEqual(messagingContextKey(context, 2), base)
  assert.deepEqual(mergeMessages([message(3), message(1)], [message(2), message(3)]).map(item => item.seq), [1, 2, 3])
})

test('个人组织只有一个时自动选择，多个时只恢复仍有效的本人选择', () => {
  const alpha = { id: 1, slug: 'alpha', name: '甲组织', unread_count: 3 }
  const beta = { id: 2, slug: 'beta', name: '乙组织', unread_count: 2 }
  assert.equal(choosePersonalMessagingOrganization([alpha], ''), 'alpha')
  assert.equal(choosePersonalMessagingOrganization([alpha, beta], ''), '')
  assert.equal(choosePersonalMessagingOrganization([alpha, beta], 'beta'), 'beta')
  assert.equal(choosePersonalMessagingOrganization([alpha, beta], 'removed'), '')
})

test('组织模式请求头与 URL 组织一致，外部参与模式只带认证不带组织头', () => {
  assert.deepEqual(buildScopeHeaders({ scope: messagingRequestScope(context), sessionToken: 'session' }), { 'X-Session-Token': 'session', 'X-Org-Slug': 'alpha' })
  assert.deepEqual(buildScopeHeaders({ scope: messagingRequestScope({ ...context, accessKind: 'business_party' }), sessionToken: 'session' }), { 'X-Session-Token': 'session' })
})

test('外部聊天深链保持个人作用域，空间成员深链继续定位经纪人身份', () => {
  const organizations = [{ id: 1, slug: 'alpha', name: '甲组织', is_primary: true }]
  const workspace: RouteWorkspace = {
    authenticated: true,
    mode: 'organization',
    organizationSlug: 'alpha',
    landlordContactId: null,
    organizations,
    capabilities: {},
    modeOptions: buildAppModeOptions({ mode: 'organization', organizationSlug: 'alpha', landlordContactId: null, organizations, landlordRelationships: [] }),
  }
  const external = getConversationRoute(8, 'external', 'business_party')
  assert.equal(withRouteWorkspace(external, { mode: 'organization', organizationSlug: 'alpha' }), external)
  assert.equal(getRouteAccessDecision(external, workspace).allowed, true)
  assert.equal(getRouteAccessDecision(`${external}&organization_slug=alpha`, workspace).allowed, false)
  assert.equal(getRouteAccessDecision(external, { ...workspace, authenticated: false }).allowed, false)
  assert.equal(getRouteAccessDecision(getConversationRoute(8, 'alpha', 'organization_member'), workspace).allowed, true)
})

test('停止轮询后旧请求不复活定时器，慢请求期间不会堆叠轮询', async () => {
  const pending = deferred<void>()
  const timers: number[] = []
  let requests = 0
  const poller = createSerialPoller(async () => {
    requests += 1
    await pending.promise
  }, 3000, {
    schedule: (_callback, delay) => {
      timers.push(delay)
      return 1 as unknown as ReturnType<typeof setTimeout>
    },
    cancel: () => {},
  })
  poller.start()
  const refreshing = poller.refresh()
  assert.equal(requests, 1)
  poller.stop()
  pending.resolve()
  await refreshing
  assert.deepEqual(timers, [])
})

test('默认计时器不把浏览器原生方法绑定到 clock 对象', async (t) => {
  const schedule = globalThis.setTimeout
  const cancel = globalThis.clearTimeout
  let scheduled = 0
  let cancelled = 0
  t.mock.method(globalThis, 'setTimeout', function (this: unknown, callback: () => void, delay: number) {
    if (this !== undefined && this !== globalThis)
      throw new TypeError('Illegal invocation')
    scheduled += 1
    return schedule(callback, delay)
  })
  t.mock.method(globalThis, 'clearTimeout', function (this: unknown, timer: ReturnType<typeof setTimeout>) {
    if (this !== undefined && this !== globalThis)
      throw new TypeError('Illegal invocation')
    cancelled += 1
    cancel(timer)
  })
  const poller = createSerialPoller(async () => {}, 3000)
  try {
    poller.start()
    await tick()
    assert.equal(scheduled, 1)
    await poller.refresh()
    assert.equal(scheduled, 2)
    assert.equal(cancelled, 1)
  }
  finally {
    poller.stop()
  }
  assert.equal(cancelled, 2)
})

test('轮询失败按 3、6 秒退避，成功恢复详情频率', async () => {
  const timers: { callback: () => void, delay: number }[] = []
  let requests = 0
  const poller = createSerialPoller(async () => {
    if (++requests <= 2)
      throw new Error('暂时不可用')
  }, 3000, {
    schedule: (callback, delay) => {
      timers.push({ callback, delay })
      return 1 as unknown as ReturnType<typeof setTimeout>
    },
    cancel: () => {},
  })
  poller.start()
  await tick()
  assert.equal(timers[0].delay, 3000)
  timers[0].callback()
  await tick()
  assert.equal(timers[1].delay, 6000)
  timers[1].callback()
  await tick()
  assert.equal(timers[2].delay, 3000)
  poller.stop()
})

test('最近页后串行补取多批增量，历史始终使用最小 seq 和 page=1', async () => {
  let state!: ConversationState
  const queries: unknown[] = []
  const controller = createConversationController(api({
    listMessages: async (_current, _id, query) => {
      queries.push(query)
      if (!query)
        return page(Array.from({ length: 50 }, (_, index) => message(100 - index)), 100)
      if (query.after_seq === 100)
        return page(Array.from({ length: 50 }, (_, index) => message(101 + index)), 55)
      if (query.after_seq === 150)
        return page(Array.from({ length: 5 }, (_, index) => message(151 + index)))
      if (query.before_seq === 51)
        return page(Array.from({ length: 50 }, (_, index) => message(50 - index)))
      return page([])
    },
  }), value => state = value)
  try {
    controller.setContext(context, 1)
    controller.activate()
    await tick()
    assert.equal(state.messages[0].seq, 51)
    await controller.refresh()
    assert.deepEqual(queries.slice(1), [{ after_seq: 100 }, { after_seq: 150 }])
    await controller.loadHistory()
    assert.deepEqual(queries[3], { before_seq: 51 })
    assert.equal(state.messages.length, 155)
    assert.equal(state.hasMore, false)
  }
  finally { controller.deactivate() }
})

test('发送失败的重试复用 UUID 和正文；回执不跳过尚未补取的对方消息', async () => {
  let state!: ConversationState
  const sent: { client_message_id: string, content: string }[] = []
  const after: number[] = []
  const controller = createConversationController(api({
    listMessages: async (_current, _id, query) => {
      if (!query)
        return page([message(1)])
      after.push(query.after_seq!)
      return query.after_seq === 1 ? page([message(2), message(3, { client_message_id: sent[0].client_message_id, sender_member_id: 1 })]) : page([])
    },
    sendMessage: async (_current, _id, body) => {
      sent.push({ ...body })
      if (sent.length === 1)
        throw new Error('响应丢失')
      return message(3, { ...body, sender_member_id: 1 })
    },
  }), value => state = value)
  try {
    controller.setContext(context, 1)
    controller.activate()
    await tick()
    assert.equal(controller.send(' 你好 '), true)
    await tick()
    assert.equal(state.pending[0].state, 'failed')
    const uuid = state.pending[0].client_message_id
    assert.match(uuid, /^[a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i)
    controller.retry(uuid)
    await tick()
    assert.deepEqual(sent[1], sent[0])
    assert.equal(after[0], 1)
    assert.deepEqual(state.messages.map(item => item.seq), [1, 2, 3])
    assert.equal(state.pending.length, 0)
  }
  finally { controller.deactivate() }
})

test('已读请求串行且单调，停留历史时不推进到新消息', async () => {
  let state!: ConversationState
  let latest = 1
  const reads: { seq: number, result: ReturnType<typeof deferred<MessagingReadResult>> }[] = []
  const controller = createConversationController(api({
    listMessages: async (_current, _id, query) => page([message(latest)].filter(item => !query || item.seq > (query.after_seq || 0))),
    markRead: async (_current, _id, seq) => {
      const result = deferred<MessagingReadResult>()
      reads.push({ seq, result })
      return result.promise
    },
  }), value => state = value)
  try {
    controller.setContext(context, 1)
    controller.activate()
    await tick()
    assert.equal(reads.length, 0)
    controller.setAtBottom(true)
    assert.deepEqual(reads.map(item => item.seq), [1])
    latest = 2
    await controller.refresh()
    controller.setAtBottom(true)
    assert.equal(reads.length, 1)
    reads[0].result.resolve({ last_read_seq: 1, unread_count: 1 })
    await tick()
    assert.deepEqual(reads.map(item => item.seq), [1, 2])
    reads[1].result.resolve({ last_read_seq: 2, unread_count: 0 })
    await tick()
    controller.setAtBottom(false)
    latest = 3
    await controller.refresh()
    assert.equal(reads.length, 2)
    assert.equal(state.conversation?.my_last_read_seq, 2)
  }
  finally { controller.deactivate() }
})

test('切组织后丢弃旧详情慢响应', async () => {
  let state!: ConversationState
  const old = deferred<Conversation>()
  const controller = createConversationController(api({ getConversation: current => current.organizationSlug === 'alpha' ? old.promise : Promise.resolve(conversation('beta')) }), value => state = value)
  try {
    controller.setContext(context, 1)
    controller.activate()
    controller.setContext({ ...context, userId: 2, organizationSlug: 'beta', namespace: 'demo.beta' }, 1)
    old.resolve(conversation('alpha'))
    await tick()
    await controller.refresh()
    assert.equal(state.conversation?.organization.slug, 'beta')
    assert.equal(state.pending.length, 0)
  }
  finally { controller.deactivate() }
})

test('账号、组织和参与方式切换后，旧发送回执不能回填新会话', async () => {
  let state!: ConversationState
  const sending = deferred<MessagingMessage>()
  const controller = createConversationController(api({ sendMessage: () => sending.promise }), value => state = value)
  try {
    controller.setContext(context, 1)
    controller.activate()
    await tick()
    controller.send('旧会话正文')
    assert.equal(state.pending.length, 1)
    controller.setContext({ ...context, userId: 2, organizationSlug: 'beta', accessKind: 'business_party' }, 2)
    sending.resolve(message(2, { content: '旧会话正文' }))
    await tick()
    assert.equal(state.pending.length, 0)
    assert.equal(state.messages.some(item => item.content === '旧会话正文'), false)
  }
  finally { controller.deactivate() }
})

test('底栏只显示一个红点，通知与聊天独立计数并拒绝旧响应', () => {
  const badge = createUnreadBadgeState()
  badge.setScope('1:organization:alpha')
  badge.set('notifications', 3)
  badge.set('messages', 4)
  assert.equal(badge.value(), 'dot')
  assert.equal(badge.count('notifications'), 3)
  assert.equal(badge.count('messages'), 4)
  const staleNotifications = badge.begin('notifications')
  const staleMessages = badge.begin('messages')
  badge.set('notifications', 0)
  badge.set('notifications', 8, staleNotifications)
  assert.equal(badge.value(), 'dot')
  assert.equal(badge.count('notifications'), 0)
  assert.equal(badge.count('messages'), 4)
  badge.set('messages', 0)
  assert.equal(badge.value(), undefined)
  badge.setScope('2:business_party:beta')
  badge.set('messages', 10, staleMessages)
  assert.equal(badge.value(), undefined)
})

async function recoveryHarness(recoveredUserId: number, replayStatus: number) {
  const identity = ref<number | null>(1)
  // 新账号没有原路由的组织资格时，页面 context 会一直为 null，仍须撤销旧账号待发项。
  const boundContext = computed(() => identity.value === 1 ? context : null)
  const login = deferred<boolean>()
  const replay = deferred<HttpTransportResponse>()
  const steps: string[] = []
  const requests: { token: string, organization: string, body: unknown }[] = []
  let token = 'expired-session'
  let state!: ConversationState
  const client = createHttpClient({
    getSessionToken: () => token,
    resolveUrl: path => path,
    recoverSession: () => recoverAuthenticatedSession({
      clearSession: () => {
        steps.push('clearSession')
        token = ''
      },
      resetToVisitor: () => {
        steps.push('resetToVisitor')
        identity.value = null
      },
      tryAutomaticLogin: async () => {
        steps.push('tryAutomaticLogin')
        const restored = await login.promise
        if (restored)
          token = 'renewed-session'
        return restored
      },
      refreshAuthenticatedContext: async () => {
        steps.push('refreshAuthenticatedContext')
        identity.value = recoveredUserId
        await nextTick()
      },
    }),
    onSessionInvalidated: () => identity.value = null,
    transport: async (request) => {
      requests.push({ token: request.headers['X-Session-Token'], organization: request.headers['X-Org-Slug'], body: request.body })
      if (request.headers['X-Session-Token'] === 'expired-session')
        return { statusCode: 401, data: { code: 401, message: '会话已过期' } }
      return replay.promise
    },
  })
  const controller = createConversationController(api({
    listMessages: async (_current, _id, query) => page(query ? [] : [message(1)]),
    sendMessage: (current, id, body) => {
      const options = messagingSendOptions(current, () => identity.value)
      return client.request<MessagingMessage>({
        url: `/api/messaging/organizations/${current.organizationSlug}/conversations/${id}/messages/`,
        method: 'POST',
        scope: options.requestScope,
        authRetry: options.authRetry,
        authReplayGuard: options.authReplayGuard,
        body,
      })
    },
  }), value => state = value)
  const stopWatching = watch([boundContext, identity], ([value, userId]) => {
    controller.setAccount(userId)
    controller.setContext(value, 1)
  }, { immediate: true })
  try {
    controller.activate()
    await tick()
    controller.send('自动恢复期间的正文')
    await tick()
    assert.deepEqual(steps, ['clearSession', 'resetToVisitor', 'tryAutomaticLogin'])
    assert.equal(identity.value, null)
    assert.equal(state.pending.length, 0)
    login.resolve(true)
    await tick()
    assert.equal(steps[3], 'refreshAuthenticatedContext')
    if (recoveredUserId === 1) {
      assert.equal(state.pending[0].content, '自动恢复期间的正文')
      assert.equal(state.pending[0].state, 'sending')
      assert.equal(requests.length, 2)
      assert.deepEqual(requests[1].body, requests[0].body)
      assert.deepEqual(requests.map(request => [request.token, request.organization]), [['expired-session', 'alpha'], ['renewed-session', 'alpha']])
      const body = requests[1].body as { client_message_id: string, content: string }
      replay.resolve(replayStatus < 300
        ? { statusCode: replayStatus, data: { code: 0, data: message(2, { ...body, sender_member_id: 1 }) } }
        : { statusCode: replayStatus, data: { code: replayStatus, message: '暂时无法保存，请重试' } })
      await tick()
      if (replayStatus < 300) {
        assert.equal(state.pending.length, 0)
        assert.equal(state.messages.find(item => item.seq === 2)?.content, '自动恢复期间的正文')
      }
      else {
        assert.equal(state.pending[0].state, 'failed')
        assert.equal(state.pending[0].client_message_id, body.client_message_id)
        assert.equal(state.pending[0].content, body.content)
      }
    }
    else {
      assert.equal(identity.value, recoveredUserId)
      assert.equal(requests.length, 1)
      assert.equal(state.pending.length, 0)
      assert.equal(state.messages.some(item => item.content === '自动恢复期间的正文'), false)
      identity.value = 1
      await tick()
      assert.equal(state.pending.length, 0)
    }
  }
  finally {
    stopWatching()
    controller.deactivate()
  }
}

test('真实 401 恢复链路撤下并恢复同一账号后，原会话正文和 UUID 保留且安全重放', () => recoveryHarness(1, 201))
test('同账号恢复后重放失败保留明确可重试正文及原 UUID', () => recoveryHarness(1, 503))
test('401 恢复成另一账号时不重放旧正文，也不向新账号展示旧待发项', () => recoveryHarness(2, 201))
