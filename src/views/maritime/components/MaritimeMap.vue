<template>
  <div class="maritime-map-host">
    <canvas ref="canvasRef" class="maritime-map-canvas"></canvas>
    <div v-if="mapStore.layers.vessels === false" class="maritime-map-notice">
      船只图层已隐藏，统计与列表不受影响
    </div>
    <div v-if="!targetsStore.loaded && targetsStore.loading" class="maritime-map-notice">
      海图数据加载中
    </div>
    <HistorySearchPanel />
    <div class="maritime-layer-switch" aria-label="图层开关">
      <button
        v-for="item in layerItems"
        :key="item.key"
        type="button"
        class="maritime-layer-switch__item"
        :class="{ 'is-active': mapStore.layers[item.key] }"
        @click="mapStore.toggleLayer(item.key)"
      >
        <i class="maritime-layer-switch__dot" :style="{ backgroundColor: item.color }"></i>
        <span>{{ item.label }}</span>
      </button>
    </div>
    <div v-if="mapStore.layers.vessels" class="maritime-map-legend" aria-label="船只标识">
      <span class="maritime-map-legend__item">
        <img class="maritime-map-legend__icon maritime-map-legend__icon--ship" :src="normalMarker" alt="正常船舶" />
        <span>正常船舶</span>
      </span>
      <span class="maritime-map-legend__item">
        <img class="maritime-map-legend__icon maritime-map-legend__icon--ship" :src="sanwuMarker" alt="三无船舶" />
        <span>三无船舶</span>
      </span>
      <span class="maritime-map-legend__item">
        <span class="maritime-map-legend__follow">★</span>
        <span>关注船只</span>
      </span>
    </div>
    <div v-if="mapStore.mode === 'pick' && mapStore.pickedPoint" class="maritime-map-mode-card">
      <span>拾取坐标</span>
      <strong>{{ pickedText }}</strong>
    </div>
    <div v-if="mapStore.mode === 'measure'" class="maritime-map-mode-card">
      <span>测距 · {{ mapStore.measurePoints.length }} 点</span>
      <strong>{{ mapStore.measureDistanceText || '请点击地图添加测点' }}</strong>
    </div>
    <div v-if="hoverInfo" class="maritime-map-tooltip" :style="tooltipStyle">
      <strong class="maritime-map-tooltip__title">{{ hoverInfo.title }}</strong>
      <span v-for="row in hoverInfo.rows" :key="row" class="maritime-map-tooltip__row">{{ row }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 地图主区域：Canvas 自绘海图底图、图层、融合目标聚合渲染与地图交互。
 */
import { computed, ref } from 'vue'
import { useMaritimeMap } from '@/composables/useMaritimeMap'
import { useMaritimeMapViewStore } from '@/stores/maritimeMapView'
import { useMaritimeTargetsStore } from '@/stores/maritimeTargets'
import type { LayerState } from '@/types/maritime'
import normalMarker from '@/assets/maritime/marker-normal.svg'
import sanwuMarker from '@/assets/maritime/marker-sanwu.svg'
import HistorySearchPanel from './HistorySearchPanel.vue'

interface LayerSwitchItem {
  key: keyof LayerState
  label: string
  color: string
}

const layerItems: LayerSwitchItem[] = [
  { key: 'vessels', label: '船只', color: 'var(--mar-green)' },
  { key: 'radar', label: '雷达', color: 'var(--mar-amber)' },
  { key: 'eo', label: '光电', color: '#c084fc' },
  { key: 'zones', label: '区域', color: '#f5b84b' },
]

const canvasRef = ref<HTMLCanvasElement | null>(null)
const mapStore = useMaritimeMapViewStore()
const targetsStore = useMaritimeTargetsStore()
const { hoverInfo } = useMaritimeMap(canvasRef)

const pickedText = computed(() => {
  const point = mapStore.pickedPoint
  if (!point) return ''
  return `${point.lon.toFixed(4)}°E  ${point.lat.toFixed(4)}°N`
})

const tooltipStyle = computed(() => ({
  left: `${Math.min(Math.max(hoverInfo.value?.x ?? 0, 90), 1180)}px`,
  top: `${Math.max(hoverInfo.value?.y ?? 0, 48)}px`,
}))
</script>

<style scoped>
.maritime-map-host {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: #061426;
  border: 1px solid var(--mar-line);
  border-radius: 8px;
}

.maritime-map-canvas {
  display: block;
  width: 100%;
  height: 100%;
  touch-action: none;
  cursor: crosshair;
}

.maritime-map-notice {
  position: absolute;
  top: 50px;
  left: 16px;
  padding: 6px 12px;
  color: var(--mar-text-dim);
  font-size: 12px;
  letter-spacing: 0.5px;
  background: rgba(4, 13, 25, 0.72);
  border: 1px solid var(--mar-line-soft);
  border-radius: 4px;
}

.maritime-map-notice--warning {
  color: var(--mar-amber);
  border-color: rgba(245, 184, 75, 0.45);
}

.maritime-layer-switch {
  position: absolute;
  left: 16px;
  bottom: 16px;
  z-index: 20;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px;
  background: rgba(4, 13, 25, 0.78);
  border: 1px solid var(--mar-line-soft);
  border-radius: 6px;
}

.maritime-layer-switch__item {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 30px;
  padding: 0 10px;
  color: var(--mar-text-dim);
  font-size: 12px;
  letter-spacing: 0.5px;
  cursor: pointer;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 4px;
}

.maritime-layer-switch__item:hover {
  color: var(--mar-text);
  background: rgba(56, 198, 255, 0.08);
}

.maritime-layer-switch__item.is-active {
  color: var(--mar-text);
  border-color: var(--mar-line);
  background: rgba(56, 198, 255, 0.12);
}

.maritime-layer-switch__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.maritime-map-legend {
  position: absolute;
  top: 52px;
  right: 16px;
  z-index: 20;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 10px;
  background: rgba(4, 13, 25, 0.78);
  border: 1px solid var(--mar-line-soft);
  border-radius: 6px;
}

.maritime-map-legend__item {
  display: flex;
  align-items: center;
  gap: 5px;
  color: var(--mar-text-dim);
  font-size: 12px;
  letter-spacing: 0.5px;
}

.maritime-map-legend__icon {
  width: 15px;
  height: 15px;
  flex-shrink: 0;
}

.maritime-map-legend__icon--ship {
  width: 22px;
  height: 22px;
}

.maritime-map-legend__follow {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 15px;
  height: 15px;
  color: var(--mar-amber);
  font-size: 14px;
  line-height: 1;
  flex-shrink: 0;
}

.maritime-map-mode-card {
  position: absolute;
  right: 16px;
  bottom: 16px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 180px;
  padding: 8px 12px;
  color: var(--mar-text-dim);
  font-size: 12px;
  background: rgba(4, 13, 25, 0.78);
  border: 1px solid var(--mar-line);
  border-radius: 6px;
}

.maritime-map-mode-card strong {
  color: var(--mar-accent);
  font-size: 14px;
  font-weight: 600;
}

.maritime-map-tooltip {
  position: absolute;
  z-index: 20;
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 168px;
  max-width: 230px;
  padding: 8px 10px;
  color: var(--mar-text);
  font-size: 12px;
  line-height: 1.45;
  pointer-events: none;
  background: rgba(4, 13, 25, 0.92);
  border: 1px solid var(--mar-line);
  border-radius: 6px;
  transform: translate(-50%, calc(-100% - 12px));
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.35);
}

.maritime-map-tooltip__title {
  color: var(--mar-accent);
  font-size: 13px;
  font-weight: 600;
}

.maritime-map-tooltip__row {
  color: var(--mar-text-dim);
}
</style>
