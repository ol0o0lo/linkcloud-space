export {
  HOUSE_PUBLISH_RULE_LABELS,
  HOUSE_PUBLISH_RULE_MODE,
  canHousePublish,
  DEFAULT_HOUSE_PUBLISH_RULES,
  evaluateHousePublishState,
  getHouseBlockingIssues,
  getHouseIssueActionHint,
  getHousePublishIssues,
  getHouseWarningIssues,
  getTrackedHousePublishIssues,
  houseMediaReadinessText,
  normalizeHousePublishRules,
} from './publish-rules';
export type { HousePublishRuleKey, HousePublishRuleMode, HousePublishRuleSnapshot } from './publish-rules';

export const CONTACT_ROLE = {
  LANDLORD: 'landlord',
  TENANT: 'tenant',
} as const;

export const HOUSE_STATUS = {
  VACANT: 'vacant',
  RENTED: 'rented',
  RENOVATING: 'renovating',
  LOCKED: 'locked',
} as const;

export const HOUSE_PUBLISH_STATUS = {
  DRAFT: 'draft',
  PUBLISHED: 'published',
  UNPUBLISHED: 'unpublished',
} as const;

export const HOUSE_PUBLISH_STATUS_COLOR: Record<string, string> = {
  [HOUSE_PUBLISH_STATUS.DRAFT]: 'default',
  [HOUSE_PUBLISH_STATUS.PUBLISHED]: 'green',
  [HOUSE_PUBLISH_STATUS.UNPUBLISHED]: 'orange',
};

export const HOUSE_IMAGE_ROLE_OPTIONS = [
  { value: 'cover', label: '封面' },
  { value: 'living_room', label: '客厅' },
  { value: 'bedroom', label: '卧室' },
  { value: 'kitchen', label: '厨房' },
  { value: 'bathroom', label: '卫生间' },
  { value: 'balcony', label: '阳台' },
  { value: 'floor_plan', label: '户型图' },
  { value: 'building', label: '楼栋/外观' },
];

export const VIEWING_STATUS = {
  SCHEDULED: 'scheduled',
  VIEWED: 'viewed',
  CANCELED: 'canceled',
  NO_SHOW: 'no_show',
  CONVERTED: 'converted',
} as const;

export const VIEWING_STATUS_FLOW_OPTIONS: Record<string, string[]> = {
  [VIEWING_STATUS.SCHEDULED]: [
    VIEWING_STATUS.VIEWED,
    VIEWING_STATUS.CONVERTED,
    VIEWING_STATUS.CANCELED,
    VIEWING_STATUS.NO_SHOW,
  ],
  [VIEWING_STATUS.VIEWED]: [
    VIEWING_STATUS.CONVERTED,
    VIEWING_STATUS.CANCELED,
  ],
  [VIEWING_STATUS.CANCELED]: [],
  [VIEWING_STATUS.NO_SHOW]: [],
  [VIEWING_STATUS.CONVERTED]: [],
};

export const LEASE_STATUS = {
  PENDING: 'pending',
  ACTIVE: 'active',
  EXPIRED: 'expired',
  TERMINATED: 'terminated',
} as const;

export const STATUS_COLOR: Record<string, string> = {
  [HOUSE_STATUS.VACANT]: 'green',
  [HOUSE_STATUS.RENTED]: 'blue',
  [HOUSE_STATUS.RENOVATING]: 'orange',
  [HOUSE_STATUS.LOCKED]: 'red',
  [LEASE_STATUS.ACTIVE]: 'blue',
  [VIEWING_STATUS.CONVERTED]: 'purple',
};

export const LEASE_STATUS_FLOW_OPTIONS: Record<string, string[]> = {
  [LEASE_STATUS.PENDING]: [
    LEASE_STATUS.ACTIVE,
    LEASE_STATUS.TERMINATED,
  ],
  [LEASE_STATUS.ACTIVE]: [
    LEASE_STATUS.EXPIRED,
    LEASE_STATUS.TERMINATED,
  ],
  [LEASE_STATUS.EXPIRED]: [LEASE_STATUS.EXPIRED],
  [LEASE_STATUS.TERMINATED]: [LEASE_STATUS.TERMINATED],
};

export const HOUSE_MEDIA_RESOURCE_TYPE = {
  ESTATE_IMAGE: 'estate_image',
  HOUSE_IMAGE: 'house_image',
  HOUSE_VIDEO: 'house_video',
  LEASE_CONTRACT: 'lease_contract',
} as const;

export const HOUSE_MEDIA_TYPE = {
  IMAGE: 'image',
  VIDEO: 'video',
  FILE: 'file',
} as const;

export type MediaRefValue = {
  media_id: number;
  media_type: string;
  label?: string;
  image_role?: string;
  url?: string;
  thumbnail?: string | null;
  file_size?: number;
  original_filename?: string;
  created_at?: string;
};

export function stripDerivedMediaFields(items: MediaRefValue[]) {
  return items.map(({ media_id, media_type, label, image_role }) => ({
    media_id,
    media_type,
    ...(label ? { label } : {}),
    ...(image_role ? { image_role } : {}),
  }));
}

export function getHouseMediaCompleteness(house: { images?: Record<string, unknown>[]; videos?: Record<string, unknown>[]; landlord_id?: number | null }) {
  const images = house.images || [];
  const hasCover = images.some((item) => item.image_role === 'cover');
  const hasFloorPlan = images.some((item) => item.image_role === 'floor_plan');
  return {
    imageCount: images.length,
    videoCount: house.videos?.length || 0,
    hasCover,
    hasFloorPlan,
    hasLandlord: Boolean(house.landlord_id),
  };
}

export function moneyText(value?: string | number | null) {
  return value ? `¥${value}` : '-';
}

export function dateTimeText(value?: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('zh-CN', { hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(/\//g, '-');
}

export function dateTimeInputValue(value?: string | null) {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 16);
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return offsetDate.toISOString().slice(0, 16);
}

export function houseLabel(house?: { id?: number; room_number?: string | null; house_label?: string | null; estate_name?: string | null; building_name?: string | null }) {
  if (!house) return '-';
  if (house.house_label) return house.house_label;
  const scopedLabel = [house.estate_name, house.building_name, house.room_number].filter(Boolean).join(' / ');
  if (scopedLabel) return scopedLabel;
  return house.room_number || `房源 #${house.id}`;
}

export function buildingLabel(building?: { id?: number; name?: string | null; estate_name?: string | null }) {
  if (!building) return '-';
  const name = building.name || `楼栋 #${building.id}`;
  return [building.estate_name, name].filter(Boolean).join(' / ');
}

export function contactLabel(contact?: { id?: number; name?: string | null; phone?: string | null; landlord_name?: string | null; landlord_phone?: string | null; tenant_name?: string | null; tenant_phone?: string | null; contact_name?: string | null; contact_phone?: string | null }) {
  if (!contact) return '-';
  const name = contact.name || contact.landlord_name || contact.tenant_name || contact.contact_name || `联系人 #${contact.id}`;
  const phone = contact.phone || contact.landlord_phone || contact.tenant_phone || contact.contact_phone;
  return [name, phone].filter(Boolean).join(' / ');
}
