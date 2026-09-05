import { SPACE_PATHS } from '@/utils/adminRouting';

export type OrganizationSection = 'members';
export type OrganizationNode =
  | 'all'
  | 'organization'
  | 'ungrouped'
  | `team:${number}`
  | `member:${number}`;
export type OrganizationWorkspaceTab = 'overview' | 'roles' | 'invites';

export type OrganizationRouteState = {
  section: OrganizationSection;
  node: OrganizationNode;
  tab: string;
};

export const DEFAULT_ORGANIZATION_ROUTE: OrganizationRouteState = {
  section: 'members',
  node: 'all',
  tab: 'members',
};

const MEMBER_TABS = new Set(['profile', 'access', 'responsibilities']);
const TEAM_TABS = new Set(['profile', 'members', 'roles', 'responsibilities']);
const ORGANIZATION_TABS = new Set<OrganizationWorkspaceTab>([
  'overview',
  'roles',
  'invites',
]);

function parseNode(value: string | null): OrganizationNode | undefined {
  if (value === 'all' || value === 'organization' || value === 'ungrouped') {
    return value;
  }
  const match = value?.match(/^(member|team):(\d+)$/);
  if (!match || Number(match[2]) <= 0) return undefined;
  return `${match[1]}:${Number(match[2])}` as OrganizationNode;
}

function defaultTab(node: OrganizationNode) {
  if (node === 'all' || node === 'ungrouped') return 'members';
  if (node === 'organization') return 'overview';
  if (node.startsWith('member:')) return 'profile';
  return 'members';
}

function validTab(node: OrganizationNode, tab: string | null) {
  if (!tab) return defaultTab(node);
  if (node === 'all') return 'members';
  if (node === 'organization')
    return ORGANIZATION_TABS.has(tab as OrganizationWorkspaceTab)
      ? tab
      : 'overview';
  if (node === 'ungrouped') return 'members';
  if (node.startsWith('member:')) {
    if (tab === 'teams') return 'profile';
    return MEMBER_TABS.has(tab) ? tab : 'profile';
  }
  return TEAM_TABS.has(tab) ? tab : 'members';
}

export function parseOrganizationRoute(search: string): OrganizationRouteState {
  const params = new URLSearchParams(
    search.startsWith('?') ? search.slice(1) : search,
  );
  if (params.get('section') && params.get('section') !== 'members') {
    return DEFAULT_ORGANIZATION_ROUTE;
  }
  const node = parseNode(params.get('node')) ?? 'all';
  return {
    section: 'members',
    node,
    tab: validTab(node, params.get('tab')),
  };
}

export function buildOrganizationLocation(
  current: OrganizationRouteState,
  patch: Partial<OrganizationRouteState>,
) {
  const next = { ...current, ...patch };
  const params = new URLSearchParams();
  params.set('section', 'members');
  params.set('node', next.node);
  params.set('tab', validTab(next.node, next.tab));
  return `${SPACE_PATHS.organization}?${params.toString()}`;
}

export function memberIdFromNode(node: OrganizationNode) {
  return node.startsWith('member:')
    ? Number(node.slice('member:'.length))
    : undefined;
}

export function teamIdFromNode(node: OrganizationNode) {
  return node.startsWith('team:')
    ? Number(node.slice('team:'.length))
    : undefined;
}
