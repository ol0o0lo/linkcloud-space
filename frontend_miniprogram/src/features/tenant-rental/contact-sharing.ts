import type { TenantContactChannel, TenantContactShare, TenantContactValues } from '../../services/manual/tenant-rental.ts'
import type { MessagingMessage } from '../messaging/types.ts'
import { createMessageUuid } from '../messaging/context.ts'

export interface ContactSharingState {
  values: TenantContactValues
  channels: TenantContactChannel[]
  loading: boolean
  loaded: boolean
  sending: boolean
  error: string
}

interface ContactSharingApi {
  read: (userId: number) => Promise<TenantContactValues>
  save: (values: TenantContactValues, userId: number) => Promise<TenantContactValues>
  share: (conversationId: number, payload: TenantContactShare, userId: number) => Promise<MessagingMessage>
}

export function emptyContactSharingState(): ContactSharingState {
  return { values: { phone: '', wechat: '' }, channels: [], loading: false, loaded: false, sending: false, error: '' }
}

export function contactValuesError(values: TenantContactValues): string {
  if (values.phone.trim() && !/^\+?[\d\s()-]{7,32}$/.test(values.phone.trim()))
    return '请输入有效的手机号'
  if (values.wechat.length > 64)
    return '微信号不能超过64个字符'
  return ''
}

export function canShareContact(state: ContactSharingState): boolean {
  return state.loaded && !state.loading && !state.sending && state.channels.length > 0
    && !contactValuesError(state.values) && state.channels.every(channel => Boolean(state.values[channel].trim()))
}

export function createContactSharingController(
  api: ContactSharingApi,
  currentUserId: () => number | null,
  onChange: (state: ContactSharingState) => void,
  onSent: (message: MessagingMessage) => void,
) {
  let session: { userId: number, conversationId: number, state: ContactSharingState, savedKey: string } | null = null
  let saveQueue = Promise.resolve(true)
  let attempt: { key: string, payload: TenantContactShare } | null = null
  const keyOf = (values: TenantContactValues) => JSON.stringify([values.phone.trim(), values.wechat.trim()])

  function publish(captured = session) {
    if (captured && session === captured && currentUserId() === captured.userId)
      onChange({ ...captured.state, values: { ...captured.state.values }, channels: [...captured.state.channels] })
  }

  async function open(userId: number, conversationId: number) {
    const previous = session
    const captured = { userId, conversationId, state: { ...emptyContactSharingState(), loading: true }, savedKey: '' }
    session = captured
    publish(captured)
    try {
      await saveQueue
      if (session !== captured || currentUserId() !== userId)
        return
      const values = await api.read(userId)
      if (session !== captured || currentUserId() !== userId)
        return
      captured.state.values = { ...values }
      captured.savedKey = keyOf(values)
      captured.state.loaded = true
      if (previous?.userId === userId && previous.state.loaded && keyOf(previous.state.values) !== previous.savedKey) {
        captured.state.values = { ...previous.state.values }
        captured.state.error = previous.state.error
      }
    }
    catch (error) {
      captured.state.error = error instanceof Error ? error.message : '联系方式暂时无法读取，请重试'
    }
    finally {
      captured.state.loading = false
      publish(captured)
    }
  }

  function edit(channel: TenantContactChannel, value: string) {
    if (!session || session.state.sending || !session.state.loaded)
      return
    session.state.values = { ...session.state.values, [channel]: value }
    session.state.error = ''
    publish()
  }

  function select(channel: TenantContactChannel, selected: boolean) {
    if (!session || session.state.sending)
      return
    session.state.channels = (['phone', 'wechat'] as const).filter(item => item === channel ? selected : session!.state.channels.includes(item))
    session.state.error = ''
    publish()
  }

  function save(): Promise<boolean> {
    const captured = session
    if (!captured?.state.loaded || currentUserId() !== captured.userId)
      return Promise.resolve(false)
    const values = { phone: captured.state.values.phone.trim(), wechat: captured.state.values.wechat.trim() }
    const key = keyOf(values)
    const error = contactValuesError(values)
    if (error) {
      captured.state.error = error
      publish(captured)
      return Promise.resolve(false)
    }
    saveQueue = saveQueue.then(async () => {
      if (currentUserId() !== captured.userId)
        return false
      if (captured.savedKey === key)
        return true
      try {
        const saved = await api.save(values, captured.userId)
        captured.savedKey = keyOf(saved)
        if (keyOf(captured.state.values) === key)
          captured.state.values = { ...saved }
        captured.state.error = ''
        publish(captured)
        return true
      }
      catch (cause) {
        captured.state.error = cause instanceof Error ? cause.message : '联系方式未能保存，请重试'
        publish(captured)
        return false
      }
    })
    return saveQueue
  }

  async function send() {
    const captured = session
    if (!captured || !canShareContact(captured.state) || currentUserId() !== captured.userId)
      return
    captured.state.sending = true
    captured.state.error = ''
    publish(captured)
    try {
      if (!await save() || session !== captured || currentUserId() !== captured.userId)
        return
      const { channels, values } = captured.state
      const payload = { channels: [...channels], phone: channels.includes('phone') ? values.phone.trim() : '', wechat: channels.includes('wechat') ? values.wechat.trim() : '' }
      const key = JSON.stringify([captured.userId, captured.conversationId, payload])
      if (attempt?.key !== key)
        attempt = { key, payload: { ...payload, client_message_id: createMessageUuid() } }
      const message = await api.share(captured.conversationId, attempt.payload, captured.userId)
      if (session === captured && currentUserId() === captured.userId) {
        attempt = null
        onSent(message)
      }
    }
    catch (cause) {
      captured.state.error = cause instanceof Error ? cause.message : '发送失败，请重试'
    }
    finally {
      captured.state.sending = false
      publish(captured)
    }
  }

  function reset() {
    session = null
    attempt = null
    onChange(emptyContactSharingState())
  }

  return { open, edit, select, save, send, reset }
}
