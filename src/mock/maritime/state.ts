/** 演示数据内存状态：生成、定时模拟与周期订阅，界面只读展示。 */
import type {
  AlarmEvent,
  AlarmLevel,
  AlarmType,
  DisposeStatus,
  DispatchOrder,
  DispatchOutcome,
  DispatchStatus,
  DispatchTimelineEvent,
  DispatchTimelineType,
  EnforcementVessel,
  EnforcementVesselStatus,
  FusionTarget,
  MaritimeStats,
  MaritimeStatus,
  SourceReport,
  TargetSource,
  TargetStatus,
  TargetType,
  TrackPoint,
} from '@/types/maritime'
import { JURISDICTION_BOUNDS } from '@/types/maritime'
import { distanceMeters } from '@/utils/geo'
import { FENCE_ZONES } from '@/mock/maritime/monitor'
import rawChuanTargets from './chuan.json'

const TRACK_PER_TARGET = 20
const TARGET_COUNT = 100
const ALARM_COUNT = 80
const TICK_MS = 60000
const MAX_ALARMS = 100
const MAX_TRACK_POINTS = 60
const MAX_LISTENERS = 12
const BOUNDS = JURISDICTION_BOUNDS

/** 历史轨迹点的时间间隔（分钟），以及航速到经纬度步长的换算系数。 */
const TRACK_INTERVAL_MIN = 5
const TRACK_JITTER = 0.0008
const KNOT_DEG_PER_MIN = 0.0002773

interface ChuanTarget {
  fusion_id: string
  display_id: string
  mmsi: string | null
  source_id: string
  longitude: number
  latitude: number
  heading: number
  speed: number
  speed_unit: string
  event_time: string
  fusion_type: string
  three_no_status: string
}

const CHUAN_TARGETS = (rawChuanTargets as ChuanTarget[]).slice(0, TARGET_COUNT)

/** 模拟器状态挂在全局上，避免开发期热更新反复重建定时器与订阅。 */
const STATE_KEY = '__AXURE_MARITIME_SIM_STATE__'

interface SimulatorState {
  running: boolean
  paused: boolean
  simError: boolean
  lastError: string
  updatedAt: string
  timer: ReturnType<typeof setInterval> | null
  listeners: Set<() => void>
  reportSeq: number
  trackSeq: number
  alarmSeq: number
  dispatchSeq: number
  timelineSeq: number
}

function globalSimulatorState(): SimulatorState {
  const record = window as unknown as Record<string, SimulatorState | undefined>
  if (!record[STATE_KEY]) {
    record[STATE_KEY] = {
      running: false,
      paused: false,
      simError: false,
      lastError: '',
      updatedAt: '',
      timer: null,
      listeners: new Set(),
      reportSeq: 0,
      trackSeq: 0,
      alarmSeq: 0,
      dispatchSeq: 0,
      timelineSeq: 0,
    }
  }
  return record[STATE_KEY] as SimulatorState
}

const QUALITY_WEIGHTS: Array<['high' | 'medium' | 'low', number]> = [
  ['high', 0.65],
  ['medium', 0.25],
  ['low', 0.1],
]
const ALARM_TYPES: AlarmType[] = ['boundary', 'overspeed', 'lost', 'collision', 'zone']
const ALARM_LEVEL_WEIGHTS: Array<[AlarmLevel, number]> = [
  ['urgent', 0.2],
  ['important', 0.35],
  ['normal', 0.45],
]
const DISPOSE_WEIGHTS: Array<[DisposeStatus, number]> = [
  ['pending', 0.35],
  ['processing', 0.2],
  ['done', 0.25],
  ['reviewed', 0.2],
]
const ALARM_DESCRIPTIONS: Record<AlarmType, string> = {
  boundary: '超出辖区/区域范围，请核实航线',
  overspeed: '航速超过辖区限速阈值，请关注',
  lost: '超过时效无有效上报，存在失联风险',
  collision: '与邻近船舶存在碰撞风险，请核实',
  zone: '进入敏感区域，请重点关注',
}

const VESSEL_DEFS: Array<{ name: string; model: string; speed: number }> = [
  { name: '厦门海巡01', model: '中型执法船', speed: 26 },
  { name: '厦门海巡03', model: '近海巡逻艇', speed: 30 },
  { name: '厦门海巡08', model: '高速执法艇', speed: 34 },
  { name: '中国渔政35001', model: '渔政执法船', speed: 22 },
  { name: '中国海监8001', model: '海监巡逻船', speed: 24 },
  { name: '闽东救援02', model: '应急救助船', speed: 20 },
  { name: '厦门海巡06', model: '近海巡逻艇', speed: 28 },
  { name: '执法快艇07', model: '高速执法艇', speed: 36 },
]

const targets: FusionTarget[] = []
const sourceReports: SourceReport[] = []
const trackPoints: TrackPoint[] = []
const alarms: AlarmEvent[] = []
const vessels: EnforcementVessel[] = []
const dispatchOrders: DispatchOrder[] = []
const sim = globalSimulatorState()

/** 可复现的伪随机数生成器，保证演示数据分布稳定。 */
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

const rng = mulberry32(20260804)

const randRange = (min: number, max: number) => min + rng() * (max - min)
const pick = <T>(items: readonly T[]): T => items[Math.floor(rng() * items.length)]
const chance = (p: number) => rng() < p
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))
const nowIso = () => new Date().toISOString()
const isoMinutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60000).toISOString()
const makeId = (prefix: string, n: number) => `${prefix}-${String(n).padStart(4, '0')}`
const normalizeCourse = (course: number) => ((course % 360) + 360) % 360

function beijingTimeToIso(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(value)
  if (!match) return new Date(value).toISOString()
  const year = Number(match[1])
  const month = Number(match[2]) - 1
  const day = Number(match[3])
  const hour = Number(match[4]) - 8
  const minute = Number(match[5])
  const second = Number(match[6])
  return new Date(Date.UTC(year, month, day, hour, minute, second)).toISOString()
}

function fusionTypeToSources(value: string): TargetSource[] {
  const sources: TargetSource[] = []
  if (value.includes('radar')) sources.push('phased')
  if (value.includes('ais')) sources.push('ais')
  if (value.includes('frame_code')) sources.push('framecode')
  return sources
}

function buildChuanTarget(raw: ChuanTarget, index: number): FusionTarget {
  const type: TargetType = raw.three_no_status === 'confirmed' ? 'sanwu' : 'normal'
  const status: TargetStatus = 'online'
  const display = raw.display_id || raw.fusion_id || String(index + 1)
  const lastUpdate = beijingTimeToIso(raw.event_time)
  return {
    id: raw.fusion_id || raw.display_id || `CH-${index + 1}`,
    name: `${type === 'sanwu' ? '三无目标' : '船舶'} ${display}`,
    mmsi: raw.mmsi || '',
    callSign: '---',
    type,
    nationality: '未知',
    length: 0,
    width: 0,
    draft: 0,
    lon: raw.longitude,
    lat: raw.latitude,
    speed: Number(raw.speed.toFixed(1)),
    course: normalizeCourse(raw.heading),
    status,
    sources: fusionTypeToSources(raw.fusion_type),
    lastUpdate,
    lastPositionTime: lastUpdate,
  }
}

function weighted<T extends string>(weights: Array<[T, number]>): T {
  let roll = rng()
  for (const [value, weight] of weights) {
    if (roll < weight) return value
    roll -= weight
  }
  return weights[weights.length - 1][0]
}

function generateSourceReports() {
  for (const target of targets) {
    for (const source of target.sources) {
      sourceReports.push({
        id: makeId('S', ++sim.reportSeq),
        targetId: target.id,
        source,
        reportTime: target.lastUpdate,
        quality: weighted(QUALITY_WEIGHTS),
        lon: target.lon,
        lat: target.lat,
        speed: target.speed,
        course: target.course,
      })
    }
  }
}

function generateTracks() {
  for (const target of targets) {
    const rad = (target.course * Math.PI) / 180
    const cosLat = Math.cos((target.lat * Math.PI) / 180)
    const latestTime = target.lastUpdate
    const isoMinutesBefore = (minutes: number) => new Date(new Date(latestTime).getTime() - minutes * 60000).toISOString()
    for (let i = TRACK_PER_TARGET; i >= 1; i -= 1) {
      const minutesAgo = i * TRACK_INTERVAL_MIN
      const step = target.speed * KNOT_DEG_PER_MIN * minutesAgo
      trackPoints.push({
        id: makeId('P', ++sim.trackSeq),
        targetId: target.id,
        time: isoMinutesBefore(minutesAgo),
        lon: clamp(target.lon - (step * Math.sin(rad)) / cosLat + randRange(-TRACK_JITTER, TRACK_JITTER), BOUNDS.minLon, BOUNDS.maxLon),
        lat: clamp(target.lat - step * Math.cos(rad) + randRange(-TRACK_JITTER, TRACK_JITTER), BOUNDS.minLat, BOUNDS.maxLat),
        speed: Number(Math.max(0, target.speed + randRange(-2, 2)).toFixed(1)),
        course: normalizeCourse(target.course + randRange(-8, 8)),
      })
    }
    trackPoints.push({
      id: makeId('P', ++sim.trackSeq),
      targetId: target.id,
      time: latestTime,
      lon: target.lon,
      lat: target.lat,
      speed: target.speed,
      course: target.course,
    })
  }
}

function createAlarm(minutesAgo = 0): AlarmEvent {
  const target = pick(targets)
  const type = pick(ALARM_TYPES)
  const zone = type === 'zone' ? pick(FENCE_ZONES) : null
  const angle = rng() * Math.PI * 2
  const distanceKm = zone ? Math.sqrt(rng()) * zone.radiusKm * 0.85 : 0
  const cosLat = Math.cos(((zone?.lat ?? target.lat) * Math.PI) / 180)
  return {
    id: makeId('A', ++sim.alarmSeq),
    type,
    level: weighted(ALARM_LEVEL_WEIGHTS),
    targetId: target.id,
    targetName: target.name,
    targetMmsi: target.mmsi,
    ...(zone ? { zoneId: zone.id } : {}),
    lon: zone ? zone.lon + (Math.sin(angle) * distanceKm) / (111.32 * cosLat) : target.lon,
    lat: zone ? zone.lat + (Math.cos(angle) * distanceKm) / 111.32 : target.lat,
    occurredAt: isoMinutesAgo(minutesAgo),
    status: weighted(DISPOSE_WEIGHTS),
    description: zone ? `${target.name}进入${zone.name}敏感水域，请重点关注` : `${target.name}${ALARM_DESCRIPTIONS[type]}`,
  }
}

function generateAlarms() {
  for (let i = 0; i < ALARM_COUNT; i += 1) {
    alarms.push(createAlarm(Math.floor(randRange(5, 60 * 24))))
  }
  alarms.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
}

function buildVessels() {
  const anchors: Array<[number, number]> = [
    [118.06, 24.45],
    [118.12, 24.43],
    [118.17, 24.44],
    [118.22, 24.4],
    [118.13, 24.36],
    [118.18, 24.33],
    [118.08, 24.39],
    [118.24, 24.36],
  ]
  VESSEL_DEFS.forEach((def, index) => {
    const anchor = anchors[index]
    vessels.push({
      id: `V-${String(index + 1).padStart(2, '0')}`,
      name: def.name,
      model: def.model,
      status: 'idle',
      lon: anchor[0] + randRange(-0.18, 0.18),
      lat: anchor[1] + randRange(-0.16, 0.16),
      speed: Number((def.speed + randRange(-1.5, 1.5)).toFixed(1)),
      lastUpdate: isoMinutesAgo(Math.floor(randRange(1, 20))),
    })
  })
}

function makeDispatchCode(date: Date, seq: number) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `ZF-${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${String(seq).padStart(3, '0')}`
}

function isoPlusMinutes(iso: string, minutes: number) {
  return new Date(new Date(iso).getTime() + minutes * 60000).toISOString()
}

function makeTimelineEvent(type: DispatchTimelineType, time: string, title: string, description: string): DispatchTimelineEvent {
  return {
    id: `E-${String(++sim.timelineSeq).padStart(4, '0')}`,
    type,
    time,
    title,
    description,
  }
}

function buildDispatchOrder(options: {
  alarm: AlarmEvent
  vessel: EnforcementVessel
  status: DispatchStatus
  dispatchTime: string
  outcome?: DispatchOutcome | null
  endTime?: string | null
  note?: string
  durationMinutes?: number | null
}): DispatchOrder {
  const seq = ++sim.dispatchSeq
  const distanceKm = Number(
    (distanceMeters({ lon: options.vessel.lon, lat: options.vessel.lat }, { lon: options.alarm.lon, lat: options.alarm.lat }) / 1000).toFixed(1),
  )
  const etaMinutes = Math.max(8, Math.round((distanceKm / (options.vessel.speed * 1.852)) * 60))
  const timeline: DispatchTimelineEvent[] = [
    makeTimelineEvent(
      'dispatch',
      options.dispatchTime,
      '智能派单',
      `系统指派 ${options.vessel.name} 前往处置${options.alarm.targetName}${ALARM_DESCRIPTIONS[options.alarm.type]}`,
    ),
  ]
  if (options.status === 'sailing' || options.status === 'arrived' || options.status === 'handling') {
    timeline.push(
      makeTimelineEvent(
        'sail',
        isoPlusMinutes(options.dispatchTime, 8),
        '已出航',
        `${options.vessel.name} 已离港出航，航速 ${options.vessel.speed.toFixed(1)} 节`,
      ),
    )
  }
  if (options.status === 'arrived' || options.status === 'handling') {
    timeline.push(
      makeTimelineEvent(
        'arrive',
        isoPlusMinutes(options.dispatchTime, etaMinutes),
        '已抵达',
        `${options.vessel.name} 已抵达目标海域，准备现场处置`,
      ),
    )
  }
  if (options.status === 'handling') {
    timeline.push(
      makeTimelineEvent(
        'handle',
        isoPlusMinutes(options.dispatchTime, etaMinutes + 5),
        '开始处置',
        `执法人员已抵近检查${options.alarm.targetName}`,
      ),
    )
  }
  if (options.status === 'finished' && options.endTime) {
    const title = options.outcome === 'done' ? '处置完成' : options.outcome === 'timeout' ? '超时未处置' : '已转办'
    const desc =
      options.outcome === 'done'
        ? '现场处置完成，告警已闭环'
        : options.outcome === 'timeout'
          ? '超过规定时限仍未处置完成'
          : '因现场情况复杂，已转办至其他执法船'
    timeline.push(makeTimelineEvent('finish', options.endTime, title, options.note || desc))
    if (options.outcome === 'transfer') {
      timeline.push(makeTimelineEvent('transfer', options.endTime, '转办登记', '原派单已结束，系统已自动生成新派单'))
    }
  }
  return {
    id: `D-${String(seq).padStart(4, '0')}`,
    code: makeDispatchCode(new Date(options.dispatchTime), seq),
    alarmId: options.alarm.id,
    alarmType: options.alarm.type,
    alarmLevel: options.alarm.level,
    alarmTime: options.alarm.occurredAt,
    alarmDescription: options.alarm.description,
    targetId: options.alarm.targetId,
    targetName: options.alarm.targetName,
    targetMmsi: options.alarm.targetMmsi,
    lon: options.alarm.lon,
    lat: options.alarm.lat,
    vesselId: options.vessel.id,
    vesselName: options.vessel.name,
    dispatchTime: options.dispatchTime,
    status: options.status,
    etaMinutes,
    distanceKm,
    outcome: options.outcome ?? null,
    endTime: options.endTime ?? null,
    durationMinutes: options.durationMinutes ?? null,
    note: options.note ?? '',
    timeline,
  }
}

function generateDispatchOrders() {
  const usedAlarmIds = new Set<string>()
  const takePendingAlarm = () => {
    const pool = alarms.filter((a) => a.status === 'pending' && !usedAlarmIds.has(a.id))
    const alarm = pool.length > 0 ? pool[Math.floor(rng() * pool.length)] ?? null : null
    if (alarm) usedAlarmIds.add(alarm.id)
    return alarm
  }
  const takeIdleVessel = () => {
    const vessel = vessels.find((v) => v.status === 'idle') ?? null
    if (vessel) vessel.status = 'dispatched'
    return vessel
  }

  const activeStatuses: DispatchStatus[] = ['waiting', 'sailing', 'arrived', 'handling']
  const activeMinutes = [6, 18, 34, 52]
  activeStatuses.forEach((status, index) => {
    const alarm = takePendingAlarm()
    const vessel = takeIdleVessel()
    if (!alarm || !vessel) return
    alarm.status = 'processing'
    dispatchOrders.push(buildDispatchOrder({ alarm, vessel, status, dispatchTime: isoMinutesAgo(activeMinutes[index]) }))
  })

  const chainAlarm = takePendingAlarm()
  if (chainAlarm) {
    const firstVessel = takeIdleVessel()
    const secondVessel = takeIdleVessel()
    if (firstVessel && secondVessel) {
      const firstEnd = isoMinutesAgo(100)
      const first = buildDispatchOrder({
        alarm: chainAlarm,
        vessel: firstVessel,
        status: 'finished',
        dispatchTime: isoMinutesAgo(150),
        outcome: 'transfer',
        endTime: firstEnd,
        note: '现场情况复杂，转办至临近执法船',
        durationMinutes: 50,
      })
      firstVessel.status = 'idle'
      dispatchOrders.push(first)
      chainAlarm.status = 'processing'
      dispatchOrders.push(buildDispatchOrder({ alarm: chainAlarm, vessel: secondVessel, status: 'sailing', dispatchTime: firstEnd }))
    }
  }

  const timeoutAlarms = [0, 1, 2].map(() => takePendingAlarm()).filter((alarm): alarm is AlarmEvent => Boolean(alarm))
  timeoutAlarms.forEach((alarm, index) => {
    const vessel = vessels[Math.floor(rng() * vessels.length)] ?? vessels[0]
    const dispatchTime = isoMinutesAgo(420 + index * 210)
    const duration = 75 + index * 15
    alarm.status = 'pending'
    dispatchOrders.push(
      buildDispatchOrder({
        alarm,
        vessel,
        status: 'finished',
        dispatchTime,
        outcome: 'timeout',
        endTime: isoPlusMinutes(dispatchTime, duration),
        note: '超过规定时限，自动结束并退回待处置',
        durationMinutes: duration,
      }),
    )
  })

  const doneCandidates = alarms.filter((a) => (a.status === 'done' || a.status === 'reviewed') && !usedAlarmIds.has(a.id))
  doneCandidates.slice(0, 14).forEach((alarm, index) => {
    const vessel = vessels[Math.floor(rng() * vessels.length)] ?? vessels[0]
    const dispatchTime = isoMinutesAgo(90 + index * 55)
    const duration = Math.max(18, Math.round(50 + rng() * 70))
    alarm.status = 'done'
    dispatchOrders.push(
      buildDispatchOrder({
        alarm,
        vessel,
        status: 'finished',
        dispatchTime,
        outcome: 'done',
        endTime: isoPlusMinutes(dispatchTime, duration),
        note: rng() > 0.5 ? '现场检查完成，告警解除' : '',
        durationMinutes: duration,
      }),
    )
  })

  dispatchOrders.sort((a, b) => b.dispatchTime.localeCompare(a.dispatchTime))
}

function initMaritimeData() {
  if (targets.length > 0 || sourceReports.length > 0 || alarms.length > 0) return
  for (let i = 0; i < CHUAN_TARGETS.length; i += 1) {
    targets.push(buildChuanTarget(CHUAN_TARGETS[i], i))
  }
  generateSourceReports()
  generateTracks()
  generateAlarms()
  buildVessels()
  generateDispatchOrders()
  sim.updatedAt = nowIso()
}

initMaritimeData()

/** 汇总当前目标、来源与告警规模统计。 */
function buildStats(): MaritimeStats {
  return {
    total: targets.length,
    phased: targets.filter((t) => t.sources.includes('phased')).length,
    xband1: targets.filter((t) => t.sources.includes('xband1')).length,
    xband2: targets.filter((t) => t.sources.includes('xband2')).length,
    ais: targets.filter((t) => t.sources.includes('ais')).length,
    framecode: targets.filter((t) => t.sources.includes('framecode')).length,
    offline: targets.filter((t) => t.status === 'offline').length,
    abnormal: targets.filter((t) => t.status === 'abnormal').length,
    alarmPending: alarms.filter((a) => a.status === 'pending').length,
  }
}

/** 查询演示数据层运行状态，供数据维护面板展示。 */
function getMaritimeStatus(): MaritimeStatus {
  return {
    running: sim.running,
    paused: sim.paused,
    simError: sim.simError,
    lastError: sim.lastError,
    updatedAt: sim.updatedAt,
    targetCount: targets.length,
    sourceCount: sourceReports.length,
    trackCount: trackPoints.length,
    alarmCount: alarms.length,
  }
}

function trimTracks() {
  const counts = new Map<string, number>()
  for (let i = trackPoints.length - 1; i >= 0; i -= 1) {
    const point = trackPoints[i]
    const count = counts.get(point.targetId) || 0
    if (count >= MAX_TRACK_POINTS) trackPoints.splice(i, 1)
    else counts.set(point.targetId, count + 1)
  }
}

/** 手动触发一次演示数据刷新，模拟异常时抛出错误并保留最近数据。 */
function refreshData(): MaritimeStats {
  if (sim.simError) {
    sim.simError = false
    sim.lastError = '数据刷新失败，正在使用最近数据'
    throw new Error(sim.lastError)
  }
  sim.lastError = ''
  const now = nowIso()
  sim.updatedAt = now
  const targetById = new Map(targets.map((target) => [target.id, target]))
  for (const target of targets) {
    target.lastUpdate = now
  }
  for (const report of sourceReports) {
    const target = targetById.get(report.targetId)
    if (!target) continue
    report.reportTime = now
    report.lon = target.lon
    report.lat = target.lat
    report.speed = target.speed
    report.course = target.course
  }
  for (const target of targets) {
    if (target.status !== 'online') continue
    trackPoints.push({
      id: makeId('P', ++sim.trackSeq),
      targetId: target.id,
      time: now,
      lon: target.lon,
      lat: target.lat,
      speed: target.speed,
      course: target.course,
    })
  }
  trimTracks()
  return buildStats()
}

/** 暂停或恢复演示数据周期更新。 */
function setPaused(value: boolean) {
  sim.paused = value
  sim.lastError = value ? '演示数据已暂停' : ''
}

/** 注入或清除演示异常，用于验证降级态。 */
function setSimError(value: boolean) {
  sim.simError = value
  sim.lastError = value ? '已注入演示异常，下次刷新将失败' : ''
}

function tickSimulator() {
  if (document.visibilityState === 'hidden') return
  if (sim.paused) return
  sim.lastError = ''
  const now = nowIso()
  for (const target of targets) {
    if (target.status !== 'online') continue
    const step = target.speed * KNOT_DEG_PER_MIN
    const rad = (target.course * Math.PI) / 180
    const cosLat = Math.cos((target.lat * Math.PI) / 180)
    target.lat = clamp(target.lat + step * Math.cos(rad), BOUNDS.minLat, BOUNDS.maxLat)
    target.lon = clamp(target.lon + (step * Math.sin(rad)) / cosLat, BOUNDS.minLon, BOUNDS.maxLon)
    target.course = normalizeCourse(target.course + randRange(-3, 3))
    target.lastUpdate = now
    target.lastPositionTime = now
  }
  const targetById = new Map(targets.map((target) => [target.id, target]))
  for (const report of sourceReports) {
    const target = targetById.get(report.targetId)
    if (!target || target.status !== 'online') continue
    report.reportTime = now
    report.lon = target.lon
    report.lat = target.lat
    report.speed = target.speed
    report.course = target.course
  }
  for (const target of targets) {
    if (target.status !== 'online') continue
    trackPoints.push({
      id: makeId('P', ++sim.trackSeq),
      targetId: target.id,
      time: now,
      lon: target.lon,
      lat: target.lat,
      speed: target.speed,
      course: target.course,
    })
  }
  trimTracks()

  const onlineCandidates = targets.filter((t) => t.status === 'online')
  for (let i = 0; i < Math.min(2, Math.floor(onlineCandidates.length * 0.01)); i += 1) {
    const target = onlineCandidates[Math.floor(rng() * onlineCandidates.length)]
    if (target) target.status = 'offline'
  }
  const offlineCandidates = targets.filter((t) => t.status === 'offline' && t.sources.length > 0)
  for (let i = 0; i < Math.min(2, Math.floor(offlineCandidates.length * 0.05)); i += 1) {
    const target = offlineCandidates[Math.floor(rng() * offlineCandidates.length)]
    if (target) {
      target.status = 'online'
      target.lastUpdate = now
      target.lastPositionTime = now
    }
  }

  if (chance(0.65)) {
    alarms.unshift(createAlarm(0))
    if (alarms.length > MAX_ALARMS) alarms.pop()
  }
  sim.updatedAt = now
  sim.listeners.forEach((cb) => cb())
}

function startSimulator() {
  if (sim.running) return
  sim.running = true
  sim.timer = setInterval(tickSimulator, TICK_MS)
}

function stopSimulator() {
  if (!sim.running) return
  sim.running = false
  if (sim.timer) clearInterval(sim.timer)
  sim.timer = null
}

/** 订阅演示数据周期更新，返回取消订阅函数。 */
export function subscribeMaritimeUpdates(cb: () => void): () => void {
  if (sim.listeners.size >= MAX_LISTENERS) sim.listeners.clear()
  sim.listeners.add(cb)
  startSimulator()
  return () => {
    sim.listeners.delete(cb)
    if (sim.listeners.size === 0) stopSimulator()
  }
}

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    stopSimulator()
    sim.listeners.clear()
    const record = window as unknown as Record<string, SimulatorState | undefined>
    if (record[STATE_KEY] === sim) record[STATE_KEY] = undefined
  })
}

/** 返回全部融合目标的只读视图。 */
export function getTargets() {
  return targets
}

/** 返回全部来源上报记录的只读视图。 */
export function getSourceReports() {
  return sourceReports
}

/** 返回全部轨迹点的只读视图。 */
export function getTrackPoints() {
  return trackPoints
}

/** 返回全部告警事件的只读视图。 */
export function getAlarms() {
  return alarms
}

/** 返回全部执法船资源的只读视图。 */
export function getLawVessels() {
  return vessels
}

/** 返回全部智能执法派单的只读视图。 */
export function getDispatchOrders() {
  return dispatchOrders
}

/** 当前系统时间 ISO 字符串，供派单流转写入时间线。 */
export function currentTimeIso() {
  return nowIso()
}

/** 创建并写入一条派单记录，返回完整派单对象。 */
export function createDispatchOrderRecord(input: {
  alarm: AlarmEvent
  vessel: EnforcementVessel
  status: DispatchStatus
  dispatchTime?: string
  outcome?: DispatchOutcome | null
  endTime?: string | null
  note?: string
  durationMinutes?: number | null
}): DispatchOrder {
  const order = buildDispatchOrder({
    alarm: input.alarm,
    vessel: input.vessel,
    status: input.status,
    dispatchTime: input.dispatchTime || nowIso(),
    outcome: input.outcome,
    endTime: input.endTime,
    note: input.note,
    durationMinutes: input.durationMinutes,
  })
  dispatchOrders.unshift(order)
  return order
}

/** 更新一条派单记录，返回更新后的派单对象。 */
export function updateDispatchOrder(id: string, patch: Partial<DispatchOrder>): DispatchOrder {
  const order = dispatchOrders.find((item) => item.id === id)
  if (!order) throw new Error('派单不存在')
  Object.assign(order, patch)
  return order
}

/** 更新执法船占用状态。 */
export function setVesselStatus(id: string, status: EnforcementVesselStatus) {
  const vessel = vessels.find((item) => item.id === id)
  if (vessel) vessel.status = status
}

export { buildStats, getMaritimeStatus, refreshData, setPaused, setSimError }
