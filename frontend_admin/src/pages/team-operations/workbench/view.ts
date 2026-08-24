import type { TeamOperationsCapabilities } from '@/services/manual/teamOperations';

export type WorkbenchView = 'mine' | 'space';

export function getWorkbenchViewFromSearch(search: string): WorkbenchView {
  return new URLSearchParams(search).get('view') === 'space' ? 'space' : 'mine';
}

export function buildWorkbenchViewLocation(
  pathname: string,
  search: string,
  view: WorkbenchView,
) {
  const params = new URLSearchParams(search);
  params.set('view', view);
  const nextSearch = params.toString();
  return `${pathname}${nextSearch ? `?${nextSearch}` : ''}`;
}

export function canAccessSpaceWorkbench(
  capabilities?: TeamOperationsCapabilities,
) {
  return Boolean(
    capabilities?.task_organization_manage ||
      capabilities?.announcement_organization_manage,
  );
}
