import type { HttpTransport } from './client'
import { AppError } from '@/core/errors/app-error'
import { stringifyQuery } from '@/http/tools/queryString'

function appendQuery(url: string, query?: Record<string, unknown>): string {
  if (!query)
    return url
  const queryString = stringifyQuery(query)
  if (!queryString)
    return url
  return `${url}${url.includes('?') ? '&' : '?'}${queryString}`
}

export const uniHttpTransport: HttpTransport = request => new Promise((resolve, reject) => {
  uni.request({
    url: appendQuery(request.url, request.query),
    method: request.method,
    data: request.body,
    header: request.headers,
    timeout: request.timeoutMs,
    dataType: 'json',
    // #ifndef MP-WEIXIN
    responseType: 'json',
    // #endif
    success(response) {
      resolve({
        statusCode: response.statusCode,
        data: response.data,
        headers: response.header as Record<string, string>,
      })
    },
    fail(cause) {
      const message = cause.errMsg || ''
      if (message.includes('timeout')) {
        reject(new AppError({ kind: 'timeout', message: '请求超时，请稍后重试', retryable: true, cause }))
        return
      }
      if (message.includes('abort')) {
        reject(new AppError({ kind: 'cancelled', message: '请求已取消', cause }))
        return
      }
      reject(cause)
    },
  } as UniApp.RequestOptions)
})
