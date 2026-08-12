/** 海图视图状态：中心点、缩放、图层、目标样式与拾取/测距工具状态。 */
import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { FusionTarget, LatLng, LayerState, MapMode, MarkerSize, MonitorCategory } from '@/types/maritime'
import { DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM } from '@/types/maritime'
import { polylineDistanceMeters } from '@/utils/geo'

export const useMaritimeMapViewStore = defineStore('maritimeMapView', () => {
  const center = ref<LatLng>({ ...DEFAULT_MAP_CENTER })
  const zoom = ref(DEFAULT_MAP_ZOOM)
  const layers = ref<LayerState>({ vessels: true, radar: false, eo: false, zones: false })
  const targetStyle = ref({ markerSize: 'medium' as MarkerSize })
  const mode = ref<MapMode>('view')
  const pickedPoint = ref<LatLng | null>(null)
  const measurePoints = ref<LatLng[]>([])
  const measureDistance = ref<number | null>(null)
  const highlightId = ref<string | null>(null)
  const followId = ref<string | null>(null)
  const dataReady = ref(false)
  const selectedCategory = ref<MonitorCategory | null>(null)
  const selectedCategoryId = ref<string | null>(null)

  const measureDistanceText = computed(() => {
    if (measureDistance.value === null) return ''
    if (measureDistance.value >= 1000) return `${(measureDistance.value / 1000).toFixed(2)} km`
    return `${Math.round(measureDistance.value)} m`
  })

  function resetView() {
    center.value = { ...DEFAULT_MAP_CENTER }
    zoom.value = DEFAULT_MAP_ZOOM
  }

  function focusTarget(target: FusionTarget, zoomLevel = 2.8) {
    center.value = { lon: target.lon, lat: target.lat }
    zoom.value = zoomLevel
    highlightId.value = target.id
  }

  function focusPoint(point: LatLng, zoomLevel = 2.8) {
    center.value = { lon: point.lon, lat: point.lat }
    zoom.value = zoomLevel
  }

  function selectMonitorItem(category: MonitorCategory, id: string) {
    selectedCategory.value = category
    selectedCategoryId.value = id
    highlightId.value = id
  }

  function clearMonitorSelection() {
    selectedCategory.value = null
    selectedCategoryId.value = null
  }

  function setHighlight(id: string | null) {
    highlightId.value = id
  }

  function setMode(next: MapMode) {
    mode.value = next
  }

  function pickPoint(point: LatLng) {
    pickedPoint.value = point
  }

  function addMeasurePoint(point: LatLng) {
    measurePoints.value = [...measurePoints.value, point]
    measureDistance.value = polylineDistanceMeters(measurePoints.value)
  }

  function removeLastMeasurePoint() {
    measurePoints.value = measurePoints.value.slice(0, -1)
    measureDistance.value = polylineDistanceMeters(measurePoints.value)
  }

  function clearMeasure() {
    measurePoints.value = []
    measureDistance.value = null
  }

  function setFollow(id: string | null) {
    followId.value = id
  }

  function toggleLayer(name: keyof LayerState) {
    layers.value = { ...layers.value, [name]: !layers.value[name] }
  }

  function showLayer(name: keyof LayerState) {
    if (!layers.value[name]) layers.value = { ...layers.value, [name]: true }
  }

  function setMarkerSize(size: MarkerSize) {
    targetStyle.value = { ...targetStyle.value, markerSize: size }
  }

  function setDataReady(ready: boolean) {
    dataReady.value = ready
  }

  return {
    center,
    zoom,
    layers,
    targetStyle,
    mode,
    pickedPoint,
    measurePoints,
    measureDistance,
    measureDistanceText,
    highlightId,
    followId,
    dataReady,
    selectedCategory,
    selectedCategoryId,
    resetView,
    focusTarget,
    focusPoint,
    selectMonitorItem,
    clearMonitorSelection,
    setHighlight,
    setMode,
    pickPoint,
    addMeasurePoint,
    removeLastMeasurePoint,
    clearMeasure,
    setFollow,
    toggleLayer,
    showLayer,
    setMarkerSize,
    setDataReady,
  }
})
