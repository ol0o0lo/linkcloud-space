import type { RequestScope as LegacyRequestScope } from '@/domain/request-context'
import type { RequestScope } from '@/infra/http/request-scope'

/**
 * 在 uniapp 的 RequestOptions 和 IUniUploadFileOptions 基础上，添加自定义参数
 */
export type CustomRequestOptions = Omit<UniApp.RequestOptions, 'method'> & {
  method?: UniApp.RequestOptions['method'] | 'PATCH'
  query?: Record<string, any>
  /** 出错时是否隐藏错误提示 */
  hideErrorToast?: boolean
  /** 请求所属业务范围。活跃业务必须显式声明，不再根据当前页面猜测。 */
  requestScope?: RequestScope | LegacyRequestScope
  /** 组织请求可显式指定目标组织，供事务式组织切换预加载使用。 */
  organizationSlug?: string
  /** 房东业务显式指定关系 ID。关系发现接口应使用 personal 范围。 */
  landlordContactId?: number
  /** 认证失效时只返回错误，不自动跳转登录 */
  skipAuthRedirect?: boolean
  /** 会话恢复后是否允许重放请求；GET 默认为 safe，写请求默认为 never。 */
  authRetry?: 'safe' | 'never'
} & IUniUploadFileOptions // 添加uni.uploadFile参数类型

/** 主要提供给 openapi-ts-request 生成的代码使用 */
export type CustomRequestOptions_ = Omit<CustomRequestOptions, 'url'>

export interface HttpRequestResult<T> {
  promise: Promise<T>
  requestTask: UniApp.RequestTask
}

// 通用响应格式（兼容 msg + message 字段）
export type IResponse<T = any> = {
  code: number
  data: T
  message: string
  [key: string]: any // 允许额外属性
} | {
  code: number
  data: T
  msg: string
  [key: string]: any // 允许额外属性
}

// 分页请求参数
export interface PageParams {
  page: number
  pageSize: number
  [key: string]: any
}

// 分页响应数据
export interface PageResult<T> {
  list: T[]
  total: number
  page: number
  pageSize: number
}
