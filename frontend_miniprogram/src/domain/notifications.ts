import type { RequestScope } from '../infra/http/request-scope.ts'
import type { AppMode, AppModeSelection } from './app-mode.ts'
import { withRouteWorkspace } from './route-access.ts'
import {
  APP_ROUTES,
  getConversationRoute,
  getHouseDetailRoute,
  getOrganizationAllocationDetailRoute,
  getOrganizationAnnouncementDetailRoute,
  getOrganizationTaskDetailRoute,
} from '../modules/routes.ts'

export type NotificationReadFilter = 'all' | 'unread' | 'read'
export type NotificationChannel = 'in_app' | 'email'

export interface NotificationScopeInput {
  userId?: number
  mode: AppMode
  organizationSlug?: string
  landlordContactId?: number | null
}

export interface NotificationCategoryPresentation {
  label: string
  icon: string
  tone: 'default' | 'primary' | 'success' | 'warning'
}

export interface NotificationActionInput {
  workspace?: AppModeSelection
  category?: string
  data?: Record<string, unknown> | null
  targetType?: string | null
  targetId?: number | null
  url?: string | null
  expiresAt?: string | null
}

export type NotificationAction
  = | { kind: 'internal', route: string, label: string }
    | { kind: 'external', url: string, label: string }

function positiveInteger(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : null
}

function queryPositiveInteger(value: string | null): number | null {
  if (!value || !/^\d+$/.test(value))
    return null
  return positiveInteger(Number(value))
}

function getStructuredTargetId(input: NotificationActionInput, dataKey: string): number | null {
  return positiveInteger(input.data?.[dataKey]) || positiveInteger(input.targetId)
}

function resolveStructuredNotificationAction(input: NotificationActionInput): NotificationAction | null {
  const category = input.category || ''
  if (category === 'messaging.message') {
    const id = positiveInteger(input.data?.conversation_id)
    const slug = input.data?.organization_slug
    return id && typeof slug === 'string' && slug.trim()
      ? { kind: 'internal', route: getConversationRoute(id, slug, 'organization_member'), label: '查看聊天' }
      : null
  }
  if (category.startsWith('team.task.')) {
    const assignmentId = positiveInteger(input.data?.assignment_id)
    const taskId = positiveInteger(input.data?.task_id)
    const preferTask = category === 'team.task.completed' || category === 'team.task.rejected'
    if (preferTask && taskId)
      return { kind: 'internal', route: getOrganizationTaskDetailRoute({ taskId }), label: '查看任务' }
    if (assignmentId)
      return { kind: 'internal', route: getOrganizationTaskDetailRoute({ assignmentId }), label: '查看任务' }
    if (taskId)
      return { kind: 'internal', route: getOrganizationTaskDetailRoute({ taskId }), label: '查看任务' }
  }

  if (category === 'team.announcement') {
    if (input.data?.withdrawn === true)
      return null
    const announcementId = getStructuredTargetId(input, 'announcement_id')
    if (announcementId)
      return { kind: 'internal', route: getOrganizationAnnouncementDetailRoute(announcementId), label: '查看公告' }
  }

  if (category === 'allocation.status') {
    const allocationRequestId = getStructuredTargetId(input, 'allocation_request_id')
    if (allocationRequestId)
      return { kind: 'internal', route: getOrganizationAllocationDetailRoute(allocationRequestId), label: '查看收益申请' }
  }

  if (category === 'house.contact') {
    const inquiryId = getStructuredTargetId(input, 'inquiry_id')
    if (inquiryId)
      return { kind: 'internal', route: `${APP_ROUTES.organizationInquiryDetail}?id=${inquiryId}`, label: '处理咨询' }
    const houseId = getStructuredTargetId(input, 'house_id')
    if (houseId)
      return { kind: 'internal', route: getHouseDetailRoute(houseId), label: '查看房源' }
  }

  if (category === 'subscription.billing')
    return { kind: 'internal', route: APP_ROUTES.organizationAdminSubscription, label: '查看订阅' }

  return null
}

function resolveLegacyNotificationUrl(url: string | null | undefined): NotificationAction | null {
  const normalized = url?.trim()
  if (!normalized)
    return null
  if (/^https:\/\//i.test(normalized))
    return { kind: 'external', url: normalized, label: '打开链接' }
  if (!normalized.startsWith('/') || normalized.startsWith('//'))
    return null

  const parsed = new URL(normalized, 'https://notification.internal')
  if (parsed.pathname === '/dashboard/rental/workbench/tasks') {
    const assignmentId = queryPositiveInteger(parsed.searchParams.get('assignment_id'))
    const taskId = queryPositiveInteger(parsed.searchParams.get('task_id'))
    if (assignmentId)
      return { kind: 'internal', route: getOrganizationTaskDetailRoute({ assignmentId }), label: '查看任务' }
    if (taskId)
      return { kind: 'internal', route: getOrganizationTaskDetailRoute({ taskId }), label: '查看任务' }
    return null
  }
  if (parsed.pathname === '/dashboard/rental/workbench/announcements') {
    const announcementId = queryPositiveInteger(parsed.searchParams.get('announcement_id'))
    return announcementId ? { kind: 'internal', route: getOrganizationAnnouncementDetailRoute(announcementId), label: '查看公告' } : null
  }
  if (parsed.pathname === '/dashboard/rental/earnings' && parsed.searchParams.get('tab') === 'reviews') {
    const allocationRequestId = queryPositiveInteger(parsed.searchParams.get('request'))
    return allocationRequestId ? { kind: 'internal', route: getOrganizationAllocationDetailRoute(allocationRequestId), label: '查看收益申请' } : null
  }
  if (parsed.pathname === '/dashboard/space/subscription' || parsed.pathname === '/dashboard/space/subscription/orders')
    return { kind: 'internal', route: APP_ROUTES.organizationAdminSubscription, label: '查看订阅' }
  return null
}

export function resolveNotificationAction(input: NotificationActionInput, now = Date.now()): NotificationAction | null {
  if (input.expiresAt) {
    const expiresAt = new Date(input.expiresAt).getTime()
    if (Number.isFinite(expiresAt) && expiresAt <= now)
      return null
  }

  if (input.category === 'team.announcement' && input.data?.withdrawn === true)
    return null
  const action = resolveStructuredNotificationAction(input) || resolveLegacyNotificationUrl(input.url)
  if (action?.kind === 'internal' && input.workspace)
    return { ...action, route: withRouteWorkspace(action.route, input.workspace) }
  return action
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
      throw new Error('未选择工作空间，请先切换到经纪人身份')
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
  if (category === 'messaging.message')
    return { label: '聊天提醒', icon: 'i-carbon-chat', tone: 'primary' }
  if (category === 'house.contact')
    return { label: '预约联系', icon: 'i-carbon-chat', tone: 'primary' }
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
