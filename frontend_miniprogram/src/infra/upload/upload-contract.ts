import { AppError, normalizeAppError } from '../../core/errors/app-error.ts'

export interface UploadCandidate {
  path: string
  name: string
  size: number
}

export interface UploadValidationOptions {
  maxCount: number
  maxSizeBytes: number
  extensions: string[]
}

export function validateUploadFiles(files: UploadCandidate[], options: UploadValidationOptions): UploadCandidate[] {
  if (!files.length)
    throw new AppError({ kind: 'validation', message: '请选择要上传的文件' })
  if (files.length > options.maxCount)
    throw new AppError({ kind: 'validation', message: `最多上传 ${options.maxCount} 个文件` })

  const allowedExtensions = new Set(options.extensions.map(item => item.toLowerCase().replace(/^\./, '')))
  for (const file of files) {
    if (file.size > options.maxSizeBytes)
      throw new AppError({ kind: 'validation', message: `文件 ${file.name} 超过大小限制` })
    const extension = file.name.split('.').pop()?.toLowerCase() || ''
    if (allowedExtensions.size && !allowedExtensions.has(extension))
      throw new AppError({ kind: 'validation', message: `文件 ${file.name} 的类型不支持` })
  }
  return files
}

export function parseUploadResponse<T>(statusCode: number, rawData: string | unknown): T {
  let data = rawData
  if (typeof rawData === 'string') {
    try {
      data = JSON.parse(rawData)
    }
    catch (cause) {
      throw new AppError({ kind: 'unexpected', message: '上传响应解析失败', cause })
    }
  }

  const record = data && typeof data === 'object' ? data as Record<string, unknown> : null
  const code = record?.code
  const success = statusCode >= 200 && statusCode < 300 && (code === undefined || code === 0 || code === 200 || code === '0' || code === '200')
  if (!success)
    throw normalizeAppError({ statusCode, data })
  return (record && 'data' in record ? record.data : data) as T
}
