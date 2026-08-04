/** 目标监控分类演示数据：雷达目标、光电设备与海域区域。 */
import type { EoDevice, FenceZone, RadarContact, TargetSource } from '@/types/maritime'
import { JURISDICTION_BOUNDS } from '@/types/maritime'

const RADAR_COUNT = 2
const EO_COUNT = 5
const FENCE_ZONE_COUNT = 1

const RADAR_SOURCES: TargetSource[] = ['phased', 'xband1', 'xband2']
const EO_PREFIXES = ['临港', '洋山', '长兴', '东海', '崇明', '浦江', '横沙', '绿华山', '小洋山']
const FENCE_NAMES = [
  '临港警戒区',
  '洋山锚地区',
  '长兴岛警戒区',
  '东海大桥区',
  '崇明南岸警戒区',
  '浦江口警戒区',
  '横沙岛警戒区',
  '绿华山警戒区',
]

function mulberry32(seed: number) {
  let value = seed
  return () => {
    value += 0x6d2b79f5
    let t = value
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const rng = mulberry32(20260805)

const randRange = (min: number, max: number) => min + rng() * (max - min)
const pick = <T>(items: readonly T[]): T => items[Math.floor(rng() * items.length)]
const chance = (p: number) => rng() < p
const normalizeCourse = (course: number) => ((course % 360) + 360) % 360
const minutesAgoIso = (minutes: number) => new Date(Date.now() - minutes * 60000).toISOString()
const makeId = (prefix: string, n: number) => `${prefix}-${String(n).padStart(4, '0')}`

export const RADAR_CONTACTS: RadarContact[] = Array.from({ length: RADAR_COUNT }, (_, index) => ({
  id: makeId('R', index + 1),
  name: `雷达目标${String(index + 1).padStart(3, '0')}`,
  lon: randRange(JURISDICTION_BOUNDS.minLon, JURISDICTION_BOUNDS.maxLon),
  lat: randRange(JURISDICTION_BOUNDS.minLat, JURISDICTION_BOUNDS.maxLat),
  speed: Number(randRange(2, 24).toFixed(1)),
  course: normalizeCourse(randRange(0, 360)),
  source: pick(RADAR_SOURCES),
  tracking: chance(0.82),
  lastUpdate: minutesAgoIso(Math.floor(randRange(0, 12))),
}))

export const EO_DEVICES: EoDevice[] = Array.from({ length: EO_COUNT }, (_, index) => ({
  id: makeId('EO', index + 1),
  name: `${pick(EO_PREFIXES)}光电${String(index + 1).padStart(2, '0')}`,
  lon: randRange(JURISDICTION_BOUNDS.minLon, JURISDICTION_BOUNDS.maxLon),
  lat: randRange(JURISDICTION_BOUNDS.minLat, JURISDICTION_BOUNDS.maxLat),
  azimuth: Number(randRange(0, 360).toFixed(0)),
  pitch: Number(randRange(-30, 30).toFixed(0)),
  online: chance(0.88),
  alarmCount: Math.floor(randRange(0, 5)),
  lastUpdate: minutesAgoIso(Math.floor(randRange(0, 8))),
}))

export const FENCE_ZONES: FenceZone[] = FENCE_NAMES.slice(0, FENCE_ZONE_COUNT).map((name, index) => ({
  id: makeId('F', index + 1),
  name,
  lon: randRange(JURISDICTION_BOUNDS.minLon + 0.5, JURISDICTION_BOUNDS.maxLon - 0.5),
  lat: randRange(JURISDICTION_BOUNDS.minLat + 0.5, JURISDICTION_BOUNDS.maxLat - 0.5),
  radiusKm: Number(randRange(6, 16).toFixed(1)),
  areaKm2: Number(randRange(3, 68).toFixed(1)),
  enabled: chance(0.75),
  alarmCount: Math.floor(randRange(0, 14)),
  lastUpdate: minutesAgoIso(Math.floor(randRange(0, 20))),
}))
