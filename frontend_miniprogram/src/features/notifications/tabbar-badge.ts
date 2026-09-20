import type { NotificationScopeInput } from '@/domain/notifications'
import { resolveNotificationScope } from '@/domain/notifications'
import { tabbarStore } from '@/tabbar/store'
import { getUnreadNotificationCount } from './service'

let syncGeneration = 0
let activeScopeKey = ''

function applyUnreadCount(count: number) {
  tabbarStore.setTabbarItemBadge('messages', count > 0 ? count : undefined)
}

export function setNotificationTabbarUnreadCount(count: number) {
  syncGeneration += 1
  applyUnreadCount(count)
}

export async function syncNotificationTabbarBadge(input: NotificationScopeInput) {
  const currentGeneration = ++syncGeneration
  const scopeKey = `${input.mode}:${input.organizationSlug || ''}:${input.landlordContactId || ''}`
  if (scopeKey !== activeScopeKey) {
    activeScopeKey = scopeKey
    applyUnreadCount(0)
  }
  if (input.mode === 'visitor') {
    return 0
  }

  try {
    const result = await getUnreadNotificationCount(resolveNotificationScope(input))
    if (currentGeneration === syncGeneration)
      applyUnreadCount(result.count)
    return result.count
  }
  catch {
    return null
  }
}
