import { formatHouseLayout } from './house.ts'

export type HouseCardStatusTone = 'primary' | 'success' | 'warning' | 'muted'

export interface HouseCardMediaSource {
  thumbnail?: unknown
  url?: unknown
}

export interface HouseCardSource {
  id: number
  room_number: string
  area?: string | number | null
  asking_rent?: string | number | null
  deposit_amount?: string | number | null
  bedrooms?: number | null
  living_rooms?: number | null
  decoration__mapping?: string | null
  has_elevator_access?: boolean
  images?: HouseCardMediaSource[] | null
  status?: string | null
  status__mapping?: string | null
  distance_m?: number | null
  nearest_metro_station?: {
    name: string
    line_names: string[]
  } | null
  building: {
    name: string
    address?: string | null
    estate?: {
      name?: string | null
      display_name?: string | null
      district?: string | null
    } | null
  }
}

export interface HouseCardModel {
  id: number
  title: string
  heading?: string
  subtitle?: string
  coverUrl: string
  imageCount: number
  location: string
  facts: string
  rentText: string
  depositText: string
  rentAmountText: string
  depositAmountText: string
  hasRent: boolean
  hasDeposit: boolean
  showStatusDot: boolean
  statusLabel: string
  statusTone: HouseCardStatusTone
  distanceText: string
}

export interface FavoriteHouseCardSource {
  target_id: string
  available: boolean
  display?: {
    title: string
    subtitle?: string
    cover_url?: string | null
    facts?: Array<{
      label: string
      value: string
    }>
  } | null
  target?: unknown
}

function formatNumericValue(value: string | number): string {
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue))
    return String(value)
  return numericValue.toLocaleString('zh-CN', { maximumFractionDigits: 2 })
}

export function formatHouseCardRent(value?: string | number | null): string {
  return value == null || value === '' ? '面议' : `¥${formatNumericValue(value)}/月`
}

export function formatHouseCardDeposit(value?: string | number | null): string {
  return value == null || value === '' ? '押金待确认' : `押金 ¥${formatNumericValue(value)}`
}

export function formatHouseDistance(value?: number | null, stationName?: string): string {
  if (value == null || !Number.isFinite(value) || value < 0)
    return ''
  const distance = value < 1000 ? `${Math.round(value)}m` : `${(value / 1000).toFixed(1)}km`
  return stationName ? `距${stationName}站 ${distance}` : `距你 ${distance}`
}

function getStatusTone(status?: string | null): HouseCardStatusTone {
  if (status === 'vacant')
    return 'success'
  if (status === 'rented')
    return 'primary'
  if (status === 'inactive')
    return 'muted'
  return 'warning'
}

function isHouseCardSource(value: unknown): value is HouseCardSource {
  if (!value || typeof value !== 'object')
    return false
  const candidate = value as Partial<HouseCardSource>
  return typeof candidate.id === 'number'
    && typeof candidate.room_number === 'string'
    && Boolean(candidate.building)
    && typeof candidate.building?.name === 'string'
}

function formatDisplayAmount(value: string): string {
  const numericValue = value.replace(/[^\d.-]/g, '')
  return numericValue ? formatNumericValue(numericValue) : value
}

export function buildHouseCardModel(house: HouseCardSource): HouseCardModel {
  const estateName = house.building.estate?.display_name || house.building.estate?.name || ''
  const buildingName = house.building.name === estateName ? '' : house.building.name
  const images = Array.isArray(house.images) ? house.images : []
  const firstImage = images[0]
  const thumbnail = typeof firstImage?.thumbnail === 'string' ? firstImage.thumbnail : ''
  const url = typeof firstImage?.url === 'string' ? firstImage.url : ''
  const district = house.building.estate?.district || ''
  const decoration = house.decoration__mapping || ''
  const area = house.area == null || house.area === '' ? '' : `${formatNumericValue(house.area)}㎡`
  const status = house.status || ''
  const hasRent = house.asking_rent != null && house.asking_rent !== ''
  const hasDeposit = house.deposit_amount != null && house.deposit_amount !== ''

  return {
    id: house.id,
    title: [estateName, buildingName, house.room_number].filter(Boolean).join(' ') || `房源 #${house.id}`,
    heading: estateName || buildingName || `房源 #${house.id}`,
    subtitle: [estateName ? buildingName : '', house.room_number].filter(Boolean).join(' · '),
    coverUrl: thumbnail || url,
    imageCount: images.length,
    location: [district, decoration].filter(Boolean).join(' · '),
    facts: [
      formatHouseLayout(house.bedrooms, house.living_rooms),
      area,
      house.has_elevator_access == null ? '电梯待确认' : house.has_elevator_access ? '有电梯' : '无电梯',
    ].filter(Boolean).join(' · '),
    rentText: formatHouseCardRent(house.asking_rent),
    depositText: formatHouseCardDeposit(house.deposit_amount),
    rentAmountText: hasRent ? formatNumericValue(house.asking_rent as string | number) : '面议',
    depositAmountText: hasDeposit ? `¥${formatNumericValue(house.deposit_amount as string | number)}` : '待确认',
    hasRent,
    hasDeposit,
    showStatusDot: Boolean(status && status !== 'listed'),
    statusLabel: house.status__mapping || status,
    statusTone: getStatusTone(status),
    distanceText: formatHouseDistance(house.distance_m, house.nearest_metro_station?.name),
  }
}

export function buildFavoriteHouseCardModel(favorite: FavoriteHouseCardSource): HouseCardModel {
  if (isHouseCardSource(favorite.target)) {
    const model = buildHouseCardModel(favorite.target)
    if (favorite.available)
      return model
    return {
      ...model,
      showStatusDot: true,
      statusLabel: '已下架',
      statusTone: 'muted',
    }
  }

  const display = favorite.display
  const facts = display?.facts || []
  const rentFact = facts.find(fact => fact.label.includes('租金') || fact.label.includes('月租'))
  const rentAmountText = rentFact ? formatDisplayAmount(rentFact.value) : '面议'
  const coverUrl = display?.cover_url || ''

  return {
    id: Number(favorite.target_id) || 0,
    title: display?.title || `房源 ${favorite.target_id}`,
    coverUrl,
    imageCount: coverUrl ? 1 : 0,
    location: display?.subtitle || '',
    facts: facts.filter(fact => fact !== rentFact).map(fact => fact.value).filter(Boolean).join(' · '),
    rentText: rentFact ? `¥${rentAmountText}/月` : '面议',
    depositText: '押金待确认',
    rentAmountText,
    depositAmountText: '待确认',
    hasRent: Boolean(rentFact),
    hasDeposit: false,
    showStatusDot: !favorite.available,
    statusLabel: favorite.available ? '' : '已下架',
    statusTone: favorite.available ? 'warning' : 'muted',
    distanceText: '',
  }
}
