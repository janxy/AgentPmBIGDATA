/** 海上全域感知大屏统一数据类型与枚举。 */

export type TargetSource = 'phased' | 'xband1' | 'xband2' | 'ais' | 'framecode'
export type DataQuality = 'high' | 'medium' | 'low'
export type TargetStatus = 'online' | 'offline' | 'abnormal'
export type TargetType = 'normal' | 'sanwu'
export type MonitorCategory = 'vessel' | 'radar' | 'eo' | 'fence'
export type AlarmLevel = 'urgent' | 'important' | 'normal'
export type AlarmType = 'boundary' | 'overspeed' | 'lost' | 'collision' | 'zone'
export type DisposeStatus = 'pending' | 'processing' | 'done' | 'reviewed'
export type MapMode = 'view' | 'pick' | 'measure'
export type MarkerSize = 'small' | 'medium' | 'large'
export type TrailMode = 'off' | 'short' | 'long'

export interface LatLng {
  lon: number
  lat: number
}

/** 多源上报融合后的统一目标 */
export interface FusionTarget {
  id: string
  name: string
  mmsi: string
  callSign: string
  type: TargetType
  nationality: string
  length: number
  width: number
  draft: number
  lon: number
  lat: number
  speed: number
  course: number
  status: TargetStatus
  sources: TargetSource[]
  lastUpdate: string
  lastPositionTime: string
}

/** 雷达监视目标：相控阵/X 波段雷达发现的海上移动目标。 */
export interface RadarContact {
  id: string
  name: string
  lon: number
  lat: number
  speed: number
  course: number
  source: TargetSource
  tracking: boolean
  lastUpdate: string
}

/** 光电监视设备：岸基/船载摄像头及可见光-红外一体机。 */
export interface EoDevice {
  id: string
  name: string
  lon: number
  lat: number
  azimuth: number
  pitch: number
  online: boolean
  alarmCount: number
  lastUpdate: string
}

/** 海域警戒区域及越界告警统计。 */
export interface FenceZone {
  id: string
  name: string
  lon: number
  lat: number
  radiusKm: number
  areaKm2: number
  enabled: boolean
  alarmCount: number
  lastUpdate: string
}

/** 单个来源对目标的一次上报 */
export interface SourceReport {
  id: string
  targetId: string
  source: TargetSource
  reportTime: string
  quality: DataQuality
  lon: number
  lat: number
  speed: number
  course: number
}

/** 目标按时间顺序的航迹点 */
export interface TrackPoint {
  id: string
  targetId: string
  time: string
  lon: number
  lat: number
  speed: number
  course: number
}

/** 单个目标最近轨迹线段，供海图轨迹图层批量渲染。 */
export interface TargetTrackLine {
  targetId: string
  points: TrackPoint[]
}

/** 告警事件 */
export interface AlarmEvent {
  id: string
  type: AlarmType
  level: AlarmLevel
  targetId: string
  targetName: string
  targetMmsi: string
  lon: number
  lat: number
  occurredAt: string
  status: DisposeStatus
  description: string
}

/** 目标规模统计 */
export interface MaritimeStats {
  total: number
  phased: number
  xband1: number
  xband2: number
  ais: number
  framecode: number
  offline: number
  abnormal: number
  alarmPending: number
}

/** 目标筛选条件 */
export interface TargetFilter {
  sources: TargetSource[]
  statuses: TargetStatus[]
  types: TargetType[]
  keyword: string
}

/** 告警筛选条件 */
export interface AlarmFilter {
  levels: AlarmLevel[]
}

export interface PageResult<T> {
  page: number
  pageSize: number
  total: number
  items: T[]
}

/** 演示数据层运行状态 */
export interface MaritimeStatus {
  running: boolean
  paused: boolean
  simError: boolean
  lastError: string
  updatedAt: string
  targetCount: number
  sourceCount: number
  trackCount: number
  alarmCount: number
}

export interface MapViewState {
  center: LatLng
  zoom: number
  mode: MapMode
}

export interface LayerState {
  vessels: boolean
  districts: boolean
  radar: boolean
  eo: boolean
  zones: boolean
}

export interface TargetStyleState {
  markerSize: MarkerSize
}

export const TARGET_SOURCE_LABELS: Record<TargetSource, string> = {
  phased: '相控阵',
  xband1: 'X波段1',
  xband2: 'X波段2',
  ais: 'AIS',
  framecode: '帧码',
}

export const TARGET_STATUS_LABELS: Record<TargetStatus, string> = {
  online: '在线',
  offline: '离线',
  abnormal: '异常',
}

export const TARGET_TYPE_LABELS: Record<TargetType, string> = {
  normal: '正常船舶',
  sanwu: '三无船舶',
}

export const MONITOR_CATEGORY_LABELS: Record<MonitorCategory, string> = {
  vessel: '船只',
  radar: '雷达',
  eo: '光电',
  fence: '区域',
}

export const DATA_QUALITY_LABELS: Record<DataQuality, string> = {
  high: '高',
  medium: '中',
  low: '低',
}

export const ALARM_LEVEL_LABELS: Record<AlarmLevel, string> = {
  urgent: '紧急',
  important: '重要',
  normal: '一般',
}

export const ALARM_TYPE_LABELS: Record<AlarmType, string> = {
  boundary: '越界',
  overspeed: '超速',
  lost: '失联',
  collision: '碰撞风险',
  zone: '区域告警',
}

export const DISPOSE_STATUS_LABELS: Record<DisposeStatus, string> = {
  pending: '待处置',
  processing: '处置中',
  done: '已处置',
  reviewed: '已复核',
}

export const TARGET_SOURCE_OPTIONS = Object.keys(TARGET_SOURCE_LABELS) as TargetSource[]
export const TARGET_STATUS_OPTIONS = Object.keys(TARGET_STATUS_LABELS) as TargetStatus[]
export const TARGET_TYPE_OPTIONS = Object.keys(TARGET_TYPE_LABELS) as TargetType[]
export const RADAR_SOURCE_OPTIONS: TargetSource[] = ['phased', 'xband1', 'xband2']
export const ALARM_LEVEL_OPTIONS = Object.keys(ALARM_LEVEL_LABELS) as AlarmLevel[]
export const DISPOSE_STATUS_OPTIONS = Object.keys(DISPOSE_STATUS_LABELS) as DisposeStatus[]

export const DEFAULT_MAP_CENTER: LatLng = { lon: 121.8, lat: 31 }
export const DEFAULT_MAP_ZOOM = 1

export const JURISDICTION_BOUNDS = {
  minLon: 120.2,
  maxLon: 123.4,
  minLat: 29.6,
  maxLat: 32.6,
} as const
