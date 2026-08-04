/** 海图演示地理要素：岸线、区划与雷达站，全部基于辖区范围离线绘制。 */
import type { LatLng } from '@/types/maritime'

export interface MaritimeGeoFeature {
  name: string
  kind: 'coastline' | 'boundary' | 'island' | 'label'
  points?: LatLng[]
  label?: LatLng
}

export interface RadarStation {
  id: string
  name: string
  lon: number
  lat: number
  radiusKm: number
  online: boolean
  lastUpdate: string
}

export const MARITIME_GEO_FEATURES: MaritimeGeoFeature[] = [
  {
    name: '大陆岸线',
    kind: 'coastline',
    points: [
      { lon: 120.2, lat: 31.9 },
      { lon: 120.95, lat: 31.82 },
      { lon: 121.35, lat: 31.52 },
      { lon: 121.72, lat: 31.08 },
      { lon: 121.98, lat: 30.72 },
      { lon: 122.32, lat: 30.28 },
      { lon: 122.72, lat: 29.85 },
      { lon: 122.95, lat: 29.6 },
    ],
  },
  {
    name: '上海市界',
    kind: 'boundary',
    points: [
      { lon: 120.9, lat: 31.6 },
      { lon: 121.45, lat: 31.18 },
      { lon: 121.72, lat: 31.08 },
    ],
  },
  {
    name: '浙江省界',
    kind: 'boundary',
    points: [
      { lon: 121.72, lat: 31.08 },
      { lon: 121.98, lat: 30.72 },
      { lon: 122.32, lat: 30.28 },
    ],
  },
  {
    name: '长兴岛',
    kind: 'island',
    points: [
      { lon: 121.78, lat: 31.32 },
      { lon: 121.88, lat: 31.38 },
      { lon: 121.93, lat: 31.33 },
      { lon: 121.86, lat: 31.25 },
    ],
  },
  {
    name: '横沙岛',
    kind: 'island',
    points: [
      { lon: 121.98, lat: 31.22 },
      { lon: 122.08, lat: 31.3 },
      { lon: 122.15, lat: 31.22 },
      { lon: 122.05, lat: 31.14 },
    ],
  },
  {
    name: '洋山港区',
    kind: 'island',
    points: [
      { lon: 121.94, lat: 30.62 },
      { lon: 122.03, lat: 30.68 },
      { lon: 122.1, lat: 30.6 },
      { lon: 122.0, lat: 30.53 },
    ],
  },
  {
    name: '舟山群岛',
    kind: 'island',
    points: [
      { lon: 122.0, lat: 30.18 },
      { lon: 122.16, lat: 30.32 },
      { lon: 122.38, lat: 30.22 },
      { lon: 122.3, lat: 30.0 },
      { lon: 122.08, lat: 29.94 },
    ],
  },
  { name: '上海市', kind: 'label', label: { lon: 121.05, lat: 31.25 } },
  { name: '浙江省', kind: 'label', label: { lon: 120.85, lat: 30.05 } },
  { name: '东海', kind: 'label', label: { lon: 122.85, lat: 31.55 } },
  { name: '杭州湾', kind: 'label', label: { lon: 121.45, lat: 30.25 } },
  { name: '长江口', kind: 'label', label: { lon: 121.95, lat: 31.05 } },
]

const RADAR_UPDATE_TIME = new Date(Date.now() - 3 * 60000).toISOString()

export const RADAR_STATIONS: RadarStation[] = [
  {
    id: 'RADAR-LCG',
    name: '芦潮港雷达站',
    lon: 121.85,
    lat: 30.82,
    radiusKm: 160,
    online: true,
    lastUpdate: RADAR_UPDATE_TIME,
  },
  {
    id: 'RADAR-SS',
    name: '嵊泗雷达站',
    lon: 122.45,
    lat: 30.72,
    radiusKm: 150,
    online: true,
    lastUpdate: RADAR_UPDATE_TIME,
  },
  {
    id: 'RADAR-ZS',
    name: '舟山雷达站',
    lon: 122.2,
    lat: 29.95,
    radiusKm: 140,
    online: true,
    lastUpdate: RADAR_UPDATE_TIME,
  },
  {
    id: 'RADAR-YS',
    name: '洋山雷达站',
    lon: 121.95,
    lat: 30.62,
    radiusKm: 120,
    online: true,
    lastUpdate: RADAR_UPDATE_TIME,
  },
]
