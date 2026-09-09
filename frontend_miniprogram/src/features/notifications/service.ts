export {
  requestNotification as getNotification,
  requestUnreadNotificationCount as getUnreadNotificationCount,
  requestNotificationPreferences as listNotificationPreferences,
  requestNotifications as listNotifications,
  markAllNotificationsRead,
  removeNotification,
  updateNotificationPreference,
  updateNotificationReadState,
} from '@/services/manual/notifications'

export type {
  NotificationOut,
  NotificationPreferenceOut,
  PagedNotificationOut,
  UnreadCountOut,
} from '@/services/manual/notifications'
