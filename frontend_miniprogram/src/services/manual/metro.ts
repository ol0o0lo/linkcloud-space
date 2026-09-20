import type { PublicMetroCityDetail, PublicMetroCitySummary } from '@/domain/public-house-metro'
import { httpGet } from '@/http/http'

const publicRequestOptions = { requestScope: { kind: 'public' as const } }

export function requestPublicMetroCities() {
  return httpGet<PublicMetroCitySummary[]>('/api/public/metro/cities/', undefined, undefined, publicRequestOptions)
}

export function requestPublicMetroCity(city: string) {
  return httpGet<PublicMetroCityDetail>(`/api/public/metro/cities/${encodeURIComponent(city)}/`, undefined, undefined, publicRequestOptions)
}
