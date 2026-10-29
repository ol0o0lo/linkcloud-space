export interface MigrationMediaReference {
  id: string
  field: string
  position: number
  url: string | null
  media_type: string
  status: string
  media_file_id?: number | null
  source_meta?: { related_field?: string, field_path?: string }
}

export interface HouseDisplayMedia {
  id?: unknown
  media_id?: unknown
  url?: unknown
  thumbnail?: unknown
  original_filename?: unknown
  [key: string]: unknown
}

export interface HouseMediaSource {
  images?: HouseDisplayMedia[] | null
  videos?: HouseDisplayMedia[] | null
  migration_media?: unknown
}

export function getHouseMigrationMedia(source: { migration_media?: unknown } | null): MigrationMediaReference[] {
  if (!Array.isArray(source?.migration_media))
    return []
  return source.migration_media.filter((value): value is MigrationMediaReference => {
    if (!value || typeof value !== 'object')
      return false
    const item = value as Partial<MigrationMediaReference>
    return typeof item.id === 'string' && typeof item.field === 'string' && typeof item.position === 'number'
      && (typeof item.url === 'string' || item.url === null) && typeof item.media_type === 'string' && typeof item.status === 'string'
  })
}

/** 仅用于展示。返回新数组，不将旧 URL 混入房源编辑和提交的正式媒体引用。 */
export function getHouseDisplayMedia(source: HouseMediaSource, type: 'image' | 'video'): HouseDisplayMedia[] {
  const field = type === 'image' ? 'images' : 'videos'
  const result = [...(source[field] || [])]
  const seen = new Set(result.map(item => item.url).filter(Boolean))
  const seenMediaIds = new Set(result.filter(item => item.url).map(item => item.media_id ?? item.id).filter(Boolean))
  const migrated = getHouseMigrationMedia(source).filter(item => item.media_type === type && item.field === field && item.url).slice().sort((left, right) => left.position - right.position)
  for (const item of migrated) {
    if (seen.has(item.url) || (item.media_file_id && seenMediaIds.has(item.media_file_id)))
      continue
    seen.add(item.url)
    const position = Number.isInteger(item.position) && item.position >= 0 ? item.position : result.length
    result.splice(Math.min(position, result.length), 0, { id: `migration-${item.id}`, url: item.url, original_filename: '旧版房源媒体' })
  }
  return result
}
