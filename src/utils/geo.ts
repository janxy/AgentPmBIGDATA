/** 地图坐标计算工具：测距与坐标转换。 */
import type { LatLng } from '@/types/maritime'

const EARTH_RADIUS_M = 6371000
const toRad = (v: number) => (v * Math.PI) / 180

/** 两点球面距离（米），用于海图测距。 */
export function distanceMeters(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat)
  const dLon = toRad(b.lon - a.lon)
  const sinLat = Math.sin(dLat / 2)
  const sinLon = Math.sin(dLon / 2)
  const h = sinLat * sinLat + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLon * sinLon
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h))
}

/** 折线总距离（米）。 */
export function polylineDistanceMeters(points: LatLng[]): number {
  let total = 0
  for (let i = 1; i < points.length; i += 1) {
    total += distanceMeters(points[i - 1], points[i])
  }
  return total
}

/** 将米转换为可读距离文案。 */
export function formatDistance(meters: number): string {
  if (meters >= 1000) return `${(meters / 1000).toFixed(2)} km`
  return `${Math.round(meters)} m`
}
