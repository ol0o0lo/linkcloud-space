import { request } from '@umijs/max';

export type NavigationAccessCapabilities = {
  role_management: boolean;
  organization_settings: boolean;
  team_settings: boolean;
  subscriptions: boolean;
  analytics: boolean;
  allocation: boolean;
  notification_dispatches: boolean;
};

export function getNavigationAccessCapabilities() {
  return request<NavigationAccessCapabilities>('/api/access/navigation/', {
    method: 'GET',
  });
}
