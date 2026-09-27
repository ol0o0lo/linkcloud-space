export interface GeoCoordinates {
  latitude: number
  longitude: number
}

const EARTH_SEMI_MAJOR_AXIS = 6378245
const EARTH_ECCENTRICITY_SQUARED = 0.006693421622965943

function isOutsideChina({ latitude, longitude }: GeoCoordinates): boolean {
  return longitude < 72.004 || longitude > 137.8347 || latitude < 0.8293 || latitude > 55.8271
}

function latitudeOffset(longitude: number, latitude: number): number {
  let offset = -100 + 2 * longitude + 3 * latitude + 0.2 * latitude ** 2 + 0.1 * longitude * latitude + 0.2 * Math.sqrt(Math.abs(longitude))
  offset += (20 * Math.sin(6 * longitude * Math.PI) + 20 * Math.sin(2 * longitude * Math.PI)) * 2 / 3
  offset += (20 * Math.sin(latitude * Math.PI) + 40 * Math.sin(latitude / 3 * Math.PI)) * 2 / 3
  offset += (160 * Math.sin(latitude / 12 * Math.PI) + 320 * Math.sin(latitude * Math.PI / 30)) * 2 / 3
  return offset
}

function longitudeOffset(longitude: number, latitude: number): number {
  let offset = 300 + longitude + 2 * latitude + 0.1 * longitude ** 2 + 0.1 * longitude * latitude + 0.1 * Math.sqrt(Math.abs(longitude))
  offset += (20 * Math.sin(6 * longitude * Math.PI) + 20 * Math.sin(2 * longitude * Math.PI)) * 2 / 3
  offset += (20 * Math.sin(longitude * Math.PI) + 40 * Math.sin(longitude / 3 * Math.PI)) * 2 / 3
  offset += (150 * Math.sin(longitude / 12 * Math.PI) + 300 * Math.sin(longitude / 30 * Math.PI)) * 2 / 3
  return offset
}

export function wgs84ToGcj02(coordinates: GeoCoordinates): GeoCoordinates {
  if (isOutsideChina(coordinates))
    return coordinates

  const { latitude, longitude } = coordinates
  const shiftedLatitude = latitude - 35
  const shiftedLongitude = longitude - 105
  const latitudeRadians = latitude / 180 * Math.PI
  const sinLatitude = Math.sin(latitudeRadians)
  const magic = 1 - EARTH_ECCENTRICITY_SQUARED * sinLatitude ** 2
  const sqrtMagic = Math.sqrt(magic)
  const latitudeDelta = latitudeOffset(shiftedLongitude, shiftedLatitude) * 180 / ((EARTH_SEMI_MAJOR_AXIS * (1 - EARTH_ECCENTRICITY_SQUARED)) / (magic * sqrtMagic) * Math.PI)
  const longitudeDelta = longitudeOffset(shiftedLongitude, shiftedLatitude) * 180 / (EARTH_SEMI_MAJOR_AXIS / sqrtMagic * Math.cos(latitudeRadians) * Math.PI)
  return { latitude: latitude + latitudeDelta, longitude: longitude + longitudeDelta }
}
