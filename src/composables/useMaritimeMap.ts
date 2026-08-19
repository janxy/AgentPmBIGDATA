/** Canvas 海图交互组合式函数：投影、缩放、平移、命中、悬浮与点击联动。 */
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { Ref } from 'vue'
import { ElMessage } from 'element-plus'
import 'element-plus/es/components/message/style/css'
import { useMaritimeMapViewStore } from '@/stores/maritimeMapView'
import { useMaritimeTargetsStore } from '@/stores/maritimeTargets'
import { JURISDICTION_BOUNDS, TARGET_SOURCE_LABELS, TARGET_STATUS_LABELS } from '@/types/maritime'
import type { EoDevice, FenceZone, FusionTarget, LatLng, TrackPoint } from '@/types/maritime'
import { EO_DEVICES, FENCE_ZONES } from '@/mock/maritime/monitor'
import { RADAR_STATIONS } from '@/utils/maritimeGeography'
import type { RadarStation } from '@/utils/maritimeGeography'
import { TARGET_MARKER_SIZE, clusterRadius, markerRadius } from '@/utils/maritimeMapTheme'
import {
  buildEoScreenItems,
  buildScreenItems,
  buildTrackTimeLabel,
  buildZoneScreenItems,
  drawEoDevices,
  drawGrid,
  drawMeasure,
  drawOcean,
  drawPickPoint,
  drawRadar,
  drawRadarStations,
  drawTargetTrack,
  drawTargets,
  drawZones,
  formatTrackTime,
  isCluster,
  preloadTargetMarkers,
  trackMotionStatus,
} from '@/utils/maritimeCanvasLayers'
import type { MapLayerContext, ScreenCluster } from '@/utils/maritimeCanvasLayers'

const BOUNDS = JURISDICTION_BOUNDS
const LON_SPAN = BOUNDS.maxLon - BOUNDS.minLon
const LAT_SPAN = BOUNDS.maxLat - BOUNDS.minLat
const MIN_ZOOM = 1
const MAX_ZOOM = 24
const TILE_SIZE = 256
const MAX_TILE_CACHE = 64
const MIN_TILE_ZOOM = 3
const MAX_TILE_ZOOM = 18
const MERCATOR_LAT_LIMIT = 85.05112878
// 天地图卫星底图浏览器端测试 key，正式部署时请替换为项目自己的 key。
const TILE_TOKEN = '55b4d4eaef95384c946e9bd1b99c5610'

interface HoverInfo {
  title: string
  rows: string[]
  x: number
  y: number
}

interface DragState {
  startX: number
  startY: number
  lon: number
  lat: number
  moved: boolean
}

type MapHit =
  | { kind: 'cluster'; item: ScreenCluster }
  | { kind: 'vessel'; target: FusionTarget }
  | TrackHit
  | { kind: 'radar'; station: RadarStation }
  | { kind: 'eo'; device: EoDevice }
  | { kind: 'zone'; zone: FenceZone }

interface TrackHit {
  kind: 'track'
  point: TrackPoint
  target: FusionTarget
  previous: TrackPoint | null
}

interface MapRuntime {
  canvasRef: Ref<HTMLCanvasElement | null>
  mapStore: ReturnType<typeof useMaritimeMapViewStore>
  targetsStore: ReturnType<typeof useMaritimeTargetsStore>
  hoverInfo: Ref<HoverInfo | null>
  alive: boolean
  width: number
  height: number
  dpr: number
  raf: number
  dragging: DragState | null
  resizeObserver: ResizeObserver | null
  disposeEvents: (() => void) | null
  disposeStoreWatch: (() => void) | null
  staticCache: StaticMapCache | null
  tileImages: Map<string, HTMLImageElement>
  failedTiles: Set<string>
}

interface StaticMapCache {
  canvas: HTMLCanvasElement
  width: number
  height: number
  dpr: number
  centerLon: number
  centerLat: number
  zoom: number
  radar: boolean
}

interface VisibleTile {
  z: number
  x: number
  y: number
  key: string
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function normalizeLon(lon: number) {
  return (lon - BOUNDS.minLon) / LON_SPAN
}

function normalizeLat(lat: number) {
  return (BOUNDS.maxLat - lat) / LAT_SPAN
}

function pixelScale(runtime: MapRuntime) {
  return Math.min(runtime.width, runtime.height) * 0.94 * runtime.mapStore.zoom
}

function projectPoint(runtime: MapRuntime, point: LatLng) {
  return {
    x: runtime.width / 2 + (normalizeLon(point.lon) - normalizeLon(runtime.mapStore.center.lon)) * pixelScale(runtime),
    y: runtime.height / 2 + (normalizeLat(point.lat) - normalizeLat(runtime.mapStore.center.lat)) * pixelScale(runtime),
  }
}

function unprojectPoint(runtime: MapRuntime, x: number, y: number): LatLng {
  return {
    lon:
      BOUNDS.minLon +
      ((x - runtime.width / 2) / pixelScale(runtime) + normalizeLon(runtime.mapStore.center.lon)) * LON_SPAN,
    lat:
      BOUNDS.maxLat -
      ((y - runtime.height / 2) / pixelScale(runtime) + normalizeLat(runtime.mapStore.center.lat)) * LAT_SPAN,
  }
}

function formatMonitorTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function webMercatorY(latRad: number) {
  return (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2
}

function webMercatorLat(normalizedY: number) {
  return (Math.atan(Math.sinh(Math.PI * (1 - 2 * normalizedY))) * 180) / Math.PI
}

function tileZoom(runtime: MapRuntime) {
  const pixelsPerDegree = pixelScale(runtime) / LON_SPAN
  return clamp(Math.round(Math.log2((360 * pixelsPerDegree) / TILE_SIZE)), MIN_TILE_ZOOM, MAX_TILE_ZOOM)
}

function visibleTileKeys(runtime: MapRuntime, z: number): VisibleTile[] {
  const size = 2 ** z
  const corners = [
    unprojectPoint(runtime, 0, 0),
    unprojectPoint(runtime, runtime.width, 0),
    unprojectPoint(runtime, runtime.width, runtime.height),
    unprojectPoint(runtime, 0, runtime.height),
  ]
  let minX = size
  let maxX = 0
  let minY = size
  let maxY = 0
  for (const point of corners) {
    const lon = clamp(point.lon, -180, 180)
    const lat = clamp(point.lat, -MERCATOR_LAT_LIMIT, MERCATOR_LAT_LIMIT)
    const x = ((lon + 180) / 360) * size
    const y = webMercatorY((lat * Math.PI) / 180) * size
    minX = Math.min(minX, x)
    maxX = Math.max(maxX, x)
    minY = Math.min(minY, y)
    maxY = Math.max(maxY, y)
  }
  const firstX = clamp(Math.floor(minX), 0, size - 1)
  const lastX = clamp(Math.ceil(maxX), 0, size - 1)
  const firstY = clamp(Math.floor(minY), 0, size - 1)
  const lastY = clamp(Math.ceil(maxY), 0, size - 1)
  const tiles: VisibleTile[] = []
  for (let x = firstX; x <= lastX; x += 1) {
    for (let y = firstY; y <= lastY; y += 1) {
      tiles.push({ z, x, y, key: `${z}/${x}/${y}` })
    }
  }
  return tiles
}

function tileBounds(tile: VisibleTile) {
  const size = 2 ** tile.z
  return {
    west: (tile.x / size) * 360 - 180,
    east: ((tile.x + 1) / size) * 360 - 180,
    north: webMercatorLat(tile.y / size),
    south: webMercatorLat((tile.y + 1) / size),
  }
}

function buildTileUrl(tile: VisibleTile) {
  const subdomain = (tile.x + tile.y) % 8
  return `https://t${subdomain}.tianditu.gov.cn/DataServer?T=img_w&x=${tile.x}&y=${tile.y}&l=${tile.z}&tk=${TILE_TOKEN}`
}

function loadTile(runtime: MapRuntime, tile: VisibleTile): HTMLImageElement | null {
  const cached = runtime.tileImages.get(tile.key)
  if (cached) return cached
  if (runtime.failedTiles.has(tile.key)) return null
  if (runtime.tileImages.size >= MAX_TILE_CACHE) return null
  const img = new Image()
  img.decoding = 'async'
  runtime.tileImages.set(tile.key, img)
  img.onload = () => {
    if (!runtime.alive || runtime.tileImages.get(tile.key) !== img) return
    runtime.staticCache = null
    scheduleRender(runtime)
  }
  img.onerror = () => {
    if (!runtime.alive || runtime.tileImages.get(tile.key) !== img) return
    runtime.tileImages.delete(tile.key)
    runtime.failedTiles.add(tile.key)
    runtime.staticCache = null
    scheduleRender(runtime)
  }
  img.src = buildTileUrl(tile)
  return img
}

function pruneTileCache(runtime: MapRuntime, visible: VisibleTile[]) {
  if (runtime.tileImages.size <= MAX_TILE_CACHE) return
  const keep = new Set(visible.map((tile) => tile.key))
  for (const key of Array.from(runtime.tileImages.keys())) {
    if (runtime.tileImages.size <= MAX_TILE_CACHE - 8) break
    if (!keep.has(key)) runtime.tileImages.delete(key)
  }
  if (runtime.failedTiles.size > MAX_TILE_CACHE * 2) runtime.failedTiles.clear()
}

function drawTileBackground(runtime: MapRuntime, ctx: CanvasRenderingContext2D) {
  const tiles = visibleTileKeys(runtime, tileZoom(runtime))
  pruneTileCache(runtime, tiles)
  for (const tile of tiles) {
    const img = loadTile(runtime, tile)
    if (!img || !img.complete || !img.naturalWidth) continue
    const bounds = tileBounds(tile)
    const pTL = projectPoint(runtime, { lon: bounds.west, lat: bounds.north })
    const pTR = projectPoint(runtime, { lon: bounds.east, lat: bounds.north })
    const pBL = projectPoint(runtime, { lon: bounds.west, lat: bounds.south })
    const a = (pTR.x - pTL.x) / TILE_SIZE
    const b = (pTR.y - pTL.y) / TILE_SIZE
    const c = (pBL.x - pTL.x) / TILE_SIZE
    const d = (pBL.y - pTL.y) / TILE_SIZE
    ctx.save()
    ctx.transform(a, b, c, d, pTL.x, pTL.y)
    ctx.drawImage(img, 0, 0)
    ctx.restore()
  }
}

function updateMapSize(runtime: MapRuntime) {
  const canvas = runtime.canvasRef.value
  if (!canvas) return
  const rect = canvas.getBoundingClientRect()
  runtime.width = Math.max(1, Math.round(rect.width))
  runtime.height = Math.max(1, Math.round(rect.height))
  runtime.dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1))
  canvas.width = Math.round(runtime.width * runtime.dpr)
  canvas.height = Math.round(runtime.height * runtime.dpr)
}

function buildLayerContext(runtime: MapRuntime, ctx: CanvasRenderingContext2D): MapLayerContext {
  const { mapStore, targetsStore } = runtime
  return {
    ctx,
    width: runtime.width,
    height: runtime.height,
    zoom: mapStore.zoom,
    now: performance.now(),
    project: (point: LatLng) => projectPoint(runtime, point),
    unproject: (x: number, y: number) => unprojectPoint(runtime, x, y),
    targets: targetsStore.mapTargets,
    followedIds: targetsStore.followedIds,
    layers: mapStore.layers,
    targetStyle: mapStore.targetStyle,
    mode: mapStore.mode,
    measurePoints: mapStore.measurePoints,
    pickedPoint: mapStore.pickedPoint,
    highlightId: mapStore.highlightId,
    selectedId: targetsStore.selectedId,
    selectedTrack: targetsStore.track,
    eoDevices: EO_DEVICES,
    zones: FENCE_ZONES,
    selectedCategory: mapStore.selectedCategory,
    selectedCategoryId: mapStore.selectedCategoryId,
  }
}

function renderMap(runtime: MapRuntime) {
  runtime.raf = 0
  if (!runtime.alive || document.visibilityState === 'hidden') return
  const canvas = runtime.canvasRef.value
  const ctx = canvas?.getContext('2d')
  if (!ctx) return
  ctx.setTransform(runtime.dpr, 0, 0, runtime.dpr, 0, 0)
  ctx.clearRect(0, 0, runtime.width, runtime.height)
  const context = buildLayerContext(runtime, ctx)
  drawStaticLayers(runtime, ctx)
  if (runtime.mapStore.layers.zones) drawZones(ctx, context)
  if (runtime.mapStore.layers.radar) drawRadarStations(ctx, context)
  if (runtime.mapStore.layers.eo) drawEoDevices(ctx, context)
  if (runtime.mapStore.layers.vessels) {
    drawTargetTrack(ctx, context)
    drawTargets(ctx, context)
  }
  drawMeasure(ctx, (point: LatLng) => projectPoint(runtime, point), runtime.mapStore.measurePoints)
  if (runtime.mapStore.mode === 'pick' && runtime.mapStore.pickedPoint) {
    drawPickPoint(ctx, (point: LatLng) => projectPoint(runtime, point), runtime.mapStore.pickedPoint)
  }
  // 有关注船只时保持逐帧重绘，驱动关注黄圈动效。
  if (runtime.mapStore.layers.vessels && runtime.targetsStore.followedIds.length > 0) {
    scheduleRender(runtime)
  }
}

function drawStaticLayers(runtime: MapRuntime, ctx: CanvasRenderingContext2D) {
  const { mapStore } = runtime
  const cached = runtime.staticCache
  const needsUpdate =
    !cached ||
    cached.width !== runtime.width ||
    cached.height !== runtime.height ||
    cached.dpr !== runtime.dpr ||
    cached.centerLon !== mapStore.center.lon ||
    cached.centerLat !== mapStore.center.lat ||
    cached.zoom !== mapStore.zoom ||
    cached.radar !== mapStore.layers.radar

  if (needsUpdate) {
    const canvas = cached?.canvas ?? document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(runtime.width * runtime.dpr))
    canvas.height = Math.max(1, Math.round(runtime.height * runtime.dpr))
    const staticCtx = canvas.getContext('2d')
    if (staticCtx) {
      staticCtx.setTransform(runtime.dpr, 0, 0, runtime.dpr, 0, 0)
      staticCtx.clearRect(0, 0, runtime.width, runtime.height)
      drawOcean(staticCtx, runtime.width, runtime.height)
      drawTileBackground(runtime, staticCtx)
      drawGrid(staticCtx, runtime.width, runtime.height, (x, y) => unprojectPoint(runtime, x, y))
      if (mapStore.layers.radar) {
        drawRadar(staticCtx, (point: LatLng) => projectPoint(runtime, point))
      }
    }
    runtime.staticCache = {
      canvas,
      width: runtime.width,
      height: runtime.height,
      dpr: runtime.dpr,
      centerLon: mapStore.center.lon,
      centerLat: mapStore.center.lat,
      zoom: mapStore.zoom,
      radar: mapStore.layers.radar,
    }
  }

  ctx.drawImage(runtime.staticCache!.canvas, 0, 0, runtime.width, runtime.height)
}

function scheduleRender(runtime: MapRuntime) {
  if (!runtime.alive || document.visibilityState === 'hidden') return
  if (runtime.raf !== 0) return
  runtime.raf = requestAnimationFrame(() => renderMap(runtime))
}

function hitMapItem(runtime: MapRuntime, x: number, y: number): MapHit | null {
  const { mapStore, targetsStore } = runtime
  const project = (point: LatLng) => projectPoint(runtime, point)

  if (mapStore.layers.vessels) {
    const radius = markerRadius(mapStore.targetStyle.markerSize)
    const markerSize = TARGET_MARKER_SIZE[mapStore.targetStyle.markerSize]
    for (const item of buildScreenItems(targetsStore.mapTargets, project, mapStore.zoom, targetsStore.followedIds)) {
      const distance = Math.hypot(item.x - x, item.y - y)
      const threshold = isCluster(item)
        ? clusterRadius(item.targets.length) + 4
        : Math.max(radius + 8, markerSize * 0.5 + 4)
      if (distance <= threshold) {
        return isCluster(item) ? { kind: 'cluster', item } : { kind: 'vessel', target: item.target }
      }
    }
  }

  if (mapStore.layers.vessels && targetsStore.selectedId && targetsStore.track.length > 0) {
    const target = targetsStore.mapTargets.find((item) => item.id === targetsStore.selectedId)
    if (target) {
      const track = targetsStore.track
      for (let index = track.length - 1; index >= 0; index -= 1) {
        const point = track[index]
        const projected = project(point)
        const distance = Math.hypot(projected.x - x, projected.y - y)
        const label = buildTrackTimeLabel(point, index, track.length, projected, mapStore.zoom)
        const labelHit =
          label !== null &&
          x >= label.x - 2 &&
          x <= label.x + label.width + 2 &&
          y >= label.y - 2 &&
          y <= label.y + label.height + 2
        if (distance <= 7 || labelHit) {
          return { kind: 'track', point, target, previous: track[index - 1] ?? null }
        }
      }
    }
  }

  if (mapStore.layers.radar) {
    for (const station of RADAR_STATIONS) {
      const point = project(station)
      if (Math.hypot(point.x - x, point.y - y) <= 14) return { kind: 'radar', station }
    }
  }

  if (mapStore.layers.eo) {
    for (const item of buildEoScreenItems(EO_DEVICES, project)) {
      if (Math.hypot(item.x - x, item.y - y) <= 10) return { kind: 'eo', device: item.device }
    }
  }

  if (mapStore.layers.zones) {
    for (const item of buildZoneScreenItems(FENCE_ZONES, project)) {
      if (pointInPolygon(x, y, item.points)) return { kind: 'zone', zone: item.zone }
    }
  }
  return null
}

function pointInPolygon(x: number, y: number, points: Array<{ x: number; y: number }>) {
  let inside = false
  for (let index = 0, previous = points.length - 1; index < points.length; previous = index, index += 1) {
    const current = points[index]
    const before = points[previous]
    const intersects = current.y > y !== before.y > y && x < ((before.x - current.x) * (y - current.y)) / (before.y - current.y) + current.x
    if (intersects) inside = !inside
  }
  return inside
}

function showTrackHover(runtime: MapRuntime, hit: TrackHit, x: number, y: number) {
  const status = trackMotionStatus(hit.point, hit.previous)
  runtime.hoverInfo.value = {
    title: `${hit.target.name} · 轨迹点`,
    rows: [
      `时间 ${formatTrackTime(hit.point.time)}`,
      `航向 ${hit.point.course.toFixed(1)}°`,
      `航速 ${hit.point.speed.toFixed(1)} kn`,
      ...(status ? [`状态 ${status}`] : []),
    ],
    x,
    y,
  }
}

function updateMapHover(runtime: MapRuntime, x: number, y: number) {
  const { mapStore } = runtime
  if (runtime.dragging) {
    runtime.hoverInfo.value = null
    return
  }
  if (mapStore.mode !== 'view') {
    const point = unprojectPoint(runtime, x, y)
    runtime.hoverInfo.value = {
      title: mapStore.mode === 'pick' ? '坐标拾取' : '测距',
      rows: [`${point.lon.toFixed(4)}°E  ${point.lat.toFixed(4)}°N`],
      x,
      y,
    }
    return
  }
  const item = hitMapItem(runtime, x, y)
  if (!item) {
    runtime.hoverInfo.value = null
    return
  }
  if (item.kind === 'cluster') {
    runtime.hoverInfo.value = {
      title: `${item.item.targets.length} 个目标`,
      rows: ['点击放大查看目标分布'],
      x,
      y,
    }
    return
  }
  if (item.kind === 'vessel') {
    const target = item.target
    const followed = runtime.targetsStore.followedIds.includes(target.id)
    const statusRows = [`状态 ${TARGET_STATUS_LABELS[target.status]} · ${target.sources.map((s) => TARGET_SOURCE_LABELS[s]).join('/') || '无来源'}`]
    if (target.status === 'offline' || target.status === 'abnormal') {
      statusRows.push('该目标数据已超时，显示最近位置')
    }
    runtime.hoverInfo.value = {
      title: target.name,
      rows: [
        `MMSI ${target.mmsi}`,
        `航速 ${target.speed.toFixed(1)} kn · 航向 ${target.course.toFixed(1)}°`,
        ...(followed ? ['已关注'] : []),
        ...statusRows,
      ],
      x,
      y,
    }
    return
  }
  if (item.kind === 'track') {
    showTrackHover(runtime, item, x, y)
    return
  }
  if (item.kind === 'radar') {
    const station = item.station
    runtime.hoverInfo.value = {
      title: station.name,
      rows: [
        `编号 ${station.id}`,
        `${station.online ? '在线' : '离线'} · 覆盖 ${station.radiusKm.toFixed(0)} km`,
        `更新时间 ${formatMonitorTime(station.lastUpdate)}`,
      ],
      x,
      y,
    }
    return
  }
  if (item.kind === 'eo') {
    const device = item.device
    runtime.hoverInfo.value = {
      title: device.name,
      rows: [
        `编号 ${device.id}`,
        `${device.online ? '在线' : '离线'} · 告警 ${device.alarmCount}`,
        `方位 ${device.azimuth}° · 俯仰 ${device.pitch}°`,
      ],
      x,
      y,
    }
    return
  }
  if (item.kind === 'zone') {
    // 区域不弹 hover 提示，点击后在右侧详情中查看区域与历史告警。
    runtime.hoverInfo.value = null
    return
  }
}

function handleMapClick(runtime: MapRuntime, x: number, y: number) {
  const { mapStore, targetsStore } = runtime
  const point = unprojectPoint(runtime, x, y)
  if (mapStore.mode === 'pick') {
    mapStore.pickPoint(point)
    if (
      point.lon < BOUNDS.minLon ||
      point.lon > BOUNDS.maxLon ||
      point.lat < BOUNDS.minLat ||
      point.lat > BOUNDS.maxLat
    ) {
      ElMessage.warning('当前点位不在辖区范围内，请确认坐标有效性')
    }
    return
  }
  if (mapStore.mode === 'measure') {
    mapStore.addMeasurePoint(point)
    return
  }
  const item = hitMapItem(runtime, x, y)
  if (!item) {
    targetsStore.clearSelection()
    mapStore.clearMonitorSelection()
    mapStore.setHighlight(null)
    return
  }
  if (item.kind === 'cluster') {
    const filteredIds = new Set(targetsStore.filteredTargets.map((t) => t.id))
    const cluster = item.item
    if (!cluster.targets.some((t) => filteredIds.has(t.id))) return
    const center = unprojectPoint(runtime, cluster.x, cluster.y)
    mapStore.center = center
    mapStore.zoom = clamp(mapStore.zoom + 0.8, MIN_ZOOM, MAX_ZOOM)
    return
  }
  if (item.kind === 'vessel') {
    const target = item.target
    // 被当前筛选排除的目标保留展示，但不响应点击定位。
    if (!targetsStore.filteredTargets.some((t) => t.id === target.id)) return
    if (target.status === 'offline') {
      ElMessage.info('目标暂无最新位置，已定位至最近位置')
    }
    mapStore.clearMonitorSelection()
    targetsStore.selectTarget(target.id)
    mapStore.focusTarget(target, Math.max(2.8, mapStore.zoom))
    return
  }
  if (item.kind === 'track') {
    showTrackHover(runtime, item, x, y)
    return
  }
  if (item.kind === 'radar') {
    targetsStore.clearSelection()
    mapStore.selectMonitorItem('radar', item.station.id)
    mapStore.showLayer('radar')
    mapStore.focusPoint({ lon: item.station.lon, lat: item.station.lat }, Math.max(2.8, mapStore.zoom))
    return
  }
  if (item.kind === 'eo') {
    targetsStore.clearSelection()
    mapStore.selectMonitorItem('eo', item.device.id)
    mapStore.showLayer('eo')
    mapStore.focusPoint({ lon: item.device.lon, lat: item.device.lat }, Math.max(2.8, mapStore.zoom))
    return
  }
  if (item.kind === 'zone') {
    targetsStore.clearSelection()
    mapStore.selectMonitorItem('fence', item.zone.id)
    mapStore.showLayer('zones')
    mapStore.focusPoint({ lon: item.zone.lon, lat: item.zone.lat }, Math.max(2.8, mapStore.zoom))
  }
}

function handleMapDblClick(runtime: MapRuntime) {
  if (runtime.mapStore.mode !== 'measure') return
  // 双击的第二次点击会在同一位置重复加一个测点，先移除重复点再结束测距。
  runtime.mapStore.removeLastMeasurePoint()
  if (runtime.mapStore.measurePoints.length < 2) {
    runtime.mapStore.clearMeasure()
    ElMessage.warning('请至少选择两个点位进行测距')
  }
  runtime.mapStore.setMode('view')
}

function handleMapPointerDown(runtime: MapRuntime, event: PointerEvent) {
  const canvas = runtime.canvasRef.value
  if (!canvas) return
  const rect = canvas.getBoundingClientRect()
  runtime.dragging = {
    startX: event.clientX - rect.left,
    startY: event.clientY - rect.top,
    lon: runtime.mapStore.center.lon,
    lat: runtime.mapStore.center.lat,
    moved: false,
  }
  canvas.setPointerCapture(event.pointerId)
}

function handleMapPointerMove(runtime: MapRuntime, event: PointerEvent) {
  const canvas = runtime.canvasRef.value
  if (!canvas) return
  const rect = canvas.getBoundingClientRect()
  const x = event.clientX - rect.left
  const y = event.clientY - rect.top
  if (!runtime.dragging) {
    updateMapHover(runtime, x, y)
    return
  }
  const dx = x - runtime.dragging.startX
  const dy = y - runtime.dragging.startY
  if (Math.abs(dx) > 3 || Math.abs(dy) > 3) runtime.dragging.moved = true
  if (runtime.dragging.moved) {
    runtime.mapStore.center = {
      lon: runtime.dragging.lon - (dx / pixelScale(runtime)) * LON_SPAN,
      lat: runtime.dragging.lat + (dy / pixelScale(runtime)) * LAT_SPAN,
    }
  }
}

function handleMapPointerUp(runtime: MapRuntime, event: PointerEvent) {
  const canvas = runtime.canvasRef.value
  if (!canvas || !runtime.dragging) return
  const rect = canvas.getBoundingClientRect()
  const x = event.clientX - rect.left
  const y = event.clientY - rect.top
  const wasDrag = runtime.dragging.moved
  runtime.dragging = null
  if (!wasDrag) handleMapClick(runtime, x, y)
}

function handleMapPointerCancel(runtime: MapRuntime) {
  runtime.dragging = null
  runtime.hoverInfo.value = null
}

function handleMapPointerLeave(runtime: MapRuntime) {
  if (!runtime.dragging) runtime.hoverInfo.value = null
}

function handleMapWheel(runtime: MapRuntime, event: WheelEvent) {
  event.preventDefault()
  const canvas = runtime.canvasRef.value
  if (!canvas) return
  const rect = canvas.getBoundingClientRect()
  const x = event.clientX - rect.left
  const y = event.clientY - rect.top
  const before = unprojectPoint(runtime, x, y)
  const factor = Math.exp(-event.deltaY * 0.0012)
  runtime.mapStore.zoom = clamp(runtime.mapStore.zoom * factor, MIN_ZOOM, MAX_ZOOM)
  const after = unprojectPoint(runtime, x, y)
  runtime.mapStore.center = {
    lon: runtime.mapStore.center.lon + before.lon - after.lon,
    lat: runtime.mapStore.center.lat + before.lat - after.lat,
  }
}

function setupMapEvents(runtime: MapRuntime): () => void {
  const canvas = runtime.canvasRef.value
  if (!canvas) return () => undefined
  const pointerDown = (event: PointerEvent) => handleMapPointerDown(runtime, event)
  const pointerMove = (event: PointerEvent) => handleMapPointerMove(runtime, event)
  const pointerUp = (event: PointerEvent) => handleMapPointerUp(runtime, event)
  const pointerCancel = () => handleMapPointerCancel(runtime)
  const pointerLeave = () => handleMapPointerLeave(runtime)
  const wheel = (event: WheelEvent) => handleMapWheel(runtime, event)
  const dblClick = () => handleMapDblClick(runtime)
  canvas.addEventListener('pointerdown', pointerDown)
  canvas.addEventListener('pointermove', pointerMove)
  canvas.addEventListener('pointerup', pointerUp)
  canvas.addEventListener('pointercancel', pointerCancel)
  canvas.addEventListener('pointerleave', pointerLeave)
  canvas.addEventListener('wheel', wheel, { passive: false })
  canvas.addEventListener('dblclick', dblClick)
  return () => {
    canvas.removeEventListener('pointerdown', pointerDown)
    canvas.removeEventListener('pointermove', pointerMove)
    canvas.removeEventListener('pointerup', pointerUp)
    canvas.removeEventListener('pointercancel', pointerCancel)
    canvas.removeEventListener('pointerleave', pointerLeave)
    canvas.removeEventListener('wheel', wheel)
    canvas.removeEventListener('dblclick', dblClick)
  }
}

/**
 * 绑定海图画布的地图视图交互。
 * @param canvasRef 海图画布引用。
 * @returns 悬浮提示状态。
 */
export function useMaritimeMap(canvasRef: Ref<HTMLCanvasElement | null>) {
  const mapStore = useMaritimeMapViewStore()
  const targetsStore = useMaritimeTargetsStore()
  const hoverInfo = ref<HoverInfo | null>(null)
  const runtime: MapRuntime = {
    canvasRef,
    mapStore,
    targetsStore,
    hoverInfo,
    alive: true,
    width: 1,
    height: 1,
    dpr: 1,
    raf: 0,
    dragging: null,
    resizeObserver: null,
    disposeEvents: null,
    disposeStoreWatch: null,
    staticCache: null,
    tileImages: new Map(),
    failedTiles: new Set(),
  }

  watch(
    () => targetsStore.mapTargets,
    (list) => {
      if (!mapStore.followId) return
      const target = list.find((item) => item.id === mapStore.followId)
      if (target) mapStore.center = { lon: target.lon, lat: target.lat }
    },
  )

  watch(
    () => targetsStore.loaded,
    (loaded) => mapStore.setDataReady(loaded),
    { immediate: true },
  )

  onMounted(() => {
    const canvas = canvasRef.value
    if (!canvas) return
    updateMapSize(runtime)
    runtime.resizeObserver = new ResizeObserver(() => {
      updateMapSize(runtime)
      scheduleRender(runtime)
    })
    runtime.resizeObserver.observe(canvas.parentElement || canvas)
    const disposeMapEvents = setupMapEvents(runtime)
    const handleViewportChange = () => {
      updateMapSize(runtime)
      scheduleRender(runtime)
    }
    window.addEventListener('resize', handleViewportChange)
    document.addEventListener('fullscreenchange', handleViewportChange)
    runtime.disposeEvents = () => {
      disposeMapEvents()
      window.removeEventListener('resize', handleViewportChange)
      document.removeEventListener('fullscreenchange', handleViewportChange)
    }
    const stopRenderWatch = watch(
      [
        () => mapStore.center,
        () => mapStore.zoom,
        () => mapStore.layers,
        () => mapStore.targetStyle,
        () => mapStore.mode,
        () => mapStore.measurePoints,
        () => mapStore.pickedPoint,
        () => mapStore.highlightId,
        () => mapStore.selectedCategory,
        () => mapStore.selectedCategoryId,
        () => targetsStore.mapTargets,
        () => targetsStore.followedIds,
        () => targetsStore.selectedId,
        () => targetsStore.track,
      ],
      () => scheduleRender(runtime),
      { flush: 'post' },
    )
    runtime.disposeStoreWatch = stopRenderWatch
    scheduleRender(runtime)
    preloadTargetMarkers(() => scheduleRender(runtime))
  })

  onBeforeUnmount(() => {
    runtime.alive = false
    cancelAnimationFrame(runtime.raf)
    runtime.resizeObserver?.disconnect()
    runtime.disposeEvents?.()
    runtime.disposeStoreWatch?.()
    if (runtime.staticCache) runtime.staticCache.canvas.width = 0
    runtime.staticCache = null
  })

  return { hoverInfo }
}
