export interface MerchantHouseFilterInput {
  minRent: string
  maxRent: string
  bedrooms: string
  district: string
}

export function buildMerchantHouseFilters(values: MerchantHouseFilterInput) {
  const parseRent = (value: string, label: string) => {
    if (!value.trim())
      return undefined
    const amount = Number(value)
    if (!Number.isFinite(amount) || amount < 0)
      throw new Error(`${label}请输入不小于 0 的数字`)
    return amount
  }
  const minRent = parseRent(values.minRent, '最低租金')
  const maxRent = parseRent(values.maxRent, '最高租金')
  if (minRent !== undefined && maxRent !== undefined && minRent > maxRent)
    throw new Error('最低租金不能高于最高租金')
  const bedrooms = values.bedrooms === '' ? undefined : Number(values.bedrooms)
  if (bedrooms !== undefined && (!Number.isInteger(bedrooms) || bedrooms < 0))
    throw new Error('卧室数请输入不小于 0 的整数')
  return { min_rent: minRent, max_rent: maxRent, bedrooms, district: values.district.trim() || undefined }
}

export function canSelectMatchHouse(house: { status: string, is_active?: boolean }): boolean {
  return house.status === 'listed' && house.is_active !== false
}

export function getMatchExtensionDate(expiresAt: string | null, days: number, now = Date.now()): string {
  const previous = expiresAt ? new Date(expiresAt).getTime() : now
  return new Date(Math.max(Number.isFinite(previous) ? previous : now, now) + days * 24 * 60 * 60 * 1000).toISOString()
}
