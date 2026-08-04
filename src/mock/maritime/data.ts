/** 演示数据查询与处置状态流转，统一通过只读快照访问内存状态。 */
import type {
  AlarmEvent,
  AlarmLevel,
  DisposeStatus,
  FusionTarget,
  PageResult,
  SourceReport,
  TargetSource,
  TargetTrackLine,
  TargetStatus,
  TargetType,
  TrackPoint,
} from '@/types/maritime'
import {
  buildStats,
  getAlarms,
  getMaritimeStatus,
  getSourceReports,
  getTargets,
  getTrackPoints,
  refreshData,
  setPaused,
  setSimError,
} from './state'

export interface TargetQueryParams {
  page?: number
  pageSize?: number
  sources?: TargetSource[]
  statuses?: TargetStatus[]
  types?: TargetType[]
  keyword?: string
}

export interface AlarmQueryParams {
  page?: number
  pageSize?: number
  levels?: AlarmLevel[]
}

export class MockError extends Error {
  code: number

  constructor(message: string, code = 1) {
    super(message)
    this.name = 'MockError'
    this.code = code
  }
}

/** 告警处置状态白名单，用于接口入参校验与状态展示。 */
export const DISPOSE_STATUS_OPTIONS: readonly DisposeStatus[] = ['pending', 'processing', 'done', 'reviewed']

function matchesTarget(target: FusionTarget, query: TargetQueryParams): boolean {
  const keyword = (query.keyword || '').trim().toLowerCase()
  if (keyword && ![target.name, target.mmsi, target.id].some((v) => v.toLowerCase().includes(keyword))) return false
  if (query.sources?.length && !query.sources.some((s) => target.sources.includes(s))) return false
  if (query.statuses?.length && !query.statuses.includes(target.status)) return false
  if (query.types?.length && !query.types.includes(target.type)) return false
  return true
}

function pageResult<T>(items: T[], page: number, pageSize: number): PageResult<T> {
  const start = (page - 1) * pageSize
  return {
    page,
    pageSize,
    total: items.length,
    items: items.slice(start, start + pageSize),
  }
}

/** 分页查询融合目标，支持来源、状态、类型与关键词组合筛选。 */
function queryTargets(query: TargetQueryParams = {}): PageResult<FusionTarget> {
  const page = query.page || 1
  const pageSize = query.pageSize || 10
  const matched = getTargets()
    .filter((t) => matchesTarget(t, query))
    .sort((a, b) => b.lastUpdate.localeCompare(a.lastUpdate))
  return pageResult(matched, page, pageSize)
}

/** 查询单个融合目标详情。 */
function queryTargetDetail(id: string): FusionTarget {
  const target = getTargets().find((t) => t.id === id)
  if (!target) throw new MockError('目标不存在', 404)
  return target
}

/** 查询目标最近各来源上报记录。 */
function queryTargetSources(id: string): SourceReport[] {
  return getSourceReports()
    .filter((s) => s.targetId === id)
    .sort((a, b) => b.reportTime.localeCompare(a.reportTime))
}

/** 查询目标最近轨迹点，按时间正序返回。 */
function queryTargetTrack(id: string, limit = 60): TrackPoint[] {
  return getTrackPoints()
    .filter((p) => p.targetId === id)
    .sort((a, b) => a.time.localeCompare(b.time))
    .slice(-limit)
}

/** 批量查询全部目标最近轨迹线段，供海图轨迹图层使用。 */
function queryTargetTracks(limit = 20): TargetTrackLine[] {
  const grouped = new Map<string, TrackPoint[]>()
  for (const point of getTrackPoints()) {
    const list = grouped.get(point.targetId)
    if (list) list.push(point)
    else grouped.set(point.targetId, [point])
  }
  return Array.from(grouped.entries()).map(([targetId, points]) => ({
    targetId,
    points: [...points].sort((a, b) => a.time.localeCompare(b.time)).slice(-limit),
  }))
}

/** 分页查询告警事件，支持按等级筛选。 */
function queryAlarms(query: AlarmQueryParams = {}): PageResult<AlarmEvent> {
  const page = query.page || 1
  const pageSize = query.pageSize || 10
  const matched = getAlarms()
    .filter((a) => !query.levels?.length || query.levels.includes(a.level))
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
  return pageResult(matched, page, pageSize)
}

/** 更新告警处置状态，校验白名单与状态流转规则。 */
function updateAlarmStatus(id: string, next: DisposeStatus): AlarmEvent {
  const alarms = getAlarms()
  const alarm = alarms.find((a) => a.id === id)
  if (!alarm) throw new MockError('告警不存在', 404)
  if (!DISPOSE_STATUS_OPTIONS.includes(next)) throw new MockError('处置状态不合法', 400)
  if (next === 'processing' && alarm.status !== 'pending') throw new MockError('该告警已进入处置流程，请勿重复操作')
  if (next === 'done' && alarm.status !== 'processing') throw new MockError('当前状态无法标记完成')
  if (next === 'reviewed' && alarm.status !== 'done') throw new MockError('仅已处置告警可复核')
  if (next === 'pending') throw new MockError('不支持回退到待处置')
  alarm.status = next
  return alarm
}

export {
  buildStats,
  getMaritimeStatus,
  queryAlarms,
  queryTargetDetail,
  queryTargetSources,
  queryTargetTracks,
  queryTargets,
  queryTargetTrack,
  refreshData,
  setPaused,
  setSimError,
  updateAlarmStatus,
}
