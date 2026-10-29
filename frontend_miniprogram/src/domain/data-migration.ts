const statusLabels: Record<string, string> = {
  uploaded: '等待预检',
  validating: '预检中',
  blocked: '待补全或处理冲突',
  awaiting_confirmation: '待确认导入',
  importing: '业务导入中',
  completed: '业务导入完成',
  partial_failed: '部分业务导入失败',
  failed: '处理失败',
  pending: '等待处理',
  processing: '处理中',
  succeeded: '成功',
  missing: '资源缺失',
  imported: '已导入',
  created: '已新增',
  updated: '已更新',
  reused: '已复用',
  archived: '已归档',
  skipped: '已跳过',
  mapped: '已复用',
  ready: '待导入',
  invalid: '校验失败',
}
const entityLabels: Record<string, string> = {
  team: '团队',
  settings: '业务设置',
  identities: '历史身份',
  staff: '员工',
  staff_team_relations: '员工团队关系',
  landlords: '房东',
  buildings: '楼栋',
  houses: '房源',
  house_team_relations: '房源团队关系',
  staff_landlord_relations: '房东分配',
  bills: '历史账单',
  bill_team_relations: '账单团队关系',
  salaries: '历史薪资',
  surveys: '历史勘察',
  house_stats: '旧版累计统计',
  auth_applications: '历史入职申请',
}
const summaryLabels: Record<string, string> = {
  total: '总记录',
  imported: '已导入',
  created: '新增',
  updated: '更新',
  reused: '复用',
  mapped: '复用',
  archived: '归档',
  skipped: '跳过',
  duplicate: '重复',
  duplicates: '重复',
  conflict: '冲突',
  conflicts: '冲突',
  errors: '错误',
  error: '错误',
  failed: '失败',
  pending: '待处理',
  ready: '待导入',
  succeeded: '成功',
  missing: '缺失',
  processing: '处理中',
}
const fieldLabels: Record<string, string> = {
  name: '名称',
  phone: '联系电话',
  address: '地址',
  floors: '总楼层',
  total_floors: '总楼层',
  totalFloors: '总楼层',
  room_number: '房号',
  house_number: '房号',
  houseNum: '房号',
  floor: '楼层',
  area: '面积',
  rent: '租金',
  asking_rent: '挂牌租金',
  bedrooms: '卧室数',
  living_rooms: '客厅数',
  bathrooms: '卫生间数',
  status: '房源状态',
  building_id: '目标楼栋',
  landlord_id: '目标房东',
  latitude: '纬度',
  longitude: '经度',
  location: '楼栋坐标',
  listing_type: '出租分类',
  migration_action: '资料变更处理',
  bill_number: '旧账单号',
  staff_name: '经办人',
  staff_id: '旧员工编号',
  amount: '金额',
  checked: '已核对',
  approved: '审核通过',
  created_at: '旧版创建时间',
  updated_at: '旧版更新时间',
  houseId: '旧房源编号',
}
export const migrationFieldOptions: Record<string, Array<{ value: string, label: string }>> = {
  status: [{ value: 'listed', label: '招租中' }, { value: 'rented', label: '已出租' }, { value: 'paused', label: '暂不出租' }],
  listing_type: [{ value: 'whole', label: '整租' }, { value: 'shared', label: '合租' }, { value: 'apartment', label: '公寓' }, { value: 'short_term', label: '短租' }],
  migration_action: [{ value: 'keep', label: '保留新版现有资料' }, { value: 'update', label: '按本次预检更新允许字段' }],
}
export const migrationEntityOptions = [{ value: '', label: '全部类型' }, ...Object.entries(entityLabels).map(([value, label]) => ({ value, label }))]
export const migrationEntityLabel = (entity: string) => entityLabels[entity] || entity
export const migrationStateLabel = (state: string) => statusLabels[state] || state || '未知状态'
export const migrationSummaryLabel = (key: string) => summaryLabels[key] || entityLabels[key] || key
export const migrationFieldLabel = (key: string) => fieldLabels[key] || key
export function migrationMediaLabel(status: string): string {
  return ({ pending: '媒体等待迁移', processing: '媒体迁移中', completed: '媒体迁移完成', failed: '媒体存在失败' } as Record<string, string>)[status] || '媒体状态待更新'
}
export function migrationMediaPercentage(summary: { total: number, succeeded: number }, status: string): number {
  if (!summary.total)
    return status === 'completed' ? 100 : 0
  return Math.min(100, Math.round(summary.succeeded / summary.total * 100))
}
export function migrationIsRunning(status: string, mediaStatus: string): boolean {
  return ['uploaded', 'validating', 'importing'].includes(status) || mediaStatus === 'processing' || (mediaStatus === 'pending' && ['completed', 'partial_failed'].includes(status))
}
export function migrationOverrideValue(field: string, text: string): unknown {
  const value = text.trim()
  if (value === 'null' && ['landlord_id', 'location'].includes(field))
    return null
  if (['floors', 'total_floors', 'totalFloors', 'floor', 'area', 'rent', 'asking_rent', 'bedrooms', 'living_rooms', 'bathrooms', 'building_id', 'landlord_id', 'latitude', 'longitude'].includes(field)) {
    if (!value || !Number.isFinite(Number(value)))
      throw new Error(`${migrationFieldLabel(field)}需要填写有效数字`)
    return ['asking_rent', 'area', 'rent'].includes(field) ? value : Number(value)
  }
  if (field === 'location') {
    try {
      return JSON.parse(value)
    }
    catch { throw new Error(`${migrationFieldLabel(field)}的格式不正确`) }
  }
  return value
}
