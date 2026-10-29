export type TenantStatusTone = 'default' | 'primary' | 'success' | 'warning' | 'danger'

export interface TenantViewingPendingPayload {
  houseId: number
  scheduledAt: string
  notes: string
}

interface TenantHouseTitleInput {
  room_number: string
  building: {
    name: string
    address?: string
    estate: { display_name: string, name: string, province?: string, city?: string, district?: string, address?: string } | null
  }
}

const viewingStatusTones: Record<string, TenantStatusTone> = {
  scheduled: 'primary',
  viewed: 'success',
  canceled: 'danger',
  no_show: 'warning',
  converted: 'success',
}

const leaseStatusTones: Record<string, TenantStatusTone> = {
  pending: 'warning',
  active: 'success',
  expired: 'default',
  terminated: 'danger',
}

export function getTenantViewingStatusTone(status: string): TenantStatusTone {
  return viewingStatusTones[status] || 'default'
}

export function getTenantLeaseStatusTone(status: string): TenantStatusTone {
  return leaseStatusTones[status] || 'default'
}

export function canCancelTenantViewing(status: string): boolean {
  return status === 'scheduled'
}

export function formatTenantHouseTitle(house: TenantHouseTitleInput): string {
  const estateName = house.building.estate?.display_name || house.building.estate?.name || ''
  return [estateName, house.building.name, house.room_number].filter(Boolean).join(' ')
}

export function formatTenantHouseAddress(house: TenantHouseTitleInput): string {
  const { building } = house
  const estate = building.estate
  return [estate?.province, estate?.city, estate?.district, building.address || estate?.address].filter(Boolean).join(' ') || building.name
}

export function sortCurrentTenantViewings<T extends { scheduled_at: string }>(items: T[], now = Date.now()): T[] {
  return [...items].sort((left, right) => {
    const leftTime = Date.parse(left.scheduled_at)
    const rightTime = Date.parse(right.scheduled_at)
    const leftPast = leftTime < now
    const rightPast = rightTime < now
    if (leftPast !== rightPast)
      return leftPast ? 1 : -1
    return leftPast ? rightTime - leftTime : leftTime - rightTime
  })
}

export function isTenantViewingPendingPayload(payload: unknown): payload is TenantViewingPendingPayload {
  if (!payload || typeof payload !== 'object')
    return false
  const value = payload as Partial<TenantViewingPendingPayload>
  return typeof value.houseId === 'number'
    && Number.isInteger(value.houseId)
    && value.houseId > 0
    && typeof value.scheduledAt === 'string'
    && value.scheduledAt.length > 0
    && Number.isFinite(Date.parse(value.scheduledAt))
    && typeof value.notes === 'string'
    && value.notes.length <= 1000
}
