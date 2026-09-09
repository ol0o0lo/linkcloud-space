import type { RequestScope } from '@/infra/http/request-scope'
import {
  notificationsBulkUsingPost,
  notificationsNotificationIdUsingDelete,
  notificationsNotificationIdUsingGet,
  notificationsNotificationIdUsingPatch,
  notificationsPreferencesCategoryUsingPatch,
  notificationsPreferencesUsingGet,
  notificationsUnreadCountUsingGet,
  notificationsUsingGet,
} from '@/services/openapi/xiaoxi'

export type {
  BulkActionIn,
  BulkResultOut,
  NotificationOut,
  NotificationPatchIn,
  NotificationPreferenceOut,
  NotificationPreferencePatchIn,
  PagedNotificationOut,
  UnreadCountOut,
} from '@/services/openapi/types'

function readOptions(requestScope: RequestScope) {
  return { requestScope, authRetry: 'safe' as const }
}

function writeOptions(requestScope: RequestScope) {
  return { requestScope }
}

export function requestNotifications(requestScope: RequestScope, page: number, pageSize: number, isRead?: 'true' | 'false') {
  return notificationsUsingGet({ params: { page, page_size: pageSize, is_read: isRead }, options: readOptions(requestScope) })
}

export function requestNotification(requestScope: RequestScope, notificationId: number) {
  return notificationsNotificationIdUsingGet({ params: { notification_id: notificationId }, options: readOptions(requestScope) })
}

export function updateNotificationReadState(requestScope: RequestScope, notificationId: number, isRead: boolean) {
  return notificationsNotificationIdUsingPatch({ params: { notification_id: notificationId }, body: { is_read: isRead }, options: writeOptions(requestScope) })
}

export function removeNotification(requestScope: RequestScope, notificationId: number) {
  return notificationsNotificationIdUsingDelete({ params: { notification_id: notificationId }, options: writeOptions(requestScope) })
}

export function markAllNotificationsRead(requestScope: RequestScope) {
  return notificationsBulkUsingPost({ body: { action: 'mark_read', all_unread: true }, options: writeOptions(requestScope) })
}

export function requestUnreadNotificationCount(requestScope: RequestScope) {
  return notificationsUnreadCountUsingGet({ options: readOptions(requestScope) })
}

export function requestNotificationPreferences() {
  return notificationsPreferencesUsingGet({ options: readOptions({ kind: 'personal' }) })
}

export function updateNotificationPreference(category: string, patch: { in_app?: boolean, email?: boolean }) {
  return notificationsPreferencesCategoryUsingPatch({ params: { category }, body: patch, options: writeOptions({ kind: 'personal' }) })
}
