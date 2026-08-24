import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { message } from 'antd';
import dayjs from 'dayjs';
import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { useTenantWorkspace } from '@/pages/space/shared';
import {
  acceptTaskAssignment,
  completeTaskAssignment,
  getDailyTeamOperationsDashboard,
  listTeamAnnouncements,
  type DailyDashboard,
  type TeamAnnouncement,
} from '@/services/manual/teamOperations';
import {
  invalidateTeamOperations,
  teamOperationsQueryKeys,
} from '../../shared';

const REFRESH_INTERVAL = 60_000;
const DASHBOARD_WIDGET_IDS = new Set([
  'mine-summary',
  'mine-priority',
  'mine-progress',
]);

export type MineWorkbenchDataValue = {
  dashboard?: DailyDashboard;
  dashboardLoading: boolean;
  dashboardError: boolean;
  retryDashboard: () => void;
  announcements: TeamAnnouncement[];
  announcementsLoading: boolean;
  announcementsError: boolean;
  retryAnnouncements: () => void;
  acceptingId?: number;
  completingId?: number;
  accept: (assignmentId: number) => Promise<unknown>;
  complete: (assignmentId: number) => Promise<unknown>;
  isFetching: boolean;
  updatedAt: string | null;
};

const MineWorkbenchDataContext = createContext<MineWorkbenchDataValue | null>(
  null,
);

type MineWorkbenchDataProviderProps = {
  visibleWidgetIds: ReadonlySet<string>;
  onDataStatusChange?: (
    isFetching: boolean,
    updatedAt: string | null,
  ) => void;
  children: ReactNode;
};

export function MineWorkbenchDataProvider({
  visibleWidgetIds,
  onDataStatusChange,
  children,
}: MineWorkbenchDataProviderProps) {
  const workspace = useTenantWorkspace();
  const queryClient = useQueryClient();
  const tenantEnabled = Boolean(workspace.selectedOrgSlug);
  const dashboardEnabled =
    tenantEnabled &&
    [...DASHBOARD_WIDGET_IDS].some((id) => visibleWidgetIds.has(id));
  const announcementsEnabled =
    tenantEnabled && visibleWidgetIds.has('mine-announcements');

  const dashboardQuery = useQuery({
    queryKey: teamOperationsQueryKeys.dashboard(workspace.selectedOrgSlug),
    queryFn: getDailyTeamOperationsDashboard,
    enabled: dashboardEnabled,
    refetchInterval: REFRESH_INTERVAL,
    refetchIntervalInBackground: false,
  });
  const announcementsQuery = useQuery({
    queryKey: teamOperationsQueryKeys.announcements(
      workspace.selectedOrgSlug,
      1,
      'published',
    ),
    queryFn: () =>
      listTeamAnnouncements({ page: 1, page_size: 3, status: 'published' }),
    enabled: announcementsEnabled,
    refetchInterval: REFRESH_INTERVAL,
    refetchIntervalInBackground: false,
  });
  const acceptMutation = useMutation({
    mutationFn: acceptTaskAssignment,
    onSuccess: async () => {
      message.success('任务已接受');
      await invalidateTeamOperations(queryClient);
    },
  });
  const completeMutation = useMutation({
    mutationFn: (assignmentId: number) => completeTaskAssignment(assignmentId),
    onSuccess: async () => {
      message.success('任务已完成');
      await invalidateTeamOperations(queryClient);
    },
  });
  const updatedAtValue = Math.max(
    dashboardQuery.dataUpdatedAt,
    announcementsQuery.dataUpdatedAt,
  );
  const updatedAt = updatedAtValue
    ? dayjs(updatedAtValue).format('HH:mm')
    : null;
  const isFetching =
    dashboardQuery.isFetching || announcementsQuery.isFetching;

  useEffect(() => {
    onDataStatusChange?.(isFetching, updatedAt);
  }, [isFetching, onDataStatusChange, updatedAt]);

  const value: MineWorkbenchDataValue = {
    dashboard: dashboardQuery.data,
    dashboardLoading: dashboardQuery.isLoading,
    dashboardError: dashboardQuery.isError,
    retryDashboard: () => void dashboardQuery.refetch(),
    announcements: announcementsQuery.data?.items || [],
    announcementsLoading: announcementsQuery.isLoading,
    announcementsError: announcementsQuery.isError,
    retryAnnouncements: () => void announcementsQuery.refetch(),
    acceptingId: acceptMutation.isPending
      ? acceptMutation.variables
      : undefined,
    completingId: completeMutation.isPending
      ? completeMutation.variables
      : undefined,
    accept: (assignmentId) => acceptMutation.mutateAsync(assignmentId),
    complete: (assignmentId) => completeMutation.mutateAsync(assignmentId),
    isFetching,
    updatedAt,
  };

  return (
    <MineWorkbenchDataContext.Provider value={value}>
      {children}
    </MineWorkbenchDataContext.Provider>
  );
}

export function useMineWorkbenchData() {
  const value = useContext(MineWorkbenchDataContext);
  if (!value) {
    throw new Error('useMineWorkbenchData must be used inside its provider');
  }
  return value;
}
