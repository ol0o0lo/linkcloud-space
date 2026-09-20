export interface HouseMapSource {
  id: number
  asking_rent?: string | number | null
  building: {
    id: number
    name: string
    address?: string | null
    location?: {
      latitude: string | number
      longitude: string | number
    } | null
    estate?: {
      id: number
      name?: string | null
      display_name?: string | null
      district?: string | null
      address?: string | null
    } | null
  }
}

export interface HouseMapCluster<T extends HouseMapSource> {
  key: string
  name: string
  district: string
  address: string
  latitude: number
  longitude: number
  houseCount: number
  minRent: number | null
  houses: T[]
}

interface MutableHouseMapCluster<T extends HouseMapSource> {
  key: string
  name: string
  district: string
  address: string
  houses: T[]
  coordinates: Map<number, { latitude: number, longitude: number }>
}

interface MapIncludePointSource {
  location: {
    latitude: string | number
    longitude: string | number
  }
}

type HouseMapRequestValue = string | number | boolean | null | undefined | Array<string | number>
const HOUSE_MAP_MARKER_TAP_GUARD_MS = 350

export interface HouseMapResultCache<T> {
  clear: () => void
  get: (key: string) => T | undefined
  set: (key: string, value: T) => void
}

function finiteCoordinate(value: string | number | null | undefined): number | null {
  if (value == null || value === '')
    return null
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : null
}

export function resolveMapIncludePoints(markers: MapIncludePointSource[], hasViewport: boolean): Array<{ latitude: number, longitude: number }> | undefined {
  if (hasViewport)
    return undefined

  const points = markers.flatMap((marker) => {
    const latitude = finiteCoordinate(marker.location.latitude)
    const longitude = finiteCoordinate(marker.location.longitude)
    return latitude == null || longitude == null ? [] : [{ latitude, longitude }]
  })

  return points.length ? points : undefined
}

export function shouldClearHouseMapSelection(lastMarkerTapAt: number, now = Date.now()): boolean {
  return lastMarkerTapAt <= 0 || now - lastMarkerTapAt >= HOUSE_MAP_MARKER_TAP_GUARD_MS
}

export function createHouseMapMarkerId(key: string): number {
  let hash = 2166136261
  for (let index = 0; index < key.length; index += 1) {
    hash ^= key.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0) % 2147483646 + 1
}

export function buildHouseMapRequestKey(params: object): string {
  return Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}:${normalizeRequestValue(key, value!)}`)
    .join('|')
}

export function diffHouseMapMarkerKeys(previousKeys: Iterable<string>, nextKeys: Iterable<string>) {
  const previous = new Set(previousKeys)
  const next = new Set(nextKeys)
  return {
    added: Array.from(next).filter(key => !previous.has(key)),
    removed: Array.from(previous).filter(key => !next.has(key)),
    retained: Array.from(next).filter(key => previous.has(key)),
  }
}

export function createHouseMapResultCache<T>(limit = 8): HouseMapResultCache<T> {
  const values = new Map<string, T>()
  const clone = (value: T): T => JSON.parse(JSON.stringify(value)) as T

  return {
    clear() {
      values.clear()
    },
    get(key) {
      const value = values.get(key)
      if (value === undefined)
        return undefined
      values.delete(key)
      values.set(key, value)
      return clone(value)
    },
    set(key, value) {
      values.delete(key)
      values.set(key, clone(value))
      while (values.size > Math.max(1, limit)) {
        const oldestKey = values.keys().next().value
        if (oldestKey === undefined)
          break
        values.delete(oldestKey)
      }
    },
  }
}

function normalizeRequestValue(key: string, value: Exclude<HouseMapRequestValue, null | undefined>): string {
  if (Array.isArray(value))
    return [...value].map(item => String(item).trim()).filter(Boolean).sort().join(',')
  if (typeof value === 'string')
    return value.trim()
  if (typeof value === 'number') {
    if (key === 'zoom')
      return String(Math.round(value))
    return Number(value.toFixed(5)).toString()
  }
  return String(value)
}

function coordinateAverage(values: number[]): number {
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(6))
}

function finiteRent(value: string | number | null | undefined): number | null {
  if (value == null || value === '')
    return null
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : null
}

export function buildHouseMapClusters<T extends HouseMapSource>(houses: T[]): HouseMapCluster<T>[] {
  const groups = new Map<string, MutableHouseMapCluster<T>>()

  for (const house of houses) {
    const latitude = finiteCoordinate(house.building.location?.latitude)
    const longitude = finiteCoordinate(house.building.location?.longitude)
    if (latitude == null || longitude == null)
      continue

    const estate = house.building.estate
    const key = estate ? `estate:${estate.id}` : `building:${house.building.id}`
    const group = groups.get(key) || {
      key,
      name: estate?.display_name || estate?.name || house.building.name,
      district: estate?.district || '',
      address: estate?.address || house.building.address || '',
      houses: [],
      coordinates: new Map(),
    }
    group.houses.push(house)
    group.coordinates.set(house.building.id, { latitude, longitude })
    groups.set(key, group)
  }

  return Array.from(groups.values()).map((group) => {
    const coordinates = Array.from(group.coordinates.values())
    const rents = group.houses.map(house => finiteRent(house.asking_rent)).filter((rent): rent is number => rent != null)
    return {
      key: group.key,
      name: group.name,
      district: group.district,
      address: group.address,
      latitude: coordinateAverage(coordinates.map(item => item.latitude)),
      longitude: coordinateAverage(coordinates.map(item => item.longitude)),
      houseCount: group.houses.length,
      minRent: rents.length ? Math.min(...rents) : null,
      houses: group.houses,
    }
  }).sort((left, right) => right.houseCount - left.houseCount || left.name.localeCompare(right.name, 'zh-CN'))
}
