import type { NotificationScopeInput } from '@/domain/notifications'
import { resolveNotificationScope } from '@/domain/notifications'
import { tabbarStore } from '@/tabbar/store'
import { choosePersonalMessagingOrganization, recalledMessagingOrganization } from '@/features/messaging/context'
import { createUnreadBadgeState } from '@/features/messaging/unread-badge'
import { getMessagingUnreadCount, listPersonalMessagingOrganizations } from '@/services/manual/messaging'
import type { PersonalMessagingOrganization } from '@/features/messaging/types'
import { getUnreadNotificationCount } from './service'

const badge = createUnreadBadgeState()

function applyUnreadCount() {
  tabbarStore.setTabbarItemBadge('messages', badge.value())
}

export function setNotificationTabbarUnreadCount(count: number) {
  badge.set('notifications', count)
  applyUnreadCount()
}

export function setMessagingTabbarUnreadCount(count: number) {
  badge.set('messages', count)
  applyUnreadCount()
}

async function messagingCount(input: NotificationScopeInput, isCurrent: () => boolean) {
  const userId = input.userId || 0
  if (input.mode === 'organization' && input.organizationSlug)
    return (await getMessagingUnreadCount({ userId, accessKind: 'organization_member', organizationSlug: input.organizationSlug })).message_count
  if (!userId)
    return 0
  const organizations: PersonalMessagingOrganization[] = []
  for (let page = 1; ; page++) {
    if (!isCurrent())
      return 0
    const result = await listPersonalMessagingOrganizations(page)
    if (!isCurrent())
      return 0
    organizations.push(...result.items)
    if (!result.items.length || organizations.length >= result.total)
      break
  }
  const selected = choosePersonalMessagingOrganization(organizations, recalledMessagingOrganization(userId))
  if (!selected)
    return 0
  return organizations.find(item => item.slug === selected)?.unread_count || 0
}

export async function syncNotificationTabbarBadge(input: NotificationScopeInput) {
  const scopeKey = `${input.userId || 0}:${input.mode}:${input.organizationSlug || ''}:${input.landlordContactId || ''}`
  badge.setScope(scopeKey)
  applyUnreadCount()
  const currentNotificationGeneration = badge.begin('notifications')
  const currentMessagingGeneration = badge.begin('messages')
  if (input.mode === 'visitor') {
    return 0
  }
  const [notifications] = await Promise.allSettled([
    getUnreadNotificationCount(resolveNotificationScope(input)).then((result) => {
      badge.set('notifications', result.count, currentNotificationGeneration)
      applyUnreadCount()
      return result.count
    }),
    messagingCount(input, () => badge.isCurrent('messages', currentMessagingGeneration)).then((count) => {
      badge.set('messages', count, currentMessagingGeneration)
      applyUnreadCount()
    }),
  ])
  return notifications.status === 'fulfilled' ? notifications.value : null
}
