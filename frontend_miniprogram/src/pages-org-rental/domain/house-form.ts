import type { OrganizationHouseWriteInput } from './organization-rental'
import { formatHouseLayout } from '../../domain/house.ts'

export function createEmptyHouseForm(buildingId = 0): OrganizationHouseWriteInput {
  return {
    building_id: buildingId,
    landlord_id: null,
    room_number: '',
    listing_type: null,
    floor: '',
    area: '',
    interior_area: '',
    asking_rent: '',
    deposit_amount: '',
    bedrooms: '',
    living_rooms: '',
    bathrooms: '',
    kitchens: '',
    balconies: '',
    orientation: '',
    decoration: '',
    has_elevator_access: false,
    images: [],
    videos: [],
    tags: '',
    public_description: '',
    internal_notes: '',
  }
}

export const houseLayoutPresets = [[1, 0], [1, 1], [2, 1], [3, 1]].map(([bedrooms, livingRooms]) => ({
  bedrooms,
  living_rooms: livingRooms,
  label: formatHouseLayout(bedrooms, livingRooms),
}))

const numericFields = [
  { key: 'floor', label: '所在楼层', integer: true, negative: true },
  { key: 'area', label: '建筑面积' },
  { key: 'interior_area', label: '套内面积' },
  { key: 'asking_rent', label: '挂牌租金' },
  { key: 'deposit_amount', label: '押金' },
  { key: 'bedrooms', label: '卧室数量', integer: true },
  { key: 'living_rooms', label: '客厅数量', integer: true },
  { key: 'bathrooms', label: '卫生间数量', integer: true },
  { key: 'kitchens', label: '厨房数量', integer: true },
  { key: 'balconies', label: '阳台数量', integer: true },
] as const

export type HouseFormErrors = Partial<Record<keyof OrganizationHouseWriteInput, string>>

export function getHouseFormErrors(values: OrganizationHouseWriteInput): HouseFormErrors {
  const errors: HouseFormErrors = {}
  if (!Number.isInteger(values.building_id) || values.building_id <= 0)
    errors.building_id = '请选择房源所在楼栋'
  if (!values.room_number.trim())
    errors.room_number = '请填写房号'
  for (const field of numericFields) {
    const value = values[field.key]
    if (value == null || String(value).trim() === '')
      continue
    const number = Number(value)
    if (!Number.isFinite(number) || (!('negative' in field) && number < 0) || ('integer' in field && !Number.isInteger(number)))
      errors[field.key] = `${field.label}请填写${'negative' in field ? '整数' : 'integer' in field ? '非负整数' : '非负数字'}`
  }
  return errors
}

export interface HouseFormDraft {
  form: OrganizationHouseWriteInput
  buildingLabel: string
  landlordLabel: string
  updatedAt: number
}

export function getHouseDraftKey(userId: number, organizationSlug: string, houseId = 0): string | null {
  if (!Number.isInteger(userId) || userId <= 0 || !organizationSlug.trim() || !Number.isInteger(houseId) || houseId < 0)
    return null
  return `house-form-draft:${userId}:${encodeURIComponent(organizationSlug)}:${houseId || 'new'}`
}

export function isHouseFormDraft(value: unknown): value is HouseFormDraft {
  if (!value || typeof value !== 'object')
    return false
  const draft = value as HouseFormDraft
  if (!draft.form || typeof draft.form !== 'object' || typeof draft.buildingLabel !== 'string' || typeof draft.landlordLabel !== 'string'
    || !Number.isFinite(draft.updatedAt) || draft.updatedAt <= 0) {
    return false
  }
  const form = draft.form
  const defaults = createEmptyHouseForm()
  if (Object.keys(form).some(key => !Object.hasOwn(defaults, key)))
    return false
  if (!Number.isInteger(form.building_id) || form.building_id < 0 || (form.landlord_id !== null && (!Number.isInteger(form.landlord_id) || form.landlord_id <= 0)))
    return false
  if (form.listing_type !== null && !['whole', 'shared', 'apartment', 'short_term'].includes(form.listing_type || ''))
    return false
  for (const [key, initial] of Object.entries(defaults)) {
    const field = form[key as keyof OrganizationHouseWriteInput]
    if (numericFields.some(item => item.key === key)) {
      if (field != null && typeof field !== 'string' && !(typeof field === 'number' && Number.isFinite(field)))
        return false
    }
    else if (key === 'images' || key === 'videos') {
      if (!Array.isArray(field) || !field.every(item => item && typeof item === 'object' && typeof item.media_id === 'number' && Number.isInteger(item.media_id) && item.media_id > 0))
        return false
    }
    else if (initial !== null && typeof field !== typeof initial) {
      return false
    }
  }
  return true
}
