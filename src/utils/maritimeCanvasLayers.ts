/** 海图 Canvas 图层渲染：底图、网格、区划、雷达、光电、区域、船只与工具图层。 */
import type {
  AlarmLevel,
  EoDevice,
  FenceZone,
  FusionTarget,
  LatLng,
  LayerState,
  MapMode,
  MonitorCategory,
  TargetStyleState,
  TrackPoint,
} from '@/types/maritime'
import { EO_DEVICES, FENCE_ZONES } from '@/mock/maritime/monitor'
import { MARITIME_GEO_FEATURES, RADAR_STATIONS } from '@/utils/maritimeGeography'
import normalMarkerUrl from '@/assets/maritime/marker-normal.svg'
import sanwuMarkerUrl from '@/assets/maritime/marker-sanwu.svg'
import {
  MARKER_RADIUS,
  TARGET_MARKER_SIZE,
  TARGET_TYPE_COLORS,
  clusterRadius,
} from '@/utils/maritimeMapTheme'
import { distanceMeters } from '@/utils/geo'

const KM_PER_DEG = 111.32

const ZONE_LEVEL_COLORS: Record<
  AlarmLevel,
  { fill: string; stroke: string; activeFill: string; activeStroke: string; text: string }
> = {
  urgent: {
    fill: 'rgba(255, 138, 107, 0.10)',
    stroke: 'rgba(255, 138, 107, 0.52)',
    activeFill: 'rgba(255, 138, 107, 0.24)',
    activeStroke: '#ffb49e',
    text: 'rgba(255, 200, 182, 0.92)',
  },
  important: {
    fill: 'rgba(255, 209, 102, 0.10)',
    stroke: 'rgba(255, 209, 102, 0.52)',
    activeFill: 'rgba(255, 209, 102, 0.24)',
    activeStroke: '#ffe2a1',
    text: 'rgba(255, 233, 184, 0.92)',
  },
  normal: {
    fill: 'rgba(86, 204, 255, 0.10)',
    stroke: 'rgba(86, 204, 255, 0.52)',
    activeFill: 'rgba(86, 204, 255, 0.24)',
    activeStroke: '#9fdcff',
    text: 'rgba(196, 234, 255, 0.92)',
  },
}

const TARGET_MARKER_URLS: Record<FusionTarget['type'], string> = {
  normal: normalMarkerUrl,
  sanwu: sanwuMarkerUrl,
}

const targetMarkers: Partial<Record<FusionTarget['type'], HTMLImageElement>> = {}

function getTargetMarker(type: FusionTarget['type']): HTMLImageElement | null {
  const image = targetMarkers[type]
  return image && image.complete && image.naturalWidth > 0 ? image : null
}

export function preloadTargetMarkers(onReady: () => void): void {
  let pending = 0
  const track = (image: HTMLImageElement) => {
    if (image.complete) return
    pending += 1
    const finish = () => {
      pending -= 1
      if (pending === 0) onReady()
    }
    image.onload = finish
    image.onerror = finish
  }
  for (const type of ['normal', 'sanwu'] as FusionTarget['type'][]) {
    const cached = targetMarkers[type]
    if (cached) {
      track(cached)
      continue
    }
    if (typeof Image === 'undefined') continue
    const image = new Image()
    image.src = TARGET_MARKER_URLS[type]
    targetMarkers[type] = image
    track(image)
  }
  if (pending === 0) onReady()
}

export interface ScreenTarget {
  target: FusionTarget
  x: number
  y: number
}

export interface ScreenEoDevice {
  device: EoDevice
  x: number
  y: number
}

export interface ScreenZone {
  zone: FenceZone
  points: Array<{ x: number; y: number }>
  x: number
  y: number
}

export interface ScreenCluster {
  targets: FusionTarget[]
  x: number
  y: number
}

export type ScreenItem = ScreenTarget | ScreenCluster

export interface MapLayerContext {
  ctx: CanvasRenderingContext2D
  width: number
  height: number
  zoom: number
  project: (point: LatLng) => { x: number; y: number }
  unproject: (x: number, y: number) => LatLng
  targets: FusionTarget[]
  layers: LayerState
  targetStyle: TargetStyleState
  mode: MapMode
  measurePoints: LatLng[]
  pickedPoint: LatLng | null
  highlightId: string | null
  selectedId: string | null
  selectedTrack: TrackPoint[]
  eoDevices: EoDevice[]
  zones: FenceZone[]
  selectedCategory: MonitorCategory | null
  selectedCategoryId: string | null
}

export function isCluster(item: ScreenItem): item is ScreenCluster {
  return 'targets' in item
}

export function buildScreenItems(
  targets: FusionTarget[],
  project: (point: LatLng) => { x: number; y: number },
  zoom: number,
): ScreenItem[] {
  const items: ScreenTarget[] = targets.map((target) => ({
    target,
    ...project(target),
  }))
  if (items.length < 50 || zoom >= 2.8) return items

  const cellSize = Math.max(24, 46 / Math.max(1, zoom * 0.7))
  const groups = new Map<string, ScreenTarget[]>()
  for (const item of items) {
    const key = `${Math.floor(item.x / cellSize)}:${Math.floor(item.y / cellSize)}`
    const list = groups.get(key)
    if (list) list.push(item)
    else groups.set(key, [item])
  }
  return Array.from(groups.values()).map((list) => {
    if (list.length === 1) return list[0]
    return {
      targets: list.map((item) => item.target),
      x: list.reduce((sum, item) => sum + item.x, 0) / list.length,
      y: list.reduce((sum, item) => sum + item.y, 0) / list.length,
    }
  })
}

export function buildEoScreenItems(
  devices: EoDevice[],
  project: (point: LatLng) => { x: number; y: number },
): ScreenEoDevice[] {
  return devices.map((device) => ({ device, ...project(device) }))
}

export function buildZoneScreenItems(
  zones: FenceZone[],
  project: (point: LatLng) => { x: number; y: number },
): ScreenZone[] {
  return zones.map((zone) => {
    const geoPoints = zonePolygon(zone)
    const points = geoPoints.map((point) => project(point))
    const center = project(zone)
    return {
      zone,
      points,
      x: center.x,
      y: center.y,
    }
  })
}

function zonePolygon(zone: FenceZone): LatLng[] {
  let seed = 0
  for (const char of zone.id) seed = (seed * 31 + char.charCodeAt(0)) % 997
  const skew = (seed % 100) / 100
  const cosLat = Math.cos((zone.lat * Math.PI) / 180)
  const count = 8
  return Array.from({ length: count }, (_, index) => {
    const angle = (Math.PI * 2 * index) / count + skew * 1.1
    const radius = zone.radiusKm * (0.68 + 0.32 * Math.abs(Math.sin(seed + index * 2.3)))
    return {
      lon: zone.lon + (Math.cos(angle) * radius) / (KM_PER_DEG * cosLat),
      lat: zone.lat + (Math.sin(angle) * radius) / KM_PER_DEG,
    }
  })
}

export function drawOcean(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const gradient = ctx.createLinearGradient(0, 0, width, height)
  gradient.addColorStop(0, '#04121f')
  gradient.addColorStop(0.5, '#071d30')
  gradient.addColorStop(1, '#04121f')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, width, height)

  ctx.save()
  ctx.strokeStyle = 'rgba(56, 198, 255, 0.05)'
  ctx.lineWidth = 1
  for (let i = 1; i <= 5; i += 1) {
    const offset = Math.min(width, height) * 0.09 * i
    ctx.beginPath()
    ctx.ellipse(width / 2, height / 2, width / 2 - offset, height / 2 - offset, 0, 0, Math.PI * 2)
    ctx.stroke()
  }
  ctx.restore()
}

export function drawGrid(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  unproject: (x: number, y: number) => LatLng,
) {
  const step = 48
  ctx.save()
  ctx.strokeStyle = 'rgba(64, 157, 255, 0.08)'
  ctx.lineWidth = 1
  for (let x = step; x < width; x += step) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, height)
    ctx.stroke()
  }
  for (let y = step; y < height; y += step) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(width, y)
    ctx.stroke()
  }

  ctx.fillStyle = 'rgba(143, 176, 208, 0.55)'
  ctx.font = '11px "PingFang SC", sans-serif'
  ctx.textAlign = 'center'
  const labelGap = step * 4
  for (let x = labelGap; x < width; x += labelGap) {
    const point = unproject(x, height / 2)
    ctx.fillText(`${point.lon.toFixed(2)}°E`, x, height - 8)
  }
  for (let y = labelGap; y < height; y += labelGap) {
    const point = unproject(width / 2, y)
    ctx.fillText(`${point.lat.toFixed(2)}°N`, 34, y)
  }
  ctx.restore()
}

export function drawDistricts(
  ctx: CanvasRenderingContext2D,
  project: (point: LatLng) => { x: number; y: number },
) {
  ctx.save()
  for (const feature of MARITIME_GEO_FEATURES) {
    if (feature.kind === 'label') {
      if (!feature.label) continue
      const point = project(feature.label)
      ctx.fillStyle = 'rgba(143, 176, 208, 0.72)'
      ctx.font = '13px "PingFang SC", sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(feature.name, point.x, point.y)
      continue
    }
    const points = feature.points || []
    if (points.length < 2) continue
    ctx.beginPath()
    points.forEach((point, index) => {
      const projected = project(point)
      if (index === 0) ctx.moveTo(projected.x, projected.y)
      else ctx.lineTo(projected.x, projected.y)
    })
    if (feature.kind === 'island') {
      ctx.closePath()
      ctx.fillStyle = 'rgba(16, 38, 58, 0.85)'
      ctx.fill()
      ctx.strokeStyle = 'rgba(92, 166, 220, 0.5)'
    } else {
      ctx.strokeStyle = 'rgba(64, 157, 255, 0.38)'
      ctx.setLineDash([6, 6])
    }
    ctx.lineWidth = 1.2
    ctx.stroke()
    ctx.setLineDash([])
  }
  ctx.restore()
}

export function drawRadar(
  ctx: CanvasRenderingContext2D,
  project: (point: LatLng) => { x: number; y: number },
) {
  ctx.save()
  for (const station of RADAR_STATIONS) {
    const point = project(station)
    const cosLat = Math.cos((station.lat * Math.PI) / 180)
    const edgeX = project({ lon: station.lon + station.radiusKm / (KM_PER_DEG * cosLat), lat: station.lat })
    const edgeY = project({ lon: station.lon, lat: station.lat - station.radiusKm / KM_PER_DEG })
    const radiusX = Math.abs(edgeX.x - point.x)
    const radiusY = Math.abs(edgeY.y - point.y)
    const gradient = ctx.createRadialGradient(point.x, point.y, 0, point.x, point.y, Math.max(radiusX, radiusY))
    gradient.addColorStop(0, 'rgba(56, 198, 255, 0.18)')
    gradient.addColorStop(0.8, 'rgba(56, 198, 255, 0.04)')
    gradient.addColorStop(1, 'rgba(56, 198, 255, 0)')
    ctx.fillStyle = gradient
    ctx.beginPath()
    ctx.ellipse(point.x, point.y, radiusX, radiusY, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = 'rgba(56, 198, 255, 0.4)'
    ctx.setLineDash([7, 7])
    ctx.beginPath()
    ctx.ellipse(point.x, point.y, radiusX, radiusY, 0, 0, Math.PI * 2)
    ctx.stroke()
    ctx.setLineDash([])
  }
  ctx.restore()
}

export function drawRadarStations(ctx: CanvasRenderingContext2D, context: MapLayerContext) {
  ctx.save()
  for (const station of RADAR_STATIONS) {
    const point = context.project(station)
    const active = context.selectedCategory === 'radar' && context.selectedCategoryId === station.id
    const color = active ? '#ffd166' : '#38c6ff'

    if (active) {
      ctx.strokeStyle = color
      ctx.globalAlpha = 0.65
      ctx.lineWidth = 1.4
      ctx.beginPath()
      ctx.arc(point.x, point.y, 15, 0, Math.PI * 2)
      ctx.stroke()
      ctx.globalAlpha = 1
    }

    ctx.fillStyle = 'rgba(3, 14, 24, 0.9)'
    ctx.strokeStyle = color
    ctx.lineWidth = 1.8
    ctx.beginPath()
    ctx.arc(point.x, point.y, 7, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()

    ctx.strokeStyle = color
    ctx.lineWidth = 1.2
    for (let i = 0; i < 3; i += 1) {
      const angle = -Math.PI / 2 + (i - 1) * 0.46
      ctx.beginPath()
      ctx.moveTo(point.x, point.y)
      ctx.lineTo(point.x + Math.cos(angle) * 10, point.y + Math.sin(angle) * 10)
      ctx.stroke()
    }

    ctx.fillStyle = active ? '#ffd166' : 'rgba(143, 176, 208, 0.92)'
    ctx.font = '11px "PingFang SC", sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(station.name, point.x, point.y + 22)
  }
  ctx.restore()
}

export function drawZones(ctx: CanvasRenderingContext2D, context: MapLayerContext) {
  const zones = context.zones.length > 0 ? context.zones : FENCE_ZONES
  ctx.save()
  for (const item of buildZoneScreenItems(zones, context.project)) {
    const zone = item.zone
    const active = context.selectedCategory === 'fence' && context.selectedCategoryId === zone.id
    const color = ZONE_LEVEL_COLORS[zone.alarmLevel] ?? ZONE_LEVEL_COLORS.normal
    ctx.beginPath()
    item.points.forEach((point, index) => {
      if (index === 0) ctx.moveTo(point.x, point.y)
      else ctx.lineTo(point.x, point.y)
    })
    ctx.closePath()
    ctx.fillStyle = active ? color.activeFill : color.fill
    ctx.fill()
    ctx.strokeStyle = active ? color.activeStroke : color.stroke
    ctx.lineWidth = active ? 1.8 : 1.2
    ctx.setLineDash([7, 5])
    ctx.stroke()
    ctx.setLineDash([])

    ctx.fillStyle = active ? color.activeStroke : color.text
    ctx.font = '12px "PingFang SC", sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(zone.name, item.x, item.y - 8)
  }
  ctx.restore()
}

export function drawZoneMarkers(ctx: CanvasRenderingContext2D, context: MapLayerContext) {
  const zones = context.zones.length > 0 ? context.zones : FENCE_ZONES
  ctx.save()
  for (const zone of zones) {
    const point = context.project(zone)
    const active = context.selectedCategory === 'fence' && context.selectedCategoryId === zone.id
    const color = ZONE_LEVEL_COLORS[zone.alarmLevel] ?? ZONE_LEVEL_COLORS.normal
    ctx.save()
    ctx.translate(point.x, point.y)
    ctx.rotate(Math.PI / 4)
    ctx.fillStyle = 'rgba(3, 14, 24, 0.88)'
    ctx.strokeStyle = active ? color.activeStroke : color.stroke
    ctx.lineWidth = active ? 1.8 : 1.2
    ctx.fillRect(-5, -5, 10, 10)
    ctx.strokeRect(-5, -5, 10, 10)
    ctx.restore()
  }
  ctx.restore()
}

export function drawEoDevices(ctx: CanvasRenderingContext2D, context: MapLayerContext) {
  const devices = context.eoDevices.length > 0 ? context.eoDevices : EO_DEVICES
  ctx.save()
  for (const item of buildEoScreenItems(devices, context.project)) {
    const device = item.device
    const color = device.online ? '#35e0a8' : '#8296a8'
    const active = context.selectedCategory === 'eo' && context.selectedCategoryId === device.id

    if (active) {
      ctx.strokeStyle = color
      ctx.globalAlpha = 0.55
      ctx.lineWidth = 1.4
      ctx.beginPath()
      ctx.arc(item.x, item.y, 11, 0, Math.PI * 2)
      ctx.stroke()
      ctx.globalAlpha = 1
    }

    ctx.save()
    ctx.translate(item.x, item.y)
    ctx.fillStyle = 'rgba(3, 14, 24, 0.88)'
    ctx.strokeStyle = color
    ctx.lineWidth = 1.6
    ctx.fillRect(-5, -4.2, 10, 8.4)
    ctx.strokeRect(-5, -4.2, 10, 8.4)
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.arc(0, 0, 2.1, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()

    if (context.zoom >= 2.8) {
      ctx.fillStyle = 'rgba(143, 176, 208, 0.85)'
      ctx.font = '11px "PingFang SC", sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(device.name, item.x, item.y + 18)
    }
  }
  ctx.restore()
}

export function drawCluster(ctx: CanvasRenderingContext2D, cluster: ScreenCluster) {
  const radius = clusterRadius(cluster.targets.length)
  const gradient = ctx.createRadialGradient(cluster.x, cluster.y, 0, cluster.x, cluster.y, radius)
  gradient.addColorStop(0, 'rgba(56, 198, 255, 0.42)')
  gradient.addColorStop(1, 'rgba(56, 198, 255, 0.08)')
  ctx.fillStyle = gradient
  ctx.beginPath()
  ctx.arc(cluster.x, cluster.y, radius, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = 'rgba(88, 216, 255, 0.9)'
  ctx.lineWidth = 1.5
  ctx.stroke()
  ctx.fillStyle = '#eaf8ff'
  ctx.font = 'bold 12px "PingFang SC", sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(String(cluster.targets.length), cluster.x, cluster.y)
  ctx.textBaseline = 'alphabetic'
}

const TRACK_LINE_COLOR = '#38c6ff'

const TRACK_MOTION_COLORS: Record<string, string> = {
  '停': '#f5b84b',
  '慢': '#38c6ff',
  '快': '#35e0a8',
  '加速': '#ff8f6b',
  '减速': '#ff6b81',
}

export function trackTimeLabelEvery(zoom: number) {
  return zoom >= 4 ? 1 : zoom >= 2.8 ? 3 : 6
}

export function formatTrackTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

export function trackMotionStatus(point: TrackPoint, previous: TrackPoint | null): string | null {
  const stopped = point.speed < 0.5
  if (stopped) return '停'
  if (previous) {
    const delta = point.speed - previous.speed
    if (delta > 0.5) return '加速'
    if (delta < -0.5) return '减速'
  }
  if (point.speed >= 12) return '快'
  if (point.speed < 8) return '慢'
  return null
}

export interface TrackTimeLabelBox {
  text: string
  x: number
  y: number
  width: number
  height: number
}

export function buildTrackTimeLabel(
  point: TrackPoint,
  index: number,
  total: number,
  projected: { x: number; y: number },
  zoom: number,
): TrackTimeLabelBox | null {
  const labelEvery = trackTimeLabelEvery(zoom)
  if (index % labelEvery !== 0 && index !== total - 1) return null
  const text = formatTrackTime(point.time)
  const height = 12
  const above = index % 2 === 0
  const width = text.length * 6 + 10
  return {
    text,
    x: projected.x - width / 2,
    y: above ? projected.y - 20 : projected.y + 10,
    width,
    height,
  }
}

function drawTrackArrow(ctx: CanvasRenderingContext2D, from: { x: number; y: number }, to: { x: number; y: number }) {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const length = Math.hypot(dx, dy)
  if (length < 8) return
  const angle = Math.atan2(dy, dx)
  const headLength = Math.min(9, length * 0.38)
  ctx.save()
  ctx.translate(from.x + dx * 0.5, from.y + dy * 0.5)
  ctx.rotate(angle)
  ctx.beginPath()
  ctx.moveTo(headLength, 0)
  ctx.lineTo(-headLength * 0.62, -headLength * 0.56)
  ctx.lineTo(-headLength * 0.62, headLength * 0.56)
  ctx.closePath()
  ctx.fillStyle = TRACK_LINE_COLOR
  ctx.fill()
  ctx.restore()
}

/** 绘制选中目标的最近航迹：细线连接至当前船位，每段画航行箭头并标注点时间。 */
export function drawTargetTrack(ctx: CanvasRenderingContext2D, context: MapLayerContext) {
  const selectedId = context.selectedId
  const track = context.selectedTrack
  if (!selectedId || track.length === 0) return
  const target = context.targets.find((item) => item.id === selectedId)
  const points = track.map((point) => context.project(point))
  if (target) {
    const latest = track[track.length - 1]
    const connected =
      latest && Math.abs(latest.lon - target.lon) < 1e-9 && Math.abs(latest.lat - target.lat) < 1e-9
    if (!connected) points.push(context.project(target))
  }
  if (points.length < 2) return

  ctx.save()
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.strokeStyle = TRACK_LINE_COLOR
  ctx.globalAlpha = 0.85
  ctx.lineWidth = 1.4
  ctx.beginPath()
  points.forEach((point, index) => {
    if (index === 0) ctx.moveTo(point.x, point.y)
    else ctx.lineTo(point.x, point.y)
  })
  ctx.stroke()

  ctx.globalAlpha = 1
  for (let index = 0; index < points.length - 1; index += 1) {
    drawTrackArrow(ctx, points[index], points[index + 1])
  }

  let previousTrackPoint: TrackPoint | null = null
  let previousStatus: string | null = null
  track.forEach((point, index) => {
    const projected = points[index]
    const isLatest = index === track.length - 1
    ctx.fillStyle = 'rgba(3, 14, 24, 0.9)'
    ctx.strokeStyle = TRACK_LINE_COLOR
    ctx.lineWidth = isLatest ? 1.5 : 1.1
    ctx.beginPath()
    ctx.arc(projected.x, projected.y, isLatest ? 3.6 : 2.4, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()

    const label = buildTrackTimeLabel(point, index, track.length, projected, context.zoom)
    if (label) {
      ctx.font = '10px "PingFang SC", sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillStyle = 'rgba(3, 14, 24, 0.78)'
      ctx.fillRect(label.x, label.y, label.width, label.height)
      ctx.fillStyle = '#dff3ff'
      ctx.fillText(label.text, label.x + label.width / 2, label.y + label.height / 2)
    }

    const status = trackMotionStatus(point, previousTrackPoint)
    if (status && previousTrackPoint && status !== previousStatus) {
      const color = TRACK_MOTION_COLORS[status] ?? '#dff3ff'
      const above = index % 2 === 0
      const statusY = above ? projected.y + 24 : projected.y - 36
      const statusWidth = status.length * 12 + 10
      ctx.font = '10px "PingFang SC", sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillStyle = 'rgba(3, 14, 24, 0.85)'
      ctx.fillRect(projected.x - statusWidth / 2, statusY, statusWidth, 12)
      ctx.strokeStyle = color
      ctx.lineWidth = 1
      ctx.strokeRect(projected.x - statusWidth / 2, statusY, statusWidth, 12)
      ctx.fillStyle = color
      ctx.fillText(status, projected.x, statusY + 6)
    }
    previousStatus = status
    previousTrackPoint = point
  })
  ctx.textBaseline = 'alphabetic'
  ctx.restore()
}

export function drawTarget(ctx: CanvasRenderingContext2D, context: MapLayerContext, target: FusionTarget) {
  const point = context.project(target)
  const markerSize = TARGET_MARKER_SIZE[context.targetStyle.markerSize]
  const color = TARGET_TYPE_COLORS[target.type]
  const active = context.highlightId === target.id || context.selectedId === target.id
  const marker = getTargetMarker(target.type)

  if (active) {
    ctx.save()
    ctx.strokeStyle = color
    ctx.globalAlpha = 0.55
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.arc(point.x, point.y, Math.max(MARKER_RADIUS[context.targetStyle.markerSize] + 8, markerSize * 0.62), 0, Math.PI * 2)
    ctx.stroke()
    ctx.restore()
  }

  if (marker) {
    ctx.save()
    ctx.translate(point.x, point.y)
    ctx.rotate(((target.course - 180) * Math.PI) / 180)
    ctx.drawImage(marker, -markerSize / 2, -markerSize, markerSize, markerSize)
    ctx.restore()
    return
  }

  const radius = MARKER_RADIUS[context.targetStyle.markerSize]
  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(point.x, point.y, radius, 0, Math.PI * 2)
  ctx.stroke()
  ctx.fillStyle = 'rgba(3, 14, 24, 0.85)'
  ctx.fill()
  ctx.restore()
}

export function drawTargets(ctx: CanvasRenderingContext2D, context: MapLayerContext) {
  for (const item of buildScreenItems(context.targets, context.project, context.zoom)) {
    if (isCluster(item)) drawCluster(ctx, item)
    else {
      const dimmed = Boolean(context.selectedId) && item.target.id !== context.selectedId
      ctx.save()
      if (dimmed) {
        const hovered = context.highlightId === item.target.id
        ctx.globalAlpha = hovered ? 0.7 : 0.35
      }
      drawTarget(ctx, context, item.target)
      ctx.restore()
    }
  }
}

export function drawMeasure(
  ctx: CanvasRenderingContext2D,
  project: (point: LatLng) => { x: number; y: number },
  points: LatLng[],
) {
  if (points.length === 0) return
  ctx.save()
  ctx.strokeStyle = 'rgba(245, 184, 75, 0.9)'
  ctx.lineWidth = 1.8
  ctx.setLineDash([])
  for (let i = 1; i < points.length; i += 1) {
    const from = project(points[i - 1])
    const to = project(points[i])
    ctx.beginPath()
    ctx.moveTo(from.x, from.y)
    ctx.lineTo(to.x, to.y)
    ctx.stroke()
    const meters = distanceMeters(points[i - 1], points[i])
    ctx.fillStyle = '#fdf3da'
    ctx.font = '11px "PingFang SC", sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(meters >= 1000 ? `${(meters / 1000).toFixed(2)} km` : `${Math.round(meters)} m`, (from.x + to.x) / 2, (from.y + to.y) / 2 - 6)
  }
  for (const point of points) {
    const projected = project(point)
    ctx.fillStyle = '#f5b84b'
    ctx.beginPath()
    ctx.arc(projected.x, projected.y, 4, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = '#fff7e8'
    ctx.lineWidth = 1
    ctx.stroke()
  }
  ctx.restore()
}

export function drawPickPoint(
  ctx: CanvasRenderingContext2D,
  project: (point: LatLng) => { x: number; y: number },
  point: LatLng,
) {
  const projected = project(point)
  ctx.save()
  ctx.strokeStyle = 'rgba(56, 198, 255, 0.9)'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(projected.x - 9, projected.y)
  ctx.lineTo(projected.x + 9, projected.y)
  ctx.moveTo(projected.x, projected.y - 9)
  ctx.lineTo(projected.x, projected.y + 9)
  ctx.stroke()
  ctx.restore()
}
