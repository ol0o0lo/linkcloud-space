import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { createContext, type ReactNode, useContext, useEffect } from 'react';
import {
  canHousePublish,
  HOUSE_STATUS,
} from '@/pages/rental/constants';
import { useHousePublishRules } from '@/pages/rental/useHousePublishRules';
import { useTenantWorkspace } from '@/pages/space/shared';
import {
  houseApi,
  type HouseOut,
} from '@/services/manual/house';
import {
  buildPublishWorkbenchRows,
  buildSpaceRisks,
  buildWorkflowTasks,
  type PublishWorkbenchRow,
  type SpaceRisk,
  type WorkflowTaskRow,
} from '../widgets/space/model';

const REFRESH_INTERVAL = 60_000;
const HOUSE_WIDGET_IDS = new Set([
  'space-overview',
  'space-publish',
  'space-risks',
]);
const WORKFLOW_WIDGET_IDS = new Set([
  'space-overview',
  'space-risks',
  'space-workflow',
]);

export type SpaceWorkbenchDataValue = {
  totalHouseCount: number;
  blockedHouseItems: HouseOut[];
  readyHouseItems: HouseOut[];
  missingContactCount: number;
  readyLeaseCount: number;
  publishRows: PublishWorkbenchRow[];
  workflowTasks: WorkflowTaskRow[];
  risks: SpaceRisk[];
  overviewLoading: boolean;
  overviewError: boolean;
  publishLoading: boolean;
  publishError: boolean;
  workflowLoading: boolean;
  workflowError: boolean;
  isFetching: boolean;
  updatedAt: string | null;
  retryOverview: () => void;
  retryPublish: () => void;
  retryWorkflow: () => void;
  publishHouse: (houseId: number) => Promise<unknown>;
  publishing: boolean;
};

const SpaceWorkbenchDataContext =
  createContext<SpaceWorkbenchDataValue | null>(null);

type SpaceWorkbenchDataProviderProps = {
  visibleWidgetIds: ReadonlySet<string>;
  onDataStatusChange?: (
    isFetching: boolean,
    updatedAt: string | null,
  ) => void;
  children: ReactNode;
};

const hasAnyVisibleWidget = (
  visibleWidgetIds: ReadonlySet<string>,
  candidates: ReadonlySet<string>,
) => [...candidates].some((id) => visibleWidgetIds.has(id));

export function SpaceWorkbenchDataProvider({
  visibleWidgetIds,
  onDataStatusChange,
  children,
}: SpaceWorkbenchDataProviderProps) {
  const workspace = useTenantWorkspace();
  const queryClient = useQueryClient();
  const publishRules = useHousePublishRules();
  const tenantEnabled = Boolean(workspace.selectedOrgSlug);
  const housesEnabled =
    tenantEnabled && hasAnyVisibleWidget(visibleWidgetIds, HOUSE_WIDGET_IDS);
  const workflowEnabled =
    tenantEnabled && hasAnyVisibleWidget(visibleWidgetIds, WORKFLOW_WIDGET_IDS);

  const houses = useQuery({
    queryKey: ['house', 'workbench', 'houses', workspace.selectedOrgSlug],
    queryFn: () => houseApi.listHouses({ page: 1, page_size: 100 }),
    enabled: housesEnabled,
    refetchInterval: REFRESH_INTERVAL,
    refetchIntervalInBackground: false,
  });
  const pendingLeaseMissingContacts = useQuery({
    queryKey: [
      'house',
      'workbench',
      'pending-lease-missing-contacts',
      workspace.selectedOrgSlug,
    ],
    queryFn: () =>
      houseApi.listViewingRecords({
        page: 1,
        page_size: 5,
        pending_lease: true,
        contact_missing: true,
      }),
    enabled: workflowEnabled,
    refetchInterval: REFRESH_INTERVAL,
    refetchIntervalInBackground: false,
  });
  const pendingLeaseReady = useQuery({
    queryKey: [
      'house',
      'workbench',
      'pending-lease-ready',
      workspace.selectedOrgSlug,
    ],
    queryFn: () =>
      houseApi.listViewingRecords({
        page: 1,
        page_size: 5,
        pending_lease: true,
        contact_missing: false,
      }),
    enabled: workflowEnabled,
    refetchInterval: REFRESH_INTERVAL,
    refetchIntervalInBackground: false,
  });
  const publishMutation = useMutation({
    mutationFn: (houseId: number) =>
      houseApi.patchHouse(houseId, { status: HOUSE_STATUS.LISTED }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['house', 'workbench'] });
      await queryClient.invalidateQueries({ queryKey: ['house', 'houses'] });
    },
  });

  const houseItems = houses.data?.items || [];
  const blockedHouseItems = publishRules.isPending
    ? []
    : houseItems.filter(
        (house) =>
          house.status === HOUSE_STATUS.VACANT &&
          !canHousePublish(house, publishRules.rules),
      );
  const readyHouseItems = publishRules.isPending
    ? []
    : houseItems.filter(
        (house) =>
          house.status === HOUSE_STATUS.VACANT &&
          canHousePublish(house, publishRules.rules),
      );
  const missingContactCount = pendingLeaseMissingContacts.data?.total || 0;
  const readyLeaseCount = pendingLeaseReady.data?.total || 0;
  const workflowLoading =
    pendingLeaseMissingContacts.isLoading || pendingLeaseReady.isLoading;
  const workflowError =
    pendingLeaseMissingContacts.isError || pendingLeaseReady.isError;
  const publishLoading = houses.isLoading || publishRules.isPending;
  const publishError = houses.isError || publishRules.isError;
  const isFetching =
    houses.isFetching ||
    pendingLeaseMissingContacts.isFetching ||
    pendingLeaseReady.isFetching ||
    publishRules.isFetching;
  const updatedAtValue = Math.max(
    houses.dataUpdatedAt,
    pendingLeaseMissingContacts.dataUpdatedAt,
    pendingLeaseReady.dataUpdatedAt,
    publishRules.dataUpdatedAt || 0,
  );
  const updatedAt = updatedAtValue
    ? dayjs(updatedAtValue).format('HH:mm')
    : null;

  useEffect(() => {
    onDataStatusChange?.(isFetching, updatedAt);
  }, [isFetching, onDataStatusChange, updatedAt]);

  const value: SpaceWorkbenchDataValue = {
    totalHouseCount: houses.data?.total || 0,
    blockedHouseItems,
    readyHouseItems,
    missingContactCount,
    readyLeaseCount,
    publishRows: buildPublishWorkbenchRows(
      blockedHouseItems.slice(0, 5),
      readyHouseItems.slice(0, 5),
      publishRules.rules,
    ),
    workflowTasks: buildWorkflowTasks(
      pendingLeaseMissingContacts.data?.items || [],
      pendingLeaseReady.data?.items || [],
    ),
    risks: buildSpaceRisks({
      blockedCount: blockedHouseItems.length,
      missingContactCount,
      readyLeaseCount,
    }),
    overviewLoading: publishLoading || workflowLoading,
    overviewError: publishError || workflowError,
    publishLoading,
    publishError,
    workflowLoading,
    workflowError,
    isFetching,
    updatedAt,
    retryOverview: () => {
      void houses.refetch();
      void publishRules.refetch();
      void pendingLeaseMissingContacts.refetch();
      void pendingLeaseReady.refetch();
    },
    retryPublish: () => {
      void houses.refetch();
      void publishRules.refetch();
    },
    retryWorkflow: () => {
      void pendingLeaseMissingContacts.refetch();
      void pendingLeaseReady.refetch();
    },
    publishHouse: (houseId) => publishMutation.mutateAsync(houseId),
    publishing: publishMutation.isPending,
  };

  return (
    <SpaceWorkbenchDataContext.Provider value={value}>
      {children}
    </SpaceWorkbenchDataContext.Provider>
  );
}

export function useSpaceWorkbenchData() {
  const value = useContext(SpaceWorkbenchDataContext);
  if (!value) {
    throw new Error('useSpaceWorkbenchData must be used inside its provider');
  }
  return value;
}
