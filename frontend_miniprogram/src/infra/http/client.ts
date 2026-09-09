import type { RequestScope } from './request-scope.ts'
import { AppError, normalizeAppError } from '../../core/errors/app-error.ts'
import { buildScopeHeaders } from './request-scope.ts'

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export interface HttpRequest<TBody = unknown> {
  url: string
  method?: HttpMethod
  authRetry?: 'safe' | 'never'
  scope: RequestScope
  query?: Record<string, unknown>
  body?: TBody
  headers?: Record<string, string>
  timeoutMs?: number
}

export interface HttpRawRequest<TBody = unknown> extends HttpRequest<TBody> {
  sessionToken?: string
  acceptedStatusCodes?: number[]
  invalidateSessionOnUnauthorized?: boolean
}

export interface HttpTransportRequest<TBody = unknown> {
  url: string
  method: HttpMethod
  headers: Record<string, string>
  query?: Record<string, unknown>
  body?: TBody
  timeoutMs: number
}

export interface HttpTransportResponse {
  statusCode: number
  data: unknown
  headers?: Record<string, string>
}

export interface HttpRawResponse<TData> extends Omit<HttpTransportResponse, 'data'> {
  data: TData
}

export type HttpTransport = (request: HttpTransportRequest) => Promise<HttpTransportResponse>

export interface HttpClientOptions {
  transport: HttpTransport
  getSessionToken: () => string
  resolveUrl: (url: string) => string
  onSessionInvalidated?: () => void
  recoverSession?: () => Promise<boolean>
}

export interface HttpClient {
  request: <TResponse, TBody = unknown>(request: HttpRequest<TBody>) => Promise<TResponse>
  requestRaw: <TResponse, TBody = unknown>(request: HttpRawRequest<TBody>) => Promise<HttpRawResponse<TResponse>>
}

interface ResponseEnvelope {
  code: string | number
  data?: unknown
  message?: unknown
  msg?: unknown
  detail?: unknown
}

function getEnvelope(value: unknown): ResponseEnvelope | null {
  if (!value || typeof value !== 'object' || !('code' in value))
    return null
  const envelope = value as Partial<ResponseEnvelope>
  if (typeof envelope.code !== 'string' && typeof envelope.code !== 'number')
    return null
  return envelope as ResponseEnvelope
}

function isSuccessCode(code: string | number): boolean {
  return code === 0 || code === 200 || code === '0' || code === '200'
}

function isUnauthenticatedResponse(response: HttpTransportResponse, envelope: ResponseEnvelope | null): boolean {
  const code = envelope?.code
  return response.statusCode === 401
    || response.statusCode === 410
    || code === 401
    || code === '401'
    || code === 410
    || code === '410'
}

export function createHttpClient(options: HttpClientOptions): HttpClient {
  let recoveryTask: Promise<boolean> | null = null

  function recoverSession(): Promise<boolean> {
    if (!options.recoverSession)
      return Promise.resolve(false)
    if (recoveryTask)
      return recoveryTask
    recoveryTask = options.recoverSession().finally(() => {
      recoveryTask = null
    })
    return recoveryTask
  }

  async function execute<TBody>(input: HttpRequest<TBody>, sessionToken = options.getSessionToken()): Promise<HttpTransportResponse> {
    const headers = {
      ...buildScopeHeaders({ scope: input.scope, sessionToken }),
      ...input.headers,
    }
    const transportRequest: HttpTransportRequest<TBody> = {
      url: options.resolveUrl(input.url),
      method: input.method || 'GET',
      headers,
      timeoutMs: input.timeoutMs || 60000,
    }
    if (input.query)
      transportRequest.query = input.query
    if (input.body !== undefined)
      transportRequest.body = input.body

    try {
      return await options.transport(transportRequest)
    }
    catch (cause) {
      if (cause instanceof AppError)
        throw cause
      throw normalizeAppError({ cause })
    }
  }

  async function request<TResponse, TBody = unknown>(input: HttpRequest<TBody>): Promise<TResponse> {
    let response = await execute(input)

    let envelope = getEnvelope(response.data)
    let unauthenticated = isUnauthenticatedResponse(response, envelope)
    const recovered = unauthenticated ? await recoverSession() : false
    const method = input.method || 'GET'
    const shouldReplay = input.authRetry === 'safe' || (input.authRetry === undefined && method === 'GET')
    const replayed = recovered && shouldReplay
    if (replayed) {
      response = await execute(input)
      envelope = getEnvelope(response.data)
      unauthenticated = isUnauthenticatedResponse(response, envelope)
    }
    if (unauthenticated && (!recovered || replayed))
      options.onSessionInvalidated?.()

    if (response.statusCode < 200 || response.statusCode >= 300 || (envelope && !isSuccessCode(envelope.code))) {
      throw normalizeAppError({
        statusCode: unauthenticated ? 401 : response.statusCode,
        data: response.data,
      })
    }

    return (envelope ? envelope.data : response.data) as TResponse
  }

  async function requestRaw<TResponse, TBody = unknown>(input: HttpRawRequest<TBody>): Promise<HttpRawResponse<TResponse>> {
    const sessionToken = Object.hasOwn(input, 'sessionToken') ? input.sessionToken || '' : options.getSessionToken()
    const response = await execute(input, sessionToken)
    const acceptedStatusCodes = input.acceptedStatusCodes || []
    const accepted = acceptedStatusCodes.includes(response.statusCode) || (response.statusCode >= 200 && response.statusCode < 300)
    const unauthenticated = response.statusCode === 401 || response.statusCode === 410

    if (unauthenticated && input.invalidateSessionOnUnauthorized !== false)
      options.onSessionInvalidated?.()
    if (!accepted)
      throw normalizeAppError({ statusCode: response.statusCode, data: response.data })

    return response as HttpRawResponse<TResponse>
  }

  return { request, requestRaw }
}
