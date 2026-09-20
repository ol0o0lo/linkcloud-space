import { httpGet } from '@/http/http'

export type NearbyPoiCategory = 'bus' | 'subway' | 'education' | 'medical'

export interface NearbyPoi {
  id: string
  name: string
  address: string
  distance: number
}

export type NearbyPois = Record<NearbyPoiCategory, NearbyPoi[]>

export function getNearbyPois(lat: number, lng: number) {
  return httpGet<NearbyPois>(
    '/api/nearby-pois/',
    { lat, lng },
    undefined,
    { requestScope: { kind: 'public' } },
  )
}
