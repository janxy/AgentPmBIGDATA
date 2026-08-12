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
      { lon: 117.95, lat: 24.48 },
      { lon: 118.03, lat: 24.45 },
      { lon: 118.07, lat: 24.42 },
      { lon: 118.09, lat: 24.37 },
      { lon: 118.06, lat: 24.31 },
      { lon: 118.01, lat: 24.25 },
      { lon: 117.95, lat: 24.2 },
    ],
  },
  {
    name: '厦门市界',
    kind: 'boundary',
    points: [
      { lon: 118.02, lat: 24.53 },
      { lon: 118.2, lat: 24.52 },
      { lon: 118.26, lat: 24.44 },
      { lon: 118.2, lat: 24.3 },
    ],
  },
  {
    name: '漳州市界',
    kind: 'boundary',
    points: [
      { lon: 118.02, lat: 24.45 },
      { lon: 118.06, lat: 24.37 },
      { lon: 118.0, lat: 24.25 },
    ],
  },
  {
    name: '厦门岛',
    kind: 'island',
    points: [
      { lon: 118.1, lat: 24.53 },
      { lon: 118.18, lat: 24.52 },
      { lon: 118.21, lat: 24.47 },
      { lon: 118.16, lat: 24.43 },
      { lon: 118.1, lat: 24.45 },
    ],
  },
  {
    name: '鼓浪屿',
    kind: 'island',
    points: [
      { lon: 118.06, lat: 24.45 },
      { lon: 118.08, lat: 24.45 },
      { lon: 118.08, lat: 24.44 },
      { lon: 118.06, lat: 24.44 },
    ],
  },
  {
    name: '金门岛',
    kind: 'island',
    points: [
      { lon: 118.23, lat: 24.5 },
      { lon: 118.31, lat: 24.5 },
      { lon: 118.34, lat: 24.45 },
      { lon: 118.3, lat: 24.4 },
      { lon: 118.23, lat: 24.42 },
    ],
  },
  {
    name: '大嶝岛',
    kind: 'island',
    points: [
      { lon: 118.3, lat: 24.55 },
      { lon: 118.34, lat: 24.55 },
      { lon: 118.35, lat: 24.52 },
      { lon: 118.3, lat: 24.52 },
    ],
  },
  { name: '厦门市', kind: 'label', label: { lon: 118.13, lat: 24.48 } },
  { name: '漳州市', kind: 'label', label: { lon: 118.0, lat: 24.32 } },
  { name: '金门县', kind: 'label', label: { lon: 118.28, lat: 24.44 } },
  { name: '厦门湾', kind: 'label', label: { lon: 118.19, lat: 24.36 } },
  { name: '九龙江口', kind: 'label', label: { lon: 117.98, lat: 24.38 } },
]

const RADAR_UPDATE_TIME = new Date(Date.now() - 3 * 60000).toISOString()

export const RADAR_STATIONS: RadarStation[] = [
  {
    id: 'RADAR-LCG',
    name: '厦门港雷达站',
    lon: 118.07,
    lat: 24.48,
    radiusKm: 90,
    online: true,
    lastUpdate: RADAR_UPDATE_TIME,
  },
  {
    id: 'RADAR-SS',
    name: '五通雷达站',
    lon: 118.18,
    lat: 24.5,
    radiusKm: 70,
    online: true,
    lastUpdate: RADAR_UPDATE_TIME,
  },
  {
    id: 'RADAR-ZS',
    name: '浯屿雷达站',
    lon: 118.05,
    lat: 24.33,
    radiusKm: 60,
    online: true,
    lastUpdate: RADAR_UPDATE_TIME,
  },
  {
    id: 'RADAR-YS',
    name: '大嶝雷达站',
    lon: 118.31,
    lat: 24.53,
    radiusKm: 70,
    online: true,
    lastUpdate: RADAR_UPDATE_TIME,
  },
]
