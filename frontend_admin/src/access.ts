import { canAccessSpaceWorkbench } from '@/pages/team-operations/workbench/view';
import type { TeamOperationsCapabilities } from '@/services/manual/teamOperations';

/**
 * @see https://umijs.org/docs/max/access#access
 * */
export default function access(
  initialState:
    | {
        currentUser?: API.MeOut;
        teamOperationsCapabilities?: TeamOperationsCapabilities;
      }
    | undefined,
) {
  const { currentUser, teamOperationsCapabilities } = initialState ?? {};
  return {
    canAdmin: Boolean(currentUser?.is_staff || currentUser?.is_superuser),
    canSuperAdmin: Boolean(currentUser?.is_superuser),
    canViewSpaceWorkbench: canAccessSpaceWorkbench(teamOperationsCapabilities),
  };
}
