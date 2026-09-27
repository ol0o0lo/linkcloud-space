import { request } from '@umijs/max';
import type { MediaRefValue } from '@/pages/rental/constants';

const BASE_PATH = '/api/admin/platform-operations/content';

export type PageResult<T> = {
  items: T[];
  total: number;
  page: number;
  page_size: number;
};

export type HomeDisplayStatus = 'disabled' | 'scheduled' | 'active' | 'expired';
export type ContentEntryKind = 'topic' | 'guide';
export type HomeBannerAction = 'entry' | 'house_list' | 'house_map';

export type ContentEntry = {
  id: number;
  kind: ContentEntryKind;
  kind__mapping: string;
  slug: string;
  eyebrow: string;
  title: string;
  summary: string;
  cover_image: MediaRefValue[];
  body_markdown: string;
  tone: string;
  sort_order: number;
  is_enabled: boolean;
  starts_at: string | null;
  ends_at: string | null;
  display_status: HomeDisplayStatus;
  display_status__mapping: string;
  house_count: number;
  created_at: string;
  updated_at: string;
};

export type HomeBanner = {
  id: number;
  eyebrow: string;
  title: string;
  description: string;
  button_text: string;
  image: MediaRefValue[];
  tone: string;
  action_type: HomeBannerAction;
  action_type__mapping: string;
  entry_id: number | null;
  entry_title: string | null;
  sort_order: number;
  is_enabled: boolean;
  starts_at: string | null;
  ends_at: string | null;
  display_status: HomeDisplayStatus;
  display_status__mapping: string;
  created_at: string;
  updated_at: string;
};

export type HomeHouse = {
  id: number;
  display_name: string;
  status: string;
  status__mapping: string;
  layout: string;
  area: string | null;
  asking_rent: string | null;
  images: MediaRefValue[];
};

export type ContentEntryHouse = {
  house: HomeHouse;
  sort_order: number;
  recommendation_reason: string;
};

export type SchedulePayload = {
  is_enabled: boolean;
  starts_at: string | null;
  ends_at: string | null;
};

export type ContentEntryPayload = SchedulePayload & {
  kind: ContentEntryKind;
  eyebrow: string;
  title: string;
  summary: string;
  cover_image: MediaRefValue[];
  body_markdown: string;
  tone: string;
  sort_order: number;
};

export type HomeBannerPayload = SchedulePayload & {
  eyebrow: string;
  title: string;
  description: string;
  button_text: string;
  image: MediaRefValue[];
  tone: string;
  action_type: HomeBannerAction;
  entry_id: number | null;
  sort_order: number;
};

export function listHomeBanners(params: { page?: number; page_size?: number; keyword?: string } = {}) {
  return request<PageResult<HomeBanner>>(`${BASE_PATH}/banners/`, { method: 'GET', params });
}

export function createHomeBanner(payload: HomeBannerPayload) {
  return request<HomeBanner>(`${BASE_PATH}/banners/`, { method: 'POST', data: payload });
}

export function updateHomeBanner(id: number, payload: Partial<HomeBannerPayload>) {
  return request<HomeBanner>(`${BASE_PATH}/banners/${id}/`, { method: 'PATCH', data: payload });
}

export function listHomeEntries(params: { page?: number; page_size?: number; kind?: ContentEntryKind; keyword?: string } = {}) {
  return request<PageResult<ContentEntry>>(`${BASE_PATH}/entries/`, { method: 'GET', params });
}

export function createContentEntry(payload: ContentEntryPayload) {
  return request<ContentEntry>(`${BASE_PATH}/entries/`, { method: 'POST', data: payload });
}

export function updateContentEntry(id: number, payload: Partial<ContentEntryPayload>) {
  return request<ContentEntry>(`${BASE_PATH}/entries/${id}/`, { method: 'PATCH', data: payload });
}

export function listHomeHouseCandidates(params: { page?: number; page_size?: number; keyword?: string } = {}) {
  return request<PageResult<HomeHouse>>(`${BASE_PATH}/house-candidates/`, { method: 'GET', params });
}

export function listContentEntryHouses(entryId: number) {
  return request<PageResult<ContentEntryHouse>>(`${BASE_PATH}/entries/${entryId}/houses/`, {
    method: 'GET',
    params: { page: 1, page_size: 500 },
  });
}

export function saveContentEntryHouses(entryId: number, items: Array<{ house_id: number; recommendation_reason: string }>) {
  return request<ContentEntryHouse[]>(`${BASE_PATH}/entries/${entryId}/houses/`, {
    method: 'PUT',
    data: { items },
  });
}
