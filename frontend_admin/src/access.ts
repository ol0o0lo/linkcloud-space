import { canAccessSpaceWorkbench } from '@/pages/team-operations/workbench/view';
import type { NavigationAccessCapabilities } from '@/services/manual/navigationAccess';
import type { TeamOperationsCapabilities } from '@/services/manual/teamOperations';

/**
 * @see https://umijs.org/docs/max/access#access
 * */
export default function access(
  initialState:
    | {
        currentUser?: API.MeOut;
        teamOperationsCapabilities?: TeamOperationsCapabilities;
        navigationCapabilities?: NavigationAccessCapabilities;
      }
    | undefined,
) {
  const { currentUser, teamOperationsCapabilities, navigationCapabilities } =
    initialState ?? {};
  const organizationSettings = Boolean(
    navigationCapabilities?.organization_settings,
  );
  const teamSettings = Boolean(navigationCapabilities?.team_settings);

  return {
    canAdmin: Boolean(currentUser?.is_staff || currentUser?.is_superuser),
    canSuperAdmin: Boolean(currentUser?.is_superuser),
    canViewSpaceWorkbench: canAccessSpaceWorkbench(teamOperationsCapabilities),
    canViewRoleManagement: Boolean(navigationCapabilities?.role_management),
    canViewOrganizationSettings: organizationSettings,
    canViewTeamSettings: teamSettings,
    canViewBusinessSettings: organizationSettings || teamSettings,
    canViewSubscriptions: Boolean(navigationCapabilities?.subscriptions),
    canViewAnalytics: Boolean(navigationCapabilities?.analytics),
    canViewAllocation: Boolean(navigationCapabilities?.allocation),
    canManageNotificationDispatches: Boolean(
      navigationCapabilities?.notification_dispatches,
    ),
  };
}
