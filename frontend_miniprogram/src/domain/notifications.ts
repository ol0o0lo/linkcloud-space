import type { RequestScope } from '../infra/http/request-scope.ts'
import type { AppMode } from './app-mode.ts'

export type NotificationReadFilter = 'all' | 'unread' | 'read'
export type NotificationChannel = 'in_app' | 'email'

export interface NotificationScopeInput {
  mode: AppMode
  organizationSlug?: string
  landlordContactId?: number | null
}

export interface NotificationCategoryPresentation {
  label: string
  icon: string
  tone: 'default' | 'primary' | 'success' | 'warning'
}

export function resolveNotificationScope(input: NotificationScopeInput): RequestScope {
  if (input.mode === 'personal')
    return { kind: 'personal' }
  if (input.mode === 'landlord') {
    if (!input.landlordContactId)
      throw new Error('当前房东关系已失效')
    return { kind: 'landlord', landlordContactId: input.landlordContactId }
  }
  if (input.mode === 'organization') {
    if (!input.organizationSlug)
      throw new Error('未选择组织，请先切换到中介端')
    return { kind: 'organization', organizationSlug: input.organizationSlug }
  }
  throw new Error('登录后才能查看消息')
}

export function getNotificationFilterParam(filter: NotificationReadFilter): 'true' | 'false' | undefined {
  if (filter === 'read')
    return 'true'
  if (filter === 'unread')
    return 'false'
  return undefined
}

export function getNotificationTone(isRead: boolean): 'default' | 'warning' {
  return isRead ? 'default' : 'warning'
}

export function getNotificationCategoryPresentation(category: string): NotificationCategoryPresentation {
  if (category.startsWith('team.task'))
    return { label: '团队任务', icon: 'i-carbon-task', tone: 'warning' }
  if (category === 'team.announcement')
    return { label: '团队公告', icon: 'i-carbon-notification', tone: 'primary' }
  if (category === 'subscription.billing')
    return { label: '订阅与支付', icon: 'i-carbon-receipt', tone: 'success' }
  if (category === 'allocation.status')
    return { label: '收益分配', icon: 'i-carbon-chart-line', tone: 'success' }
  return { label: '其他通知', icon: 'i-carbon-notification', tone: 'default' }
}

export function isRequiredNotificationChannel(
  preference: { required_channels?: string[] },
  channel: NotificationChannel,
): boolean {
  return preference.required_channels?.includes(channel) || false
}
