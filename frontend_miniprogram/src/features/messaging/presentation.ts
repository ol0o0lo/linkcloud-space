import type { Conversation } from './types.ts'

export function conversationPeer(conversation: Conversation) {
  return conversation.members.find(member => member.id !== conversation.my_member_id)
}

export function conversationLabel(conversation: Conversation): string {
  if (conversation.namespace === 'real_estate.inquiry')
    return '房源咨询'
  return conversationPeer(conversation)?.access_kind === 'organization_member' ? '空间成员' : '咨询用户'
}

function dayNumber(date: Date) {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000
}

export function messageDayKey(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`
}

export function formatMessageClock(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })
}

export function formatMessageTime(value?: string, now = new Date()): string {
  if (!value)
    return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime()))
    return ''
  const days = dayNumber(now) - dayNumber(date)
  if (days === 0)
    return formatMessageClock(value)
  if (days === 1)
    return '昨天'
  if (days > 1 && days < 7)
    return date.toLocaleDateString('zh-CN', { weekday: 'short' })
  return date.toLocaleDateString('zh-CN', { ...(date.getFullYear() === now.getFullYear() ? {} : { year: 'numeric' as const }), month: 'numeric', day: 'numeric' })
}

export function formatMessageDay(value: string, now = new Date()): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime()))
    return ''
  const days = dayNumber(now) - dayNumber(date)
  return days === 0 ? '今天' : days === 1 ? '昨天' : date.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })
}

export function showMessageTime(value: string, previous?: string): boolean {
  return !previous || messageDayKey(value) !== messageDayKey(previous) || new Date(value).getTime() - new Date(previous).getTime() >= 5 * 60000
}

/** ChatSender 当前版本的 change/send 事件使用 { value }，同时兼容字符串形式。 */
export function senderInputValue(event: unknown): string {
  if (typeof event === 'string')
    return event
  return event && typeof event === 'object' && 'value' in event && typeof event.value === 'string' ? event.value : ''
}
