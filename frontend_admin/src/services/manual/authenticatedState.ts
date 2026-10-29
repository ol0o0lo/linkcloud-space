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
  organizationSlug?: string,
): Promise<AuthenticatedStateSnapshot | null> {
  const userInfo = currentUser || (await fetchUserInfo?.());
  if (!userInfo) {
    return null;
  }

  const organizations = await appsOrganizationsApiSwitchList({
    skipErrorHandler: true,
    ...(organizationSlug ? { headers: { 'X-Org-Slug': organizationSlug } } : {}),
  }).catch(() => []);
  // 显式作用域仅构建快照，不改变全局请求组织；调用方确认请求仍有效后再提交。
  const selectedOrgSlug = organizationSlug
    ? organizations.find((item) => item.slug === organizationSlug)?.slug
    : resolveSelectedOrgSlug(organizations);
  const [teamOperationsCapabilities, navigationCapabilities] = selectedOrgSlug
    ? await Promise.all([
        getTeamOperationsCapabilities(organizationSlug).catch(() => undefined),
        getNavigationAccessCapabilities(organizationSlug).catch(() => undefined),
      ])
    : [undefined, undefined];

  return {
    currentUser: userInfo,
    organizations: organizationSlug
      ? organizations.map((item) => ({
          ...item,
          is_current: item.slug === selectedOrgSlug,
        }))
      : organizations,
    selectedOrgSlug,
    teamOperationsCapabilities,
    navigationCapabilities,
  };
}
