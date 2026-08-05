/** 演示数据查询与处置状态流转，统一通过只读快照访问内存状态。 */
import type {
  AlarmEvent,
  AlarmLevel,
  AlarmType,
  DisposeStatus,
  DispatchOrder,
  DispatchOutcome,
  DispatchStatus,
  EnforcementVessel,
  FusionTarget,
  LawDispatchRecommend,
  PageResult,
  SourceReport,
  TargetSource,
  TargetTrackLine,
  TargetStatus,
  TargetType,
  TrackPoint,
} from '@/types/maritime'
import { distanceMeters } from '@/utils/geo'
import {
  buildStats,
  createDispatchOrderRecord,
  currentTimeIso,
  getAlarms,
  getDispatchOrders,
  getLawVessels,
  getMaritimeStatus,
  getSourceReports,
  getTargets,
  getTrackPoints,
  refreshData,
  setPaused,
  setSimError,
  setVesselStatus,
  updateDispatchOrder,
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

export interface LawDispatchQueryParams {
  page?: number
  pageSize?: number
  scope?: 'current' | 'history'
  statuses?: DispatchStatus[]
  outcomes?: DispatchOutcome[]
  types?: AlarmType[]
  keyword?: string
}

export interface CreateLawDispatchParams {
  alarmId?: string
  vesselId?: string
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
const DISPATCH_OUTCOME_OPTIONS: readonly DispatchOutcome[] = ['done', 'timeout', 'transfer']
const ALARM_LEVEL_ORDER: Record<AlarmLevel, number> = { urgent: 0, important: 1, normal: 2 }

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

function isSameDay(a: string, b: string) {
  const da = new Date(a)
  const db = new Date(b)
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate()
}

function matchesDispatchOrder(order: DispatchOrder, query: LawDispatchQueryParams): boolean {
  const keyword = (query.keyword || '').trim().toLowerCase()
  if (
    keyword &&
    ![order.code, order.targetName, order.targetMmsi, order.vesselName, order.alarmType, order.alarmDescription].some((value) =>
      value.toLowerCase().includes(keyword),
    )
  ) {
    return false
  }
  if (query.statuses?.length && !query.statuses.includes(order.status)) return false
  if (query.outcomes?.length && !(order.outcome && query.outcomes.includes(order.outcome))) return false
  if (query.types?.length && !query.types.includes(order.alarmType)) return false
  if (query.scope === 'current' && order.status === 'finished') return false
  if (query.scope === 'history' && order.status !== 'finished') return false
  return true
}

/** 智能执法概览：当前执行、今日完成、按时率与可用执法船。 */
function queryLawDispatchOverview() {
  const now = new Date()
  const orders = getDispatchOrders()
  const current = orders.filter((order) => order.status !== 'finished')
  const finished = orders.filter((order) => order.status === 'finished')
  const today = (value: string | null) => Boolean(value && isSameDay(value, now.toISOString()))
  const doneOrders = finished.filter((order) => order.outcome === 'done')
  const onTime = doneOrders.filter((order) => (order.durationMinutes ?? 0) <= (order.etaMinutes + 12)).length
  const onTimeRate = finished.length > 0 ? Math.round((onTime / finished.length) * 100) : 0
  const avgResponseMinutes =
    finished.length > 0
      ? Math.round(
          finished.reduce((sum, order) => {
            const response = (new Date(order.dispatchTime).getTime() - new Date(order.alarmTime).getTime()) / 60000
            return sum + Math.max(1, Math.round(response))
          }, 0) / finished.length,
        )
      : 0
  return {
    currentWaiting: current.filter((order) => order.status === 'waiting').length,
    currentActive: current.filter((order) => ['sailing', 'arrived', 'handling'].includes(order.status)).length,
    currentToday: current.filter((order) => today(order.dispatchTime)).length,
    currentFinishedToday: 0,
    historyTodayFinished: finished.filter((order) => today(order.endTime || order.dispatchTime)).length,
    onTimeRate,
    avgResponseMinutes,
    availableVessels: getLawVessels().filter((vessel) => vessel.status === 'idle').length,
  }
}

/** 分页查询派单列表，scope 区分当前/历史。 */
function queryLawDispatchOrders(query: LawDispatchQueryParams = {}): PageResult<DispatchOrder> {
  const page = query.page || 1
  const pageSize = query.pageSize || 10
  const matched = getDispatchOrders()
    .filter((order) => matchesDispatchOrder(order, query))
    .sort((a, b) => b.dispatchTime.localeCompare(a.dispatchTime))
  return pageResult(matched, page, pageSize)
}

/** 查询派单详情。 */
function queryLawDispatchDetail(id: string): DispatchOrder {
  const order = getDispatchOrders().find((item) => item.id === id)
  if (!order) throw new MockError('派单不存在', 404)
  return order
}

function findDispatchableAlarm(alarmId?: string): AlarmEvent {
  const pending = getAlarms().filter((alarm) => alarm.status === 'pending')
  if (pending.length === 0) throw new MockError('暂无待处置告警，可稍后再试')
  const activeAlarmIds = new Set(getDispatchOrders().filter((order) => order.status !== 'finished').map((order) => order.alarmId))
  const candidates = alarmId ? pending.filter((alarm) => alarm.id === alarmId) : pending
  if (alarmId && candidates.length === 0) throw new MockError('告警不存在或不在待处置状态')
  const available = candidates.filter((alarm) => !activeAlarmIds.has(alarm.id))
  if (available.length === 0) {
    if (alarmId) throw new MockError('该告警已有进行中的派单，请勿重复派单')
    throw new MockError('当前待处置告警均已有进行中派单')
  }
  return [...available].sort(
    (a, b) => ALARM_LEVEL_ORDER[a.level] - ALARM_LEVEL_ORDER[b.level] || b.occurredAt.localeCompare(a.occurredAt),
  )[0]
}

function findBestVessel(alarm: AlarmEvent, vesselId?: string): EnforcementVessel {
  const idle = getLawVessels().filter((vessel) => vessel.status === 'idle')
  if (idle.length === 0) throw new MockError('暂无空闲执法船，请稍后再试')
  const candidates = vesselId ? idle.filter((vessel) => vessel.id === vesselId) : idle
  if (vesselId && candidates.length === 0) throw new MockError('所选执法船不可用，请重新选择')
  const alarmPoint = { lon: alarm.lon, lat: alarm.lat }
  return [...candidates].sort((a, b) => {
    const da = distanceMeters({ lon: a.lon, lat: a.lat }, alarmPoint)
    const db = distanceMeters({ lon: b.lon, lat: b.lat }, alarmPoint)
    return da - db
  })[0]
}

function dispatchDistance(vessel: EnforcementVessel, alarm: AlarmEvent) {
  return Number((distanceMeters({ lon: vessel.lon, lat: vessel.lat }, { lon: alarm.lon, lat: alarm.lat }) / 1000).toFixed(1))
}

/** 智能派单推荐：等级优先、就近且空闲的执法船。 */
function recommendLawDispatch(alarmId?: string): LawDispatchRecommend {
  const alarm = findDispatchableAlarm(alarmId)
  const vessel = findBestVessel(alarm)
  const distanceKm = dispatchDistance(vessel, alarm)
  const etaMinutes = Math.max(8, Math.round((distanceKm / (vessel.speed * 1.852)) * 60))
  return {
    alarm,
    vessel,
    distanceKm,
    etaMinutes,
    reason: `${vessel.name} 当前空闲且距目标最近，预计 ${etaMinutes} 分钟抵达`,
  }
}

/** 创建智能派单：告警转入处置中，执法船标记执行中。 */
function createSmartDispatch(params: CreateLawDispatchParams = {}): DispatchOrder {
  const alarm = findDispatchableAlarm(params.alarmId)
  const vessel = findBestVessel(alarm, params.vesselId)
  const order = createDispatchOrderRecord({ alarm, vessel, status: 'waiting', dispatchTime: currentTimeIso() })
  setVesselStatus(vessel.id, 'dispatched')
  const current = getAlarms().find((item) => item.id === alarm.id)
  if (current) current.status = 'processing'
  return order
}

/** 催办：向执法船追加催办时间线，仅进行中派单可用。 */
function urgeDispatch(id: string): DispatchOrder {
  const order = getDispatchOrders().find((item) => item.id === id)
  if (!order) throw new MockError('派单不存在', 404)
  if (order.status === 'finished') throw new MockError('已结束派单不支持催办')
  const event = {
    id: `U-${Date.now()}`,
    type: 'urge' as const,
    time: currentTimeIso(),
    title: '催办提醒',
    description: `已向 ${order.vesselName} 发送催办指令，请加快处置进度`,
  }
  return updateDispatchOrder(id, { timeline: [...order.timeline, event] })
}

/** 推进派单状态：待出航→出航中→已抵达→处置中。 */
function advanceDispatch(id: string): DispatchOrder {
  const order = getDispatchOrders().find((item) => item.id === id)
  if (!order) throw new MockError('派单不存在', 404)
  if (order.status === 'finished') throw new MockError('已结束派单不支持推进')
  const nextMap: Partial<Record<DispatchStatus, { status: DispatchStatus; type: 'sail' | 'arrive' | 'handle'; title: string; description: string }>> = {
    waiting: {
      status: 'sailing',
      type: 'sail',
      title: '已出航',
      description: `${order.vesselName} 已离港出航，正在驶向目标海域`,
    },
    sailing: {
      status: 'arrived',
      type: 'arrive',
      title: '已抵达',
      description: `${order.vesselName} 已抵达目标海域，开始抵近核查`,
    },
    arrived: {
      status: 'handling',
      type: 'handle',
      title: '开始处置',
      description: '执法人员已开始现场处置',
    },
  }
  const next = nextMap[order.status]
  if (!next) throw new MockError('当前状态无需推进，请直接结束派单')
  const event = {
    id: `A-${Date.now()}`,
    type: next.type,
    time: currentTimeIso(),
    title: next.title,
    description: next.description,
  }
  return updateDispatchOrder(id, { status: next.status, timeline: [...order.timeline, event] })
}

/** 结束派单：处置完成/超时未处置/转办，转办自动生成新派单。 */
function finishDispatch(id: string, outcome: DispatchOutcome, note = ''): DispatchOrder {
  const order = getDispatchOrders().find((item) => item.id === id)
  if (!order) throw new MockError('派单不存在', 404)
  if (order.status === 'finished') throw new MockError('派单已结束，请勿重复操作')
  if (!DISPATCH_OUTCOME_OPTIONS.includes(outcome)) throw new MockError('处置结果不合法')
  let candidate: EnforcementVessel | null = null
  if (outcome === 'transfer') {
    const alarmPoint = { lon: order.lon, lat: order.lat }
    candidate =
      getLawVessels()
        .filter((vessel) => vessel.status === 'idle' && vessel.id !== order.vesselId)
        .sort(
          (a, b) =>
            distanceMeters({ lon: a.lon, lat: a.lat }, alarmPoint) - distanceMeters({ lon: b.lon, lat: b.lat }, alarmPoint),
        )[0] ?? null
    if (!candidate) throw new MockError('暂无其他可用执法船，暂无法转办')
  }
  const endTime = currentTimeIso()
  const durationMinutes = Math.max(1, Math.round((new Date(endTime).getTime() - new Date(order.dispatchTime).getTime()) / 60000))
  const title = outcome === 'done' ? '处置完成' : outcome === 'timeout' ? '超时未处置' : '已转办'
  const description =
    note.trim() ||
    (outcome === 'done'
      ? '现场处置完成，告警已闭环'
      : outcome === 'timeout'
        ? '超过规定时限仍未处置完成'
        : '因现场情况复杂，已转办至其他执法船')
  const events = [...order.timeline, { id: `F-${Date.now()}`, type: 'finish' as const, time: endTime, title, description }]
  if (outcome === 'transfer' && candidate) {
    events.push({
      id: `T-${Date.now()}`,
      type: 'transfer' as const,
      time: endTime,
      title: '转办登记',
      description: `系统已自动派单至 ${candidate.name}`,
    })
  }
  updateDispatchOrder(id, {
    status: 'finished',
    outcome,
    endTime,
    durationMinutes,
    note: note.trim(),
    timeline: events,
  })
  setVesselStatus(order.vesselId, 'idle')
  const alarm = getAlarms().find((item) => item.id === order.alarmId)
  if (alarm) {
    if (outcome === 'done') alarm.status = 'done'
    if (outcome === 'timeout') alarm.status = 'pending'
    if (outcome === 'transfer' && candidate) {
      createDispatchOrderRecord({ alarm, vessel: candidate, status: 'waiting', dispatchTime: endTime })
      setVesselStatus(candidate.id, 'dispatched')
      alarm.status = 'processing'
    }
  }
  return queryLawDispatchDetail(id)
}

export {
  buildStats,
  advanceDispatch,
  createSmartDispatch,
  finishDispatch,
  getMaritimeStatus,
  queryAlarms,
  queryLawDispatchDetail,
  queryLawDispatchOrders,
  queryLawDispatchOverview,
  queryTargetDetail,
  queryTargetSources,
  queryTargetTracks,
  queryTargets,
  queryTargetTrack,
  recommendLawDispatch,
  refreshData,
  setPaused,
  setSimError,
  updateAlarmStatus,
  urgeDispatch,
}
