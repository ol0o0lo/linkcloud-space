export interface PublicHouseRegionSelection {
  province: string
  city: string
  district: string
}

export interface PublicHouseRegionDistrict {
  district: string
  house_count: number
  subdistricts?: PublicHouseRegionSubdistrict[]
}

export interface PublicHouseRegionSubdistrict {
  subdistrict: string
  house_count: number
}

export interface PublicHouseRegionCity {
  city: string
  house_count: number
  districts: PublicHouseRegionDistrict[]
}

export interface PublicHouseRegionProvince {
  province: string
  house_count: number
  cities: PublicHouseRegionCity[]
}

export interface PublicHouseCityOption {
  province: string
  city: PublicHouseRegionCity
  label: string
  initial: string
}

export interface PublicHouseCityIndexGroup {
  index: string
  cities: PublicHouseCityOption[]
}

export interface PublicHouseLocatedRegion {
  province: string
  city: string
  district: string
}

export interface PublicHouseManualRegionPreference {
  source: 'manual'
  expiresAt: number
}

export const PUBLIC_HOUSE_MANUAL_REGION_TTL_MS = 7 * 24 * 60 * 60 * 1000

export function createPublicHouseManualRegionPreference(now = Date.now()): PublicHouseManualRegionPreference {
  return {
    source: 'manual',
    expiresAt: now + PUBLIC_HOUSE_MANUAL_REGION_TTL_MS,
  }
}

export function isPublicHouseManualRegionPreference(value: unknown): value is PublicHouseManualRegionPreference {
  if (!value || typeof value !== 'object')
    return false
  const preference = value as Record<string, unknown>
  return preference.source === 'manual' && typeof preference.expiresAt === 'number' && Number.isFinite(preference.expiresAt)
}

export function isPublicHouseManualRegionPreferenceActive(preference: PublicHouseManualRegionPreference, now = Date.now()) {
  return preference.expiresAt > now
}

export function createNationwidePublicHouseRegion(): PublicHouseRegionSelection {
  return { province: '', city: '', district: '' }
}

export function isPublicHouseRegionSelection(value: unknown): value is PublicHouseRegionSelection {
  if (!value || typeof value !== 'object')
    return false
  const selection = value as Record<string, unknown>
  if (typeof selection.province !== 'string' || typeof selection.city !== 'string' || typeof selection.district !== 'string')
    return false
  if (selection.district && (!selection.province || !selection.city))
    return false
  if (selection.city && !selection.province)
    return false
  return !selection.province || Boolean(selection.city)
}

export function buildPublicHouseRegionParams(selection: PublicHouseRegionSelection) {
  if (!selection.city)
    return {}
  return {
    province: selection.province,
    city: selection.city,
    district: selection.district || undefined,
  }
}

function stripRegionSuffix(value: string, level: 'province' | 'city' | 'district') {
  const suffixes = {
    province: /(壮族自治区|回族自治区|维吾尔自治区|特别行政区|自治区|省|市)$/,
    city: /(自治州|地区|盟|市)$/,
    district: /(自治县|林区|新区|[县区市])$/,
  } as const
  return value.trim().replace(suffixes[level], '') || value.trim()
}

const cityIndexOrder = [...'ABCDEFGHJKLMNOPQRSTWXYZ'.split(''), '#']
const cityPinyinBoundaries = '阿芭擦搭蛾发噶哈击喀垃妈拿哦啪期然撒塌挖昔压匝'.split('')
const cityInitialOverrides: Array<[prefix: string, initial: string]> = [
  ['重庆', 'C'],
  ['长', 'C'],
  ['厦', 'X'],
  ['乐', 'L'],
  ['朝阳', 'C'],
]
let cityPinyinCollator: Intl.Collator | null | undefined

function getCityPinyinCollator() {
  if (cityPinyinCollator !== undefined)
    return cityPinyinCollator
  try {
    cityPinyinCollator = typeof Intl === 'undefined' || !Intl.Collator
      ? null
      : new Intl.Collator('zh-CN-u-co-pinyin')
  }
  catch {
    cityPinyinCollator = null
  }
  return cityPinyinCollator
}

function compareCityLabels(left: string, right: string) {
  return getCityPinyinCollator()?.compare(left, right) ?? left.localeCompare(right)
}

export function getPublicHouseCityInitial(city: string) {
  const label = stripRegionSuffix(city, 'city')
  const override = cityInitialOverrides.find(([prefix]) => label.startsWith(prefix))
  if (override)
    return override[1]

  const firstCharacter = label.charAt(0)
  if (/^[a-z]$/i.test(firstCharacter))
    return firstCharacter.toUpperCase()

  const collator = getCityPinyinCollator()
  if (!collator)
    return '#'
  for (let index = cityIndexOrder.length - 2; index >= 0; index--) {
    if (collator.compare(firstCharacter, cityPinyinBoundaries[index]) >= 0)
      return cityIndexOrder[index]
  }
  return '#'
}

function flattenPublicHouseCities(regions: PublicHouseRegionProvince[]) {
  return regions.flatMap(province => province.cities.map(city => ({
    province: province.province,
    city,
    label: stripRegionSuffix(city.city, 'city'),
    initial: getPublicHouseCityInitial(city.city),
  })))
}

export function buildPublicHouseCityIndex(regions: PublicHouseRegionProvince[]): PublicHouseCityIndexGroup[] {
  const grouped = new Map<string, PublicHouseCityOption[]>()
  for (const item of flattenPublicHouseCities(regions)) {
    const cities = grouped.get(item.initial) || []
    cities.push(item)
    grouped.set(item.initial, cities)
  }

  return cityIndexOrder.flatMap((index) => {
    const cities = grouped.get(index)
    if (!cities?.length)
      return []
    return [{
      index,
      cities: cities.sort((left, right) => compareCityLabels(left.label, right.label) || compareCityLabels(left.province, right.province)),
    }]
  })
}

export function getPopularPublicHouseCities(regions: PublicHouseRegionProvince[], limit = 6): PublicHouseCityOption[] {
  return flattenPublicHouseCities(regions)
    .sort((left, right) => right.city.house_count - left.city.house_count || compareCityLabels(left.label, right.label))
    .slice(0, Math.max(0, limit))
}

function regionIdentity(value: string, level: 'province' | 'city' | 'district') {
  return stripRegionSuffix(value, level).replace(/\s+/g, '').toLocaleLowerCase()
}

export function formatPublicHouseRegionLabel(selection: PublicHouseRegionSelection) {
  if (selection.district)
    return stripRegionSuffix(selection.district, 'district')
  if (selection.city)
    return stripRegionSuffix(selection.city, 'city')
  return '全国'
}

export function resolvePublicHouseRegionSelection(
  regions: PublicHouseRegionProvince[],
  selection: PublicHouseRegionSelection,
): PublicHouseRegionSelection | null {
  if (!selection.city)
    return createNationwidePublicHouseRegion()
  const province = regions.find(item => regionIdentity(item.province, 'province') === regionIdentity(selection.province, 'province'))
  const city = province?.cities.find(item => regionIdentity(item.city, 'city') === regionIdentity(selection.city, 'city'))
  if (!province || !city)
    return null
  if (!selection.district)
    return { province: province.province, city: city.city, district: '' }
  const district = city.districts.find(item => regionIdentity(item.district, 'district') === regionIdentity(selection.district, 'district'))
  return district ? { province: province.province, city: city.city, district: district.district } : null
}

export function findLocatedPublicHouseRegion(
  regions: PublicHouseRegionProvince[],
  located: PublicHouseLocatedRegion,
): PublicHouseRegionSelection | null {
  return resolvePublicHouseRegionSelection(regions, {
    province: located.province,
    city: located.city,
    district: '',
  })
}
