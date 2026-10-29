import { beforeEach, describe, expect, it } from 'vitest';
import { getHouseListStateFromSearch, syncHouseListSearch } from './listState';

const defaultFilters = {
  assetTab: 'houses' as const,
  page: 1,
  pageSize: 20,
  scope: 'all' as const,
  inspectionDue: false,
};

describe('house list URL state', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/rental/properties/list');
  });

  it('normalizes legacy inspection view into independent scope filters', () => {
    expect(getHouseListStateFromSearch('?view=inspection')).toMatchObject({
      scope: 'mine',
      inspectionDue: true,
      inspectionReason: undefined,
    });

    expect(
      getHouseListStateFromSearch(
        '?scope=all&inspection_due=true&inspection_reason=expired',
      ),
    ).toMatchObject({
      scope: 'all',
      inspectionDue: true,
      inspectionReason: 'expired',
    });
  });

  it('drops unsupported status and ordering values', () => {
    expect(
      getHouseListStateFromSearch(
        '?status=unknown&ordering=-asking_rent,room_number',
      ),
    ).toMatchObject({ status: undefined, ordering: undefined });
    expect(
      getHouseListStateFromSearch('?status=paused&ordering=-asking_rent'),
    ).toMatchObject({ status: 'paused', ordering: '-asking_rent' });
  });

  it('preserves unrelated parameters while syncing filters', () => {
    window.history.replaceState(
      {},
      '',
      '/rental/properties/list?foo=x&building_id=11&view=inspection',
    );

    syncHouseListSearch({
      ...defaultFilters,
      buildingId: 11,
      status: 'paused',
    });

    expect(window.location.search).toBe('?foo=x&status=paused&building_id=11');
  });

  it('serializes non-default scope, inspection, ordering, and pagination', () => {
    syncHouseListSearch({
      ...defaultFilters,
      inspectionDue: true,
      inspectionReason: 'expired',
      ordering: '-asking_rent',
      page: 3,
      pageSize: 50,
      scope: 'mine',
    });

    expect(window.location.search).toBe(
      '?ordering=-asking_rent&scope=mine&inspection_due=true&inspection_reason=expired&page=3&page_size=50',
    );
  });
  it('启用状态默认不筛选，支持只查看停用房源', () => {
    expect(getHouseListStateFromSearch('').isActive).toBeUndefined();
    expect(getHouseListStateFromSearch('?is_active=false').isActive).toBe(
      false,
    );
    expect(getHouseListStateFromSearch('?is_active=true').isActive).toBe(true);
    syncHouseListSearch({ ...defaultFilters, isActive: false });
    expect(window.location.search).toBe('?is_active=false');
    syncHouseListSearch(defaultFilters);
    expect(window.location.search).toBe('');
  });
});
