import type { PickedFile } from '@/platform/contracts/file-picker'
import type { MigrationMediaReference } from '@/domain/house-media'
import { resolveApiUrl } from '@/core/config/runtime'
import { normalizeAppError } from '@/core/errors/app-error'
import { buildScopeHeaders } from '@/infra/http/request-scope'
import { getHttpSessionToken, runtimeHttpClient } from '@/infra/http/runtime'
import { parseUploadResponse, validateUploadFiles } from '@/infra/upload/upload-contract'

export interface MigrationPage<T> { items: T[], total: number, page: number, page_size: number }
export interface MigrationDecisions {
  overrides: Array<{ entity_type: string, source_id: string, fields: Record<string, unknown> }>
  mappings: Array<{ entity_type: string, source_id: string, target_id: number }>
  member_mappings: Record<string, number>
}
export interface MigrationIssue {
  entity_type: string
  source_id: string
  field: string
  code: string
  message: string
  candidates?: Array<{ id: number, label: string }>
}
export interface MigrationBatch {
  id: string
  source_team_name: string
  source_team_id: string
  status: string
  media_status: string
  created_at: string
  updated_at: string
  error_message: string
  summary: Record<string, number>
  media_summary: { total: number, pending: number, processing: number, succeeded: number, failed: number, missing: number, detached?: number }
  preview: { version: string, summary: Record<string, number>, issues: MigrationIssue[], decisions: MigrationDecisions } | null
}
export interface MigrationRecord {
  id: number
  batch_id: string
  entity_type: string
  source_id: string
  data: Record<string, unknown>
  state: string
  error_message: string
  target_type: string
  target_id: number | null
  source_deleted: boolean
  media?: Array<MigrationMediaReference & { binding_state?: string }>
}
export interface MigrationAsset {
  id: string
  status: string
  source_url: string
  url?: string | null
  media_type?: string
  resource_type: string
  error_message: string
  attempts: number
  media_file_id: number | null
  binding_state?: string
}
export interface MigrationOptions {
  organization: { id: number, name: string, slug: string }
  members: Array<{ id: number, name: string }>
  can_manage: boolean
}
export interface MigrationArchiveFilters {
  entity_type?: string
  search?: string
  batch_id?: string
  created_from?: string
  created_to?: string
  staff_id?: string
  bill_number?: string
  checked?: boolean
  approved?: boolean
  source_deleted?: boolean
}
export interface MigrationReport {
  source_team_name: string
  manifest: { schema_version?: number, snapshot_at?: string, complete?: boolean }
  status: string
  summary: Record<string, number>
  media_status: string
  media_summary: MigrationBatch['media_summary']
  issues: MigrationIssue[]
  record_errors: Array<{ entity_type: string, source_id: string, error_message: string }>
  media_errors: Array<{ id: string, status: string, error_message: string }>
}

function request<T>(organizationSlug: string, path: string, method: 'GET' | 'POST' = 'GET', body?: unknown, query?: Record<string, unknown>) {
  return runtimeHttpClient.request<T>({
    url: `/api/data-migration/${path}`,
    scope: { kind: 'organization', organizationSlug },
    method,
    body,
    query,
    authRetry: method === 'GET' ? 'safe' : 'never',
  })
}

export const getMigrationOptions = (slug: string) => request<MigrationOptions>(slug, 'options/')
export const listMigrationBatches = (slug: string, page: number, pageSize: number) => request<MigrationPage<MigrationBatch>>(slug, 'batches/', 'GET', undefined, { page, page_size: pageSize })
export const getMigrationBatch = (slug: string, id: string) => request<MigrationBatch>(slug, `batches/${encodeURIComponent(id)}/`)
export const previewMigrationBatch = (slug: string, id: string, decisions: MigrationDecisions) => request<MigrationBatch>(slug, `batches/${encodeURIComponent(id)}/preview/`, 'POST', decisions)
export const confirmMigrationBatch = (slug: string, id: string, version: string) => request<MigrationBatch>(slug, `batches/${encodeURIComponent(id)}/confirm/`, 'POST', { preview_version: version })
export const retryMigrationBatch = (slug: string, id: string) => request<MigrationBatch>(slug, `batches/${encodeURIComponent(id)}/retry/`, 'POST', {})
export const listMigrationRecords = (slug: string, id: string, page: number, pageSize: number, filters: { entity_type?: string, state?: string, search?: string } = {}) => request<MigrationPage<MigrationRecord>>(slug, `batches/${encodeURIComponent(id)}/records/`, 'GET', undefined, { page, page_size: pageSize, ...filters })
export const listMigrationAssets = (slug: string, id: string, page: number, pageSize: number, status = '') => request<MigrationPage<MigrationAsset>>(slug, `batches/${encodeURIComponent(id)}/assets/`, 'GET', undefined, { page, page_size: pageSize, status: status || undefined })
export const retryMigrationAsset = (slug: string, id: string, payload: { source_url?: string, media_id?: number } = {}) => request<MigrationAsset>(slug, `assets/${encodeURIComponent(id)}/retry/`, 'POST', payload)
export const listMigrationArchives = (slug: string, page: number, pageSize: number, filters: MigrationArchiveFilters = {}) => request<MigrationPage<MigrationRecord>>(slug, 'archives/', 'GET', undefined, { page, page_size: pageSize, ...filters })
export const getMigrationArchive = (slug: string, id: number) => request<MigrationRecord>(slug, `archives/${id}/`)
export const getMigrationReport = (slug: string, id: string) => request<MigrationReport>(slug, `batches/${encodeURIComponent(id)}/report/`)

export function uploadMigrationPackage(slug: string, file: PickedFile, onProgress: (percentage: number) => void): Promise<MigrationBatch> {
  validateUploadFiles([file], { maxCount: 1, maxSizeBytes: 100 * 1024 * 1024, extensions: ['zip'] })
  const header = buildScopeHeaders({ scope: { kind: 'organization', organizationSlug: slug }, sessionToken: getHttpSessionToken() })
  return new Promise((resolve, reject) => {
    const task = uni.uploadFile({
      url: resolveApiUrl('/api/data-migration/batches/'),
      name: 'file',
      filePath: file.path,
      file: file.file,
      header,
      timeout: 120000,
      success(response) {
        try {
          resolve(parseUploadResponse<MigrationBatch>(response.statusCode, response.data))
        }
        catch (error) { reject(error) }
      },
      fail: cause => reject(normalizeAppError({ cause })),
    })
    task.onProgressUpdate(event => onProgress(event.progress))
  })
}
