const CHINESE_NUMBERS = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十']

function formatRoomCount(value: number): string {
  return CHINESE_NUMBERS[value] || String(value)
}

export function formatHouseLayout(bedrooms?: number | null, livingRooms?: number | null): string {
  if (bedrooms == null && livingRooms == null)
    return '户型待完善'

  const roomCount = bedrooms || 0
  const livingRoomCount = livingRooms || 0
  if (roomCount === 1 && livingRoomCount === 0)
    return '单间'
  if (roomCount === 0 && livingRoomCount === 0)
    return '户型待完善'

  return `${roomCount > 0 ? `${formatRoomCount(roomCount)}室` : ''}${livingRoomCount > 0 ? `${formatRoomCount(livingRoomCount)}厅` : ''}`
}

export function normalizePublicHouseQuery(query: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(query).flatMap(([key, rawValue]) => {
      if (rawValue == null)
        return []
      if (typeof rawValue === 'string') {
        const value = rawValue.trim()
        return value ? [[key, value]] : []
      }
      if (Array.isArray(rawValue))
        return rawValue.length > 0 ? [[key, rawValue]] : []
      return [[key, rawValue]]
    }),
  )
}
