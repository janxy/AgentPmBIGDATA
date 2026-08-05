<template>
  <aside class="vt-panel" aria-label="视图工具">
    <header class="vt-head">
      <h2>视图工具</h2>
      <span>海图操作</span>
    </header>

    <section class="vt-group">
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

  </aside>
</template>

<script setup lang="ts">
/**
 * 海图右侧视图工具：复位视角、坐标拾取、测距与全屏。
 */
import { computed } from 'vue'
import { ElMessage } from 'element-plus'
import 'element-plus/es/components/message/style/css'
import { Aim, Coordinate, FullScreen, Odometer, RefreshLeft } from '@element-plus/icons-vue'
import { useMaritimeMapViewStore } from '@/stores/maritimeMapView'
import { useMaritimeScreen } from '@/composables/useMaritimeScreen'

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

</style>
