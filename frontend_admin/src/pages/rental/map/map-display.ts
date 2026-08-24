import type {
  BuildingMapMarkerOut,
  EstateMapMarkerOut,
} from '@/services/manual/house';

export type MapDisplayLevel =
  | 'estate-cluster'
  | 'estate'
  | 'building-compact'
  | 'building-detail';

export type MapCounts = BuildingMapMarkerOut['counts'];

export type EstateMapDisplayPoint = {
  key: string;
  kind: 'estate' | 'independent-building';
  resourceId: number;
  estateId?: number;
  buildingId?: number;
  name: string;
  address: string;
  lat: number;
  lng: number;
  locationSource: 'estate' | 'building-centroid' | 'building';
  buildingCount: number;
  locatedBuildingCount: number;
  unlocatedBuildingCount: number;
  counts: MapCounts;
  estate?: EstateMapMarkerOut;
  building?: BuildingMapMarkerOut;
};

export type MapPrimaryMetric = {
  key: keyof Pick<
    MapCounts,
    'total' | 'vacant' | 'listed' | 'rented' | 'renovating'
  >;
  label: string;
  value: number;
};

export type EstateMapSummary = {
  pointCount: number;
  estateCount: number;
  independentBuildingCount: number;
  buildingCount: number;
  locatedBuildingCount: number;
  unlocatedBuildingCount: number;
  counts: MapCounts;
};

const EMPTY_COUNTS: MapCounts = {
  total: 0,
  vacant: 0,
  listed: 0,
  rented: 0,
  renovating: 0,
};

const PRIMARY_METRICS: Record<
  string,
  Pick<MapPrimaryMetric, 'key' | 'label'>
> = {
  vacant: { key: 'vacant', label: '空置' },
  listed: { key: 'listed', label: '招租' },
  rented: { key: 'rented', label: '已租' },
  renovating: { key: 'renovating', label: '装修' },
};

export function getMapDisplayLevel(zoom: number): MapDisplayLevel {
  const normalizedZoom = Number.isFinite(zoom)
    ? Math.min(20, Math.max(3, Math.floor(zoom)))
    : 3;
  if (normalizedZoom <= 9) return 'estate-cluster';
  if (normalizedZoom <= 13) return 'estate';
  if (normalizedZoom <= 15) return 'building-compact';
  return 'building-detail';
}

export function isEstateDisplayLevel(level: MapDisplayLevel) {
  return level === 'estate-cluster' || level === 'estate';
}

export function isBuildingDisplayLevel(level: MapDisplayLevel) {
  return level === 'building-compact' || level === 'building-detail';
}

function toCoordinate(value: string | number) {
  const coordinate = Number(value);
  return Number.isFinite(coordinate) ? coordinate : undefined;
}

export function mergeEstateMapDisplayPoints(
  estates: EstateMapMarkerOut[],
  buildings: BuildingMapMarkerOut[],
): EstateMapDisplayPoint[] {
  const estatePoints = estates.flatMap((estate) => {
    const lat = toCoordinate(estate.lat);
    const lng = toCoordinate(estate.lng);
    if (lat == null || lng == null) return [];
    return [
      {
        key: `estate:${estate.id}`,
        kind: 'estate' as const,
        resourceId: estate.id,
        estateId: estate.id,
        name: estate.display_name || estate.name,
        address: estate.address,
        lat,
        lng,
        locationSource:
          estate.location_source === 'building_centroid'
            ? ('building-centroid' as const)
            : ('estate' as const),
        buildingCount: estate.building_count,
        locatedBuildingCount: estate.located_building_count,
        unlocatedBuildingCount: estate.unlocated_building_count,
        counts: estate.counts,
        estate,
      },
    ];
  });
  const independentBuildingPoints = buildings.flatMap((building) => {
    if (building.estate) return [];
    const lat = toCoordinate(building.lat);
    const lng = toCoordinate(building.lng);
    if (lat == null || lng == null) return [];
    return [
      {
        key: `building:${building.id}`,
        kind: 'independent-building' as const,
        resourceId: building.id,
        buildingId: building.id,
        name: building.name,
        address: building.address,
        lat,
        lng,
        locationSource: 'building' as const,
        buildingCount: 1,
        locatedBuildingCount: 1,
        unlocatedBuildingCount: 0,
        counts: building.counts,
        building,
      },
    ];
  });
  return [...estatePoints, ...independentBuildingPoints];
}

export function getMapPrimaryMetric(
  counts: MapCounts,
  houseStatus?: string,
): MapPrimaryMetric {
  const metric =
    (houseStatus && PRIMARY_METRICS[houseStatus]) ||
    ({ key: 'total', label: '房源' } as const);
  return { ...metric, value: counts[metric.key] };
}

export function sumMapCounts(
  items: ReadonlyArray<{ counts: MapCounts }>,
): MapCounts {
  return items.reduce(
    (summary, item) => ({
      total: summary.total + item.counts.total,
      vacant: summary.vacant + item.counts.vacant,
      listed: summary.listed + item.counts.listed,
      rented: summary.rented + item.counts.rented,
      renovating: summary.renovating + item.counts.renovating,
    }),
    { ...EMPTY_COUNTS },
  );
}

export function summarizeEstateMapPoints(
  points: EstateMapDisplayPoint[],
): EstateMapSummary {
  return {
    pointCount: points.length,
    estateCount: points.filter((point) => point.kind === 'estate').length,
    independentBuildingCount: points.filter(
      (point) => point.kind === 'independent-building',
    ).length,
    buildingCount: points.reduce(
      (total, point) => total + point.buildingCount,
      0,
    ),
    locatedBuildingCount: points.reduce(
      (total, point) => total + point.locatedBuildingCount,
      0,
    ),
    unlocatedBuildingCount: points.reduce(
      (total, point) => total + point.unlocatedBuildingCount,
      0,
    ),
    counts: sumMapCounts(points),
  };
}
