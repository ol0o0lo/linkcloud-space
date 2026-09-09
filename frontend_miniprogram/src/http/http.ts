import type { CustomRequestOptions } from '@/http/types'
import type { HttpMethod } from '@/infra/http/client'
import type { RequestScope } from '@/infra/http/request-scope'
import { AppError } from '@/core/errors/app-error'
import { runtimeHttpClient } from '@/infra/http/runtime'

function resolveRequestScope(options: CustomRequestOptions): RequestScope {
  if (typeof options.requestScope === 'object')
    return options.requestScope
  if (options.requestScope === 'public')
    return { kind: 'public' }
  if (options.requestScope === 'personal')
    return { kind: 'personal' }
  if (options.requestScope === 'landlord' && options.landlordContactId)
    return { kind: 'landlord', landlordContactId: options.landlordContactId }
  if (options.requestScope === 'organization' && options.organizationSlug)
    return { kind: 'organization', organizationSlug: options.organizationSlug }
  throw new AppError({ kind: 'unexpected', message: '当前身份信息不完整，请重新进入后再试' })
}

export function http<T>(options: CustomRequestOptions): Promise<T> {
  const headers = Object.fromEntries(
    Object.entries(options.header || {}).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
  )
  return runtimeHttpClient.request<T>({
    url: options.url,
    method: (options.method || 'GET') as HttpMethod,
    authRetry: options.authRetry,
    scope: resolveRequestScope(options),
    query: options.query,
    body: options.data,
    headers,
    timeoutMs: options.timeout,
  })
}

/**
 * GET 请求
 * @param url 后台地址
 * @param query 请求query参数
 * @param header 请求头，默认为json格式
 * @returns
 */
export function httpGet<T>(url: string, query?: Record<string, any>, header?: Record<string, any>, options?: Partial<CustomRequestOptions>) {
  return http<T>({
    url,
    query,
    method: 'GET',
    header,
    ...options,
  })
}

/**
 * POST 请求
 * @param url 后台地址
 * @param data 请求body参数
 * @param query 请求query参数，post请求也支持query，很多微信接口都需要
 * @param header 请求头，默认为json格式
 * @returns
 */
export function httpPost<T>(url: string, data?: Record<string, any>, query?: Record<string, any>, header?: Record<string, any>, options?: Partial<CustomRequestOptions>) {
  return http<T>({
    url,
    query,
    data,
    method: 'POST',
    header,
    ...options,
  })
}
/**
 * PUT 请求
 */
export function httpPut<T>(url: string, data?: Record<string, any>, query?: Record<string, any>, header?: Record<string, any>, options?: Partial<CustomRequestOptions>) {
  return http<T>({
    url,
    data,
    query,
    method: 'PUT',
    header,
    ...options,
  })
}

/**
 * PATCH 请求
 */
export function httpPatch<T>(url: string, data?: Record<string, any>, query?: Record<string, any>, header?: Record<string, any>, options?: Partial<CustomRequestOptions>) {
  return http<T>({
    url,
    data,
    query,
    method: 'PATCH',
    header,
    ...options,
  })
}

/**
 * DELETE 请求（无请求体，仅 query）
 */
export function httpDelete<T>(url: string, query?: Record<string, any>, header?: Record<string, any>, options?: Partial<CustomRequestOptions>) {
  return http<T>({
    url,
    query,
    method: 'DELETE',
    header,
    ...options,
  })
}

// 支持与 axios 类似的API调用
http.get = httpGet
http.post = httpPost
http.put = httpPut
http.patch = httpPatch
http.delete = httpDelete

// 支持与 alovaJS 类似的API调用
http.Get = httpGet
http.Post = httpPost
http.Put = httpPut
http.Patch = httpPatch
http.Delete = httpDelete
