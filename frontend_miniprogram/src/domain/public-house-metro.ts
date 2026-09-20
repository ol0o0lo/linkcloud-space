export type PublicHouseRadiusM = 500 | 1000 | 1500 | 2000
export type PublicHouseLocationMode = 'region' | 'metro'

export interface PublicMetroStation {
  name: string
}

export interface PublicMetroLine {
  name: string
  color: string
  stations: PublicMetroStation[]
}

export interface PublicMetroCityDetail {
  name: string
  province: string
  data_version: string
  lines: PublicMetroLine[]
}

export interface PublicMetroCitySummary {
  name: string
  province: string
}

export interface PublicHouseMetroSelection {
  city: string
  stationNames: string[]
}

export const PUBLIC_HOUSE_RADIUS_OPTIONS: PublicHouseRadiusM[] = [500, 1000, 1500, 2000]

export function isPublicHouseRadiusM(value: unknown): value is PublicHouseRadiusM {
  return typeof value === 'number' && PUBLIC_HOUSE_RADIUS_OPTIONS.includes(value as PublicHouseRadiusM)
}

export function isPublicHouseMetroSelection(value: unknown): value is PublicHouseMetroSelection {
  if (!value || typeof value !== 'object')
    return false
  const selection = value as Record<string, unknown>
  return typeof selection.city === 'string'
    && Array.isArray(selection.stationNames)
    && selection.stationNames.length <= 5
    && selection.stationNames.every(name => typeof name === 'string' && Boolean(name.trim()))
}

export function normalizeMetroStationNames(stationNames: string[]): string[] {
  return Array.from(new Set(stationNames.map(name => name.trim()).filter(Boolean)))
}

export function reconcileMetroSelection(selection: PublicHouseMetroSelection, city: string): PublicHouseMetroSelection {
  return selection.city === city
    ? { city, stationNames: normalizeMetroStationNames(selection.stationNames).slice(0, 5) }
    : { city, stationNames: [] }
}

export function toggleMetroStation(selected: string[], stationName: string): string[] {
  const names = normalizeMetroStationNames(selected)
  const normalizedName = stationName.trim()
  if (!normalizedName)
    return names
  if (names.includes(normalizedName))
    return names.filter(name => name !== normalizedName)
  if (names.length >= 5)
    throw new Error('最多选择 5 个站点')
  return [...names, normalizedName]
}

export function formatPublicHouseRadiusLabel(radiusM: PublicHouseRadiusM): string {
  if (radiusM < 1000)
    return `${radiusM}m`
  return `${radiusM / 1000}km`
}

export function buildPublicHouseSpatialParams(input: {
  nearbyEnabled: boolean
  nearbyLocation: { longitude: number, latitude: number } | null
  radiusM: PublicHouseRadiusM
  mode: PublicHouseLocationMode
  province: string
  city: string
  district: string
  subdistrict?: string
  metroStationNames: string[]
}) {
  const globalRegion = input.city
    ? { province: input.province, city: input.city }
    : {}
  if (input.nearbyEnabled && input.nearbyLocation) {
    return {
      ...globalRegion,
      longitude: input.nearbyLocation.longitude,
      latitude: input.nearbyLocation.latitude,
      radius_m: input.radiusM,
      coordinate_system: 'gcj02' as const,
    }
  }
  const stationNames = normalizeMetroStationNames(input.metroStationNames)
  if (input.mode === 'metro' && input.city && stationNames.length) {
    return {
      ...globalRegion,
      metro_stations: stationNames,
      radius_m: input.radiusM,
    }
  }
  if (!input.city)
    return {}
  return {
    ...globalRegion,
    district: input.district || undefined,
    subdistrict: input.district && input.subdistrict ? input.subdistrict : undefined,
  }
}
