import type { TenantContactRequestIn, TenantContactRequestOut } from '../../services/manual/tenant-rental.ts'
import { getConversationRoute } from '../../modules/routes.ts'
import { createMessageUuid } from '../messaging/context.ts'

export type TenantContactDraft = Omit<TenantContactRequestIn, 'client_message_id'>

export interface TenantContactSubmissionState {
  sending: boolean
  result: TenantContactRequestOut | null
  notice: string
  error: string
}

export function tenantContactSendOptions(userId: number, currentUserId: () => number | null) {
  return {
    requestScope: { kind: 'personal' as const },
    authRetry: 'safe' as const,
    authReplayGuard: () => currentUserId() === userId,
  }
}

function emptyState(): TenantContactSubmissionState {
  return { sending: false, result: null, notice: '', error: '' }
}

export function createTenantContactSubmissionController(
  send: (payload: TenantContactRequestIn, userId: number) => Promise<TenantContactRequestOut>,
  navigate: (url: string) => Promise<unknown>,
  onChange: (state: TenantContactSubmissionState) => void,
  setContactVisible: (visible: boolean) => void = () => {},
) {
  let userId: number | null = null
  let knownUserId: number | null = null
  let draft: TenantContactDraft | null = null
  let draftKey = ''
  let active = true
  let attempt: (TenantContactSubmissionState & { userId: number, payload: TenantContactRequestIn }) | null = null

  function publish() {
    onChange(attempt && userId === attempt.userId
      ? { sending: attempt.sending, result: attempt.result, notice: attempt.notice, error: attempt.error }
      : emptyState())
  }

  function setContext(nextUserId: number | null, nextDraft: TenantContactDraft) {
    const nextKey = JSON.stringify([nextDraft.house_id, nextDraft.channels, nextDraft.phone, nextDraft.wechat])
    // 会话恢复会短暂撤下身份；仅同一账号、房源和未修改的输入保留原 UUID 与回执。
    if ((nextUserId && knownUserId && nextUserId !== knownUserId) || nextKey !== draftKey)
      attempt = null
    if (nextUserId)
      knownUserId = nextUserId
    userId = nextUserId
    draftKey = nextKey
    draft = { ...nextDraft, channels: [...nextDraft.channels] }
    publish()
  }

  function setActive(value: boolean) {
    active = value
  }

  async function submit() {
    if (!active || !userId || !draft?.house_id || attempt?.sending)
      return
    attempt ||= {
      ...emptyState(),
      userId,
      payload: { ...draft, channels: [...draft.channels], phone: draft.phone.trim(), wechat: draft.wechat.trim(), client_message_id: createMessageUuid() },
    }
    const captured = attempt
    captured.sending = true
    captured.error = ''
    publish()
    try {
      if (!captured.result)
        captured.result = await send(captured.payload, captured.userId)
      if (captured !== attempt)
        return
      const { conversation, message } = captured.result
      if (!conversation && !message) {
        captured.notice = '咨询已记录，暂无接待人员，暂时无法开始聊天'
        return
      }
      if (!conversation?.id || !conversation.organization.slug || message?.conversation_id !== conversation.id) {
        captured.notice = '咨询已记录，聊天暂时无法打开'
        return
      }
      captured.notice = '联系方式已发送'
      publish()
      if (!active || userId !== captured.userId)
        return
      try {
        setContactVisible(false)
        await navigate(getConversationRoute(conversation.id, conversation.organization.slug, 'business_party'))
      }
      catch {
        if (captured === attempt) {
          captured.error = '联系方式已发送，聊天页面暂时无法打开，请点击“打开聊天”重试'
          if (active && userId === captured.userId)
            setContactVisible(true)
        }
      }
    }
    catch (error) {
      if (captured === attempt)
        captured.error = error instanceof Error ? error.message : '发送失败，请稍后重试'
    }
    finally {
      if (captured === attempt) {
        captured.sending = false
        publish()
      }
    }
  }

  return { setContext, setActive, submit }
}
