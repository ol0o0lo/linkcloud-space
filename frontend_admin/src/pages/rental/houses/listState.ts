import type { HouseListParams, HouseOut } from '@/services/manual/house';
import { HOUSE_STATUS } from '../constants';
import type { PropertyAssetAction } from './PropertyAssetNavigator';
import type { PropertyAssetWorkspaceTab } from './PropertyAssetWorkspace';

export const DEFAULT_HOUSE_PAGE_SIZE = 20;
export const HOUSE_PAGE_SIZE_OPTIONS = [10, 20, 50, 100];
export const HOUSE_SORTABLE_FIELDS = [
  'room_number',
  'layout',
  'building',
  'asking_rent',
  'deposit_amount',
  'landlord',
  'status',
] as const;

export type HouseSortableField = (typeof HOUSE_SORTABLE_FIELDS)[number];
export type HouseOrdering = HouseSortableField | `-${HouseSortableField}`;
export type HouseScope = NonNullable<HouseListParams['scope']>;
export type HouseStatus = HouseOut['status'];
export type HouseInspectionReason = NonNullable<
  HouseListParams['inspection_reason']
>;
export type HouseInspectionFilter = 'due' | HouseInspectionReason;
export type HouseScopeFilters = {
  assetAction?: PropertyAssetAction;
  assetTab: PropertyAssetWorkspaceTab;
  q?: string;
  status?: HouseStatus;
  estateId?: number;
  buildingId?: number;
  ordering?: HouseOrdering;
  scope: HouseScope;
  inspectionDue: boolean;
  inspectionReason?: HouseInspectionReason;
};

function getPositiveId(value: string | null) {
  return value && /^[1-9]\d*$/.test(value) ? Number(value) : undefined;
}

function getHousePageSize(value: string | null) {
  const pageSize = Number(value);
  return HOUSE_PAGE_SIZE_OPTIONS.includes(pageSize)
    ? pageSize
    : DEFAULT_HOUSE_PAGE_SIZE;
}

function parseHouseStatus(value: string | null): HouseStatus | undefined {
  return Object.values(HOUSE_STATUS).includes(value as HouseStatus)
    ? (value as HouseStatus)
    : undefined;
}

export function parseHouseOrdering(
  value: string | null,
): HouseOrdering | undefined {
  if (!value || value.includes(',')) return undefined;
  const field = value.startsWith('-') ? value.slice(1) : value;
  if (!HOUSE_SORTABLE_FIELDS.includes(field as HouseSortableField)) {
    return undefined;
  }
  return value as HouseOrdering;
}

function parsePropertyAssetWorkspaceTab(
  value: string | null,
): PropertyAssetWorkspaceTab {
  return value === 'structure' || value === 'profile' ? value : 'houses';
}

function parsePropertyAssetAction(
  value: string | null,
  estateId?: number,
  buildingId?: number,
): PropertyAssetAction | undefined {
  if (value === 'create-estate') return { type: 'create-estate' };
  if (value === 'create-building') {
    return { type: 'create-building', estateId };
  }
  if (value === 'edit-estate' && estateId) {
    return { type: 'edit-estate', estateId };
  }
  if (value === 'edit-building' && buildingId) {
    return { type: 'edit-building', buildingId };
  }
  return undefined;
}

export function getHouseListStateFromSearch(search: string) {
  const params = new URLSearchParams(search);
  const pageValue = Number(params.get('page') || '1');
  const viewParam = params.get('view');
  const scopeParam = params.get('scope');
  const inspectionDueParam = params.get('inspection_due');
  const inspectionReasonParam = params.get('inspection_reason');
  const scope: HouseScope =
    scopeParam === 'all' || scopeParam === 'mine'
      ? scopeParam
      : viewParam === 'mine' || viewParam === 'inspection'
        ? 'mine'
        : 'all';
  const inspectionReason: HouseInspectionReason | undefined =
    inspectionReasonParam === 'missing_images' ||
    inspectionReasonParam === 'missing_videos' ||
    inspectionReasonParam === 'expired'
      ? inspectionReasonParam
      : undefined;
  const inspectionDue = Boolean(
    inspectionReason ||
      inspectionDueParam === 'true' ||
      (inspectionDueParam === null && viewParam === 'inspection'),
  );
  const estateId = getPositiveId(params.get('estate_id'));
  const buildingId = getPositiveId(params.get('building_id'));
  const requestedAssetTab = parsePropertyAssetWorkspaceTab(
    params.get('asset_tab'),
  );
  const assetTab =
    !estateId && !buildingId
      ? 'houses'
      : buildingId && requestedAssetTab === 'structure'
        ? 'houses'
        : requestedAssetTab;
  const assetAction = parsePropertyAssetAction(
    params.get('asset_action'),
    estateId,
    buildingId,
  );
  return {
    assetAction,
    assetTab,
    page: Number.isFinite(pageValue) && pageValue > 0 ? pageValue : 1,
    pageSize: getHousePageSize(params.get('page_size')),
    q: params.get('keyword') || undefined,
    status: parseHouseStatus(params.get('status')),
    estateId,
    buildingId,
    ordering: parseHouseOrdering(params.get('ordering')),
    scope,
    inspectionDue,
    inspectionReason: inspectionDue ? inspectionReason : undefined,
  };
}

export function syncHouseListSearch(
  filters: HouseScopeFilters & { page: number; pageSize: number },
) {
  const params = new URLSearchParams(window.location.search);
  params.delete('asset_action');
  params.delete('asset_issue');
  params.delete('keyword');
  params.delete('asset_tab');
  params.delete('status');
  params.delete('estate_id');
  params.delete('building_id');
  params.delete('ordering');
  params.delete('view');
  params.delete('scope');
  params.delete('inspection_due');
  params.delete('inspection_reason');
  params.delete('page');
  params.delete('page_size');
  params.delete('estate_edit');
  params.delete('estate_create');
  params.delete('building_edit');
  params.delete('building_create');
  if (filters.assetAction) {
    params.set('asset_action', filters.assetAction.type);
  }
  if (
    filters.assetTab !== 'houses' &&
    (filters.estateId || filters.buildingId)
  ) {
    params.set('asset_tab', filters.assetTab);
  }
  if (filters.q) params.set('keyword', filters.q);
  if (filters.status) params.set('status', filters.status);
  if (filters.estateId) params.set('estate_id', String(filters.estateId));
  if (filters.buildingId) params.set('building_id', String(filters.buildingId));
  if (filters.ordering) params.set('ordering', filters.ordering);
  if (filters.scope === 'mine') params.set('scope', filters.scope);
  if (filters.inspectionDue) params.set('inspection_due', 'true');
  if (filters.inspectionDue && filters.inspectionReason) {
    params.set('inspection_reason', filters.inspectionReason);
  }
  if (filters.page > 1) params.set('page', String(filters.page));
  if (filters.pageSize !== DEFAULT_HOUSE_PAGE_SIZE) {
    params.set('page_size', String(filters.pageSize));
  }
  const nextSearch = params.toString();
  const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}${window.location.hash || ''}`;
  const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash || ''}`;
  if (nextUrl !== currentUrl) {
    window.history.replaceState(window.history.state, '', nextUrl);
  }
}
