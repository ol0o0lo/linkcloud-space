export type HomeEntryKind = 'topic' | 'guide'
export type HomeBannerAction = 'entry' | 'house_list' | 'house_map'
export type HomeBannerTone = 'blue' | 'violet' | 'teal'
export type HomeEntryTone = 'sage' | 'lavender' | 'slate' | 'clay'

export interface HomeMediaRef {
  media_id: number
  resource_type?: string | null
  original_filename?: string | null
  url?: string | null
  thumbnail?: string | null
}

export interface HomeEntrySummary {
  slug: string
  kind: HomeEntryKind
  eyebrow: string
  title: string
  summary: string
  cover_image: HomeMediaRef[]
  tone: HomeEntryTone
}

export interface HomeEntryDetail extends HomeEntrySummary {
  body_html: string
}

export interface HomeBanner {
  id: number
  eyebrow: string
  title: string
  description: string
  button_text: string
  image: HomeMediaRef[]
  tone: HomeBannerTone
  action_type: HomeBannerAction
  entry_slug: string | null
}

export interface HomeContent {
  banners: HomeBanner[]
  topics: HomeEntrySummary[]
  guides: HomeEntrySummary[]
}

export interface PageResult<T> {
  items: T[]
  total: number
  page: number
  page_size: number
}

export interface PublicHouseSearchPreset {
  keyword?: string
  listing_type?: 'whole' | 'shared' | 'apartment' | 'short_term'
  max_rent?: string
  bedrooms?: number
  bedrooms_min?: number
  nearby?: 1
  longitude?: number
  latitude?: number
  radius_m?: 500 | 1000 | 1500 | 2000
  place_name?: string
  place_city?: string
  sort?: 'latest' | 'rent_asc'
  location_mode?: 'metro'
}

export const EMPTY_HOME_CONTENT: HomeContent = {
  banners: [],
  topics: [],
  guides: [],
}

export const HOME_QUICK_SEARCHES: Record<string, PublicHouseSearchPreset> = {
  条件找房: {},
  地铁找房: { location_mode: 'metro' },
  低价好房: { sort: 'rent_asc' },
  品质整租: { listing_type: 'whole' },
  最新上架: { sort: 'latest' },
}

export const HOME_RANKING_SEARCHES: Record<string, PublicHouseSearchPreset> = {
  热门区域: { sort: 'latest' },
  地铁线路: { location_mode: 'metro' },
  性价比榜: { sort: 'rent_asc' },
}

function appendQuery(path: string, values: object): string {
  const query = Object.entries(values)
    .filter((entry): entry is [string, string | number] => (typeof entry[1] === 'string' || typeof entry[1] === 'number') && entry[1] !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&')
  return query ? `${path}?${query}` : path
}

export function getPublicHouseSearchRoute(preset: PublicHouseSearchPreset = {}): string {
  return appendQuery('/pages-housing/search/index', preset)
}

export function getPublicHouseMapRoute(preset: PublicHouseSearchPreset = {}): string {
  return appendQuery('/pages-housing/map/index', preset)
}

export function getHomeEntryListRoute(kind: HomeEntryKind): string {
  return appendQuery('/pages-housing/home-content/index', { kind })
}

export function getHomeEntryDetailRoute(slug: string): string {
  return appendQuery('/pages-housing/home-content/detail', { slug })
}

export function getHomeBannerRoute(banner: HomeBanner): string | null {
  if (banner.action_type === 'house_map')
    return '/pages-housing/map/index'
  if (banner.action_type === 'house_list')
    return getPublicHouseSearchRoute()
  if (banner.entry_slug)
    return getHomeEntryDetailRoute(banner.entry_slug)
  return null
}

export function parsePublicHouseSearchPreset(options: Record<string, string | undefined>): PublicHouseSearchPreset {
  const decoded = Object.fromEntries(Object.entries(options).map(([key, value]) => {
    if (!value)
      return [key, value]
    try {
      return [key, decodeURIComponent(value)]
    }
    catch {
      return [key, value]
    }
  })) as Record<string, string | undefined>
  const bedrooms = decoded.bedrooms ? Number(decoded.bedrooms) : undefined
  const bedroomsMin = decoded.bedrooms_min ? Number(decoded.bedrooms_min) : undefined
  const longitude = decoded.longitude ? Number(decoded.longitude) : undefined
  const latitude = decoded.latitude ? Number(decoded.latitude) : undefined
  const radius = decoded.radius_m ? Number(decoded.radius_m) : undefined
  const nearbyLocationValid = decoded.nearby === '1' && Number.isFinite(longitude) && Number.isFinite(latitude) && longitude! >= -180 && longitude! <= 180 && latitude! >= -90 && latitude! <= 90
  return {
    keyword: decoded.keyword || undefined,
    listing_type: ['whole', 'shared', 'apartment', 'short_term'].includes(decoded.listing_type || '') ? decoded.listing_type as PublicHouseSearchPreset['listing_type'] : undefined,
    max_rent: decoded.max_rent || undefined,
    bedrooms: Number.isInteger(bedrooms) && Number(bedrooms) >= 0 ? bedrooms : undefined,
    bedrooms_min: Number.isInteger(bedroomsMin) && Number(bedroomsMin) >= 0 ? bedroomsMin : undefined,
    nearby: decoded.nearby === '1' ? 1 : undefined,
    longitude: nearbyLocationValid ? longitude : undefined,
    latitude: nearbyLocationValid ? latitude : undefined,
    radius_m: nearbyLocationValid && [500, 1000, 1500, 2000].includes(radius || 0) ? radius as PublicHouseSearchPreset['radius_m'] : undefined,
    place_name: nearbyLocationValid ? decoded.place_name || undefined : undefined,
    place_city: nearbyLocationValid ? decoded.place_city || undefined : undefined,
    sort: decoded.sort === 'rent_asc' ? 'rent_asc' : 'latest',
    location_mode: decoded.location_mode === 'metro' ? 'metro' : undefined,
  }
}
