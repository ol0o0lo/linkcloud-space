import type { GeoCoordinates } from '@/domain/geo-coordinates'
import { httpGet } from '@/http/http'

export interface CurrentWeatherOut {
  provider: 'amap' | 'qweather'
  location: {
    province: string
    city: string
    district: string
    source: 'device' | 'default'
  }
  current: {
    temperature_c: number
    condition: string
    humidity_percent: number | null
    observed_at: string
  }
  stale: boolean
}

export function getCurrentWeather(coordinates?: GeoCoordinates): Promise<CurrentWeatherOut> {
  return httpGet<CurrentWeatherOut>('/api/weather/current/', coordinates
    ? { latitude: coordinates.latitude, longitude: coordinates.longitude, coordinate_system: 'gcj02' }
    : undefined, undefined, { requestScope: { kind: 'personal' } })
}
