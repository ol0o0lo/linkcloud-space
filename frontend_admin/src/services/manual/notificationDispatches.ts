import { request } from '@umijs/max';

export type NotificationDispatchTarget = {
  id: number;
  label: string;
  description?: string;
  avatar_url?: string | null;
};

export type NotificationDispatchTargetPage = {
  items: NotificationDispatchTarget[];
  total: number;
  page: number;
  page_size: number;
};

export type NotificationDispatchTargetScope =
  | 'organization'
  | 'teams'
  | 'users';

export type NotificationDispatchManagementContext =
  | 'auto'
  | 'platform'
  | 'tenant';

export function listNotificationDispatchTargets(params: {
  scope: NotificationDispatchTargetScope;
  management_context?: NotificationDispatchManagementContext;
  keyword?: string;
  page?: number;
  page_size?: number;
}) {
  return request<NotificationDispatchTargetPage>(
    '/api/notification-dispatches/targets/',
    {
      method: 'GET',
      params,
    },
  );
}
