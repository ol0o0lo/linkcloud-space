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
    estate: { display_name: string, name: string } | null
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
