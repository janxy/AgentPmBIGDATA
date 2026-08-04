/** 演示数据内存状态：生成、定时模拟与周期订阅，界面只读展示。 */
import type {
  AlarmEvent,
  AlarmLevel,
  AlarmType,
  DisposeStatus,
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

const TARGET_COUNT = 20
const TRACK_PER_TARGET = 20
const ALARM_COUNT = 80
const TICK_MS = 10000
const MAX_ALARMS = 100
const MAX_TRACK_POINTS = 40
const MAX_LISTENERS = 12
const BOUNDS = JURISDICTION_BOUNDS

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
    }
  }
  return record[STATE_KEY] as SimulatorState
}

const NAME_PREFIXES = [
  '海巡', '远洋', '深蓝', '振华', '东望', '长兴', '舟山', '临港', '洋山', '崇明',
  '浦江', '东海', '中远', '招商', '宏图', '安澜', '华海', '海通', '恒泰', '联丰',
]
const NAME_SUFFIXES = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10']
const NATIONALITIES = ['中国', '中国香港', '巴拿马', '利比里亚', '马绍尔群岛', '新加坡']
const TYPE_WEIGHTS: Array<[TargetType, number]> = [
  ['normal', 0.78],
  ['sanwu', 0.22],
]
const STATUS_WEIGHTS: Array<[TargetStatus, number]> = [
  ['online', 0.8],
  ['offline', 0.12],
  ['abnormal', 0.08],
]
const QUALITY_WEIGHTS: Array<['high' | 'medium' | 'low', number]> = [
  ['high', 0.65],
  ['medium', 0.25],
  ['low', 0.1],
]
const SOURCE_POOL: TargetSource[] = ['phased', 'xband1', 'xband2', 'ais', 'framecode']
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

const targets: FusionTarget[] = []
const sourceReports: SourceReport[] = []
const trackPoints: TrackPoint[] = []
const alarms: AlarmEvent[] = []
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

function weighted<T extends string>(weights: Array<[T, number]>): T {
  let roll = rng()
  for (const [value, weight] of weights) {
    if (roll < weight) return value
    roll -= weight
  }
  return weights[weights.length - 1][0]
}

function randomSources(): TargetSource[] {
  if (chance(0.015)) return []
  // 多数目标多源融合，保证五类来源均有覆盖。
  const count = 5 - (chance(0.05) ? 1 : 0) - (chance(0.1) ? 1 : 0)
  const pool = [...SOURCE_POOL]
  const result: TargetSource[] = []
  for (let i = 0; i < count && pool.length > 0; i += 1) {
    result.push(pool.splice(Math.floor(rng() * pool.length), 1)[0])
  }
  return result
}

function buildTarget(index: number): FusionTarget {
  const type = weighted(TYPE_WEIGHTS)
  const suffix = pick(NAME_SUFFIXES)
  const name = type === 'sanwu' ? `三无${suffix}` : `${pick(NAME_PREFIXES)}${suffix}`
  const sources = randomSources()
  const baseSpeed = type === 'sanwu' ? randRange(0, 10) : randRange(6, 18)
  const status = sources.length === 0 ? 'offline' : weighted(STATUS_WEIGHTS)
  return {
    id: makeId('T', index + 1),
    name,
    mmsi: type === 'sanwu' ? '' : `412${String(Math.floor(randRange(1000000, 9999999)))}`,
    callSign: type === 'sanwu' ? '---' : `${pick(['B', 'A', 'C', 'D'])}${Math.floor(randRange(1000, 9999))}`,
    type,
    nationality: type === 'sanwu' ? '未知' : pick(NATIONALITIES),
    length: Math.round(randRange(20, 300)),
    width: Math.round(randRange(6, 45)),
    draft: Number(randRange(2, 18).toFixed(1)),
    lon: randRange(BOUNDS.minLon, BOUNDS.maxLon),
    lat: randRange(BOUNDS.minLat, BOUNDS.maxLat),
    speed: Number(baseSpeed.toFixed(1)),
    course: normalizeCourse(randRange(0, 360)),
    status,
    sources,
    lastUpdate: isoMinutesAgo(Math.floor(randRange(0, 30))),
    lastPositionTime: isoMinutesAgo(Math.floor(randRange(0, 30))),
  }
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
    for (let i = TRACK_PER_TARGET; i >= 1; i -= 1) {
      const step = ((target.speed / 60) * 0.12 * i) / 60
      trackPoints.push({
        id: makeId('P', ++sim.trackSeq),
        targetId: target.id,
        time: isoMinutesAgo(i * 2),
        lon: clamp(target.lon - (step * Math.sin(rad)) / cosLat + randRange(-0.002, 0.002), BOUNDS.minLon, BOUNDS.maxLon),
        lat: clamp(target.lat - step * Math.cos(rad) + randRange(-0.002, 0.002), BOUNDS.minLat, BOUNDS.maxLat),
        speed: Number(Math.max(0, target.speed + randRange(-2, 2)).toFixed(1)),
        course: normalizeCourse(target.course + randRange(-20, 20)),
      })
    }
  }
}

function createAlarm(minutesAgo = 0): AlarmEvent {
  const target = pick(targets)
  const type = pick(ALARM_TYPES)
  return {
    id: makeId('A', ++sim.alarmSeq),
    type,
    level: weighted(ALARM_LEVEL_WEIGHTS),
    targetId: target.id,
    targetName: target.name,
    targetMmsi: target.mmsi,
    lon: target.lon,
    lat: target.lat,
    occurredAt: isoMinutesAgo(minutesAgo),
    status: weighted(DISPOSE_WEIGHTS),
    description: `${target.name}${ALARM_DESCRIPTIONS[type]}`,
  }
}

function generateAlarms() {
  for (let i = 0; i < ALARM_COUNT; i += 1) {
    alarms.push(createAlarm(Math.floor(randRange(5, 60 * 24))))
  }
  alarms.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
}

function initMaritimeData() {
  if (targets.length > 0 || sourceReports.length > 0 || alarms.length > 0) return
  for (let i = 0; i < TARGET_COUNT; i += 1) {
    targets.push(buildTarget(i))
  }
  generateSourceReports()
  generateTracks()
  generateAlarms()
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
    const step = (target.speed / 60) * 0.12
    const rad = (target.course * Math.PI) / 180
    const cosLat = Math.cos((target.lat * Math.PI) / 180)
    target.lat = clamp(target.lat + (step * Math.cos(rad)) / 60, BOUNDS.minLat, BOUNDS.maxLat)
    target.lon = clamp(target.lon + (step * Math.sin(rad)) / (60 * cosLat), BOUNDS.minLon, BOUNDS.maxLon)
    target.course = normalizeCourse(target.course + randRange(-2.5, 2.5))
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

export { buildStats, getMaritimeStatus, refreshData, setPaused, setSimError }
