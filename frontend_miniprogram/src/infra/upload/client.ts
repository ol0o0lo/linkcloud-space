import type { PickedFile } from '@/platform/contracts/file-picker'
import type { MediaFileOut } from '@/services/openapi/types'
import type { RequestScope } from '@/infra/http/request-scope'
import { resolveApiUrl } from '@/core/config/runtime'
import { AppError, normalizeAppError } from '@/core/errors/app-error'
import { getHttpSessionToken } from '@/infra/http/runtime'
import { buildScopeHeaders } from '@/infra/http/request-scope'
import { platform } from '@/platform'
import { parseUploadResponse, validateUploadFiles } from './upload-contract'

export interface UploadMediaOptions {
  kind?: 'image' | 'file'
  scope: RequestScope
  resourceType: string
  mediaScope: 'user' | 'org'
  maxCount?: number
  maxSizeBytes?: number
  extensions?: string[]
  onProgress?: (progress: number, fileIndex: number) => void
}

function uploadSingle(file: PickedFile, options: UploadMediaOptions, fileIndex: number): Promise<MediaFileOut[]> {
  return new Promise((resolve, reject) => {
    const task = uni.uploadFile({
      url: resolveApiUrl('/api/media/upload/'),
      filePath: file.path,
      file: file.file,
      name: 'files',
      formData: {
        resource_type: options.resourceType,
        scope: options.mediaScope,
      },
      header: buildScopeHeaders({ scope: options.scope, sessionToken: getHttpSessionToken() }),
      success(response) {
        try {
          resolve(parseUploadResponse<MediaFileOut[]>(response.statusCode, response.data))
        }
        catch (error) {
          reject(error)
        }
      },
      fail(cause) {
        reject(normalizeAppError({ cause }))
      },
    })
    task.onProgressUpdate((event) => {
      options.onProgress?.(event.progress, fileIndex)
    })
  })
}

export async function chooseAndUploadMedia(options: UploadMediaOptions): Promise<MediaFileOut[]> {
  const maxCount = options.maxCount || 1
  const selection = await platform.filePicker.pick({ kind: options.kind || 'image', count: maxCount, extensions: options.extensions })
  if ('reason' in selection)
    throw new AppError({ kind: 'business', message: selection.reason })
  if (!selection.value.length)
    return []
  const files = validateUploadFiles(selection.value, {
    maxCount,
    maxSizeBytes: options.maxSizeBytes || 10 * 1024 * 1024,
    extensions: options.extensions || ['jpg', 'jpeg', 'png', 'webp'],
  })
  const results: MediaFileOut[] = []
  for (let index = 0; index < files.length; index += 1)
    results.push(...await uploadSingle(selection.value[index], options, index))
  return results
}
