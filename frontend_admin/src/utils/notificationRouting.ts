import {
  ADMIN_BASE_PATH,
  getSafeAdminRedirect,
  SPACE_PATHS,
} from './adminRouting';

export const NOTIFICATIONS_PATH = '/personal-business/notifications';

export function getNotificationPath(item: API.NotificationOut) {
  return getSafeAdminRedirect(
    getNotificationUrl(item),
    `${NOTIFICATIONS_PATH}?notification_id=${item.id}`,
  );
}

export function getNotificationUrl(item: API.NotificationOut) {
  if (item.category !== 'messaging.message') return item.url;

  const id = Number(item.data?.conversation_id);
  const slug = item.data?.organization_slug;
  if (
    !Number.isSafeInteger(id) ||
    id <= 0 ||
    typeof slug !== 'string' ||
    !slug.trim()
  )
    return undefined;

  const params = new URLSearchParams({
    conversation_id: String(id),
    organization_slug: slug.trim(),
  });
  return `${ADMIN_BASE_PATH}${SPACE_PATHS.messaging}?${params}`;
}
