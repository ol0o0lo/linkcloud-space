import type { Conversation, MessagingContext, MessagingMessage, PersonalMessagingOrganization } from './types.ts'

export function messagingRequestScope(context: MessagingContext) {
  return context.accessKind === 'organization_member'
    ? { kind: 'organization' as const, organizationSlug: context.organizationSlug }
    : { kind: 'personal' as const }
}

export function messagingSendOptions(context: MessagingContext, currentUserId: () => number | null) {
  return {
    requestScope: messagingRequestScope(context),
    authRetry: 'safe' as const,
    authReplayGuard: () => currentUserId() === context.userId,
  }
}

export function messagingContextKey(context: MessagingContext | null, conversationId?: number): string {
  return context ? JSON.stringify([context.userId, context.accessKind, context.organizationSlug, context.namespace || '', conversationId || 0]) : ''
}

export function conversationTitle(conversation: Conversation): string {
  return conversation.members.find(member => member.id !== conversation.my_member_id)?.display_name || '聊天'
}

export function mergeMessages(current: MessagingMessage[], incoming: MessagingMessage[]): MessagingMessage[] {
  const bySequence = new Map(current.map(message => [message.seq, message]))
  incoming.forEach(message => bySequence.set(message.seq, message))
  return Array.from(bySequence.values()).sort((left, right) => left.seq - right.seq)
}

/** 所有重试复用第一次生成的 UUID；此函数只用于创建新的发送项。 */
export function createMessageUuid(random = Math.random): string {
  if (typeof globalThis.crypto?.randomUUID === 'function')
    return globalThis.crypto.randomUUID()
  return '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, value => (Number(value) ^ Math.floor(random() * 16) >> Number(value) / 4).toString(16))
}

export function choosePersonalMessagingOrganization(items: PersonalMessagingOrganization[], rememberedSlug: string): string {
  if (items.length === 1)
    return items[0].slug
  return items.some(item => item.slug === rememberedSlug) ? rememberedSlug : ''
}

export function personalMessagingSelectionKey(userId: number, namespace = ''): string {
  return `messaging-organization:${userId}:${namespace}`
}

export function rememberMessagingOrganization(userId: number, slug: string, namespace = '') {
  uni.setStorageSync(personalMessagingSelectionKey(userId, namespace), slug)
}

export function recalledMessagingOrganization(userId: number, namespace = ''): string {
  const value: unknown = uni.getStorageSync(personalMessagingSelectionKey(userId, namespace))
  return typeof value === 'string' ? value : ''
}
