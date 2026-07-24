import { httpPost } from '@/http/http'

export type AnalyticsEventName
  = | 'house.exposure'
    | 'house.view'
    | 'house.phone_click'
    | 'house.online_consult_click'
    | 'house.share'
    | 'house.qrcode_view'

export interface AnalyticsEventInput {
  event_name: AnalyticsEventName | string
  target_type: string
  target_id: string | number
  source?: string
  properties?: Record<string, unknown>
  idempotency_key?: string
}

type AnalyticsQueuedEvent = AnalyticsEventInput & {
  anonymous_id: string
  session_id: string
  occurred_at: string
}

interface AnalyticsCollectResult {
  accepted: number
  duplicates: number
  event_ids: number[]
  errors: { index: number, event_name: string, message: string }[]
}

const ANALYTICS_ANONYMOUS_ID_KEY = 'analytics.anonymous_id'
const MAX_QUEUE_SIZE = 100
const BATCH_SIZE = 20
const FLUSH_DELAY = 2000
const queue: AnalyticsQueuedEvent[] = []
const sessionId = createId()
let flushTimer: ReturnType<typeof setTimeout> | undefined
let flushing: Promise<AnalyticsCollectResult | undefined> | undefined

function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`
}

function anonymousId() {
  const saved = uni.getStorageSync(ANALYTICS_ANONYMOUS_ID_KEY)
  if (saved)
    return String(saved)
  const value = createId()
  uni.setStorageSync(ANALYTICS_ANONYMOUS_ID_KEY, value)
  return value
}

function defaultSource() {
  let source = 'h5'
  // #ifdef MP-WEIXIN
  source = 'miniprogram'
  // #endif
  return source
}

function scheduleFlush() {
  if (flushTimer)
    clearTimeout(flushTimer)
  flushTimer = setTimeout(() => {
    void flushAnalyticsEvents()
  }, FLUSH_DELAY)
}

export function trackAnalyticsEvent(input: AnalyticsEventInput) {
  queue.push({
    anonymous_id: anonymousId(),
    session_id: sessionId,
    occurred_at: new Date().toISOString(),
    source: defaultSource(),
    ...input,
  })
  if (queue.length > MAX_QUEUE_SIZE)
    queue.splice(0, queue.length - MAX_QUEUE_SIZE)
  if (queue.length >= BATCH_SIZE)
    void flushAnalyticsEvents()
  else
    scheduleFlush()
}

export function trackPublicHouseEvent(
  eventName: AnalyticsEventName,
  houseId: string | number,
  properties: Record<string, unknown> = {},
) {
  trackAnalyticsEvent({
    event_name: eventName,
    target_type: 'house',
    target_id: houseId,
    properties,
  })
}

export function flushAnalyticsEvents() {
  if (flushing)
    return flushing
  if (flushTimer) {
    clearTimeout(flushTimer)
    flushTimer = undefined
  }
  const events = queue.splice(0, BATCH_SIZE)
  if (!events.length)
    return Promise.resolve(undefined)

  flushing = httpPost<AnalyticsCollectResult>(
    '/api/analytics/events/',
    { events },
    undefined,
    undefined,
    { hideErrorToast: true },
  )
    .catch(() => {
      queue.unshift(...events)
      if (queue.length > MAX_QUEUE_SIZE)
        queue.splice(MAX_QUEUE_SIZE)
      return undefined
    })
    .finally(() => {
      flushing = undefined
      if (queue.length)
        scheduleFlush()
    })
  return flushing
}
