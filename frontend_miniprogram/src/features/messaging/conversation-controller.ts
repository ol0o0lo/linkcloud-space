import type { Conversation, MessagingApi, MessagingContext, MessagingMessage, PendingMessage } from './types.ts'
import type { HouseCardPayload, MessageMedia } from './message-content.ts'
import { createMessageUuid, mergeMessages, messagingContextKey } from './context.ts'
import { createSerialPoller } from './polling.ts'

export interface ConversationState {
  conversation: Conversation | null
  messages: MessagingMessage[]
  pending: PendingMessage[]
  loading: boolean
  historyLoading: boolean
  hasMore: boolean
  error: string
}

function initialState(): ConversationState {
  return { conversation: null, messages: [], pending: [], loading: false, historyLoading: false, hasMore: false, error: '' }
}

function errorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : '消息加载失败，请稍后重试'
}

export function createConversationController(api: MessagingApi, onChange: (state: ConversationState) => void, onRead: () => void = () => {}) {
  let state = initialState()
  let context: MessagingContext | null = null
  let conversationId = 0
  let generation = 0
  let requestEpoch = 0
  let active = false
  let atBottom = false
  let loaded = false
  // 发送回执可能跳过尚未补取的其他消息，不能用回执的 seq 推进增量游标。
  let receivedSequence = 0
  let wantedReadSequence = 0
  let reading = false
  let knownUserId: number | null = null
  let outboxEpoch = 0
  const pendingByContext = new Map<string, PendingMessage[]>()

  function publish(patch: Partial<ConversationState>) {
    state = { ...state, ...patch }
    if (patch.pending && context)
      pendingByContext.set(messagingContextKey(context, conversationId), patch.pending)
    onChange(state)
  }

  function snapshot() {
    if (!context || !conversationId)
      return null
    const captured = { context: { ...context }, id: conversationId, generation, epoch: requestEpoch, outboxEpoch, key: messagingContextKey(context, conversationId) }
    return { ...captured, current: () => generation === captured.generation, visible: () => generation === captured.generation && requestEpoch === captured.epoch && active }
  }

  async function flushRead() {
    if (reading || !active || !atBottom || !state.conversation)
      return
    const captured = snapshot()
    if (!captured)
      return
    reading = true
    try {
      while (captured.visible() && wantedReadSequence > (state.conversation?.my_last_read_seq || 0)) {
        if (!atBottom)
          break
        const seq = wantedReadSequence
        const result = await api.markRead(captured.context, captured.id, seq)
        if (!captured.visible() || !state.conversation)
          return
        publish({ conversation: { ...state.conversation, my_last_read_seq: Math.max(state.conversation.my_last_read_seq, result.last_read_seq), unread_count: result.unread_count } })
        onRead()
        if (result.last_read_seq < seq)
          break
      }
    }
    catch {
      // 已读失败保留位置，下一次前台增量完成后继续重试。
    }
    finally {
      reading = false
    }
  }

  function markVisible() {
    if (!active || !atBottom)
      return
    // 仅标记通过最近页/增量确认展示的连续位置，发送回执不越过尚未接收的消息。
    wantedReadSequence = Math.max(wantedReadSequence, receivedSequence)
    void flushRead()
  }

  async function refresh() {
    const captured = snapshot()
    if (!captured || !active)
      return
    publish({ loading: !loaded, error: '' })
    try {
      const conversation = await api.getConversation(captured.context, captured.id)
      if (!captured.visible())
        return
      const member = conversation.members.find(item => item.id === conversation.my_member_id)
      if (conversation.id !== captured.id || conversation.organization.slug !== captured.context.organizationSlug || member?.access_kind !== captured.context.accessKind)
        throw new Error('会话参与身份已变化，请从消息列表重新进入')
      publish({ conversation: { ...conversation, my_last_read_seq: Math.max(conversation.my_last_read_seq, state.conversation?.my_last_read_seq || 0) } })
      if (!loaded) {
        const result = await api.listMessages(captured.context, captured.id)
        if (!captured.visible())
          return
        receivedSequence = result.items.reduce((max, item) => Math.max(max, item.seq), 0)
        loaded = true
        const confirmed = new Set(result.items.map(message => message.client_message_id))
        publish({ messages: mergeMessages(state.messages, result.items), pending: state.pending.filter(item => !confirmed.has(item.client_message_id)), hasMore: result.total > result.items.length })
      }
      else {
        while (captured.visible()) {
          const result = await api.listMessages(captured.context, captured.id, { after_seq: receivedSequence })
          if (!captured.visible())
            return
          const maximum = result.items.reduce((max, item) => Math.max(max, item.seq), receivedSequence)
          if (result.items.length && maximum <= receivedSequence)
            throw new Error('消息位置无效，请重新进入聊天')
          receivedSequence = maximum
          const confirmed = new Set(result.items.map(message => message.client_message_id))
          publish({ messages: mergeMessages(state.messages, result.items), pending: state.pending.filter(item => !confirmed.has(item.client_message_id)) })
          if (result.items.length < result.page_size)
            break
        }
      }
    }
    catch (cause) {
      if (captured.visible())
        publish({ error: errorMessage(cause) })
      throw cause
    }
    finally {
      if (captured.visible())
        publish({ loading: false })
    }
  }

  const poller = createSerialPoller(refresh, 3000)

  function setAccount(userId: number | null) {
    if (!userId || knownUserId === userId)
      return
    knownUserId = userId
    outboxEpoch += 1
    pendingByContext.clear()
  }

  function setContext(next: MessagingContext | null, id: number) {
    if (messagingContextKey(next, id) === messagingContextKey(context, conversationId))
      return
    generation += 1
    requestEpoch += 1
    setAccount(next?.userId || null)
    context = next ? { ...next } : null
    conversationId = id
    poller.stop()
    loaded = false
    receivedSequence = 0
    wantedReadSequence = 0
    atBottom = false
    state = initialState()
    // 会话恢复会短暂撤下身份；正文仅在原账号及原会话重新确认后恢复。
    publish({ pending: next ? pendingByContext.get(messagingContextKey(next, id)) || [] : [] })
    if (active && next && id)
      poller.start()
  }

  function activate() {
    active = true
    if (context && conversationId)
      poller.start()
  }

  function deactivate() {
    active = false
    requestEpoch += 1
    poller.stop()
    publish({ loading: false, historyLoading: false })
  }

  async function loadHistory() {
    const captured = snapshot()
    if (!captured || !active || state.historyLoading || !state.hasMore || !state.messages.length)
      return
    const before = state.messages[0].seq
    publish({ historyLoading: true })
    try {
      const result = await api.listMessages(captured.context, captured.id, { before_seq: before })
      if (captured.visible())
        publish({ messages: mergeMessages(state.messages, result.items), hasMore: result.total > result.items.length })
    }
    catch (cause) {
      if (captured.visible())
        publish({ error: errorMessage(cause) })
    }
    finally {
      if (captured.visible())
        publish({ historyLoading: false })
    }
  }

  async function sendPending(item: PendingMessage) {
    const captured = snapshot()
    if (!captured || !active || !state.conversation?.can_send)
      return
    publish({ pending: state.pending.map(candidate => candidate.client_message_id === item.client_message_id ? { ...candidate, state: 'sending', error: '' } : candidate) })
    try {
      const body = item.message_type === 'house.listing'
        ? { client_message_id: item.client_message_id, content: item.content, message_type: item.message_type, house_id: item.payload!.house_id }
        : { client_message_id: item.client_message_id, content: item.content }
      const message = await api.sendMessage(captured.context, captured.id, body)
      if (captured.outboxEpoch !== outboxEpoch)
        return
      const remaining = (pendingByContext.get(captured.key) || []).filter(candidate => candidate.client_message_id !== item.client_message_id)
      pendingByContext.set(captured.key, remaining)
      if (captured.key === messagingContextKey(context, conversationId)) {
        publish({ messages: mergeMessages(state.messages, [message]), pending: remaining })
        if (active)
          void poller.refresh()
      }
    }
    catch (cause) {
      if (captured.outboxEpoch !== outboxEpoch)
        return
      const failed: PendingMessage[] = (pendingByContext.get(captured.key) || []).map(candidate => candidate.client_message_id === item.client_message_id ? { ...candidate, state: 'failed', error: errorMessage(cause) } : candidate)
      pendingByContext.set(captured.key, failed)
      if (captured.key === messagingContextKey(context, conversationId))
        publish({ pending: failed })
    }
  }

  function send(content: string) {
    if (!active || !context || state.loading || !state.conversation?.can_send || !content.trim())
      return false
    const item: PendingMessage = { client_message_id: createMessageUuid(), content: content.trim(), state: 'sending', error: '' }
    publish({ pending: [...state.pending, item] })
    void sendPending(item)
    return true
  }

  function retry(uuid: string) {
    const item = state.pending.find(candidate => candidate.client_message_id === uuid && candidate.state === 'failed')
    if (item)
      void sendPending(item)
  }

  function sendHouse(payload: HouseCardPayload, media: MessageMedia[] = []) {
    if (!active || !context || state.loading || !state.conversation?.can_send || !Number.isInteger(payload.house_id) || payload.house_id <= 0)
      return false
    const item: PendingMessage = {
      client_message_id: createMessageUuid(),
      content: `[房源] ${payload.title}`,
      message_type: 'house.listing',
      payload: { ...payload },
      media: media.map(value => ({ ...value })),
      state: 'sending',
      error: '',
    }
    publish({ pending: [...state.pending, item] })
    void sendPending(item)
    return true
  }

  function setAtBottom(value: boolean) {
    atBottom = value
    if (value)
      markVisible()
  }

  return { setAccount, setContext, activate, deactivate, refresh: poller.refresh, loadHistory, send, sendHouse, retry, setAtBottom }
}
