import type { GeoCoordinates } from '@/domain/geo-coordinates'
import { httpGet } from '@/http/http'
import { platformStorage } from '@/platform'

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

interface CachedWeather {
  weather: CurrentWeatherOut
  coordinates: GeoCoordinates | null
  expiresAt: number
}

const WEATHER_CACHE_KEY = 'current-weather-v1'
const WEATHER_CACHE_TTL = 10 * 60 * 1000

export function getCachedCurrentWeather(): CachedWeather | null {
  try {
    const raw = platformStorage.persistent.getItem(WEATHER_CACHE_KEY)
    const cache = raw ? JSON.parse(raw) as CachedWeather : null
    if (cache && cache.expiresAt > Date.now() && cache.weather?.location && cache.weather?.current
      && (cache.coordinates === null || (Number.isFinite(cache.coordinates?.latitude) && Number.isFinite(cache.coordinates?.longitude)))) {
      return cache
    }
  }
  catch {}
  return null
}

export async function getCurrentWeather(coordinates?: GeoCoordinates): Promise<CurrentWeatherOut> {
  const cache = getCachedCurrentWeather()
  if (cache && cache.coordinates?.latitude === coordinates?.latitude && cache.coordinates?.longitude === coordinates?.longitude)
    return cache.weather

  const weather = await httpGet<CurrentWeatherOut>('/api/weather/current/', coordinates
    ? { latitude: coordinates.latitude, longitude: coordinates.longitude, coordinate_system: 'gcj02' }
    : undefined, undefined, { requestScope: { kind: 'personal' } })
  try {
    platformStorage.persistent.setItem(WEATHER_CACHE_KEY, JSON.stringify({
      weather,
      coordinates: coordinates || null,
      expiresAt: Date.now() + WEATHER_CACHE_TTL,
    }))
  }
  catch {}
  return weather
}
