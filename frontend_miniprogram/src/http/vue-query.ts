import type { CustomRequestOptions } from '@/http/types'
import { http } from './http'

/*
 * openapi-ts-request 工具的 request 跨客户端适配方法
 */
type OpenApiRequestOptions = Omit<CustomRequestOptions, 'url'> & {
  params?: Record<string, unknown>
  headers?: Record<string, unknown>
}

export default function request<T>(
  url: string,
  options: OpenApiRequestOptions,
) {
  const requestOptions: CustomRequestOptions & {
    params?: Record<string, unknown>
    headers?: Record<string, unknown>
  } = {
    url,
    ...options,
  }

  if (options.params) {
    requestOptions.query = requestOptions.params
    delete requestOptions.params
  }

  if (options.headers) {
    requestOptions.header = options.headers
    delete requestOptions.headers
  }

  return http<T>(requestOptions)
}
