import type { TenantStatusTone } from './tenant-rental.ts'

const houseStatusTones: Record<string, TenantStatusTone> = {
  listed: 'success',
  vacant: 'warning',
  rented: 'primary',
  renovating: 'warning',
  inactive: 'default',
}

export function getLandlordHouseStatusTone(status: string): TenantStatusTone {
  return houseStatusTones[status] || 'default'
}
