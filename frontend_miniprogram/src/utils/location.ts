import type { GeoCoordinates } from '@/domain/geo-coordinates'
import { wgs84ToGcj02 } from '@/domain/geo-coordinates'

const UNKNOWN_LOCATION_ERROR = '无法获取当前位置，请稍后重试'

export function getLocationErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : UNKNOWN_LOCATION_ERROR
}

export async function getCurrentLocationGcj02(): Promise<GeoCoordinates> {
  // #ifdef H5
  if (!window.isSecureContext)
    throw new Error('定位需要 HTTPS 或 localhost')
  if (!navigator.geolocation)
    throw new Error('当前浏览器不支持定位')

  const coordinates = await new Promise<GeoCoordinates>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      position => resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude }),
      (error) => {
        const messages: Record<number, string> = {
          1: '定位权限未开启，请检查浏览器和系统设置',
          2: '位置暂时不可用，请检查系统定位服务或网络',
          3: '定位超时，请稍后重试',
        }
        reject(new Error(messages[error.code] || UNKNOWN_LOCATION_ERROR))
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    )
  })
  return wgs84ToGcj02(coordinates)
  // #endif

  // #ifndef H5
  const location = await uni.getLocation({ type: 'gcj02', isHighAccuracy: true })
  return { latitude: location.latitude, longitude: location.longitude }
  // #endif
}
