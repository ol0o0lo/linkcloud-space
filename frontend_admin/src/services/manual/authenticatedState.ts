import {
  getNavigationAccessCapabilities,
  type NavigationAccessCapabilities,
} from '@/services/manual/navigationAccess';
import {
  getTeamOperationsCapabilities,
  type TeamOperationsCapabilities,
} from '@/services/manual/teamOperations';
import { appsOrganizationsApiSwitchList } from '@/services/openapi/organizations';
import { resolveSelectedOrgSlug } from '@/utils/orgSelection';

export type AuthenticatedStateSnapshot = {
  currentUser: API.MeOut;
  organizations: API.SwitchListItemOut[];
  selectedOrgSlug?: string;
  teamOperationsCapabilities?: TeamOperationsCapabilities;
  navigationCapabilities?: NavigationAccessCapabilities;
};

export async function loadAuthenticatedState(
  fetchUserInfo?: () => Promise<API.MeOut | undefined>,
  currentUser?: API.MeOut,
): Promise<AuthenticatedStateSnapshot | null> {
  const userInfo = currentUser || (await fetchUserInfo?.());
  if (!userInfo) {
    return null;
  }

  const organizations = await appsOrganizationsApiSwitchList({
    skipErrorHandler: true,
  }).catch(() => []);
  const selectedOrgSlug = resolveSelectedOrgSlug(organizations);
  const [teamOperationsCapabilities, navigationCapabilities] = selectedOrgSlug
    ? await Promise.all([
        getTeamOperationsCapabilities().catch(() => undefined),
        getNavigationAccessCapabilities().catch(() => undefined),
      ])
    : [undefined, undefined];

  return {
    currentUser: userInfo,
    organizations,
    selectedOrgSlug,
    teamOperationsCapabilities,
    navigationCapabilities,
  };
}
