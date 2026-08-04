/** 海图 Canvas 图层渲染：底图、网格、区划、雷达、光电、区域、船只与工具图层。 */
import type {
  EoDevice,
  FenceZone,
  FusionTarget,
  LatLng,
  LayerState,
  MapMode,
  MonitorCategory,
  TargetStyleState,
} from '@/types/maritime'
import { EO_DEVICES, FENCE_ZONES } from '@/mock/maritime/monitor'
import { MARITIME_GEO_FEATURES, RADAR_STATIONS } from '@/utils/maritimeGeography'
import {
  MARKER_RADIUS,
  STATUS_COLORS,
  clusterRadius,
} from '@/utils/maritimeMapTheme'
import { distanceMeters } from '@/utils/geo'

const KM_PER_DEG = 111.32

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
    ctx.beginPath()
    item.points.forEach((point, index) => {
      if (index === 0) ctx.moveTo(point.x, point.y)
      else ctx.lineTo(point.x, point.y)
    })
    ctx.closePath()
    ctx.fillStyle = active ? 'rgba(245, 184, 75, 0.32)' : 'rgba(245, 184, 75, 0.12)'
    ctx.fill()
    ctx.strokeStyle = active ? '#f5b84b' : 'rgba(245, 184, 75, 0.72)'
    ctx.lineWidth = active ? 2 : 1.4
    ctx.setLineDash([7, 5])
    ctx.stroke()
    ctx.setLineDash([])

    ctx.fillStyle = active ? '#fde9bd' : 'rgba(245, 184, 75, 0.95)'
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
    ctx.save()
    ctx.translate(point.x, point.y)
    ctx.rotate(Math.PI / 4)
    ctx.fillStyle = 'rgba(3, 14, 24, 0.88)'
    ctx.strokeStyle = active ? '#f5b84b' : 'rgba(245, 184, 75, 0.9)'
    ctx.lineWidth = active ? 2 : 1.5
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

export function drawTarget(ctx: CanvasRenderingContext2D, context: MapLayerContext, target: FusionTarget) {
  const point = context.project(target)
  const radius = MARKER_RADIUS[context.targetStyle.markerSize]
  const color = STATUS_COLORS[target.status]
  const active = context.highlightId === target.id || context.selectedId === target.id

  if (active) {
    ctx.save()
    ctx.strokeStyle = color
    ctx.globalAlpha = 0.55
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.arc(point.x, point.y, radius + 8, 0, Math.PI * 2)
    ctx.stroke()
    ctx.restore()
  }

  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(point.x, point.y, radius, 0, Math.PI * 2)
  ctx.stroke()
  ctx.fillStyle = 'rgba(3, 14, 24, 0.85)'
  ctx.fill()
  ctx.restore()

  const heading = (target.course * Math.PI) / 180
  ctx.strokeStyle = color
  ctx.lineWidth = 1.4
  ctx.beginPath()
  ctx.moveTo(point.x, point.y)
  ctx.lineTo(point.x + Math.sin(heading) * (radius + 5), point.y - Math.cos(heading) * (radius + 5))
  ctx.stroke()

}

export function drawTargets(ctx: CanvasRenderingContext2D, context: MapLayerContext) {
  for (const item of buildScreenItems(context.targets, context.project, context.zoom)) {
    if (isCluster(item)) drawCluster(ctx, item)
    else drawTarget(ctx, context, item.target)
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
