import { request } from '@umijs/max';
import type { MigrationMediaRef } from './house';

export type MigrationPage<T> = { items: T[]; total: number; page: number; page_size: number };
export type MigrationDecisions = {
  overrides: { entity_type: string; source_id: string; fields: Record<string, unknown> }[];
  mappings: { entity_type: string; source_id: string; target_id: number }[];
  member_mappings: Record<string, number>;
};
export type MigrationIssue = {
  entity_type: string;
  source_id: string;
  field: string;
  code: string;
  message: string;
  candidates?: { id: number; label: string }[];
};
export type MigrationBatch = {
  id: string;
  source_team_name: string;
  source_team_id: string;
  status: string;
  media_status: string;
  created_at: string;
  updated_at: string;
  error_message: string;
  summary: Record<string, number>;
  media_summary: { total: number; pending: number; processing: number; succeeded: number; failed: number; missing: number; detached?: number };
  preview?: { version: string; summary: Record<string, number>; issues: MigrationIssue[]; decisions: MigrationDecisions } | null;
};
export type MigrationRecord = {
  id: number;
  batch_id: string;
  entity_type: string;
  source_id: string;
  data: Record<string, unknown>;
  state: string;
  error_message: string;
  target_type: string;
  target_id: number | null;
  source_deleted: boolean;
  media?: (MigrationMediaRef & { binding_state: string })[];
};
export type MigrationAsset = {
  id: string;
  status: string;
  source_url: string;
  resource_type: string;
  error_message: string;
  attempts: number;
  media_file_id: number | null;
  binding_state?: string;
  url?: string | null;
};
export type MigrationOptions = {
  organization: { id: number; name: string; slug: string };
  members: { id: number; name: string }[];
  can_manage: boolean;
};
export type MigrationFilters = { page: number; page_size: number; entity_type?: string; state?: string; search?: string; batch_id?: string; status?: string; created_from?: string; created_to?: string; staff_id?: string; checked?: boolean; approved?: boolean; source_deleted?: boolean; bill_number?: string };

const base = '/api/data-migration';
// 显式绑定发起操作时的组织，避免切换空间后异步请求写入另一组织。
function options(slug: string, signal?: AbortSignal) {
  return { headers: { 'X-Org-Slug': slug }, signal };
}

export const dataMigrationApi = {
  options: (slug: string, signal?: AbortSignal) => request<MigrationOptions>(`${base}/options/`, { ...options(slug, signal), method: 'GET' }),
  batches: (slug: string, params: MigrationFilters, signal?: AbortSignal) => request<MigrationPage<MigrationBatch>>(`${base}/batches/`, { ...options(slug, signal), method: 'GET', params }),
  upload: (slug: string, file: File, signal?: AbortSignal) => {
    const data = new FormData();
    data.append('file', file);
    return request<MigrationBatch>(`${base}/batches/`, { ...options(slug, signal), method: 'POST', data });
  },
  batch: (slug: string, id: string, signal?: AbortSignal) => request<MigrationBatch>(`${base}/batches/${encodeURIComponent(id)}/`, { ...options(slug, signal), method: 'GET' }),
  preview: (slug: string, id: string, data: MigrationDecisions, signal?: AbortSignal) => request<MigrationBatch>(`${base}/batches/${encodeURIComponent(id)}/preview/`, { ...options(slug, signal), method: 'POST', data }),
  confirm: (slug: string, id: string, version: string, signal?: AbortSignal) => request<MigrationBatch>(`${base}/batches/${encodeURIComponent(id)}/confirm/`, { ...options(slug, signal), method: 'POST', data: { preview_version: version } }),
  retry: (slug: string, id: string, signal?: AbortSignal) => request<MigrationBatch>(`${base}/batches/${encodeURIComponent(id)}/retry/`, { ...options(slug, signal), method: 'POST' }),
  records: (slug: string, id: string, params: MigrationFilters, signal?: AbortSignal) => request<MigrationPage<MigrationRecord>>(`${base}/batches/${encodeURIComponent(id)}/records/`, { ...options(slug, signal), method: 'GET', params }),
  assets: (slug: string, id: string, params: MigrationFilters, signal?: AbortSignal) => request<MigrationPage<MigrationAsset>>(`${base}/batches/${encodeURIComponent(id)}/assets/`, { ...options(slug, signal), method: 'GET', params }),
  retryAsset: (slug: string, id: string, data: { source_url?: string; media_id?: number } = {}, signal?: AbortSignal) => request<MigrationAsset>(`${base}/assets/${encodeURIComponent(id)}/retry/`, { ...options(slug, signal), method: 'POST', data }),
  archives: (slug: string, params: MigrationFilters, signal?: AbortSignal) => request<MigrationPage<MigrationRecord>>(`${base}/archives/`, { ...options(slug, signal), method: 'GET', params }),
  archive: (slug: string, id: number, signal?: AbortSignal) => request<MigrationRecord>(`${base}/archives/${id}/`, { ...options(slug, signal), method: 'GET' }),
  report: (slug: string, id: string, signal?: AbortSignal) => request<Record<string, unknown>>(`${base}/batches/${encodeURIComponent(id)}/report/`, { ...options(slug, signal), method: 'GET' }),
};
