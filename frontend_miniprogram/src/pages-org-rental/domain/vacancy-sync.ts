import type { VacancySyncOut } from '../api/organization-rental'

export type VacancySyncBlock = VacancySyncOut['blocks'][number]
export type VacancySyncFilter = 'all' | 'errors' | 'changes'

export const vacancyChangeLabels = {
  create_houses: '新增房源',
  update_houses: '更新资料',
  mark_paused: '改为暂不出租',
  mark_rented: '清单外改为已租',
  preserve_ignored: '忽略保护，保持原状',
  inactive_conflicts: '停用房源冲突',
} as const

export function getVacancyChangeGroups(block: VacancySyncBlock) {
  return Object.entries(vacancyChangeLabels).map(([key, label]) => ({
    key,
    label,
    items: block.changes[key as keyof typeof vacancyChangeLabels] || [],
  })).filter(group => group.items.length)
}

export function getVacancyVisibleLines(block: VacancySyncBlock, filter: VacancySyncFilter) {
  if (filter === 'errors')
    return block.lines.filter(line => line.status !== 'valid')
  if (filter === 'changes') {
    const rooms = new Set([
      ...block.changes.create_houses,
      ...block.changes.update_houses,
      ...block.changes.mark_paused,
    ].map(item => item.room_number))
    return block.lines.filter(line => line.room_number && rooms.has(line.room_number))
  }
  return block.lines
}

export function isVacancyBlockVisible(block: VacancySyncBlock, filter: VacancySyncFilter) {
  if (filter === 'errors')
    return block.errors.length > 0 || block.lines.some(line => line.status !== 'valid')
  if (filter === 'changes')
    return [block.changes.create_houses, block.changes.update_houses, block.changes.mark_paused, block.changes.mark_rented].some(items => items.length)
  return true
}

export function formatVacancyFieldValue(field: string, value?: string | null) {
  if (value == null || value === '')
    return '未填写'
  if (field === 'asking_rent')
    return `¥${Number(value).toFixed(2)}/月`
  if (field === 'floor')
    return `${value}楼`
  return value
}

export const vacancyFieldLabels: Record<string, string> = {
  floor: '楼层',
  asking_rent: '租金',
  bedrooms: '卧室数',
  living_rooms: '客厅数',
  tags: '标签',
}
