<template>
  <aside class="vt-panel" aria-label="视图工具">
    <header class="vt-head">
      <h2>视图工具</h2>
      <span>海图操作</span>
    </header>

    <section class="vt-group">
      <h3 class="vt-group__title">图层</h3>
      <div class="vt-layer-list">
        <button
          v-for="item in layerItems"
          :key="item.key"
          type="button"
          class="vt-layer"
          :class="{ 'is-active': mapStore.layers[item.key] }"
          @click="mapStore.toggleLayer(item.key)"
        >
          <i class="vt-layer__dot" :style="{ backgroundColor: item.color }" />
          <span>{{ item.label }}</span>
          <i class="vt-layer__check" :class="{ 'is-on': mapStore.layers[item.key] }" />
        </button>
      </div>
    </section>

    <section class="vt-group">
      <h3 class="vt-group__title">目标样式</h3>
      <div class="vt-field">
        <span class="vt-field__label">标记大小</span>
        <div class="vt-segment">
          <button
            v-for="item in markerOptions"
            :key="item.value"
            type="button"
            class="vt-segment__item"
            :class="{ 'is-active': mapStore.targetStyle.markerSize === item.value }"
            @click="mapStore.setMarkerSize(item.value)"
          >
            {{ item.label }}
          </button>
        </div>
      </div>
    </section>

    <section class="vt-group">
      <h3 class="vt-group__title">工具</h3>
      <button
        type="button"
        class="vt-action"
        :disabled="!mapStore.dataReady"
        @click="handleResetView"
      >
        <el-icon><RefreshLeft /></el-icon>
        <span>复位视角</span>
      </button>
      <button
        type="button"
        class="vt-action"
        :class="{ 'is-active': mapStore.mode === 'pick' }"
        @click="togglePick"
      >
        <el-icon><Coordinate /></el-icon>
        <span>坐标拾取</span>
      </button>
      <button
        type="button"
        class="vt-action"
        :class="{ 'is-active': mapStore.mode === 'measure' }"
        @click="toggleMeasure"
      >
        <el-icon><Odometer /></el-icon>
        <span>测距</span>
      </button>
      <button type="button" class="vt-action" @click="toggleFullscreen">
        <el-icon><FullScreen /></el-icon>
        <span>{{ fullscreen ? '退出全屏' : '全屏' }}</span>
      </button>
    </section>

    <section v-if="mapStore.mode === 'pick'" class="vt-readout">
      <span class="vt-readout__label">拾取坐标</span>
      <strong>{{ pickedText || '尚未拾取' }}</strong>
    </section>

    <section v-if="mapStore.mode === 'measure'" class="vt-readout">
      <span class="vt-readout__label">测距 · {{ mapStore.measurePoints.length }} 点</span>
      <strong>{{ mapStore.measureDistanceText || (mapStore.measurePoints.length < 2 ? '需至少两点' : '计算中') }}</strong>
      <div class="vt-readout__actions">
        <button type="button" class="vt-mini-btn" :disabled="mapStore.measurePoints.length < 2" @click="finishMeasure">
          <el-icon><Aim /></el-icon>
          <span>完成</span>
        </button>
        <button type="button" class="vt-mini-btn" :disabled="mapStore.measurePoints.length === 0" @click="clearMeasure">
          <el-icon><RefreshLeft /></el-icon>
          <span>清除</span>
        </button>
      </div>
    </section>

    <footer class="vt-foot">
      <span class="vt-foot__hint">图层与样式即时生效</span>
    </footer>
  </aside>
</template>

<script setup lang="ts">
/**
 * 海图右侧视图工具：图层、目标样式、复位视角、坐标拾取、测距与全屏。
 */
import { computed } from 'vue'
import { ElMessage } from 'element-plus'
import 'element-plus/es/components/message/style/css'
import { Aim, Coordinate, FullScreen, Odometer, RefreshLeft } from '@element-plus/icons-vue'
import { useMaritimeMapViewStore } from '@/stores/maritimeMapView'
import { useMaritimeScreen } from '@/composables/useMaritimeScreen'
import type { LayerState, MarkerSize } from '@/types/maritime'

interface LayerItem {
  key: keyof LayerState
  label: string
  color: string
}

const layerItems: LayerItem[] = [
  { key: 'vessels', label: '船只', color: 'var(--mar-green)' },
  { key: 'radar', label: '雷达', color: 'var(--mar-amber)' },
  { key: 'districts', label: '区划', color: '#5da8dc' },
  { key: 'eo', label: '光电', color: '#c084fc' },
  { key: 'zones', label: '区域', color: '#f5b84b' },
]

const markerOptions: Array<{ value: MarkerSize; label: string }> = [
  { value: 'small', label: '小' },
  { value: 'medium', label: '中' },
  { value: 'large', label: '大' },
]

const mapStore = useMaritimeMapViewStore()
const { fullscreen, toggleFullscreen } = useMaritimeScreen()

const pickedText = computed(() => {
  const point = mapStore.pickedPoint
  if (!point) return ''
  return `${point.lon.toFixed(4)}°E  ${point.lat.toFixed(4)}°N`
})

function handleResetView() {
  if (!mapStore.dataReady) return
  mapStore.resetView()
  ElMessage.success('视角已复位')
}

function togglePick() {
  if (mapStore.mode === 'pick') {
    mapStore.setMode('view')
    return
  }
  mapStore.clearMeasure()
  mapStore.setMode('pick')
}

function toggleMeasure() {
  if (mapStore.mode === 'measure') {
    finishMeasure()
    return
  }
  mapStore.clearMeasure()
  mapStore.setMode('measure')
}

function finishMeasure() {
  if (mapStore.measurePoints.length < 2) {
    ElMessage.warning('请至少选择两个点位进行测距')
    return
  }
  mapStore.setMode('view')
}

function clearMeasure() {
  mapStore.clearMeasure()
  mapStore.setMode('view')
}
</script>

<style scoped>
.vt-panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 224px;
  padding: 12px;
  color: var(--mar-text);
  background: rgba(6, 18, 34, 0.92);
  border: 1px solid var(--mar-line);
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
}

.vt-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--mar-line-soft);
}

.vt-head h2 {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 1px;
  color: var(--mar-accent);
}

.vt-head span {
  color: var(--mar-text-faint);
  font-size: 11px;
}

.vt-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.vt-group__title {
  margin: 0;
  color: var(--mar-text-dim);
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 1px;
}

.vt-layer-list {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}

.vt-layer {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 30px;
  padding: 0 8px;
  color: var(--mar-text-dim);
  font-size: 12px;
  cursor: pointer;
  background: rgba(13, 34, 58, 0.5);
  border: 1px solid var(--mar-line-soft);
  border-radius: 4px;
}

.vt-layer:hover {
  color: var(--mar-text);
  border-color: var(--mar-line);
}

.vt-layer.is-active {
  color: var(--mar-text);
  background: rgba(56, 198, 255, 0.1);
  border-color: var(--mar-line);
}

.vt-layer__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.vt-layer__check {
  width: 8px;
  height: 8px;
  margin-left: auto;
  border: 1px solid var(--mar-text-faint);
  border-radius: 2px;
  flex-shrink: 0;
}

.vt-layer__check.is-on {
  background: var(--mar-accent);
  border-color: var(--mar-accent);
  box-shadow: 0 0 6px rgba(56, 198, 255, 0.55);
}

.vt-field {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.vt-field__label {
  color: var(--mar-text-dim);
  font-size: 12px;
  flex-shrink: 0;
}

.vt-segment {
  display: flex;
  gap: 4px;
}

.vt-segment__item {
  min-width: 38px;
  height: 26px;
  padding: 0 8px;
  color: var(--mar-text-dim);
  font-size: 12px;
  cursor: pointer;
  background: rgba(13, 34, 58, 0.5);
  border: 1px solid var(--mar-line-soft);
  border-radius: 4px;
}

.vt-segment__item:hover {
  color: var(--mar-text);
}

.vt-segment__item.is-active {
  color: var(--mar-accent);
  border-color: rgba(56, 198, 255, 0.6);
  background: rgba(56, 198, 255, 0.14);
}

.vt-action {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 32px;
  padding: 0 10px;
  color: var(--mar-text-dim);
  font-size: 12px;
  cursor: pointer;
  background: rgba(13, 34, 58, 0.5);
  border: 1px solid var(--mar-line-soft);
  border-radius: 4px;
}

.vt-action:hover:not(:disabled) {
  color: var(--mar-text);
  border-color: var(--mar-line);
  background: rgba(56, 198, 255, 0.08);
}

.vt-action.is-active {
  color: var(--mar-accent);
  border-color: rgba(56, 198, 255, 0.6);
  background: rgba(56, 198, 255, 0.12);
}

.vt-action:disabled {
  color: var(--mar-text-faint);
  cursor: not-allowed;
  opacity: 0.6;
}

.vt-action .el-icon {
  font-size: 15px;
  flex-shrink: 0;
}

.vt-readout {
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 9px 10px;
  background: rgba(4, 13, 25, 0.7);
  border: 1px solid var(--mar-line-soft);
  border-radius: 4px;
}

.vt-readout__label {
  color: var(--mar-text-faint);
  font-size: 11px;
}

.vt-readout strong {
  color: var(--mar-accent-2);
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.3px;
  word-break: break-all;
}

.vt-readout__actions {
  display: flex;
  gap: 6px;
  margin-top: 2px;
}

.vt-mini-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  height: 26px;
  padding: 0 8px;
  color: var(--mar-text-dim);
  font-size: 12px;
  cursor: pointer;
  background: rgba(13, 34, 58, 0.5);
  border: 1px solid var(--mar-line-soft);
  border-radius: 4px;
}

.vt-mini-btn:hover:not(:disabled) {
  color: var(--mar-text);
  border-color: var(--mar-line);
}

.vt-mini-btn:disabled {
  color: var(--mar-text-faint);
  cursor: not-allowed;
  opacity: 0.5;
}

.vt-foot {
  padding-top: 8px;
  border-top: 1px solid var(--mar-line-soft);
}

.vt-foot__hint {
  color: var(--mar-text-faint);
  font-size: 11px;
}
</style>
