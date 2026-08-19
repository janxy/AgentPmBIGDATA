/** 海上全域感知大屏数据接口：统一走 request 封装，可平滑替换为真实后端。 */
import { request } from '@/utils/request'
import { subscribeMaritimeUpdates as subscribeMockMaritimeUpdates } from '@/mock/maritime'
import type {
  AlarmEvent,
  AlarmLevel,
  AlarmType,
  DisposeStatus,
  DispatchOrder,
  DispatchOutcome,
  DispatchOverview,
  DispatchStatus,
  FrameCodeInfo,
  FusionTarget,
  LawDispatchRecommend,
  MaritimeStats,
  MaritimeStatus,
  PageResult,
  SourceReport,
  TargetFilter,
  TargetTrackLine,
  TargetType,
  TrackPoint,
} from '@/types/maritime'

interface TargetListQuery extends Partial<TargetFilter> {
  page?: number
  pageSize?: number
}

interface HistoricalTargetQuery {
  date: string
  page?: number
  pageSize?: number
  types?: TargetType[]
}

interface AlarmListQuery {
  page?: number
  pageSize?: number
  levels?: AlarmLevel[]
}

interface LawDispatchListQuery {
  page?: number
  pageSize?: number
  scope?: 'current' | 'history'
  statuses?: DispatchStatus[]
  outcomes?: DispatchOutcome[]
  types?: AlarmType[]
  keyword?: string
}

function buildQuery(params: Record<string, string | number | boolean | string[] | undefined | null>): string {
  const search = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return
    if (Array.isArray(value)) {
      if (value.length > 0) search.set(key, value.join(','))
      return
    }
    search.set(key, String(value))
  })
  const qs = search.toString()
  return qs ? `?${qs}` : ''
}

/** 获取当前目标规模与来源统计。 */
export function fetchMaritimeOverview(): Promise<MaritimeStats> {
  return request<MaritimeStats>('/api/maritime/overview')
}

/** 分页查询融合目标，支持来源、状态、类型与关键词组合筛选。 */
export function fetchTargets(query: TargetListQuery = {}): Promise<PageResult<FusionTarget>> {
  const qs = buildQuery({
    page: query.page ?? 1,
    pageSize: query.pageSize ?? 10,
    sources: query.sources,
    statuses: query.statuses,
    types: query.types,
    keyword: query.keyword,
  })
  return request<PageResult<FusionTarget>>(`/api/maritime/targets${qs}`)
}

/** 按日期查询历史船只快照，供历史模式地图展示。 */
export function fetchHistoricalTargets(query: HistoricalTargetQuery): Promise<PageResult<FusionTarget>> {
  const qs = buildQuery({
    date: query.date,
    page: query.page ?? 1,
    pageSize: query.pageSize ?? 999,
    types: query.types,
  })
  return request<PageResult<FusionTarget>>(`/api/maritime/history/targets${qs}`)
}

/** 按目标标识查询融合目标详情。 */
export function fetchTargetDetail(id: string, date?: string): Promise<FusionTarget> {
  const qs = date ? `&date=${encodeURIComponent(date)}` : ''
  return request<FusionTarget>(`/api/maritime/target/detail?id=${encodeURIComponent(id)}${qs}`)
}

/** 查询目标帧码维度信息，传入历史日期时返回该日期快照。 */
export function fetchTargetFrameCode(id: string, date?: string): Promise<FrameCodeInfo> {
  const qs = date ? `&date=${encodeURIComponent(date)}` : ''
  return request<FrameCodeInfo>(`/api/maritime/target/frame-code?id=${encodeURIComponent(id)}${qs}`)
}

/** 查询目标最近各来源上报记录。 */
export function fetchTargetSources(id: string, date?: string): Promise<SourceReport[]> {
  const qs = date ? `&date=${encodeURIComponent(date)}` : ''
  return request<SourceReport[]>(`/api/maritime/target/sources?id=${encodeURIComponent(id)}${qs}`)
}

/** 查询目标最近轨迹点，limit 默认 60。 */
export function fetchTargetTrack(id: string, limit = 60, date?: string): Promise<TrackPoint[]> {
  const qs = date ? `&date=${encodeURIComponent(date)}` : ''
  return request<TrackPoint[]>(`/api/maritime/target/track?id=${encodeURIComponent(id)}&limit=${limit}${qs}`)
}

/** 批量查询全部目标最近轨迹线段，供海图轨迹图层使用。 */
export function fetchTargetTracks(limit = 20): Promise<TargetTrackLine[]> {
  return request<TargetTrackLine[]>(`/api/maritime/target/tracks?limit=${limit}`)
}

/** 分页查询告警事件，支持按等级筛选。 */
export function fetchAlarms(query: AlarmListQuery = {}): Promise<PageResult<AlarmEvent>> {
  const qs = buildQuery({
    page: query.page ?? 1,
    pageSize: query.pageSize ?? 10,
    levels: query.levels,
  })
  return request<PageResult<AlarmEvent>>(`/api/maritime/alarms${qs}`)
}

/** 查询智能执法概览统计。 */
export function fetchLawDispatchOverview(): Promise<DispatchOverview> {
  return request<DispatchOverview>('/api/maritime/law/overview')
}

/** 分页查询智能执法派单，scope 区分当前/历史。 */
export function fetchLawDispatchOrders(query: LawDispatchListQuery = {}): Promise<PageResult<DispatchOrder>> {
  const qs = buildQuery({
    page: query.page ?? 1,
    pageSize: query.pageSize ?? 10,
    scope: query.scope,
    statuses: query.statuses,
    outcomes: query.outcomes,
    types: query.types,
    keyword: query.keyword,
  })
  return request<PageResult<DispatchOrder>>(`/api/maritime/law/orders${qs}`)
}

/** 查询派单详情。 */
export function fetchLawDispatchDetail(id: string): Promise<DispatchOrder> {
  return request<DispatchOrder>(`/api/maritime/law/order/detail?id=${encodeURIComponent(id)}`)
}

/** 获取智能派单推荐：告警等级优先、执法船就近空闲。 */
export function fetchLawDispatchRecommend(alarmId?: string): Promise<LawDispatchRecommend> {
  const qs = alarmId ? `?alarmId=${encodeURIComponent(alarmId)}` : ''
  return request<LawDispatchRecommend>(`/api/maritime/law/recommend${qs}`)
}

/** 确认创建智能派单。 */
export function createLawDispatch(payload: { alarmId?: string; vesselId?: string }): Promise<DispatchOrder> {
  return request<DispatchOrder>('/api/maritime/law/dispatch', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

/** 催办进行中的派单。 */
export function urgeLawDispatch(id: string): Promise<DispatchOrder> {
  return request<DispatchOrder>('/api/maritime/law/urge', {
    method: 'POST',
    body: JSON.stringify({ id }),
  })
}

/** 推进派单状态至下一阶段。 */
export function advanceLawDispatch(id: string): Promise<DispatchOrder> {
  return request<DispatchOrder>('/api/maritime/law/advance', {
    method: 'POST',
    body: JSON.stringify({ id }),
  })
}

/** 结束派单并登记处置结果，转办时自动生成新派单。 */
export function finishLawDispatch(id: string, outcome: DispatchOutcome, note = ''): Promise<DispatchOrder> {
  return request<DispatchOrder>('/api/maritime/law/finish', {
    method: 'POST',
    body: JSON.stringify({ id, outcome, note }),
  })
}

/** 更新告警处置状态，后端按状态流转规则校验。 */
export function updateAlarmStatus(id: string, status: DisposeStatus): Promise<AlarmEvent> {
  return request<AlarmEvent>('/api/maritime/alarms/status', {
    method: 'POST',
    body: JSON.stringify({ id, status }),
  })
}

/** 手动触发一次演示数据刷新，失败时返回错误信息。 */
export function refreshMaritimeData(): Promise<MaritimeStats> {
  return request<MaritimeStats>('/api/maritime/refresh', { method: 'POST' })
}

/** 暂停或恢复演示数据周期更新。 */
export function pauseMaritimeData(paused: boolean): Promise<MaritimeStatus> {
  return request<MaritimeStatus>('/api/maritime/pause', {
    method: 'POST',
    body: JSON.stringify({ paused }),
  })
}

/** 注入或清除演示异常，用于数据维护面板验证降级态。 */
export function injectMaritimeError(enabled: boolean): Promise<MaritimeStatus> {
  return request<MaritimeStatus>('/api/maritime/error', {
    method: 'POST',
    body: JSON.stringify({ enabled }),
  })
}

/** 查询演示数据层运行状态。 */
export function getMaritimeStatus(): Promise<MaritimeStatus> {
  return request<MaritimeStatus>('/api/maritime/status')
}

/** 订阅演示数据周期更新，返回取消订阅函数。 */
export function subscribeMaritimeUpdates(cb: () => void): () => void {
  return subscribeMockMaritimeUpdates(cb)
}
