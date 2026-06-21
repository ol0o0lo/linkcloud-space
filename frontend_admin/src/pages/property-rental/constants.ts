export const PROPERTY_TYPE_OPTIONS = [
  { value: 'residential', label: '住宅' },
  { value: 'commercial', label: '商业' },
  { value: 'industrial', label: '工业' },
  { value: 'mixed', label: '综合' },
];

export const CONTACT_ROLE = {
  LANDLORD: 'landlord',
  TENANT: 'tenant',
} as const;

export const CONTACT_ROLE_OPTIONS = [
  { value: CONTACT_ROLE.LANDLORD, label: '房东' },
  { value: CONTACT_ROLE.TENANT, label: '租客' },
];

export const HOUSE_STATUS = {
  VACANT: 'vacant',
  RENTED: 'rented',
  RENOVATING: 'renovating',
  LOCKED: 'locked',
} as const;

export const HOUSE_STATUS_OPTIONS = [
  { value: HOUSE_STATUS.VACANT, label: '空置' },
  { value: HOUSE_STATUS.RENTED, label: '已租' },
  { value: HOUSE_STATUS.RENOVATING, label: '装修中' },
  { value: HOUSE_STATUS.LOCKED, label: '封存' },
];

export const HOUSE_PUBLISH_STATUS = {
  DRAFT: 'draft',
  PUBLISHED: 'published',
  UNPUBLISHED: 'unpublished',
} as const;

export const HOUSE_PUBLISH_STATUS_OPTIONS = [
  { value: HOUSE_PUBLISH_STATUS.DRAFT, label: '草稿' },
  { value: HOUSE_PUBLISH_STATUS.PUBLISHED, label: '已发布' },
  { value: HOUSE_PUBLISH_STATUS.UNPUBLISHED, label: '已下架' },
];

export const HOUSE_PUBLISH_STATUS_TEXT: Record<string, string> = {
  [HOUSE_PUBLISH_STATUS.DRAFT]: '草稿',
  [HOUSE_PUBLISH_STATUS.PUBLISHED]: '已发布',
  [HOUSE_PUBLISH_STATUS.UNPUBLISHED]: '已下架',
};

export const HOUSE_PUBLISH_STATUS_COLOR: Record<string, string> = {
  [HOUSE_PUBLISH_STATUS.DRAFT]: 'default',
  [HOUSE_PUBLISH_STATUS.PUBLISHED]: 'green',
  [HOUSE_PUBLISH_STATUS.UNPUBLISHED]: 'orange',
};

export const HOUSE_ORIENTATION_OPTIONS = [
  { value: 'south', label: '南' },
  { value: 'north', label: '北' },
  { value: 'east', label: '东' },
  { value: 'west', label: '西' },
  { value: 'south_north', label: '南北' },
  { value: 'east_west', label: '东西' },
];

export const HOUSE_DECORATION_OPTIONS = [
  { value: 'raw', label: '毛坯' },
  { value: 'simple', label: '简装' },
  { value: 'fine', label: '精装' },
  { value: 'luxury', label: '豪装' },
];

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

export const VIEWING_STATUS_OPTIONS = [
  { value: VIEWING_STATUS.SCHEDULED, label: '已预约' },
  { value: VIEWING_STATUS.VIEWED, label: '已带看' },
  { value: VIEWING_STATUS.CANCELED, label: '已取消' },
  { value: VIEWING_STATUS.NO_SHOW, label: '爽约' },
  { value: VIEWING_STATUS.CONVERTED, label: '已成交' },
];

export const LEASE_STATUS = {
  PENDING: 'pending',
  ACTIVE: 'active',
  EXPIRED: 'expired',
  TERMINATED: 'terminated',
} as const;

export const STATUS_TEXT: Record<string, string> = {
  [HOUSE_STATUS.VACANT]: '空置',
  [HOUSE_STATUS.RENTED]: '已租',
  [HOUSE_STATUS.RENOVATING]: '装修中',
  [HOUSE_STATUS.LOCKED]: '封存',
  [VIEWING_STATUS.SCHEDULED]: '已预约',
  [VIEWING_STATUS.VIEWED]: '已带看',
  [VIEWING_STATUS.CANCELED]: '已取消',
  [VIEWING_STATUS.NO_SHOW]: '爽约',
  [VIEWING_STATUS.CONVERTED]: '已成交',
  [LEASE_STATUS.PENDING]: '待生效',
  [LEASE_STATUS.ACTIVE]: '生效中',
  [LEASE_STATUS.EXPIRED]: '已到期',
  [LEASE_STATUS.TERMINATED]: '已终止',
};

export const STATUS_COLOR: Record<string, string> = {
  [HOUSE_STATUS.VACANT]: 'green',
  [HOUSE_STATUS.RENTED]: 'blue',
  [HOUSE_STATUS.RENOVATING]: 'orange',
  [HOUSE_STATUS.LOCKED]: 'red',
  [LEASE_STATUS.ACTIVE]: 'blue',
  [VIEWING_STATUS.CONVERTED]: 'purple',
};

export const LEASE_STATUS_FLOW_OPTIONS: Record<string, { value: string; label: string }[]> = {
  [LEASE_STATUS.PENDING]: [
    { value: LEASE_STATUS.ACTIVE, label: STATUS_TEXT[LEASE_STATUS.ACTIVE] },
    { value: LEASE_STATUS.TERMINATED, label: STATUS_TEXT[LEASE_STATUS.TERMINATED] },
  ],
  [LEASE_STATUS.ACTIVE]: [
    { value: LEASE_STATUS.EXPIRED, label: STATUS_TEXT[LEASE_STATUS.EXPIRED] },
    { value: LEASE_STATUS.TERMINATED, label: STATUS_TEXT[LEASE_STATUS.TERMINATED] },
  ],
  [LEASE_STATUS.EXPIRED]: [{ value: LEASE_STATUS.EXPIRED, label: STATUS_TEXT[LEASE_STATUS.EXPIRED] }],
  [LEASE_STATUS.TERMINATED]: [{ value: LEASE_STATUS.TERMINATED, label: STATUS_TEXT[LEASE_STATUS.TERMINATED] }],
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

export function getCoverImage(images: Record<string, unknown>[] = []) {
  return images.find((item) => item.image_role === 'cover') || images[0] || null;
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
