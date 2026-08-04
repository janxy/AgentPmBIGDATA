/** 海图绘制主题：目标状态色、来源色、标记尺寸与轨迹长度。 */
import type { FusionTarget, MarkerSize, TargetSource, TrailMode } from '@/types/maritime'

export const STATUS_COLORS: Record<FusionTarget['status'], string> = {
  online: '#35e0a8',
  offline: '#8296a8',
  abnormal: '#f5b84b',
}

export const SOURCE_COLORS: Record<TargetSource, string> = {
  phased: '#ffa94d',
  xband1: '#ffd166',
  xband2: '#f472b6',
  ais: '#38c6ff',
  framecode: '#7c9cff',
}

export const MARKER_RADIUS: Record<MarkerSize, number> = {
  small: 5,
  medium: 7,
  large: 9,
}

export const TRAIL_LENGTH: Record<TrailMode, number> = {
  off: 0,
  short: 12,
  long: 26,
}

export function markerRadius(size: MarkerSize): number {
  return MARKER_RADIUS[size]
}

export function clusterRadius(count: number): number {
  return Math.min(30, 16 + count * 1.4)
}
