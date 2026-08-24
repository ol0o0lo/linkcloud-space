import type { QueryClient } from '@tanstack/react-query';

export const teamOperationsQueryKeys = {
  all: ['team-operations'] as const,
  capabilities: (orgSlug?: string) =>
    ['team-operations', 'capabilities', orgSlug] as const,
  dashboard: (orgSlug?: string) =>
    ['team-operations', 'dashboard', orgSlug] as const,
  announcements: (
    orgSlug?: string,
    page?: number,
    status?: string,
    keyword?: string,
  ) =>
    [
      'team-operations',
      'announcements',
      orgSlug,
      page,
      status,
      keyword,
    ] as const,
  tasks: (orgSlug?: string, page?: number, filters?: object) =>
    ['team-operations', 'tasks', orgSlug, page, filters] as const,
  taskSummary: (orgSlug?: string, filters?: object) =>
    ['team-operations', 'tasks', 'summary', orgSlug, filters] as const,
  assignments: (orgSlug?: string, page?: number, filters?: object) =>
    ['team-operations', 'assignments', orgSlug, page, filters] as const,
  assignmentSummary: (orgSlug?: string, filters?: object) =>
    ['team-operations', 'assignments', 'summary', orgSlug, filters] as const,
};

export function priorityColor(priority?: string) {
  if (priority === 'urgent') return 'red';
  if (priority === 'high') return 'orange';
  return 'default';
}

export function assignmentStatusColor(status?: string) {
  if (status === 'pending') return 'gold';
  if (status === 'in_progress') return 'blue';
  if (status === 'completed') return 'green';
  if (status === 'rejected') return 'red';
  return 'default';
}

export function taskStatusColor(status?: string) {
  if (status === 'active') return 'blue';
  if (status === 'completed') return 'green';
  return 'default';
}

export function announcementStatusColor(status?: string) {
  if (status === 'draft') return 'gold';
  if (status === 'published') return 'green';
  return 'default';
}

export async function invalidateTeamOperations(queryClient: QueryClient) {
  await queryClient.invalidateQueries({
    queryKey: teamOperationsQueryKeys.all,
  });
  await queryClient.invalidateQueries({
    queryKey: ['platform-management', 'notifications'],
  });
  await queryClient.invalidateQueries({ queryKey: ['notification-bell'] });
}
