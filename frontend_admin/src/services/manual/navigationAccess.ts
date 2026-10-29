import { request } from '@umijs/max';

export type NavigationAccessCapabilities = {
  role_management: boolean;
  organization_settings: boolean;
  team_settings: boolean;
  subscriptions: boolean;
  subscriptions_manage: boolean;
  analytics: boolean;
  allocation: boolean;
  notification_dispatches: boolean;
};

export function getNavigationAccessCapabilities(organizationSlug?: string) {
  return request<NavigationAccessCapabilities>('/api/access/navigation/', {
    method: 'GET',
    ...(organizationSlug ? { headers: { 'X-Org-Slug': organizationSlug } } : {}),
  });
}
