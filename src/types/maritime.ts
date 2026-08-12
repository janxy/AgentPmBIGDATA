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
  alarmLevel: AlarmLevel
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

/** 执法船可用状态 */
export type EnforcementVesselStatus = 'idle' | 'dispatched' | 'offline'
/** 派单执行状态 */
export type DispatchStatus = 'waiting' | 'sailing' | 'arrived' | 'handling' | 'finished'
/** 派单结束结果 */
export type DispatchOutcome = 'done' | 'timeout' | 'transfer'
/** 处置时间线事件类型 */
export type DispatchTimelineType = 'dispatch' | 'sail' | 'arrive' | 'handle' | 'urge' | 'finish' | 'transfer'

/** 可调用的执法船资源 */
export interface EnforcementVessel {
  id: string
  name: string
  model: string
  status: EnforcementVesselStatus
  lon: number
  lat: number
  speed: number
  lastUpdate: string
}

/** 处置时间线节点 */
export interface DispatchTimelineEvent {
  id: string
  type: DispatchTimelineType
  time: string
  title: string
  description: string
}

/** 智能执法派单 */
export interface DispatchOrder {
  id: string
  code: string
  alarmId: string
  alarmType: AlarmType
  alarmLevel: AlarmLevel
  alarmTime: string
  alarmDescription: string
  targetId: string
  targetName: string
  targetMmsi: string
  lon: number
  lat: number
  vesselId: string
  vesselName: string
  dispatchTime: string
  status: DispatchStatus
  etaMinutes: number
  distanceKm: number
  outcome: DispatchOutcome | null
  endTime: string | null
  durationMinutes: number | null
  note: string
  timeline: DispatchTimelineEvent[]
}

/** 智能执法概览统计 */
export interface DispatchOverview {
  currentWaiting: number
  currentActive: number
  currentToday: number
  currentFinishedToday: number
  historyTodayFinished: number
  onTimeRate: number
  avgResponseMinutes: number
  availableVessels: number
}

/** 智能派单推荐结果 */
export interface LawDispatchRecommend {
  alarm: AlarmEvent
  vessel: EnforcementVessel
  distanceKm: number
  etaMinutes: number
  reason: string
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

export const ENFORCEMENT_VESSEL_STATUS_LABELS: Record<EnforcementVesselStatus, string> = {
  idle: '空闲',
  dispatched: '执行中',
  offline: '维护中',
}

export const DISPATCH_STATUS_LABELS: Record<DispatchStatus, string> = {
  waiting: '待出航',
  sailing: '出航中',
  arrived: '已抵达',
  handling: '处置中',
  finished: '已结束',
}

export const DISPATCH_OUTCOME_LABELS: Record<DispatchOutcome, string> = {
  done: '处置完成',
  timeout: '超时未处置',
  transfer: '已转办',
}

export const TARGET_SOURCE_OPTIONS = Object.keys(TARGET_SOURCE_LABELS) as TargetSource[]
export const TARGET_STATUS_OPTIONS = Object.keys(TARGET_STATUS_LABELS) as TargetStatus[]
export const TARGET_TYPE_OPTIONS = Object.keys(TARGET_TYPE_LABELS) as TargetType[]
export const RADAR_SOURCE_OPTIONS: TargetSource[] = ['phased', 'xband1', 'xband2']
export const ALARM_LEVEL_OPTIONS = Object.keys(ALARM_LEVEL_LABELS) as AlarmLevel[]
export const ALARM_TYPE_OPTIONS = Object.keys(ALARM_TYPE_LABELS) as AlarmType[]
export const DISPOSE_STATUS_OPTIONS = Object.keys(DISPOSE_STATUS_LABELS) as DisposeStatus[]
export const ENFORCEMENT_VESSEL_STATUS_OPTIONS = Object.keys(ENFORCEMENT_VESSEL_STATUS_LABELS) as EnforcementVesselStatus[]
export const DISPATCH_STATUS_OPTIONS = Object.keys(DISPATCH_STATUS_LABELS) as DispatchStatus[]
export const DISPATCH_OUTCOME_OPTIONS = Object.keys(DISPATCH_OUTCOME_LABELS) as DispatchOutcome[]

export const DEFAULT_MAP_CENTER: LatLng = { lon: 118.17, lat: 24.36 }
export const DEFAULT_MAP_ZOOM = 1

export const JURISDICTION_BOUNDS = {
  minLon: 117.95,
  maxLon: 118.35,
  minLat: 24.2,
  maxLat: 24.5,
} as const
