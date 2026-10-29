import type { PropertyLocation } from '@/domain/property-location'

export type { PropertyLocation } from '@/domain/property-location'
export type OrganizationStatusTone = 'default' | 'primary' | 'success' | 'warning' | 'danger'
export type OrganizationViewingAction = 'viewed' | 'canceled' | 'no_show' | 'converted'
export type OrganizationHouseLifecycleAction = 'publish' | 'unpublish' | 'disable' | 'enable'
export type OrganizationLeaseStatusAction = 'active' | 'expired' | 'terminated'
export type OrganizationAllocationAction = 'approve' | 'reject' | 'void'
export type OrganizationCapabilities = Record<string, unknown> | undefined

const vacancyBuildingMatchStatusLabels: Record<string, string> = {
  matched: '已匹配',
  overridden: '已手动选择',
  ambiguous: '待选择',
  new: '将新建',
  created: '已新建',
}

const vacancyLineStatusLabels: Record<string, string> = {
  valid: '可同步',
  error: '有错误',
  ignored: '已忽略',
}

const allocationRuleSourceLabels: Record<string, string> = {
  default: '系统默认',
  organization: '空间设置',
  team: '团队设置',
}

const allocationStatusTones: Record<string, OrganizationStatusTone> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'danger',
  voided: 'danger',
  expired: 'danger',
  withdrawn: 'default',
}

type OrganizationMediaType = 'image' | 'video' | 'file'

interface OrganizationMediaRefInput {
  media_id?: unknown
  media_type?: OrganizationMediaType
  [key: string]: unknown
}

export interface OrganizationHouseWriteInput {
  building_id: number
  landlord_id: number | null
  room_number: string
  listing_type?: 'whole' | 'shared' | 'apartment' | 'short_term' | null
  floor?: string | number | null
  area?: string | number | null
  interior_area?: string | number | null
  asking_rent?: string | number | null
  deposit_amount?: string | number | null
  bedrooms?: string | number | null
  living_rooms?: string | number | null
  bathrooms?: string | number | null
  kitchens?: string | number | null
  balconies?: string | number | null
  orientation?: string | null
  decoration?: string | null
  has_elevator_access?: boolean
  images?: OrganizationMediaRefInput[]
  videos?: OrganizationMediaRefInput[]
  tags?: string | string[]
  public_description?: string
  internal_notes?: string
}

export interface OrganizationContactWriteInput {
  name: string
  phone: string
  email?: string
  roles: string[]
  notes?: string
  is_active: boolean
}

export interface OrganizationEstateWriteInput {
  location?: PropertyLocation | null
  name: string
  display_name: string
  developer?: string | null
  built_year?: string | number | null
  property_type: string
  province: string
  city: string
  district: string
  subdistrict?: string
  address?: string
  description?: string
}

export interface OrganizationBuildingWriteInput {
  location?: PropertyLocation | null
  estate_id: number | null
  name: string
  floors: string | number
  under_floors?: string | number | null
  year_built?: string | number | null
  elevator: boolean
  address: string
  tags?: string | string[]
}

export interface OrganizationViewingCreateInput {
  house_id: number
  contact_id?: number | null
  source_inquiry_id?: number
  customer_name: string
  customer_phone: string
  scheduled_at: string | number | Date
  assigned_to_id?: number | null
  notes?: string
}

export interface OrganizationLeaseWriteInput {
  house_id: number
  tenant_id: number
  source_viewing_record_id?: number | null
  sign_at?: string | null
  start_date: string
  end_date: string
  monthly_rent: string | number
  deposit?: string | number | null
  payment_day?: string | number | null
  status?: string | null
  contract_files?: OrganizationMediaRefInput[]
  notes?: string
  extra?: Record<string, unknown>
}

interface OrganizationAllocationActionInput {
  status: string
  source_snapshot: Record<string, unknown>
}

interface OrganizationAllocationActionCapabilities {
  review?: boolean
  void?: boolean
}

interface OrganizationHouseTitleInput {
  room_number: string
  building: {
    name: string
    estate: { display_name: string, name: string } | null
  }
}

interface VacancySyncComparableInput {
  raw_text: string
  building_overrides?: Array<{ block_index: number, building_id: number }>
  ignored_lines?: number[]
}

const viewingActions: readonly OrganizationViewingAction[] = ['viewed', 'canceled', 'no_show', 'converted']

const leaseStatusActions: Record<string, OrganizationLeaseStatusAction[]> = {
  pending: ['active', 'terminated'],
  active: ['expired', 'terminated'],
  expired: [],
  terminated: [],
}

const viewingStatusTones: Record<string, OrganizationStatusTone> = {
  scheduled: 'primary',
  viewed: 'success',
  canceled: 'danger',
  no_show: 'warning',
  converted: 'success',
}

const leaseStatusTones: Record<string, OrganizationStatusTone> = {
  pending: 'warning',
  active: 'success',
  expired: 'default',
  terminated: 'danger',
}

const houseStatusTones: Record<string, OrganizationStatusTone> = {
  paused: 'warning',
  listed: 'success',
  rented: 'primary',
}

export function getVacancyBuildingMatchStatusLabel(status?: string): string {
  return status ? vacancyBuildingMatchStatusLabels[status] || '状态未知' : '状态未知'
}

export function getVacancyLineStatusLabel(status?: string): string {
  return status ? vacancyLineStatusLabels[status] || '状态未知' : '状态未知'
}

export function getAllocationRuleSourceLabel(source?: string, _mapping?: string): string {
  return source ? allocationRuleSourceLabels[source] || '其他规则' : '其他规则'
}

export function isUniActionCanceled(error: unknown): boolean {
  if (error instanceof Error)
    return /cancel/i.test(error.message)
  if (typeof error !== 'object' || error === null)
    return false
  const actionError = error as { errMsg?: unknown, message?: unknown }
  return /cancel/i.test(String(actionError.errMsg || actionError.message || ''))
}

export function getViewingActions(status: string): OrganizationViewingAction[] {
  return status === 'scheduled' ? [...viewingActions] : []
}

export function getOrganizationHouseLifecycleActions(status: string, isActive = true): OrganizationHouseLifecycleAction[] {
  if (!isActive)
    return ['enable']
  if (status === 'paused')
    return ['publish', 'disable']
  if (status === 'listed')
    return ['unpublish', 'disable']
  if (status === 'rented')
    return ['disable']
  return []
}

export function getOrganizationLeaseStatusActions(status: string): OrganizationLeaseStatusAction[] {
  return [...(leaseStatusActions[status] || [])]
}

export function getOrganizationAllocationLeaseId(request: Pick<OrganizationAllocationActionInput, 'source_snapshot'>): number | null {
  const value = request.source_snapshot.lease_id
  const leaseId = Number(value)
  return Number.isInteger(leaseId) && leaseId > 0 ? leaseId : null
}

export function getOrganizationAllocationActions(
  request: OrganizationAllocationActionInput,
  capabilities: OrganizationAllocationActionCapabilities | null | undefined,
): OrganizationAllocationAction[] {
  if (!getOrganizationAllocationLeaseId(request))
    return []
  if (request.status === 'pending' && capabilities?.review)
    return ['approve', 'reject']
  if (request.status === 'approved' && capabilities?.void)
    return ['void']
  return []
}

function numericValue(value: unknown): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function optionalHouseNumber(value: unknown): number | null {
  if (value == null || String(value).trim() === '')
    return null
  const parsed = Number(value)
  if (!Number.isFinite(parsed))
    throw new Error('房源数字字段格式不正确')
  return parsed
}

function nullableMoneyValue(value: unknown): number | null {
  if (value == null || value === '')
    return null
  return numericValue(value)
}

function nullableIntegerValue(value: unknown): number | null {
  if (value == null || value === '')
    return null
  const parsed = Number(value)
  return Number.isInteger(parsed) ? parsed : null
}

function nullableText(value: unknown): string | null {
  const normalized = String(value || '').trim()
  return normalized || null
}

function normalizeTags(value: string | string[] | undefined): string[] {
  const items = Array.isArray(value) ? value : String(value || '').split(/[,，]/)
  return Array.from(new Set(items.map(item => item.trim()).filter(Boolean)))
}

function normalizeMediaRefs(items: OrganizationMediaRefInput[] | undefined, mediaType: OrganizationMediaType) {
  return (items || []).flatMap((item) => {
    const mediaId = Number(item.media_id)
    return Number.isInteger(mediaId) && mediaId > 0 ? [{ media_id: mediaId, media_type: mediaType }] : []
  })
}

export function buildOrganizationHouseCreatePayload(values: OrganizationHouseWriteInput) {
  return {
    building_id: Number(values.building_id),
    landlord_id: values.landlord_id == null ? null : Number(values.landlord_id),
    room_number: values.room_number.trim(),
    listing_type: values.listing_type || null,
    floor: optionalHouseNumber(values.floor),
    area: optionalHouseNumber(values.area),
    interior_area: optionalHouseNumber(values.interior_area),
    asking_rent: optionalHouseNumber(values.asking_rent),
    deposit_amount: optionalHouseNumber(values.deposit_amount),
    bedrooms: optionalHouseNumber(values.bedrooms),
    living_rooms: optionalHouseNumber(values.living_rooms),
    bathrooms: optionalHouseNumber(values.bathrooms),
    kitchens: optionalHouseNumber(values.kitchens),
    balconies: optionalHouseNumber(values.balconies),
    orientation: nullableText(values.orientation),
    decoration: nullableText(values.decoration),
    has_elevator_access: values.has_elevator_access === true,
    images: normalizeMediaRefs(values.images, 'image'),
    videos: normalizeMediaRefs(values.videos, 'video'),
    tags: normalizeTags(values.tags),
    public_description: String(values.public_description || '').trim(),
  }
}

export function buildOrganizationHousePatchPayload(values: OrganizationHouseWriteInput, originalMedia?: Pick<OrganizationHouseWriteInput, 'images' | 'videos'>) {
  const { images, videos, ...fields } = buildOrganizationHouseCreatePayload(values)
  return {
    ...fields,
    ...(originalMedia && JSON.stringify(images) === JSON.stringify(normalizeMediaRefs(originalMedia.images, 'image')) ? {} : { images }),
    ...(originalMedia && JSON.stringify(videos) === JSON.stringify(normalizeMediaRefs(originalMedia.videos, 'video')) ? {} : { videos }),
    internal_notes: String(values.internal_notes || '').trim(),
  }
}

export function buildOrganizationEstatePayload(values: OrganizationEstateWriteInput) {
  return {
    name: values.name.trim(),
    display_name: values.display_name.trim(),
    ...(values.location !== undefined ? { location: values.location } : {}),
    developer: nullableText(values.developer),
    built_year: nullableIntegerValue(values.built_year),
    property_type: values.property_type,
    province: values.province.trim(),
    city: values.city.trim(),
    district: values.district.trim(),
    subdistrict: String(values.subdistrict || '').trim(),
    address: String(values.address || '').trim(),
    description: String(values.description || '').trim(),
  }
}

export function buildOrganizationBuildingPayload(values: OrganizationBuildingWriteInput) {
  return {
    estate_id: values.estate_id == null ? null : Number(values.estate_id),
    name: values.name.trim(),
    ...(values.location !== undefined ? { location: values.location } : {}),
    floors: numericValue(values.floors),
    under_floors: nullableIntegerValue(values.under_floors),
    year_built: nullableIntegerValue(values.year_built),
    elevator: values.elevator === true,
    address: values.address.trim(),
    tags: normalizeTags(values.tags),
  }
}

export function buildOrganizationViewingCreatePayload(values: OrganizationViewingCreateInput) {
  return {
    house_id: Number(values.house_id),
    contact_id: values.contact_id == null ? null : Number(values.contact_id),
    ...(values.source_inquiry_id ? { source_inquiry_id: Number(values.source_inquiry_id) } : {}),
    customer_name: values.customer_name.trim(),
    customer_phone: values.customer_phone.trim(),
    scheduled_at: new Date(values.scheduled_at).toISOString(),
    assigned_to_id: values.assigned_to_id == null ? null : Number(values.assigned_to_id),
    notes: String(values.notes || '').trim(),
  }
}

export function buildOrganizationContactPayload(values: OrganizationContactWriteInput) {
  return {
    name: values.name.trim(),
    phone: values.phone.trim(),
    email: String(values.email || '').trim(),
    roles: Array.from(new Set(values.roles)),
    notes: String(values.notes || '').trim(),
    is_active: values.is_active,
  }
}

export function buildOrganizationLeasePatchPayload(values: OrganizationLeaseWriteInput) {
  return {
    house_id: Number(values.house_id),
    tenant_id: Number(values.tenant_id),
    source_viewing_record_id: values.source_viewing_record_id == null ? null : Number(values.source_viewing_record_id),
    sign_at: values.sign_at || null,
    start_date: values.start_date,
    end_date: values.end_date,
    monthly_rent: numericValue(values.monthly_rent),
    deposit: nullableMoneyValue(values.deposit),
    payment_day: numericValue(values.payment_day || 1),
    status: values.status || null,
    contract_files: normalizeMediaRefs(values.contract_files, 'file'),
    notes: String(values.notes || '').trim(),
    extra: values.extra || {},
  }
}

export function canOpenOrganizationCapability(capabilities: OrganizationCapabilities, capability?: string): boolean {
  return capability ? capabilities?.[capability] === true : true
}

export function formatOrganizationHouseTitle(house: OrganizationHouseTitleInput): string {
  const estateName = house.building.estate?.display_name || house.building.estate?.name || ''
  return [estateName, house.building.name, house.room_number].filter(Boolean).join(' ')
}

export function formatOrganizationDateTime(value?: string | null): string {
  return value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '--'
}

export function formatOrganizationLocalDate(date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function formatOrganizationMoney(value?: string | number | null): string {
  if (value == null || value === '')
    return '--'
  const amount = Number(value)
  return Number.isFinite(amount) ? `¥${amount.toFixed(2)}` : `¥${value}`
}

export function getOrganizationViewingStatusTone(status: string): OrganizationStatusTone {
  return viewingStatusTones[status] || 'default'
}

export function getOrganizationLeaseStatusTone(status: string): OrganizationStatusTone {
  return leaseStatusTones[status] || 'default'
}

export function getOrganizationHouseStatusTone(status: string): OrganizationStatusTone {
  return houseStatusTones[status] || 'default'
}

export function getOrganizationAllocationStatusTone(status: string): OrganizationStatusTone {
  return allocationStatusTones[status] || 'default'
}

function getVacancySyncInputFingerprint(input: VacancySyncComparableInput): string {
  return JSON.stringify({
    raw_text: input.raw_text,
    building_overrides: [...(input.building_overrides || [])]
      .sort((left, right) => left.block_index - right.block_index || left.building_id - right.building_id),
    ignored_lines: [...(input.ignored_lines || [])].sort((left, right) => left - right),
  })
}

export function isVacancySyncPreviewStale(previewInput: VacancySyncComparableInput | null, currentInput: VacancySyncComparableInput): boolean {
  if (!previewInput)
    return false
  return getVacancySyncInputFingerprint(previewInput) !== getVacancySyncInputFingerprint(currentInput)
}
